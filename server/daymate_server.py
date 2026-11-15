#!/usr/bin/env python3
"""
Сервер совместных данных DayMate.

Один файл, только стандартная библиотека Python 3.8+, база — SQLite.
Хранит только то, чем двое пользователей решили делиться: заметки на день,
планы и желания, а также календарь цикла — если его владелец включил общий доступ.
Лекарства, расписание и привычки на сервер не попадают.

Запуск:  DAYMATE_DB=/var/lib/daymate/daymate.db python3 daymate_server.py
Слушает 127.0.0.1:8787; наружу его выставляет обратный прокси с HTTPS (см. README.md).
"""
import hashlib
import json
import os
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB_PATH = os.environ.get("DAYMATE_DB", "daymate.db")
HOST = os.environ.get("DAYMATE_HOST", "127.0.0.1")
PORT = int(os.environ.get("DAYMATE_PORT", "8787"))

MAX_BODY = 512 * 1024
MAX_CHANGES = 200
MAX_PAYLOAD = 8 * 1024
MAX_ITEMS_PER_SPACE = 20000
CODE_TTL = 15 * 60
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # без похожих символов
ITEM_TYPES = ("note", "plan", "cycle")

LOCK = threading.Lock()
RATE = {}  # (ключ, окно) -> счётчик


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    folder = os.path.dirname(os.path.abspath(DB_PATH))
    os.makedirs(folder, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                space_id TEXT, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS codes (
                code TEXT PRIMARY KEY, space_id TEXT NOT NULL, expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS items (
                space_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL, date TEXT,
                payload TEXT NOT NULL, author_id TEXT NOT NULL, updated_at TEXT NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL,
                PRIMARY KEY (space_id, id)
            );
            CREATE INDEX IF NOT EXISTS items_seq ON items (space_id, seq);
            CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
            INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
            """
        )


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def rate_limit(key, limit, window):
    """Не больше limit событий за window секунд на один ключ."""
    bucket = (key, int(time.time() // window))
    with LOCK:
        if len(RATE) > 10000:
            RATE.clear()
        RATE[bucket] = RATE.get(bucket, 0) + 1
        if RATE[bucket] > limit:
            raise ApiError(429, "Слишком много попыток. Подождите и попробуйте снова.")


def clean_name(value):
    name = str(value or "").strip()[:40]
    if not name:
        raise ApiError(400, "Укажите имя.")
    return name


def next_seq(conn):
    conn.execute("UPDATE meta SET value = value + 1 WHERE key = 'seq'")
    return conn.execute("SELECT value FROM meta WHERE key = 'seq'").fetchone()[0]


def space_info(conn, space_id):
    if not space_id:
        return None
    members = conn.execute("SELECT id, name FROM users WHERE space_id = ? ORDER BY created_at", (space_id,)).fetchall()
    return {"id": space_id, "members": [{"id": m["id"], "name": m["name"]} for m in members]}


def drop_space_if_empty(conn, space_id):
    if conn.execute("SELECT 1 FROM users WHERE space_id = ?", (space_id,)).fetchone() is None:
        conn.execute("DELETE FROM items WHERE space_id = ?", (space_id,))
        conn.execute("DELETE FROM codes WHERE space_id = ?", (space_id,))


def leave_space(conn, user):
    """Выход из пары: календарь цикла уходящего стирается, общие заметки и планы остаются партнёру."""
    space_id = user["space_id"]
    if not space_id:
        return
    conn.execute(
        "UPDATE items SET payload = '{}', deleted = 1, seq = ?, updated_at = ? WHERE space_id = ? AND id = ?",
        (next_seq(conn), now_iso(), space_id, "cycle:" + user["id"]),
    )
    conn.execute("UPDATE users SET space_id = NULL WHERE id = ?", (user["id"],))
    drop_space_if_empty(conn, space_id)


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------- обработчики ----------

def register(conn, _user, body, ip):
    rate_limit("register:" + ip, 20, 3600)
    token = secrets.token_urlsafe(32)
    user_id = secrets.token_hex(8)
    conn.execute(
        "INSERT INTO users (id, token_hash, name, created_at) VALUES (?, ?, ?, ?)",
        (user_id, hash_token(token), clean_name(body.get("name")), int(time.time())),
    )
    return {"userId": user_id, "token": token}


def profile(conn, user, body, _ip):
    conn.execute("UPDATE users SET name = ? WHERE id = ?", (clean_name(body.get("name")), user["id"]))
    return {"ok": True}


def pair_create(conn, user, _body, _ip):
    rate_limit("code:" + user["id"], 20, 3600)
    space_id = user["space_id"]
    if space_id:
        if conn.execute("SELECT COUNT(*) FROM users WHERE space_id = ?", (space_id,)).fetchone()[0] >= 2:
            raise ApiError(409, "Вы уже в паре. Сначала разорвите текущую.")
    else:
        space_id = secrets.token_hex(8)
        conn.execute("UPDATE users SET space_id = ? WHERE id = ?", (space_id, user["id"]))
    conn.execute("DELETE FROM codes WHERE space_id = ? OR expires_at < ?", (space_id, int(time.time())))
    code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
    expires = int(time.time()) + CODE_TTL
    conn.execute("INSERT INTO codes (code, space_id, expires_at) VALUES (?, ?, ?)", (code, space_id, expires))
    return {"code": code, "expiresAt": expires, "space": space_info(conn, space_id)}


def pair_join(conn, user, body, _ip):
    rate_limit("join:" + user["id"], 10, 3600)
    code = "".join(ch for ch in str(body.get("code", "")).upper() if ch.isalnum())
    row = conn.execute("SELECT space_id FROM codes WHERE code = ? AND expires_at >= ?", (code, int(time.time()))).fetchone()
    if row is None:
        raise ApiError(404, "Код не найден или устарел. Попросите новый.")
    space_id = row["space_id"]
    if user["space_id"] == space_id:
        raise ApiError(409, "Это ваш собственный код — его должен ввести второй человек.")
    if conn.execute("SELECT COUNT(*) FROM users WHERE space_id = ?", (space_id,)).fetchone()[0] >= 2:
        raise ApiError(409, "В этой паре уже два участника.")
    leave_space(conn, user)
    conn.execute("UPDATE users SET space_id = ? WHERE id = ?", (space_id, user["id"]))
    conn.execute("DELETE FROM codes WHERE code = ?", (code,))
    return {"space": space_info(conn, space_id)}


def pair_leave(conn, user, _body, _ip):
    leave_space(conn, user)
    return {"ok": True}


def account_delete(conn, user, _body, _ip):
    leave_space(conn, user)
    conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return {"ok": True}


def sync(conn, user, body, _ip):
    space_id = user["space_id"]
    if not space_id:
        return {"space": None, "seq": 0, "items": []}

    changes = body.get("changes") or []
    if not isinstance(changes, list) or len(changes) > MAX_CHANGES:
        raise ApiError(400, "Слишком много изменений за один раз.")
    if changes:
        count = conn.execute("SELECT COUNT(*) FROM items WHERE space_id = ?", (space_id,)).fetchone()[0]
        if count + len(changes) > MAX_ITEMS_PER_SPACE:
            raise ApiError(413, "Достигнут предел количества записей.")
    for change in changes:
        if not isinstance(change, dict):
            raise ApiError(400, "Некорректная запись.")
        item_id = str(change.get("id", ""))
        item_type = change.get("type")
        payload = json.dumps(change.get("payload") or {}, ensure_ascii=False)
        date = change.get("date")
        if not item_id or len(item_id) > 100 or item_type not in ITEM_TYPES or len(payload.encode()) > MAX_PAYLOAD:
            raise ApiError(400, "Некорректная запись.")
        if date is not None and (not isinstance(date, str) or len(date) != 10):
            raise ApiError(400, "Некорректная дата.")
        # Календарь цикла может менять только его владелец.
        if (item_type == "cycle" or item_id.startswith("cycle:")) and item_id != "cycle:" + user["id"]:
            raise ApiError(403, "Чужой календарь цикла изменить нельзя.")
        existing = conn.execute("SELECT type FROM items WHERE space_id = ? AND id = ?", (space_id, item_id)).fetchone()
        if existing is not None and existing["type"] != item_type:
            raise ApiError(400, "Некорректная запись.")
        deleted = 1 if change.get("deleted") else 0
        conn.execute(
            """INSERT INTO items (space_id, id, type, date, payload, author_id, updated_at, deleted, seq)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (space_id, id) DO UPDATE SET date = excluded.date, payload = excluded.payload,
                   updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq""",
            (space_id, item_id, item_type, date, "{}" if deleted else payload, user["id"], now_iso(), deleted, next_seq(conn)),
        )

    since = body.get("since")
    since = since if isinstance(since, int) and since >= 0 else 0
    rows = conn.execute(
        "SELECT * FROM items WHERE space_id = ? AND seq > ? ORDER BY seq LIMIT 2000", (space_id, since)
    ).fetchall()
    items = [
        {
            "id": r["id"], "type": r["type"], "date": r["date"], "payload": json.loads(r["payload"]),
            "authorId": r["author_id"], "updatedAt": r["updated_at"], "deleted": bool(r["deleted"]), "seq": r["seq"],
        }
        for r in rows
    ]
    seq = items[-1]["seq"] if items else since
    return {"space": space_info(conn, space_id), "seq": seq, "items": items, "more": len(rows) == 2000}


ROUTES = {
    "/api/register": (register, False),
    "/api/profile": (profile, True),
    "/api/pair/create": (pair_create, True),
    "/api/pair/join": (pair_join, True),
    "/api/pair/leave": (pair_leave, True),
    "/api/account/delete": (account_delete, True),
    "/api/sync": (sync, True),
}


class Handler(BaseHTTPRequestHandler):
    server_version = "DayMate/1"
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass  # не пишем в журнал адреса и содержимое запросов

    def client_ip(self):
        ip = self.client_address[0]
        forwarded = self.headers.get("X-Forwarded-For")
        # Заголовку прокси верим, только если запрос пришёл с этой же машины.
        if forwarded and ip in ("127.0.0.1", "::1"):
            ip = forwarded.split(",")[-1].strip()
        return ip

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_cors()
        self.end_headers()
        self.wfile.write(raw)

    def send_cors(self):
        # Авторизация — по токену в заголовке, cookie не используются, поэтому любой источник допустим.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"ok": True, "service": "daymate"})
        else:
            self.send_json(404, {"error": "Не найдено."})

    def do_POST(self):
        try:
            route = ROUTES.get(self.path.split("?")[0])
            if route is None:
                raise ApiError(404, "Не найдено.")
            handler, needs_auth = route
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                self.close_connection = True
                raise ApiError(413, "Слишком большой запрос.")
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                raise ApiError(400, "Некорректный JSON.")
            if not isinstance(body, dict):
                raise ApiError(400, "Некорректный запрос.")

            ip = self.client_ip()
            rate_limit("ip:" + ip, 600, 60)
            with LOCK_DB:
                conn = db()
                try:
                    user = None
                    if needs_auth:
                        auth = self.headers.get("Authorization", "")
                        token = auth[7:] if auth.startswith("Bearer ") else ""
                        user = conn.execute("SELECT * FROM users WHERE token_hash = ?", (hash_token(token),)).fetchone() if token else None
                        if user is None:
                            raise ApiError(401, "Аккаунт не найден. Подключитесь заново.")
                    result = handler(conn, user, body, ip)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()
            self.send_json(200, result)
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "Ошибка сервера."})


LOCK_DB = threading.Lock()  # записи идут по одной: пользователей мало, зато нет гонок

if __name__ == "__main__":
    init_db()
    print(f"DayMate server: http://{HOST}:{PORT}  (база: {DB_PATH})", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
