# MEDIA·RAF·RAW

> Платформа студенческого медиацентра · Radio Политех-FM

Внутренняя платформа для команды студенческого медиацентра: лента публикаций, мессенджер, образовательные курсы с практиками и домашними заданиями, база знаний, система сертификатов, геймификация и модерация. Работает как SPA + PWA с офлайн-режимом.

---

## 📑 Оглавление

- [Возможности](#-возможности)
- [Стек технологий](#-стек-технологий)
- [Архитектура](#-архитектура)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-переменные-окружения)
- [Структура проекта](#-структура-проекта)
- [Работа с базой данных](#-работа-с-базой-данных)
- [Seed курсов](#-seed-курсов)
- [API](#-api)
- [PWA и офлайн-режим](#-pwa-и-офлайн-режим)
- [Cron-задачи](#-cron-задачи)
- [Деплой](#-деплой)
- [Роли пользователей](#-роли-пользователей)
- [Скрипты](#-скрипты)

---

## ✨ Возможности

### Социальная часть
- **Лента публикаций** с медиа (фото/видео), реакциями и комментариями с вложенностью.
- **Профили пользователей**: аватар, обложка, био, соцсети, группа, направление, навыки.
- **Мессенджер** с личными и групповыми чатами, ответами, пересылками, реакциями, закреплёнными сообщениями, медиа, голосовыми с waveform, поиском, индикатором «печатает».

### Обучение
- **Курсы** с уроками, тестами и drip-режимом.
- **Практические занятия** с руководителем: тема, дата, длительность.
- **Домашние задания** с комбинированной сдачей (текст + ссылка + файлы).
- **Разблокировка уроков** по цепочке: следующий урок не откроется, пока практика не одобрена руководителем.
- **Сертификаты** с уникальным серийным номером, QR-кодом и PDF-экспортом.
- **Публичная проверка** сертификатов по ссылке `/verify/:serial`.

### База знаний
- **Wiki** с категориями, статьями, тегами, поиском, хлебными крошками.
- Полноценный markdown-редактор в админке с превью.

### Геймификация
- **XP и уровни** с настраиваемыми порогами.
- **Достижения** (редактируются через админку).
- **Ежедневные квесты** — индивидуальные для каждого студента.
- **Серии дней** (streak) с бонусами.
- **Лидерборд** по неделе и за всё время.
- **Уведомления** о level-up, достижениях и штрафах.

### Модерация
- **Жалобы** на посты, комментарии, сообщения, пользователей.
- **Автомодерация** при множественных жалобах.
- **Восстановление пароля** через код от администратора.

### Платформа
- **Модульная система** — разделы включаются/выключаются из админки.
- **Онбординг** — короткий тур для новых пользователей и при добавлении новых фич.
- **Тёмная и светлая** темы.
- **PWA** с офлайн-режимом, splash-экраном и push-уведомлениями.
- **Админ-панель** с полным управлением: пользователи, курсы, wiki, сертификаты, бэкапы, аналитика, пакетные операции.

---

## 🛠 Стек технологий

### Backend
| Технология | Назначение |
|---|---|
| **Node.js** (ESM) | Серверная среда |
| **Express** | HTTP-сервер |
| **Prisma** | ORM |
| **PostgreSQL** | Основная БД |
| **Socket.IO** | Реальное время (чаты, typing, уведомления) |
| **JWT + bcrypt** | Аутентификация |
| **Multer + Sharp** | Загрузка и обработка изображений |
| **ffmpeg** | Генерация waveform для голосовых |
| **node-cron** | Фоновые задачи |
| **web-push** | Push-уведомления |
| **pg_dump / pg_restore** | Резервное копирование |

### Frontend
| Технология | Назначение |
|---|---|
| **React 18** | UI |
| **Vite** | Сборка |
| **React Router** | Маршрутизация |
| **Tailwind CSS** | Стилизация |
| **Framer Motion** | Анимации (минимально) |
| **Socket.IO Client** | Реальное время |
| **Recharts** | Графики в админке |
| **react-easy-crop** | Обрезка изображений |
| **qrcode.react** | QR-коды сертификатов |
| **html-to-image + jsPDF** | PDF-экспорт сертификатов |
| **vite-plugin-pwa** | PWA и Service Worker |

---

## 🏗 Архитектура

```
┌─────────────────┐         ┌──────────────────┐
│   React SPA     │◄───────►│   Express API    │
│  (Vite build)   │  HTTP   │   + Socket.IO    │
│                 │◄───────►│                  │
│  · Router       │   WS    │  · JWT auth      │
│  · Contexts     │         │  · Prisma ORM    │
│  · PWA + SW     │         │  · Uploads       │
└─────────────────┘         └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │   PostgreSQL     │
                            │  + uploads/ на   │
                            │    диске         │
                            └──────────────────┘
```

**Ключевые принципы:**
- **Клиент и сервер разделены.** Клиент знает только `VITE_API` и `VITE_SOCKET`.
- **Аутентификация через JWT.** Токен хранится в `localStorage` (mrr_token). После смены пароля все старые токены инвалидируются через `passwordChangedAt`.
- **Prisma — единая точка работы с БД.** Все миграции через `prisma db push`.
- **Socket.IO** используется для чатов, typing-индикатора, уведомлений в реальном времени.
- **PWA** работает офлайн: precache HTML/JS/CSS, кеш `/uploads`, офлайн-экран при отсутствии сети.

---

## 🚀 Быстрый старт

### Требования

- **Node.js** ≥ 20
- **PostgreSQL** ≥ 14
- **ffmpeg** (для waveform голосовых)
- **pg_dump / pg_restore** (для бэкапов)

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/yurikov2126-pixel/media-raf-raw1.git
cd media-raf-raw1

# 2. Установить зависимости сервера
cd server
npm install

# 3. Установить зависимости клиента
cd ../client
npm install
```

### Настройка БД

```bash
# Создать базу (пример для Ubuntu)
sudo -u postgres psql <<'EOF'
CREATE DATABASE media_raf_raw
  WITH ENCODING='UTF8'
  LC_COLLATE='C.UTF-8'
  LC_CTYPE='C.UTF-8';
CREATE USER media_raf_raw WITH ENCRYPTED PASSWORD 'ваш_пароль';
GRANT ALL PRIVILEGES ON DATABASE media_raf_raw TO media_raf_raw;
\c media_raf_raw
GRANT ALL ON SCHEMA public TO media_raf_raw;
ALTER SCHEMA public OWNER TO media_raf_raw;
\q
EOF
```

### Переменные окружения

Создайте `server/.env`:

```env
DATABASE_URL="postgresql://media_raf_raw:пароль@localhost:5432/media_raf_raw?schema=public"
JWT_SECRET="сгенерируйте-через-openssl-rand-hex-32"
PUBLIC_URL="https://mediarafraw.ru"
PORT=4000

# Опционально:
# MRR_PG_DUMP_PATH=/www/server/pgsql/bin/pg_dump
# MRR_PG_RESTORE_PATH=/www/server/pgsql/bin/pg_restore
# FFMPEG_PATH=/usr/bin/ffmpeg
# PUSH_CLEANUP_CRON="0 4 * * *"
# NOTIFY_CLEANUP_CRON="30 4 * * *"
# PASSWORD_RESET_CLEANUP_CRON="45 4 * * *"
# GAMIFICATION_INACTIVITY_CRON="0 5 * * *"
```

Создайте `client/.env`:

```env
VITE_API="http://localhost:4000/api"
VITE_SOCKET="http://localhost:4000"
```

### Миграция и запуск

```bash
# 1. Применить схему Prisma
cd server
npx prisma db push
npx prisma generate

# 2. Запустить сервер (dev)
npm start

# 3. В отдельном терминале — клиент
cd ../client
npm run dev
```

Открыть **http://localhost:5173**

---

## 📁 Структура проекта

```
media-raf-raw1/
├── client/                          # React + Vite
│   ├── public/                      # Иконки, favicon, manifest
│   ├── src/
│   │   ├── api/                     # HTTP-клиент
│   │   │   └── client.js
│   │   ├── components/              # Компоненты
│   │   │   ├── messenger/           # Компоненты мессенджера
│   │   │   ├── Layout.jsx
│   │   │   ├── Avatar.jsx
│   │   │   ├── VoicePlayer.jsx
│   │   │   ├── ImageCropper.jsx
│   │   │   ├── ProfileEditor.jsx
│   │   │   └── ...
│   │   ├── hooks/                   # Кастомные хуки
│   │   │   ├── usePageMeta.js
│   │   │   ├── usePostDraft.js
│   │   │   ├── usePullToRefresh.js
│   │   │   └── useLocalStorage.js
│   │   ├── lib/                     # Утилиты
│   │   │   ├── modalStack.js
│   │   │   └── push.js
│   │   ├── pages/                   # Страницы
│   │   │   ├── Admin/               # Админ-панель (модульно)
│   │   │   ├── Feed.jsx
│   │   │   ├── Messenger.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Courses.jsx
│   │   │   ├── CourseView.jsx
│   │   │   ├── Certificate.jsx
│   │   │   ├── Wiki.jsx
│   │   │   └── ...
│   │   ├── store/                   # React-контексты
│   │   │   ├── auth.jsx
│   │   │   ├── socket.jsx
│   │   │   ├── notifications.jsx
│   │   │   ├── settings.jsx
│   │   │   ├── modules.jsx
│   │   │   ├── onboarding.jsx
│   │   │   ├── theme.jsx
│   │   │   ├── network.jsx
│   │   │   └── gamification.jsx
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── sw.js                    # Service Worker (injectManifest)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                          # Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed/                    # Seed курсов
│   │       ├── index.js
│   │       ├── helpers.js
│   │       └── courses/
│   │           ├── photography.js
│   │           ├── videography.js
│   │           ├── editing.js
│   │           ├── radio.js
│   │           ├── studio-sound.js
│   │           └── live-sound.js
│   ├── src/
│   │   ├── lib/                     # Внутренние модули
│   │   │   ├── prisma.js
│   │   │   ├── notify.js
│   │   │   ├── push.js
│   │   │   ├── backup.js
│   │   │   ├── dbMaintenance.js
│   │   │   ├── chatCleanup.js
│   │   │   ├── analytics.js
│   │   │   ├── bulkActions.js
│   │   │   ├── serverInfo.js
│   │   │   ├── moderation.js
│   │   │   ├── passwordReset.js
│   │   │   ├── passwordResetCron.js
│   │   │   ├── pushCleanup.js
│   │   │   ├── pushCleanupCron.js
│   │   │   ├── notifyCleanup.js
│   │   │   ├── notifyCleanupCron.js
│   │   │   ├── gamification.js
│   │   │   ├── gamificationCatalog.js
│   │   │   ├── gamificationSettings.js
│   │   │   ├── gamificationCron.js
│   │   │   ├── courseLogic.js
│   │   │   └── audioPeaks.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/                  # HTTP-роуты
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── posts.js
│   │   │   ├── chats.js
│   │   │   ├── uploads.js
│   │   │   ├── courses.js
│   │   │   ├── practicals.js
│   │   │   ├── homework.js
│   │   │   ├── wiki.js
│   │   │   ├── notifications.js
│   │   │   ├── reports.js
│   │   │   ├── modules.js
│   │   │   ├── onboarding.js
│   │   │   ├── gamification.js
│   │   │   ├── publicMeta.js
│   │   │   └── admin.js
│   │   ├── socket.js                # Socket.IO обработчики
│   │   └── index.js                 # Точка входа
│   ├── uploads/                     # Загруженные файлы
│   ├── backups/                     # Дампы БД
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🗄 Работа с базой данных

Проект использует **PostgreSQL** и **Prisma ORM**.

### Основные команды

```bash
cd server

# Синхронизировать схему с БД (без миграций, безопасно)
npx prisma db push

# Пересобрать Prisma Client (обязательно после изменения схемы)
npx prisma generate

# Открыть Prisma Studio (веб-интерфейс для БД)
npx prisma studio

# Проверить схему без изменений
npx prisma validate
```

### Важно

- Проект **не использует `prisma migrate`** — все изменения схемы применяются через `db push`.
- После изменения `schema.prisma` **обязательно** запустить `npx prisma generate` и **полностью перезапустить** Node-процесс, чтобы Prisma Client подхватил новые модели.
- `pm2 restart all` **не всегда достаточно** — используйте `pm2 delete all && pm2 start src/index.js --name mediaraf`.

### Модели БД (обзор)

| Группа | Модели |
|---|---|
| Пользователи | `User`, `PushSubscription` |
| Соцсеть | `Post`, `Comment`, `PostReaction` |
| Мессенджер | `Chat`, `ChatMember`, `Message`, `Reaction` |
| Курсы | `Course`, `Lesson`, `Test`, `Question`, `TestAttempt`, `Enrollment`, `LessonProgress`, `Certificate` |
| Практики и ДЗ | `PracticalWork`, `PracticalSubmission`, `Homework`, `HomeworkSubmission` |
| Wiki | `WikiCategory`, `WikiArticle` |
| Система | `Notification`, `Setting`, `AdminAction` |
| Модерация | `Report` |
| Пароли | `PasswordResetRequest` |
| Геймификация | `UserStats`, `UserAchievement`, `XpLog`, `DailyQuest`, `QuestTemplate`, `Achievement` |

---

## 🌱 Seed курсов

Seed-скрипт удаляет все существующие курсы и создаёт заново с уроками, тестами, практиками и ДЗ.

```bash
cd server
node prisma/seed/index.js
```

### Внимание

- **Все курсы и связанные данные удаляются** (уроки, тесты, прогресс, сертификаты, практики, ДЗ).
- **Пользователи, посты, чаты и остальное сохраняются.**
- Для каждого курса создаётся своя структура: уроки, тесты (10–12 вопросов), практики с руководителем, ДЗ.

### Добавление нового курса

1. Создайте файл `server/prisma/seed/courses/название.js`:

```js
export const myCourse = {
    slug: 'moy-kurs',
    title: 'Мой курс',
    description: '...',
    category: 'photo',
    level: 'beginner',
    published: true,
    lessons: [
        {
            title: 'Урок 1',
            content: '...',
            order: 1,
            duration: 25,
            videoUrl: 'https://www.youtube.com/watch?v=XXXXX',
            test: {
                title: 'Тест к уроку',
                passScore: 70,
                questions: [
                    { type: 'single', text: '...', payload: { options: ['A', 'B'], correct: 0 } },
                    // ... всего 10-12 вопросов
                ],
            },
            // опционально:
            practical: {
                topic: 'Тема практики',
                description: 'Что делать',
                durationMin: 90,
            },
            homework: {
                title: 'Название ДЗ',
                description: 'Описание',
                maxFiles: 3,
            },
        },
    ],
};
```

2. Импортируйте его в `server/prisma/seed/index.js` и добавьте в массив `COURSES`.

---

## 🔌 API

Базовый URL: `VITE_API` (по умолчанию `http://localhost:4000/api`).

Все защищённые запросы требуют заголовок:
```
Authorization: Bearer <JWT>
```

### Основные роуты

| Роут | Описание |
|---|---|
| `POST /auth/register` | Регистрация |
| `POST /auth/login` | Вход |
| `GET /auth/me` | Текущий пользователь |
| `POST /auth/recover/request` | Запрос восстановления пароля |
| `POST /auth/recover/verify` | Смена пароля по коду |
| `GET /users` | Список пользователей |
| `GET /users/:username` | Профиль |
| `PATCH /users/me` | Обновить профиль |
| `GET /posts/feed` | Лента с пагинацией |
| `POST /posts` | Создать пост |
| `GET /chats` | Список чатов |
| `POST /uploads` | Загрузить файл |
| `GET /courses` | Список курсов |
| `GET /courses/:slug` | Курс с уроками, тестами, практиками |
| `POST /courses/:id/enroll` | Записаться на курс |
| `POST /courses/lessons/:lessonId/complete` | Отметить урок пройденным |
| `POST /courses/tests/:testId/submit` | Отправить тест |
| `POST /practicals/:practicalId/submit` | Сдать практику |
| `POST /practicals/submissions/:id/review` | Проверить практику (MENTOR/ADMIN) |
| `POST /practicals/unlock/:lessonId` | Принудительно разблокировать урок |
| `POST /homework/:homeworkId/submit` | Сдать ДЗ |
| `POST /homework/submissions/:id/review` | Проверить ДЗ (MENTOR/ADMIN) |
| `GET /wiki/categories` | Wiki: категории |
| `GET /wiki/articles` | Wiki: статьи |
| `GET /notifications` | Уведомления |
| `POST /reports` | Жалоба |
| `GET /modules` | Состояние модулей |
| `GET /gamification/me` | Статистика геймификации |
| `GET /gamification/quests` | Квесты на сегодня |
| `GET /gamification/leaderboard` | Лидерборд |
| `GET /admin/*` | Все админские роуты (требует role=ADMIN) |

### Socket.IO события

**Клиент → сервер:**
- `chat:join` — присоединиться к чату
- `message:send` — отправить сообщение
- `message:edit` — редактировать
- `message:delete` — удалить
- `reaction:toggle` — реакция на сообщение
- `typing` — индикатор печати

**Сервер → клиент:**
- `message:new` — новое сообщение
- `message:edited` — отредактировано
- `message:deleted` — удалено
- `reaction:update` — обновление реакций
- `typing` — кто-то печатает
- `user:online` / `user:offline` — статус пользователей
- `notification:new` — новое уведомление
- `chat:updated` — обновление чата

---

## 📱 PWA и офлайн-режим

### Что кешируется

- **HTML/JS/CSS** — precache через `vite-plugin-pwa` (injectManifest).
- **`/uploads/`** — стратегия `CacheFirst`, TTL 30 дней, до 200 записей.
- **`/api/`** — `NetworkOnly` (всегда свежие данные).

### Офлайн-поведение

- Splash-экран с логотипом.
- Если сессия сохранена, а сети нет — показывается **Offline-экран** с кнопкой «Повторить».
- Если приложение уже открыто и сеть пропала — **баннер** сверху с индикатором.

### Установка

На мобильном открыть сайт в браузере → «Поделиться» → **«Добавить на главный экран»**. Приложение откроется в standalone-режиме.

### Обновление

Service Worker обновляется автоматически (`registerType: 'autoUpdate'`). Пользователь получит новую версию при следующем запуске.

---

## ⏰ Cron-задачи

Все cron-задачи регистрируются в `server/src/index.js` при старте.

| Задача | Расписание | Что делает |
|---|---|---|
| Push cleanup | `0 4 * * *` | Удаляет неактивные push-подписки |
| Notify cleanup | `30 4 * * *` | Удаляет старые прочитанные уведомления |
| Password reset cleanup | `45 4 * * *` | Удаляет старые заявки на восстановление пароля |
| Gamification inactivity | `0 5 * * *` | Списывает XP у неактивных пользователей |

Расписание можно переопределить через переменные окружения (см. `.env`).

---

## 🚢 Деплой

### На aaPanel / Ubuntu (продакшен)

```bash
# 1. Установить Node.js ≥ 20, PostgreSQL, ffmpeg
sudo apt update
sudo apt install -y postgresql ffmpeg

# 2. Собрать клиент
cd /www/wwwroot/mediarafraw.ru/client
npm install
npm run build

# 3. Установить зависимости сервера
cd /www/wwwroot/mediarafraw.ru/server
npm install
npx prisma db push
npx prisma generate

# 4. Запустить через PM2
npm install -g pm2
pm2 start src/index.js --name mediaraf
pm2 save
pm2 startup
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name mediarafraw.ru;

    # SSL (пример)
    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # SPA (статика)
    root /www/wwwroot/mediarafraw.ru/client/dist;
    index index.html;

    # OG-теги для ботов (отдельно, до SPA)
    location ~ ^/(app/u/|app/certificates/|verify/|app/wiki/|app/courses/) {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Загруженные файлы
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Перезапуск после обновления

```bash
cd /www/wwwroot/mediarafraw.ru
git pull
cd client && npm install && npm run build
cd ../server && npm install && npx prisma db push && npx prisma generate
pm2 delete all
pm2 start src/index.js --name mediaraf
pm2 save
```

**Важно:** для применения изменений Prisma-схемы **обязательно** `pm2 delete`, а не `restart`.

---

## 👥 Роли пользователей

| Роль | Возможности |
|---|---|
| **STUDENT** | Обычный доступ: лента, чаты, курсы, wiki, геймификация |
| **MENTOR** | + проверка практик и ДЗ у своих студентов |
| **ADMIN** | Полный доступ: админ-панель, модерация, все настройки, принудительная разблокировка уроков |

---

## 📜 Скрипты

### Server (`server/package.json`)

```json
{
  "scripts": {
    "start": "node src/index.js",
    "seed": "node prisma/seed/index.js"
  }
}
```

### Client (`client/package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## 🔐 Безопасность

- **JWT в `localStorage`** — уязвимо к XSS. Убедитесь, что весь пользовательский контент санитайзится.
- **`passwordChangedAt`** инвалидирует все старые токены при смене пароля.
- **Rate limit** на восстановление пароля (5 запросов / сутки).
- **Уникальные индексы** в БД на `username`, `phone`, `email`.
- **CORS** — настраивается на конкретный домен, а не `origin: true`.
- **Загружаемые файлы** — лимит 200 МБ, изображения сжимаются через `sharp` до 1920px.

---

## 🐛 Известные ограничения

- **SQLite не поддерживается** — только PostgreSQL. Для dev на Mac используйте `brew services start postgresql`.
- **ffmpeg** обязателен для генерации waveform голосовых. Без него используется fallback (хеш-based waveform).
- **`prisma migrate` не используется** — только `db push`. История миграций в проекте не ведётся.
- **PDF-экспорт сертификатов** работает на клиенте через `html-to-image` + `jsPDF`.

---

## 📄 Лицензия

Проект разработан для внутреннего использования студенческим медиацентром **MEDIA·RAF·RAW** (Radio Политех-FM). Не предназначен для публичного распространения без согласования с автором.

---

## 🙏 Благодарности

- Команда медиацентра MEDIA·RAF·RAW за тестирование и фидбэк.
- Сообщество разработчиков за открытые библиотеки, на которых построен проект.

---

**Made with ❤️ by MEDIA·RAF·RAW team**ы