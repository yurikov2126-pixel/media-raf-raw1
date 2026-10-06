# MEDIA·RAF·RAW

Студенческий медиацентр: платформа для обучения, общения и производства контента. Курсы, вики, чаты, практики с руководителями, геймификация, аналитика.

**Прод:** https://mediarafraw.ru  
**Стек:** React + Vite + Tailwind / Express + Prisma + PostgreSQL + Socket.io

---

## Что внутри

- **6 курсов** — фотография, видеосъёмка, монтаж, радиожурналистика, студийная и концертная звукорежиссура. Всего 74 урока, 18 практик, 24 домашних задания.
- **Вики «ВикиМедиа»** — база знаний по всем темам курсов + профессия, оборудование, терминология.
- **Практики с руководителем** — назначение даты, сдача, проверка, штрафы за просрочку.
- **Домашние задания** — текст + ссылка + файлы, проверка с оценкой и дедлайнами.
- **Чат и лента** — общение, посты, комментарии, реакции.
- **Геймификация** — XP, уровни, ежедневные квесты, достижения.
- **Уведомления** — push, WebSocket, in-app.
- **Аналитика** — воронка прохождения курсов, где отваливаются студенты.
- **Модерация** — жалобы, бан, удаление контента.
- **PWA** — установка на телефон, офлайн-доступ к урокам.
- **Админка** — пользователи, курсы, вики, рассылки, бэкапы, настройки.

---

## Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL 14+
- npm или yarn

### Установка

```bash
git clone <repo>
cd media-raf-raw

# Сервер
cd server
cp .env.example .env       # заполнить DATABASE_URL, JWT_SECRET и др.
npm install
npx prisma db push
npx prisma generate
node prisma/seed/index.js  # ⚠️ удаляет и пересоздаёт курсы/вики
npm run dev                # или: node src/index.js

# Клиент (в другом терминале)
cd ../client
cp .env.example .env
npm install
npm run dev
```

Сервер: `http://localhost:4000`  
Клиент: `http://localhost:5173`

---

## Продакшн

Прод разворачивается на Ubuntu-сервере через PM2 + Nginx. См. `DEPLOY.md`.

Кратко:

```bash
cd /www/wwwroot/mediarafraw.ru/server
git pull
npm install
npx prisma db push
npx prisma generate
pm2 restart mediaraf

cd ../client
git pull
npm install
npm run build
```

---

## Структура проекта

```
media-raf-raw/
├── client/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/          # страницы (Courses, CourseView, Messenger, Wiki, Admin…)
│   │   ├── components/     # переиспользуемые компоненты
│   │   ├── store/          # контексты (auth, settings, notifications, socket, modules, gamification)
│   │   ├── api/            # HTTP-клиент
│   │   ├── lib/            # утилиты (push, modalStack, …)
│   │   ├── styles/         # index.css, tailwind
│   │   ├── stickers/       # стикеры
│   │   └── App.jsx         # роутинг
│   ├── public/
│   └── vite.config.js
│
├── server/                 # Express + Prisma + Socket.io
│   ├── src/
│   │   ├── routes/         # API-роуты
│   │   ├── lib/            # бизнес-логика (courseLogic, courseAnalytics, notify, …)
│   │   ├── middleware/     # auth, requireRole
│   │   ├── socket.js       # WebSocket
│   │   └── index.js        # точка входа
│   ├── prisma/
│   │   ├── schema.prisma   # схема БД
│   │   └── seed/           # seed курсов и вики
│   └── uploads/            # статика (фото, видео, файлы)
│
└── docs/                   # скриншоты (опционально)
```

---

## Основные документы

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — как всё устроено.
- [`DATABASE.md`](./DATABASE.md) — модели Prisma и логика.
- [`COURSES.md`](./COURSES.md) — структура курсов и seed.
- [`WIKI.md`](./WIKI.md) — структура вики.
- [`API.md`](./API.md) — список эндпоинтов.
- [`ROADMAP.md`](./ROADMAP.md) — планы и статус.
- [`DEPLOY.md`](./DEPLOY.md) — деплой.
- [`DESIGN.md`](./DESIGN.md) — дизайн-система.
- [`CONTENT-GUIDE.md`](./CONTENT-GUIDE.md) — как писать уроки и статьи.

---

## Лицензия

Внутренний проект студенческого медиацентра. Все права принадлежат MEDIA·RAF·RAW.