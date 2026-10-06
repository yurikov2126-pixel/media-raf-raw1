# API

Список эндпоинтов. Base URL: `/api`.

Аутентификация: `Authorization: Bearer <JWT>`.

---

## Auth

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/auth/register` | public | Регистрация |
| POST | `/auth/login` | public | Вход |
| POST | `/auth/logout` | auth | Выход |
| GET | `/auth/me` | auth | Текущий пользователь |
| POST | `/auth/refresh` | auth | Обновить токен |
| POST | `/auth/password-reset/request` | public | Заявка на сброс пароля |
| POST | `/auth/password-reset/verify` | public | Ввод кода + новый пароль |

## Users

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/users/:username` | auth | Профиль |
| PATCH | `/users/me` | auth | Обновить профиль |
| POST | `/users/me/avatar` | auth | Загрузить аватар |
| POST | `/users/me/cover` | auth | Загрузить обложку |
| GET | `/users/search?q=` | auth | Поиск |

## Posts

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/posts?limit=&offset=` | auth | Лента |
| POST | `/posts` | auth | Создать пост |
| GET | `/posts/:id` | auth | Пост |
| PATCH | `/posts/:id` | auth (author) | Редактировать |
| DELETE | `/posts/:id` | auth (author/admin) | Удалить |
| POST | `/posts/:id/react` | auth | Реакция |
| GET | `/posts/:id/comments` | auth | Комментарии |
| POST | `/posts/:id/comments` | auth | Комментировать |

## Chats

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/chats` | auth | Список чатов |
| POST | `/chats` | auth | Создать чат |
| GET | `/chats/:id/messages` | auth | Сообщения |
| POST | `/chats/:id/pin` | auth | Закрепить сообщение |
| DELETE | `/chats/:id/pin` | auth | Открепить |
| DELETE | `/chats/:id` | auth | Удалить/выйти |

Через WebSocket: `message:new`, `message:edited`, `message:deleted`, `reaction:update`, `typing`, `chat:pinned`, `chat:deleted`.

## Courses

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/courses` | auth | Список курсов |
| GET | `/courses/:slug` | auth | Курс с уроками |
| POST | `/courses/:slug/enroll` | auth | Записаться |
| POST | `/courses/lessons/:lessonId/complete` | auth | Отметить урок пройденным (без теста) |
| POST | `/courses/tests/:testId/submit` | auth | Отправить тест |
| GET | `/courses/certificates/:id` | auth | Сертификат |

## Practicals

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/practicals/:practicalId/submit` | auth | Сдать практику |
| GET | `/practicals/my` | auth | Мои практики |
| GET | `/practicals/review` | MENTOR/ADMIN | На проверку |
| POST | `/practicals/submissions/:id/review` | MENTOR/ADMIN | Одобрить/отклонить |
| POST | `/practicals/unlock/:lessonId` | MENTOR/ADMIN | Разблокировать урок |

## Homework

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/homework/:homeworkId/submit` | auth | Сдать ДЗ |
| GET | `/homework/my` | auth | Мои ДЗ |
| GET | `/homework/review` | MENTOR/ADMIN | На проверку |
| POST | `/homework/submissions/:id/review` | MENTOR/ADMIN | Одобрить/отклонить |

## Notifications

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/notifications` | auth | Список |
| POST | `/notifications/read-all` | auth | Прочитать все |
| POST | `/notifications/:id/read` | auth | Прочитать |
| POST | `/notifications/read-chat/:chatId` | auth | Прочитать чат |
| DELETE | `/notifications/:id` | auth | Удалить |
| DELETE | `/notifications/read` | auth | Удалить прочитанные |
| DELETE | `/notifications/all` | auth | Удалить все |

## Push

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/push/public-key` | auth | VAPID public key |
| POST | `/push/subscribe` | auth | Подписаться |
| POST | `/push/unsubscribe` | auth | Отписаться |
| POST | `/push/test` | auth | Тестовый push |

## Wiki

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/wiki/categories` | auth | Категории |
| GET | `/wiki/articles?category=&q=&tag=` | auth | Список статей |
| GET | `/wiki/popular` | auth | Топ-5 |
| GET | `/wiki/articles/:slug` | auth | Статья + related |

## Reports

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/reports` | auth | Жалоба |

## Uploads

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/uploads` | auth | Загрузить файл (multipart) |

## Settings

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/settings/public` | public | Публичные настройки брендинга |

## Modules

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/modules` | auth | Состояние модулей |

## Onboarding

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/onboarding` | auth | Данные онбординга |
| POST | `/onboarding/complete` | auth | Завершить |

## Gamification

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/gamification/me` | auth | Мой профиль XP |
| GET | `/gamification/leaderboard` | auth | Лидерборд |
| GET | `/gamification/quests` | auth | Ежедневные квесты |
| GET | `/gamification/achievements` | auth | Мои достижения |

---

## Admin

Все роуты ниже требуют `role = ADMIN`.

### Dashboard / Server / Maintenance

| Метод | Путь |
|-------|------|
| GET | `/admin/stats` |
| GET | `/admin/server/info` |
| POST | `/admin/server/cleanup` |
| GET | `/admin/maintenance/scan` |
| POST | `/admin/maintenance/cleanup` |
| GET | `/admin/maintenance/dbinfo` |
| POST | `/admin/maintenance/vacuum` |

