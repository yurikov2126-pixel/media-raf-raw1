# ARCHITECTURE

Общая архитектура платформы MEDIA·RAF·RAW.

## Схема

```
┌─────────────────────────────────────────────────────────────────┐
│                        Браузер (PWA)                             │
│  React + Vite + Tailwind + Service Worker + Socket.io-client    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    HTTPS (REST + WebSocket)
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Nginx (reverse proxy)                        │
│  - /api  → Express :4000                                        │
│  - /uploads → static                                            │
│  - /     → client/dist (SPA)                                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                  Express API :4000                              │
│  ┌───────────────┬───────────────┬────────────────────────┐    │
│  │  routes/      │  lib/         │  middleware/           │    │
│  │  auth, users, │  courseLogic, │  auth, requireRole     │    │
│  │  chats, posts,│  notify, push,│                        │    │
│  │  courses,     │  gamification,│                        │    │
│  │  practicals,  │  courseAnalytics,                       │    │
│  │  homework,    │  bulkActions, │                        │    │
│  │  admin,       │  deadlineCron,│                        │    │
│  │  wiki, …      │  dripCron, …  │                        │    │
│  └───────────────┴───────────────┴────────────────────────┘    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         Socket.io (WebSocket): чаты, уведомления          │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     Prisma ORM                                  │
│                     PostgreSQL                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Роли пользователя

| Роль | Возможности |
|------|-------------|
| `STUDENT` | Курсы, чаты, лента, вики, сдача практик и ДЗ |
| `MENTOR` | Всё то же + кабинет руководителя (проверка практик и ДЗ) |
| `ADMIN` | Всё то же + админка (пользователи, курсы, вики, рассылки, бэкапы) |

## Серверная часть

### Структура

```
server/src/
├── index.js           # точка входа, CORS, регистрация роутов, запуск кронов
├── socket.js          # Socket.io: комнаты user:<id>, chat:<id>
├── middleware/
│   └── auth.js        # auth, requireRole
├── routes/            # по файлу на группу эндпоинтов
│   ├── auth.js
│   ├── users.js
│   ├── chats.js
│   ├── posts.js
│   ├── courses.js
│   ├── practicals.js
│   ├── homework.js
│   ├── notifications.js
│   ├── wiki.js
│   ├── admin.js       # большой, разбит по секциям (курсы, вики, пуши, …)
│   ├── reports.js
│   ├── push.js
│   └── …
└── lib/               # бизнес-логика
    ├── prisma.js            # PrismaClient singleton
    ├── notify.js            # createNotification, notifyBroadcast
    ├── push.js              # web push
    ├── courseLogic.js       # computeAccess, getLessonStatuses
    ├── courseAnalytics.js   # воронка по курсам
    ├── gamification.js      # XP, уровни, квесты
    ├── gamificationCron.js  # крон ежедневных квестов
    ├── deadlineCron.js      # напоминания о дедлайнах
    ├── dripCron.js          # разблокировка drip-уроков по расписанию
    ├── bulkActions.js       # импорт/экспорт курсов
    ├── moderation.js        # жалобы
    ├── passwordReset.js     # восстановление пароля
    ├── passwordResetCron.js
    ├── backup.js            # pg_dump / restore
    ├── chatCleanup.js       # очистка после удаления пользователя
    ├── modules.js           # включение/выключение модулей
    └── …
