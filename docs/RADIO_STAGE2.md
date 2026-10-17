# Radio 2.0 — Stage 2

## Included
- Administrator-only media library with private audio storage (`RADIO_ASSET_DIR`, default `private/radio-audio`).
- 30 MiB per upload; MP3, WAV, OGG, FLAC, M4A; file-header sanity check and server-side duration extraction via **ffprobe**.
- Ordered playlists with immutable approved state; scheduled playlists cannot be edited.
- One-off broadcasting schedule with server-side no-overlap check and duration calculated from the actual assets.
- A responsive radio workspace at `/app/radio`.
- Server routes protected by `auth, requireRole('ADMIN')`.

## Deployment prerequisites
1. Ensure `ffprobe` is installed and available to the server process (`ffmpeg` tools).
2. Ensure `RADIO_ASSET_DIR` exists or is creatable and is on backed-up private storage.
3. Apply migration `20261017080000_radio_stage2` via the repository migration deployment process and generate the Prisma client.
4. Run server tests and client build before merging. Preview may require a separate migration step, per existing preview runbook.
5. Do **not** expose private radio files via generic `/uploads`.

## Safety
No Windows Radio Agent, ESP32, relay, live-stream or emergency broadcast commands are implemented. Planning a show does not cause playback. Mandatory emergency messaging must not rely on this module.

## Known limits / next stage
- Only single-occurrence slots; recurrence templates and calendar views to follow.
- Schedule times are submitted as an ISO UTC instant from the browser's local datetime input. Before automatic playout, station timezone and daylight-saving rules must be fixed in station settings.
- Client audio preview uses an authenticated blob fetch; very long files should eventually use authenticated streaming/range support.
- The generated audio metadata has not yet been independently checked in a running instance.
- There is currently no local Windows client and no amp-ready handshake.

## Ubuntu Server 24.04 + aaPanel: пошаговая подготовка

**Выполняйте команды по SSH на сервере Ubuntu 24.04.** aaPanel остаётся менеджером сайта; `ffprobe` — отдельная системная утилита из пакета `ffmpeg`, её не нужно устанавливать как PHP-extension или npm-модуль.

### Шаг 1. Проверка существующих инструментов

```bash
cat /etc/os-release
command -v ffprobe || true
ffprobe -version | head -n 2 || true
command -v ffmpeg || true
```

Если `ffprobe` отсутствует:

```bash
sudo apt update
sudo apt install -y ffmpeg
/usr/bin/ffprobe -version | head -n 2
```

Примечание: команда `apt install` не заменяет Node.js, PostgreSQL, Prisma или настройки сайта в aaPanel. Путь к `ffprobe` должен быть доступен процессу Node.js, запускаемому через systemd.

### Шаг 2. Установите фактические пути и пользователя сервиса

```bash
sudo systemctl cat mediaraf-api.service
sudo systemctl show mediaraf-api.service -p User -p Group -p WorkingDirectory -p ExecStart
```

Сверьте `WorkingDirectory`, фактического пользователя и каталог проекта. **Не копируйте слепо примеры путей или пользователей** — они могут отличаться в вашей установке. Проверить доступ к `ffprobe` от имени сервисного пользователя (если указан `User=`):

```bash
sudo -u ACTUAL_SERVICE_USER /usr/bin/ffprobe -version | head -n 2
```

Замените `ACTUAL_SERVICE_USER` на пользователя из `systemctl show`. Если systemd не указывает `User`, уточните реального пользователя процесса прежде, чем менять владельца каталогов.

### Шаг 3. Каталог для аудиозаписей

Серверный код использует `RADIO_ASSET_DIR` или по умолчанию относительный `private/radio-audio`. Рекомендуется **абсолютный путь**, например `/var/lib/mediaraf-radio/audio`, чтобы изменение рабочего каталога не поменяло расположение файлов.

```bash
sudo install -d -m 700 -o ACTUAL_SERVICE_USER -g ACTUAL_SERVICE_GROUP /var/lib/mediaraf-radio/audio
sudo ls -ld /var/lib/mediaraf-radio/audio
```

Замените плейсхолдеры фактическими значениями из service unit. Для systemd задайте переменную окружения в существующем безопасном механизме конфигурации (`EnvironmentFile` или systemd drop-in), например:

```ini
[Service]
Environment=RADIO_ASSET_DIR=/var/lib/mediaraf-radio/audio
```

После изменения unit:
```bash
sudo systemctl daemon-reload
sudo systemctl restart mediaraf-api.service
sudo systemctl status mediaraf-api.service --no-pager
```

**Важно:** не перезапускайте production до готовности к деплою и резервной копии. Каталог находится вне публичного document root aaPanel (`/www/wwwroot/...`) и должен включаться в резервное копирование аудиобиблиотеки отдельно от БД. Не открывайте к нему доступ через nginx static location.

### Шаг 4. Prisma и развёртывание

После review и merge PR, на production используйте **существующий проверенный скрипт развёртывания**, который делает backup и `prisma migrate deploy` — не запускайте параллельно самостоятельную миграцию из aaPanel. Если запускаете деплой вручную, следуйте основному `README.md` и `scripts/deploy.sh`, предварительно проверив текущее состояние рабочей директории:

```bash
git status --short
git branch --show-current
```

Только после успешного резервного копирования и с учётом порядка шагов вашего деплоя применяются:

```bash
cd /ABSOLUTE/PATH/TO/PROJECT/server
npx prisma generate
npx prisma migrate deploy
```

`/ABSOLUTE/PATH/TO/PROJECT` — пример, не реальный путь. **Не выполнять эти команды раньше запланированного деплоя**. Учитывайте, что preview изолирован и имеет собственный runbook (`docs/PREVIEW_DEPLOY.md`).

### Шаг 5. Проверки после деплоя

```bash
sudo systemctl is-active mediaraf-api.service
sudo journalctl -u mediaraf-api.service -n 100 --no-pager
```

Откройте `/app/radio` под администратором, загрузите короткий тестовый MP3/WAV, создайте плейлист и задайте будущий слот. Проверьте отказ в доступе по `/api/radio/*` для учётной записи STUDENT. Тестовый эфир **не должен** включать усилитель — аппаратная интеграция отсутствует.

### Замечания по эксплуатации

- Ограничение загрузки в этом этапе — 30 MiB на файл. Если aaPanel/nginx перед API ограничивает размер POST, при получении HTTP 413 проверьте `client_max_body_size` **именно для API vhost** и ставьте минимально достаточный лимит (например, `35m`), не меняя глобальный лимит без необходимости.
- Убедитесь, что директория `RADIO_ASSET_DIR` не доступна напрямую из интернета.
- Серверный `ffprobe` выполняется с timeout; проверяйте ресурсные лимиты и журнал.
- При любых проблемах с подготовкой эфира верните работающий процесс без переключения силовой части, ESP32 или аварийного оповещения.
