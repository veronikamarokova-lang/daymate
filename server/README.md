# Сервер совместных данных DayMate

Один файл `daymate_server.py`, нужен только Python 3.8+ (без дополнительных пакетов). База — SQLite.

На сервере хранятся только общие записи пары: заметки на день, планы и желания, а также календарь цикла,
если его владелец включил общий доступ. Лекарства, расписание и привычки на сервер не передаются.

## Проверка на своём компьютере

```bash
python3 server/test_server.py                         # автоматическая проверка
DAYMATE_DB=./daymate.db python3 server/daymate_server.py   # запуск на http://127.0.0.1:8787
```

## Быстрая установка (Ubuntu/Debian, без домена)

Подходит, когда на сервер заходят по IP-адресу, а порт 443 занят другой программой.
Скрипт ставит сервер DayMate и Caddy, получает HTTPS-сертификат на IP-адрес и открывает порт 8443:

```bash
curl -fsSL https://raw.githubusercontent.com/veronikamarokova-lang/daymate/main/server/install.sh -o install.sh
bash install.sh
```

В конце скрипт печатает адрес вида `https://IP:8443` — его вводят оба пользователя в разделе «Вместе».
Порт 80 должен быть свободен: через него Let's Encrypt проверяет владение адресом.

## Ручная установка (Linux с systemd)


```bash
sudo useradd --system --home /var/lib/daymate --create-home daymate
sudo mkdir -p /opt/daymate
sudo cp daymate_server.py /opt/daymate/
sudo cp daymate.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daymate
curl http://127.0.0.1:8787/api/health        # должно ответить {"ok": true, ...}
```

Сервер слушает только `127.0.0.1:8787`. Наружу его нужно выставить через HTTPS: Android-приложение
не подключается к серверу без шифрования, а данные о здоровье по открытому каналу передавать нельзя.

### HTTPS

Нужен домен, направленный на сервер. Самый простой вариант — Caddy, он сам получает сертификат:

```
daymate.example.ru {
    reverse_proxy 127.0.0.1:8787
}
```

Если на сервере уже работает nginx, добавьте в него сайт с `proxy_pass http://127.0.0.1:8787;`
и заголовком `proxy_set_header X-Forwarded-For $remote_addr;`, сертификат — через certbot.

## Резервная копия

Вся база — файл `/var/lib/daymate/daymate.db`. Копия: `sqlite3 /var/lib/daymate/daymate.db ".backup backup.db"`.

## Что стоит знать

- Аккаунт привязан к устройству: пароля и почты нет. При переустановке приложения нужно подключиться и соединиться заново.
- Данные в базе не зашифрованы: их может прочитать тот, у кого есть доступ к серверу.
- Соединение — по одноразовому коду из 8 символов, который действует 15 минут; число попыток ввода ограничено.