```

### Ключевые сценарии

#### Прохождение курса

1. Студент записывается (`POST /courses/:slug/enroll`).
2. Открывает урок (`GET /courses/:slug` → `lessons[]` с `unlocked`).
3. Сдаёт тест (`POST /courses/tests/:id/submit`).
4. При успехе `LessonProgress.completedAt` фиксируется.
5. Если у урока есть практика — следующий урок **не откроется** до `PracticalSubmission.status = APPROVED`.
6. ДЗ не блокирует, но за просрочку — штраф к оценке.

Подробности — в `DATABASE.md` и `COURSES.md`.

#### Drip-режимы

| `dripMode` | Логика |
|------------|--------|
| `null` | Все уроки открыты сразу |
| `test` | Следующий урок открывается после сдачи теста (и практики) предыдущего |
| `test_weekly` | То же + не более N уроков в неделю (`weeklyLessonLimit`) |
| `schedule` | Урок N открывается через N × `dripInterval` дней от enrollment |

#### Уведомления

Типы уведомлений (см. `notify.js`):

| Тип | Когда | Кому |
|-----|-------|------|
| `message` | Новое сообщение в чате | Получателю |
| `mention` | Упоминание @username | Упомянутому |
| `post` | Новый пост | Подписчикам (если есть) |
| `certificate` | Выдача сертификата | Студенту |
| `system` | Системное / рассылка | По адресу |
| `report` | Жалоба | Админам |
| `password_reset` | Запрос сброса пароля | Админам |
| `lesson_new` | Новый урок в курсе | Всем записанным |
| `lesson_unlocked` | Открылся drip-урок | Студенту |
| `practical_scheduled` | Назначена дата практики | Всем записанным |
| `practical_due` | За 24 ч до практики | Кто не сдал |
| `homework_due` | За 24 ч до дедлайна ДЗ | Кто не сдал |
| `homework_overdue` | Просрочил ДЗ | Кто не сдал |

#### Кроны

Все кроны регистрируются в `src/index.js`:

```js
startCron();                    // автобэкап в 03:00
schedulePushCleanup();          // очистка push-подписок в 04:00
scheduleNotifyCleanup();        // очистка уведомлений в 04:30
schedulePasswordResetCleanup(); // очистка заявок в 04:45
scheduleInactivityCharge();     // списание XP за неактивность
scheduleDeadlineReminders();    // напоминания о дедлайнах в 09:00
scheduleDripUnlockNotifications(); // drip-уведомления в 08:00
```

## Клиентская часть

### Структура

```
client/src/
├── pages/
│   ├── Landing.jsx
│   ├── Login.jsx, Register.jsx
│   ├── Feed.jsx, Post.jsx
│   ├── Messenger.jsx       # чат
│   ├── Courses.jsx         # список курсов
│   ├── CourseView.jsx      # страница курса + урок + тест + практика + ДЗ
│   ├── Wiki.jsx            # список статей
│   ├── WikiArticle.jsx     # статья
│   ├── Notifications.jsx
│   ├── Profile.jsx
│   ├── MentorReviews.jsx   # кабинет руководителя
│   └── Admin/              # админка (папка)
│       ├── index.jsx
│       ├── constants.js
│       └── tabs/           # по вкладке на файл
├── components/
│   ├── MarkdownView.jsx    # единый рендер markdown (уроки, вики, описания)
│   ├── ImageViewer.jsx     # просмотрщик изображений
│   ├── FileUploader.jsx
│   ├── EnrollButton.jsx
│   ├── PracticalCard.jsx
│   ├── HomeworkCard.jsx
│   ├── NotificationBell.jsx
│   ├── Layout.jsx          # сайдбар + main
│   └── …
├── store/
│   ├── auth.jsx            # JWT, user
│   ├── settings.jsx        # брендинг, лендинг
│   ├── notifications.jsx
│   ├── socket.jsx
│   ├── modules.jsx         # вкл/выкл модулей
│   └── gamification.jsx
├── api/client.js           # fetch + resolveUrl + uploadFile
├── lib/
│   ├── push.js             # Web Push подписка
│   └── modalStack.js       # счётчик открытых модалок
└── App.jsx                 # роутинг react-router
```

### Стили

Tailwind + кастомные классы в `index.css`:

- `.card` — карточка
- `.btn-primary`, `.btn-ghost` — кнопки
- `.chip` — маленькая плашка
- `.input` — поле ввода
- `.mrr-md-content` — контейнер отрендеренного markdown

### PWA

- `vite-plugin-pwa` с `injectManifest`.
- `src/sw.js` — service worker с precache + runtime cache.
- Установка на телефон, офлайн-доступ к пройденным урокам.

### Socket.io

Комнаты:

- `user:<id>` — личные уведомления.
- `chat:<id>` — события чата.

События: `message:new`, `message:edited`, `message:deleted`, `reaction:update`, `typing`, `chat:pinned`, `chat:deleted`, `notification:new`.

## Коммуникация

- REST — для CRUD.
- WebSocket — для live-обновлений (сообщения, typing, уведомления).
- Push — для офлайн-сценариев (вкладка закрыта).

## Безопасность

- JWT в `Authorization: Bearer`.
- `requireRole('ADMIN')` для админских роутов.
- Prisma-параметры (нет SQL-инъекций).
- XSS: `MarkdownView` экранирует HTML.
- CORS: только `CLIENT_URL` (env) или все (dev).
- Rate limiting — не реализован (нужно добавить).