### Analytics

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/admin/analytics?period=30` | Общая |
| GET | `/admin/analytics/courses?period=30` | Воронка по курсам |

### Moderation

| Метод | Путь |
|-------|------|
| GET | `/admin/reports` |
| GET | `/admin/reports/meta` |
| PATCH | `/admin/reports/:id` |
| POST | `/admin/reports/:id/delete-content` |
| POST | `/admin/reports/:id/ban-user` |
| DELETE | `/admin/reports/:id` |

### Users

| Метод | Путь |
|-------|------|
| GET | `/admin/users` |
| PATCH | `/admin/users/:id` |
| PATCH | `/admin/users/:id/password` |
| DELETE | `/admin/users/:id` |

### Courses

| Метод | Путь |
|-------|------|
| GET | `/admin/courses` |
| GET | `/admin/courses/:id` |
| POST | `/admin/courses` |
| PATCH | `/admin/courses/:id` |
| DELETE | `/admin/courses/:id` |
| POST | `/admin/courses/:courseId/lessons` |
| PATCH | `/admin/lessons/:id` |
| DELETE | `/admin/lessons/:id` |
| POST | `/admin/lessons/:lessonId/test` |
| PATCH | `/admin/tests/:id` |
| DELETE | `/admin/tests/:id` |
| POST | `/admin/tests/:testId/questions` |
| PATCH | `/admin/questions/:id` |
| DELETE | `/admin/questions/:id` |

### Practicals / Homework (admin)

| Метод | Путь |
|-------|------|
| GET | `/admin/mentors` |
| GET | `/admin/practicals-list` |
| POST | `/admin/lessons/:lessonId/practical` |
| PATCH | `/admin/practicals/:id` |
| DELETE | `/admin/practicals/:id` |
| GET | `/admin/homeworks-list` |
| POST | `/admin/lessons/:lessonId/homework` |
| PATCH | `/admin/homework/:id` |
| DELETE | `/admin/homework/:id` |
| POST | `/admin/practicals/bulk-assign-supervisor` |
| POST | `/admin/homeworks/bulk-delete` |

### Certificates

| Метод | Путь |
|-------|------|
| GET | `/admin/certificates` |
| POST | `/admin/certificates` |
| PATCH | `/admin/certificates/:id` |
| DELETE | `/admin/certificates/:id` |

### Settings, Broadcast, Push

| Метод | Путь |
|-------|------|
| GET | `/admin/settings` |
| PUT | `/admin/settings` |
| POST | `/admin/broadcast` |
| GET | `/admin/groups` |
| GET | `/admin/push/stats` |
| GET | `/admin/push/subscriptions` |
| POST | `/admin/push/send` |
| POST | `/admin/push/test-self` |
| DELETE | `/admin/push/subscriptions/:id` |
| POST | `/admin/push/subscriptions/delete-many` |

### Backup

| Метод | Путь |
|-------|------|
| GET | `/admin/backups` |
| POST | `/admin/backups` |
| POST | `/admin/backups/restore` |
| DELETE | `/admin/backups/:filename` |
| GET | `/admin/backups/:filename/download` |

### Bulk

| Метод | Путь |
|-------|------|
| POST | `/admin/bulk/recalc-all` |
| POST | `/admin/bulk/issue-certificates` |
| POST | `/admin/bulk/recalc-user-course` |
| POST | `/admin/bulk/enroll` |
| POST | `/admin/bulk/unenroll` |
| POST | `/admin/bulk/reset-progress` |
| POST | `/admin/bulk/import-curriculum` |
| POST | `/admin/bulk/validate-curriculum` |
| GET | `/admin/bulk/export-course/:id` |
| GET | `/admin/bulk/export-all-courses` |
| GET | `/admin/bulk/actions` |

### Wiki (admin)

| Метод | Путь |
|-------|------|
| GET/POST | `/admin/wiki/categories` |
| PATCH/DELETE | `/admin/wiki/categories/:id` |
| GET/POST | `/admin/wiki/articles` |
| PATCH/DELETE | `/admin/wiki/articles/:id` |

### Modules / Onboarding / Gamification

| Метод | Путь |
|-------|------|
| GET/PUT | `/admin/modules` |
| GET | `/admin/onboarding/info` |
| POST | `/admin/onboarding/reset-all` |
| POST | `/admin/onboarding/reset-user/:userId` |
| GET/PUT | `/admin/gamification/settings` |
| GET | `/admin/gamification/overview` |
| GET | `/admin/gamification/catalog` |
| POST | `/admin/gamification/grant-xp` |
| POST | `/admin/gamification/reset-user/:userId` |
| POST | `/admin/gamification/reset-all` |
| GET/POST | `/admin/gamification/achievements` |
| PATCH/DELETE | `/admin/gamification/achievements/:id` |
| GET/PUT | `/admin/gamification/levels` |
| GET/POST | `/admin/gamification/quest-templates` |
| PATCH/DELETE | `/admin/gamification/quest-templates/:id` |

### Password resets (admin)

| Метод | Путь |
|-------|------|
| GET | `/admin/password-resets` |
| POST | `/admin/password-resets/:id/generate-code` |
| POST | `/admin/password-resets/:id/reject` |