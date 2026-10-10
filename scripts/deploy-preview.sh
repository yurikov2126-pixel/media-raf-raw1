#!/usr/bin/env bash
# Preview-only deploy. Never writes to production.
set -euo pipefail

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
git merge --ff-only "origin/$BRANCH"

# Require the committed preview guard before any service restart.
grep -q "process.env.PREVIEW_MODE !== 'true'" server/src/index.js || {
  echo "Missing committed preview background-job guard" >&2; exit 1;
}
grep -q "process.env.PREVIEW_MODE === 'true'" server/src/lib/push.js || {
  echo "Missing committed preview push guard" >&2; exit 1;
}

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
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"
curl --fail --silent --show-error http://127.0.0.1:4001/api/health
echo "Preview deployed successfully"
