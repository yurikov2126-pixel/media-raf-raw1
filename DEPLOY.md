# DEPLOY

Развёртывание и обновление прода.

## Прод-сервер

- **Домен:** https://mediarafraw.ru
- **ОС:** Ubuntu 22.04
- **Путь:** `/www/wwwroot/mediarafraw.ru/`
- **PM2:** процесс `mediaraf`
- **Nginx:** раздаёт `client/dist` + проксирует `/api` на `:4000`

## Требования

- Node.js 18+
- PostgreSQL 14+
- PM2 (`npm i -g pm2`)
- Nginx
- Git

## Переменные окружения

### `server/.env`

```
DATABASE_URL=postgresql://user:pass@localhost:5432/media_raf_raw
PORT=4000
JWT_SECRET=<длинный рандом>
CLIENT_URL=https://mediarafraw.ru

VAPID_PUBLIC_KEY=<для web push>
VAPID_PRIVATE_KEY=<для web push>
VAPID_SUBJECT=mailto:media@mrr.ru

# Опционально
DEADLINE_CRON=0 9 * * *
DRIP_CRON=0 8 * * *
```

### `client/.env`

```
VITE_API=https://mediarafraw.ru/api
VITE_VAPID_PUBLIC_KEY=<тот же, что на сервере>
```

## Первичная установка

```bash
# 1. Клонировать
cd /www/wwwroot
git clone <repo> mediarafraw.ru
cd mediarafraw.ru

# 2. Сервер
cd server
cp .env.example .env
nano .env  # заполнить переменные
npm install
npx prisma db push
npx prisma generate
node prisma/seed/index.js  # ⚠️ удалит курсы и создаст заново

# 3. Клиент
cd ../client
cp .env.example .env
nano .env
npm install
npm run build

# 4. Запуск
cd ../server
pm2 start src/index.js --name mediaraf
pm2 save
pm2 startup

# 5. Nginx
sudo nano /etc/nginx/sites-available/mediarafraw.ru
# проксирование /api → localhost:4000, /uploads → static, / → client/dist
sudo ln -s /etc/nginx/sites-available/mediarafraw.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Обновление

### Изменения на сервере

```bash
cd /www/wwwroot/mediarafraw.ru/server
git pull
npm install
npx prisma db push       # если менялась схема
npx prisma generate      # если менялась схема
pm2 restart mediaraf
pm2 logs mediaraf --lines 30
```

### Изменения на клиенте

```bash
cd /www/wwwroot/mediarafraw.ru/client
git pull
npm install
npm run build
# Nginx автоматически отдаст новый dist
```

### Изменения в seed

⚠️ **Внимание:** seed курсов удаляет все курсы и пересоздаёт.
Прогресс, сертификаты и enrollments теряются.

```bash
cd /www/wwwroot/mediarafraw.ru/server
node prisma/seed/index.js
```

Вики сидируется безопасно (upsert по slug).

## Бэкапы

### Ручной

```bash
cd /www/wwwroot/mediarafraw.ru/server/backups
pg_dump -U postgres -Fc media_raf_raw > backup-$(date +%Y%m%d-%H%M).dump
```

### Автоматический

Крон `startCron()` делает бэкап **каждый день в 03:00**.
Хранит 30 дней, потом удаляет.

### Восстановление

```bash
pg_restore -U postgres -d media_raf_raw --clean backup-20250101-0300.dump
pm2 restart mediaraf
```

Или через админку: `/app/admin?tab=backups`.

## Логи

```bash
pm2 logs mediaraf --lines 100      # последние 100 строк
pm2 logs mediaraf --lines 100 --err # только ошибки
pm2 flush                          # очистить
```

Логи PM2 лежат в `~/.pm2/logs/`.

## Очистка

В админке → `Server`:
- Очистить PM2 логи.
- Удалить старые бэкапы (> 30 дней).

## Nginx (пример конфига)

```nginx
server {
    listen 443 ssl http2;
    server_name mediarafraw.ru;

    ssl_certificate /etc/letsencrypt/live/mediarafraw.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mediarafraw.ru/privkey.pem;

    root /www/wwwroot/mediarafraw.ru/client/dist;
    index index.html;

    # SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 200M;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Uploads
    location /uploads/ {
        alias /www/wwwroot/mediarafraw.ru/server/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## Мониторинг

```bash
pm2 monit                         # интерактивный монитор
pm2 status                        # статус
pm2 describe mediaraf             # детали процесса
```

## Частые проблемы

### Сервер не запускается

```bash
pm2 logs mediaraf --lines 50
```

Смотрите ошибку. Обычно:
- Порт занят: `lsof -i :4000`.
- Prisma не сгенерирован: `npx prisma generate`.
- Неверный `DATABASE_URL`.

### 502 Bad Gateway

Nginx не видит бэкенд. Проверьте:
```bash
pm2 status
curl http://localhost:4000/api/health
```

### Пользователи не видят обновления

Service worker кэширует. Решение:
- Увеличить версию в `vite.config.js`.
- Пользователям — жёсткая перезагрузка (Ctrl+Shift+R).

### Prisma Client не видит новые модели

```bash
rm -rf node_modules/.prisma node_modules/@prisma/client
npx prisma generate
pm2 restart mediaraf
```