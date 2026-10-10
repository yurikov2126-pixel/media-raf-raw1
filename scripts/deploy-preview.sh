#!/usr/bin/env bash
# Preview-only deploy. Never writes to production.
set -euo pipefail
export PATH="/www/server/nodejs/v24.21.0/bin:/www/server/pgsql/bin:$PATH"
umask 077

# Prevent overlapping timer/manual deployments.
exec 9>/home/mediaraf-deploy/preview-deploy.lock
flock -n 9 || { echo "Preview deployment already running"; exit 0; }

ROOT=/www/wwwroot/mediaraf-preview
BRANCH=feature/editorial-student-navigation
SERVICE=mediaraf-preview
cd "$ROOT"

# Fail closed on dirty tracked files: do not overwrite server-local changes.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ERROR: preview has modified tracked files. Reconcile them before deploy." >&2
  git status --short
  exit 1
fi
if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "ERROR: wrong preview branch" >&2
  exit 1
fi

# Read only the explicitly allowed settings (never print secrets).
[[ -f server/.env ]] || { echo "Missing preview .env" >&2; exit 1; }
grep -qx 'PREVIEW_MODE=true' server/.env || { echo "PREVIEW_MODE must be true" >&2; exit 1; }
grep -qx 'PORT=4001' server/.env || { echo "PORT must be 4001" >&2; exit 1; }
DB_URL="$(sed -n 's/^DATABASE_URL=//p' server/.env | tail -n1)"
DB_URL="${DB_URL%\"}"; DB_URL="${DB_URL#\"}"
[[ -n "$DB_URL" ]] || { echo "DATABASE_URL missing" >&2; exit 1; }
# Verify DB name from URI path, without revealing credentials.
DB_NAME="${DB_URL%%\?*}"
DB_NAME="${DB_NAME##*/}"
[[ "$DB_NAME" == "mediaraf_preview" ]] || { echo "Refusing to deploy to non-preview database" >&2; exit 1; }
unset DB_URL DB_NAME

git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$BRANCH")" ]] &&
   systemctl is-active --quiet "$SERVICE"; then
  echo "Preview is up to date"
  exit 0
fi
# Verify safety guards in the incoming commit before checking it out.
TARGET="origin/$BRANCH"
git show "$TARGET:server/src/index.js" | grep -F "process.env.PREVIEW_MODE !== 'true'" >/dev/null || {
  echo "Incoming commit lacks background-job guard" >&2; exit 1;
}
git show "$TARGET:server/src/lib/push.js" | grep -F "process.env.PREVIEW_MODE === 'true'" >/dev/null || {
  echo "Incoming commit lacks push guard" >&2; exit 1;
}

# Back up only the preview database before changing code or applying migrations.
BACKUP_DIR=/home/mediaraf-deploy/backups
[[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]] || {
  echo "Preview backup directory unavailable" >&2; exit 1;
}
BACKUP_FILE="$BACKUP_DIR/preview-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
# Fixed database/user/host; never pass credentials on the command line.
if ! PGCONNECT_TIMEOUT=10 pg_dump -h 127.0.0.1 -p 5432 -U mediaraf_preview \
  -d mediaraf_preview -Fc -f "$BACKUP_FILE"; then
  rm -f "$BACKUP_FILE"
  echo "Preview backup failed; deployment aborted" >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" >/dev/null
echo "Preview backup verified"

git merge --ff-only "$TARGET"

(
  cd server
  npm ci
  npx prisma generate
  npx prisma migrate deploy
)
(
  cd client
  npm ci
  VITE_API=/api VITE_SOCKET=https://preview.mediarafraw.ru npm run build
)
sudo -n /usr/bin/systemctl restart mediaraf-preview.service
sleep 3
systemctl is-active --quiet "$SERVICE"
curl --fail --silent --show-error http://127.0.0.1:4001/api/health
echo "Preview deployed successfully"
