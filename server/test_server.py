"""Проверка сервера: python3 test_server.py (поднимает сервер на временной базе)."""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error

tmp = tempfile.mkdtemp()
env = dict(os.environ, DAYMATE_DB=os.path.join(tmp, "t.db"), DAYMATE_PORT="8799")
proc = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "daymate_server.py")], env=env, stdout=subprocess.DEVNULL)
BASE = "http://127.0.0.1:8799"

def call(path, body=None, token=None, method="POST"):
    req = urllib.request.Request(BASE + path, data=json.dumps(body or {}).encode() if method == "POST" else None, method=method)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", "Bearer " + token)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=5) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

try:
    for _ in range(50):
        try:
            if call("/api/health", method="GET")[0] == 200: break
        except Exception: time.sleep(0.1)
    a = call("/api/register", {"name": "Ника"})[1]; b = call("/api/register", {"name": "Аня"})[1]; c = call("/api/register", {"name": "Чужой"})[1]
    assert call("/api/sync", {}, "bad")[0] == 401
    assert call("/api/sync", {"since": 0}, a["token"])[1]["space"] is None
    code = call("/api/pair/create", {}, a["token"])[1]["code"]
    assert call("/api/pair/join", {"code": code}, a["token"])[0] == 409          # свой код
    assert call("/api/pair/join", {"code": "ZZZZZZZZ"}, b["token"])[0] == 404
    s, joined = call("/api/pair/join", {"code": code.lower()}, b["token"]); assert s == 200 and len(joined["space"]["members"]) == 2
    assert call("/api/pair/join", {"code": code}, c["token"])[0] == 404          # код одноразовый
    note = {"id": "n1", "type": "note", "date": "2026-11-16", "payload": {"text": "купить хлеб"}}
    s, r = call("/api/sync", {"since": 0, "changes": [note]}, a["token"]); assert s == 200 and r["items"][0]["authorId"] == a["userId"]
    s, r = call("/api/sync", {"since": 0}, b["token"]); assert r["items"][0]["payload"]["text"] == "купить хлеб"; seq = r["seq"]
    assert call("/api/sync", {"since": seq}, b["token"])[1]["items"] == []       # повторно ничего не приходит
    # чужой цикл менять нельзя, свой можно
    assert call("/api/sync", {"changes": [{"id": "cycle:" + a["userId"], "type": "cycle", "payload": {"days": []}}]}, b["token"])[0] == 403
    assert call("/api/sync", {"changes": [{"id": "cycle:" + b["userId"], "type": "cycle", "payload": {"days": ["2026-11-01"]}}]}, b["token"])[0] == 200
    # посторонний ничего не видит
    assert call("/api/sync", {"since": 0}, c["token"])[1]["space"] is None
    # удаление записи доходит до партнёра
    call("/api/sync", {"changes": [dict(note, deleted=True)]}, b["token"])
    r = call("/api/sync", {"since": seq}, a["token"])[1]; assert any(i["id"] == "n1" and i["deleted"] and i["payload"] == {} for i in r["items"])
    # некорректные данные
    assert call("/api/sync", {"changes": [{"id": "x", "type": "evil", "payload": {}}]}, a["token"])[0] == 400
    assert call("/api/sync", {"changes": [{"id": "x", "type": "note", "payload": {"t": "я" * 9000}}]}, a["token"])[0] == 400
    # выход из пары стирает календарь цикла уходящего
    assert call("/api/pair/leave", {}, b["token"])[0] == 200
    r = call("/api/sync", {"since": 0}, a["token"])[1]
    assert len(r["space"]["members"]) == 1 and any(i["id"] == "cycle:" + b["userId"] and i["deleted"] for i in r["items"])
    assert call("/api/account/delete", {}, a["token"])[0] == 200 and call("/api/sync", {}, a["token"])[0] == 401
    print("server tests: OK")
finally:
    proc.terminate()
