#!/usr/bin/env bash
# Установка сервера DayMate на Ubuntu/Debian, когда у сервера нет домена, а порт 443 занят.
# HTTPS-сертификат выдаётся прямо на IP-адрес (Let's Encrypt), сервер доступен на порту 8443.
# Запуск от root:  bash install.sh
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/veronikamarokova-lang/daymate/main/server"
HTTPS_PORT="${DAYMATE_HTTPS_PORT:-8443}"

[ "$(id -u)" = "0" ] || { echo "Запустите от root: sudo bash install.sh"; exit 1; }

echo "== 1/4. Сервер DayMate =="
id daymate >/dev/null 2>&1 || useradd --system --home /var/lib/daymate --create-home --shell /usr/sbin/nologin daymate
mkdir -p /opt/daymate /var/lib/daymate
chown daymate:daymate /var/lib/daymate
chmod 700 /var/lib/daymate
curl -fsSL "$REPO_RAW/daymate_server.py" -o /opt/daymate/daymate_server.py
curl -fsSL "$REPO_RAW/daymate.service" -o /etc/systemd/system/daymate.service
systemctl daemon-reload
systemctl enable daymate >/dev/null 2>&1
systemctl restart daymate
sleep 2
curl -fsS http://127.0.0.1:8787/api/health >/dev/null || { echo "Сервер DayMate не запустился: journalctl -u daymate -n 30"; exit 1; }
echo "Сервер DayMate работает."

echo "== 2/4. Caddy (HTTPS) =="
if ! command -v caddy >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
caddy version

echo "== 3/4. Настройка =="
IP="${DAYMATE_IP:-$(curl -4 -fsS --max-time 10 https://ifconfig.me || true)}"
case "$IP" in
  *[!0-9.]*|"") echo "Не удалось определить IP-адрес. Запустите так: DAYMATE_IP=ваш.ip.адрес bash install.sh"; exit 1 ;;
esac
if [ -s /etc/caddy/Caddyfile ] && ! grep -q "DayMate" /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup-$(date +%s)"
fi
cat > /etc/caddy/Caddyfile <<CADDY
# DayMate: HTTPS на IP-адресе. Порт 443 занят другой программой, поэтому используется $HTTPS_PORT.
{
	https_port $HTTPS_PORT
}

https://$IP:$HTTPS_PORT {
	tls {
		issuer acme {
			profile shortlived
			disable_tlsalpn_challenge
		}
	}
	reverse_proxy 127.0.0.1:8787
}
CADDY
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow "$HTTPS_PORT"/tcp >/dev/null
  echo "В ufw открыты порты 80 и $HTTPS_PORT."
fi
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy

echo "== 4/4. Проверка (ждём сертификат, до минуты) =="
for _ in $(seq 1 20); do
  if curl -fsS --max-time 5 "https://$IP:$HTTPS_PORT/api/health" >/dev/null 2>&1; then
    echo
    echo "ГОТОВО. Адрес сервера для приложения:"
    echo "    https://$IP:$HTTPS_PORT"
    exit 0
  fi
  sleep 3
done
echo
echo "Сервер установлен, но HTTPS пока не отвечает. Пришлите вывод этой команды:"
echo "    journalctl -u caddy -n 40 --no-pager"
exit 1
