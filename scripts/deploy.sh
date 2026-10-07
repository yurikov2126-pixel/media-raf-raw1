#!/usr/bin/env bash
#
# Deploy MEDIA-RAF-RAW to production.
# Запуск на сервере:
#   bash /www/wwwroot/mediarafraw.ru/scripts/deploy.sh
#
set -euo pipefail

REPO_DIR=/www/wwwroot/mediarafraw.ru
BACKUP_DIR=/root/db-backups
LOG_FILE=/var/log/mediaraf-deploy.log

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR"

# ─── 1. Проверка состояния репо ───
log "=== 1. Проверка состояния репо ==="
if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  log "❌ Есть незакоммиченные изменения в трекаемых файлах:"
  git status --short | tee -a "$LOG_FILE"
  exit 1
fi
log "OK: дерево чистое"

# ─── 2. Бэкап БД ───
log "=== 2. Бэкап БД ==="
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/mediaraf_$(date +%Y%m%d_%H%M%S).sql"
# Извлекаем URL из .env, убираем кавычки и Prisma-специфичный "?schema=..."
DB_URL=$(grep -E '^DATABASE_URL=' server/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*$//')

# Используем pg_dump от версии сервера (18), а не системный 16
# Приоритет: aaPanel pg_dump (18) → системные пути → дефолт
PG_DUMP_BIN=""
for candidate in \
  /www/server/pgsql/bin/pg_dump \
  /usr/lib/postgresql/18/bin/pg_dump \
  /usr/local/pgsql/bin/pg_dump \
  pg_dump
do
  if [ -x "$candidate" ] || command -v "$candidate" >/dev/null 2>&1; then
    # Проверим версию — должна быть 18.x
    ver=$("$candidate" --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
    if [ "$ver" = "18" ]; then
      PG_DUMP_BIN="$candidate"
      break
    fi
    # Запомним хоть что-то на случай, если 18 не найдётся
    [ -z "$PG_DUMP_BIN" ] && PG_DUMP_BIN="$candidate"
  fi
done

log "Используем pg_dump: $PG_DUMP_BIN ($($PG_DUMP_BIN --version))"
"$PG_DUMP_BIN" "$DB_URL" > "$BACKUP_FILE"
log "OK: дамп сохранён в $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ─── 3. Обновление кода ───
log "=== 3. git pull ==="
git pull origin main

# ─── 4. Сервер ───
log "=== 4. Server: зависимости и БД ==="
cd server
npm config set registry https://registry.npmjs.org/
npm ci
npx prisma generate
npx prisma db push --skip-generate

# ─── 5. Перезапуск API ───
log "=== 5. Перезапуск API ==="
systemctl restart mediaraf-api
sleep 3
systemctl is-active mediaraf-api
curl -fsS http://localhost:4000/api/health || { log "❌ API не отвечает"; exit 1; }

# ─── 6. Клиент ───
log "=== 6. Client: зависимости и сборка ==="
cd ../client
npm config set registry https://registry.npmjs.org/
npm ci
npm run build

# ─── 7. Публикация клиента ───
log "=== 7. Публикация клиента в корень ==="
cd ..
cp -r client/dist/. .
chown -R www:www index.html assets sw.js manifest.webmanifest registerSW.js workbox-*.js favicon*.png icon*.png icon*.svg apple-touch-icon.png 2>/dev/null || true
log "OK: клиент опубликован"

# ─── 8. Проверки ───
log "=== 8. Финальная проверка ==="
API_STATUS=$(curl -s http://localhost:4000/api/health)
log "API: $API_STATUS"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
log "Site (localhost): HTTP $HTTP_STATUS"

HTTP_STATUS_EXT=$(curl -s -o /dev/null -w "%{http_code}" https://mediarafraw.ru/ || echo "N/A")
log "Site (external): HTTP $HTTP_STATUS_EXT"

log "✅ Deploy finished successfully"