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
│
├── client/                                    # ─── React + Vite (SPA + PWA)
│   │
│   ├── public/                                # Статика, попадает в dist как есть
│   │   ├── favicon.svg                        # Основная иконка (SVG)
│   │   ├── favicon-16.png
│   │   ├── favicon-32.png
│   │   ├── apple-touch-icon.png               # 180×180 для iOS
│   │   ├── icon-192.png                       # PWA-иконка
│   │   ├── icon-512.png                       # PWA-иконка (high-res)
│   │   ├── icon-maskable.svg                  # Maskable-иконка для Android
│   │   └── robots.txt
│   │
│   ├── src/
│   │   │
│   │   ├── api/                               # Работа с HTTP-API
│   │   │   └── client.js                      # fetch-обёртка, ApiError, uploadFile/uploadBlob, ping
│   │   │
│   │   ├── components/                        # Переиспользуемые компоненты
│   │   │   │
│   │   │   ├── messenger/                     # Компоненты мессенджера
│   │   │   │   ├── MessageBubble.jsx          # Пузырь сообщения с реакциями
│   │   │   │   ├── GroupAvatar.jsx            # Сетка 2×2 из аватаров
│   │   │   │   ├── NewChatButton.jsx          # Модалка создания чата
│   │   │   │   └── MessengerNavMenu.jsx       # Popover-меню (опционально)
│   │   │   │
│   │   │   ├── Layout.jsx                     # Общий каркас: сайдбар + мобильный хедер + outlet
│   │   │   ├── MobileNav.jsx                  # Нижняя навигация на мобильных
│   │   │   ├── Avatar.jsx                     # Аватар с индикатором «онлайн»
│   │   │   ├── NotificationBell.jsx           # Колокольчик + попап уведомлений
│   │   │   ├── NetworkBanner.jsx              # Баннер при потере сети
│   │   │   ├── ThemeToggle.jsx                # Переключатель темы
│   │   │   ├── SplashScreen.jsx               # React-сплэш после гидратации
│   │   │   ├── OfflineScreen.jsx              # Полноэкранная заглушка без сети
│   │   │   ├── OnboardingModal.jsx            # Пошаговый тур по платформе
│   │   │   │
│   │   │   ├── PostCard.jsx                   # Карточка поста (обычная/компактная)
│   │   │   ├── PostReactions.jsx              # Панель реакций на пост
│   │   │   ├── CommentSection.jsx             # Комментарии с вложенностью
│   │   │   ├── ReportButton.jsx               # Кнопка «Пожаловаться» + модалка
│   │   │   ├── MessageText.jsx                # Рендер markdown + @упоминания
│   │   │   │
│   │   │   ├── VoicePlayer.jsx                # Плеер голосовых с waveform и перемоткой
│   │   │   ├── VoiceRecorder.jsx              # (в Messenger) запись голосовых
│   │   │   ├── ImageViewer.jsx                # Полноэкранный просмотрщик с свайпами
│   │   │   ├── ImageCropper.jsx               # Кроппер (аватары, обложки, посты)
│   │   │   ├── MediaGalleryModal.jsx          # Галерея медиа в чате
│   │   │   ├── ProfileEditor.jsx              # Модалка редактирования профиля
│   │   │   ├── ChangePasswordModal.jsx        # Смена пароля
│   │   │   ├── MentionSuggest.jsx             # Автокомплит @упоминаний
│   │   │   ├── PinnedBar.jsx                  # Плашка закреплённого сообщения
│   │   │   │
│   │   │   ├── LevelBadge.jsx                 # Значок уровня
│   │   │   ├── XpProgressBar.jsx              # Прогресс XP до след. уровня
│   │   │   ├── AchievementCard.jsx            # Карточка одного достижения
│   │   │   ├── AchievementToast.jsx           # Pop-up о level-up / достижении
│   │   │   ├── QuestCard.jsx                  # Карточка ежедневного квеста
│   │   │   │
│   │   │   ├── OnboardingModal.jsx
│   │   │   ├── SplashScreen.jsx
│   │   │   │
│   │   │   └── Admin/                         # Компоненты только для админки
│   │   │       ├── ConfirmDialog.jsx          # Универсальный диалог подтверждения
│   │   │       └── SearchSelect.jsx           # Дропдаун с поиском
│   │   │
│   │   ├── hooks/                             # Кастомные React-хуки
│   │   │   ├── usePageMeta.js                 # Динамический <title> + og-теги
│   │   │   ├── usePostDraft.js                # Автосохранение черновика поста
│   │   │   ├── usePullToRefresh.js            # Pull-to-refresh для списков
│   │   │   └── useLocalStorage.js             # Синхронизация стейта с localStorage
│   │   │
│   │   ├── lib/                               # Внутренние утилиты клиента
│   │   │   ├── modalStack.js                  # Счётчик открытых модалок (для отключения свайпов)
│   │   │   └── push.js                        # Web Push API, проверка iOS/standalone
│   │   │
│   │   ├── pages/                             # Страницы (роуты)
│   │   │   │
│   │   │   ├── Landing.jsx                    # Публичный лендинг
│   │   │   ├── Login.jsx                      # Вход + регистрация
│   │   │   ├── Feed.jsx                       # Лента с infinite scroll
│   │   │   ├── Profile.jsx                    # Профиль (свой/чужой)
│   │   │   ├── Messenger.jsx                  # Мессенджер (список + чат)
│   │   │   ├── Notifications.jsx              # Страница уведомлений
│   │   │   ├── Leaderboard.jsx                # Рейтинг
│   │   │   ├── Courses.jsx                    # Список курсов
│   │   │   ├── CourseView.jsx                 # Курс с уроками, тестами, практиками, ДЗ
│   │   │   ├── Certificate.jsx                # Сертификат с PDF-экспортом
│   │   │   ├── Verify.jsx                     # Публичная проверка сертификата
│   │   │   ├── Wiki.jsx                       # Список статей
│   │   │   ├── WikiArticle.jsx                # Статья с хлебными крошками
│   │   │   │
│   │   │   └── Admin/                         # ─── Админ-панель (модульная)
│   │   │       ├── index.jsx                  # Роутер вкладок
│   │   │       ├── constants.js               # TABS, TEMPLATES, QUESTION_TYPES
│   │   │       ├── utils.js                   # downloadJSON, fmtSize, renderMarkdownSimple
│   │   │       │
│   │   │       ├── components/                # См. выше
│   │   │       │
│   │   │       └── tabs/                      # Одна вкладка = один раздел
│   │   │           ├── Dashboard.jsx          # Метрики + инфо о сервере + обслуживание БД
│   │   │           ├── Analytics.jsx          # Графики (Recharts)
│   │   │           ├── Users.jsx              # Фильтры, массовые действия, экспорт CSV
│   │   │           ├── Certificates.jsx       # Список сертификатов + выдача
│   │   │           ├── Broadcast.jsx          # In-app рассылка
│   │   │           ├── Push.jsx               # Push-рассылка + управление подписками + автоочистка
│   │   │           ├── Backups.jsx            # Бэкапы PostgreSQL + VACUUM
│   │   │           ├── Moderation.jsx         # Очередь жалоб
│   │   │           ├── PasswordResets.jsx     # Заявки на сброс пароля
│   │   │           ├── Modules.jsx            # Включение/выключение разделов
│   │   │           ├── Settings.jsx           # Системные настройки + модерация + автоочистка уведомлений
│   │   │           ├── Gamification.jsx       # Настройки геймификации (подтабы)
│   │   │           │
│   │   │           ├── Courses/
│   │   │           │   ├── index.jsx          # Список + экспорт
│   │   │           │   ├── CourseEditor.jsx   # Редактор курса + мета
│   │   │           │   ├── LessonEditor.jsx   # Редактор урока
│   │   │           │   ├── TestEditor.jsx     # Редактор теста
│   │   │           │   └── QuestionEditor.jsx # Редактор вопроса (5 типов)
│   │   │           │
│   │   │           ├── Wiki/
│   │   │           │   ├── index.jsx          # Список статей и категорий
│   │   │           │   ├── CategoryEditor.jsx
│   │   │           │   └── ArticleEditor.jsx  # Markdown-редактор с превью
│   │   │           │
│   │   │           ├── Bulk/
│   │   │           │   ├── index.jsx          # Пакетные операции + журнал
│   │   │           │   ├── RecalcUserCourseForm.jsx
│   │   │           │   ├── BulkCourseAction.jsx
│   │   │           │   └── CurriculumImportForm.jsx  # Импорт курсов из JSON
│   │   │           │
│   │   │           └── SiteDesign/
│   │   │               ├── index.jsx          # Подтабы
│   │   │               ├── BrandEditor.jsx    # Логотип, цвета, градиент
│   │   │               ├── LandingEditor.jsx  # Hero, фичи, CTA
│   │   │               ├── MenuEditor.jsx     # Пункты навигации
│   │   │               ├── FooterEditor.jsx   # Футер и ссылки
│   │   │               ├── CertificateEditor.jsx  # Шаблоны сертификатов
│   │   │               └── ThemeEditor.jsx    # Тема по умолчанию
│   │   │
│   │   ├── stickers/                          # SVG-стикеры
│   │   │   └── pack.jsx                       # STICKERS, Sticker, QUICK_EMOJI
│   │   │
│   │   ├── store/                             # React-контексты (провайдеры)
│   │   │   ├── auth.jsx                       # user, token, login/logout, register
│   │   │   ├── socket.jsx                     # Socket.IO-клиент
│   │   │   ├── notifications.jsx              # Уведомления + push
│   │   │   ├── settings.jsx                   # Настройки сайта (бренд, лендинг)
│   │   │   ├── modules.jsx                    # Состояние модулей (feed/chats/courses/wiki)
│   │   │   ├── onboarding.jsx                 # Тур для новых пользователей
│   │   │   ├── theme.jsx                      # Тёмная/светлая тема
│   │   │   ├── network.jsx                    # Онлайн/офлайн, ping
│   │   │   └── gamification.jsx               # XP, квесты, achievements + WS-события
│   │   │
│   │   ├── styles/
│   │   │   └── index.css                      # Tailwind + CSS-переменные + light-theme overrides
│   │   │
│   │   ├── sw.js                              # Service Worker (injectManifest)
│   │   ├── App.jsx                            # Роуты + Gate-компоненты
│   │   └── main.jsx                           # Точка входа + провайдеры
│   │
│   ├── index.html                             # HTML-шаблон + inline-splash + og-теги
│   ├── vite.config.js                         # Vite + PWA-плагин + манифест
│   ├── tailwind.config.js                     # Цвета (ink, violet, pink, cyan, lime)
│   ├── postcss.config.js
│   └── package.json
│
├── server/                                    # ─── Express + Prisma + Socket.IO
│   │
│   ├── prisma/
│   │   ├── schema.prisma                      # Все модели
│   │   └── seed/                              # Наполнение курсов
│   │       ├── index.js                       # Запуск: node prisma/seed/index.js
│   │       ├── helpers.js                     # buildTest, slugify
│   │       └── courses/
│   │           ├── photography.js             # Основы фотографии (12 уроков)
│   │           ├── videography.js             # Основы видеосъёмки (12 уроков)
│   │           ├── editing.js                 # Основы монтажа (12 уроков)
│   │           ├── radio.js                   # Радиожурналистика (12 уроков)
│   │           ├── studio-sound.js            # Студийная звукорежиссура (13 уроков)
│   │           └── live-sound.js              # Концертная звукорежиссура (13 уроков)
│   │
│   ├── src/
│   │   │
│   │   ├── lib/                               # Бизнес-логика
│   │   │   │
│   │   │   ├── prisma.js                      # Singleton PrismaClient
│   │   │   ├── notify.js                      # createNotification, notifyChatMessage, notifyBroadcast, buildPreview
│   │   │   ├── push.js                        # sendPushToAll / ToUser / ToUsers (web-push)
│   │   │   │
│   │   │   ├── backup.js                      # pg_dump / pg_restore, listBackups, checkPgTools
│   │   │   ├── dbMaintenance.js               # scanDatabase, cleanupDatabase, getDatabaseInfo, VACUUM
│   │   │   ├── chatCleanup.js                 # hardDeleteChat, getLiveChatStats, cleanupAfterUserDelete
│   │   │   ├── analytics.js                   # getAnalytics (регистрации, активность, топы)
│   │   │   ├── bulkActions.js                 # Импорт/экспорт курсов, рекальк прогресса, журнал
│   │   │   ├── serverInfo.js                  # CPU/RAM/диск/uptime, cleanup логов и бэкапов
│   │   │   │
│   │   │   ├── moderation.js                  # listReports, updateReport, deleteReportedContent, applyAutoModeration
│   │   │   ├── passwordReset.js               # createResetRequest, generateCodeForRequest, verifyCodeAndReset
│   │   │   ├── passwordResetCron.js           # Ежедневная очистка старых заявок
│   │   │   │
│   │   │   ├── pushCleanup.js                 # Удаление неактивных push-подписок
│   │   │   ├── pushCleanupCron.js
│   │   │   ├── notifyCleanup.js               # Удаление старых прочитанных уведомлений
│   │   │   ├── notifyCleanupCron.js
│   │   │   │
│   │   │   ├── gamification.js                # Ядро: awardXp, deductXp, quests, streaks, hooks
│   │   │   ├── gamificationCatalog.js         # XP_DEFAULTS, DEDUCTION_DEFAULTS, ACHIEVEMENTS, QUEST_TEMPLATES
│   │   │   ├── gamificationSettings.js        # Чтение/запись настроек геймификации
│   │   │   ├── gamificationCron.js            # Ежедневное списание XP за неактивность
│   │   │   │
│   │   │   ├── courseLogic.js                 # getLessonStatuses, computeAccess (разблокировка уроков)
│   │   │   └── audioPeaks.js                  # Извлечение waveform из аудио через ffmpeg
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js                        # JWT-проверка + requireRole + инвалидация по passwordChangedAt
│   │   │
│   │   ├── routes/                            # HTTP-роуты
│   │   │   │
│   │   │   ├── auth.js                        # register, login, me, recover/request, recover/verify
│   │   │   ├── users.js                       # список, профиль, PATCH /me, смена пароля, посты
│   │   │   ├── posts.js                       # лента (feed), CRUD, реакции, комментарии
│   │   │   ├── chats.js                       # список чатов, сообщения, медиа, pin
│   │   │   ├── uploads.js                     # загрузка файлов (Sharp + audioPeaks)
│   │   │   │
│   │   │   ├── courses.js                     # список, курс, enroll, complete, submit test, сертификат
│   │   │   ├── practicals.js                  # сдача практики, проверка (MENTOR/ADMIN), unlock
│   │   │   ├── homework.js                    # сдача ДЗ, проверка (MENTOR/ADMIN)
│   │   │   │
│   │   │   ├── wiki.js                        # категории, статьи, популярное
│   │   │   ├── notifications.js               # список, mark-read, clear
│   │   │   ├── reports.js                     # создание жалобы
│   │   │   ├── modules.js                     # состояние модулей (GET)
│   │   │   ├── onboarding.js                  # config + complete
│   │   │   ├── gamification.js                # status, me, daily, quests, leaderboard, achievements catalog
│   │   │   ├── publicMeta.js                  # og-теги для ботов (user/certificate/wiki/course)
│   │   │   │
│   │   │   └── admin.js                       # ─── Все админские роуты
│   │   │           · /stats, /analytics
│   │   │           · /server/info, /server/cleanup
│   │   │           · /maintenance/scan, /cleanup, /dbinfo, /vacuum
│   │   │           · /users, /courses, /lessons, /tests, /questions
│   │   │           · /certificates, /settings, /broadcast, /groups
│   │   │           · /backups
│   │   │           · /bulk/*
│   │   │           · /wiki/*
│   │   │           · /push/*
│   │   │           · /notifications/cleanup-*
│   │   │           · /modules
│   │   │           · /onboarding/*
│   │   │           · /gamification/* (settings, overview, achievements, levels, quest-templates)
│   │   │           · /reports, /password-resets
│   │   │
│   │   ├── socket.js                          # Socket.IO: чаты, typing, сообщения, реакции, онлайн
│   │   └── index.js                           # Точка входа: Express + Socket.IO + cron-задачи
│   │
│   ├── uploads/                               # Загруженные файлы (создаётся автоматически)
│   ├── backups/                               # Дампы PostgreSQL (создаётся автоматически)
│   ├── .env                                   # Не в git
│   ├── .env.example
│   └── package.json
│
├── .gitignore                                 # node_modules, .env, uploads/, backups/, dist/
├── .github/
│   └── workflows/                             # (опционально) CI/CD
│       └── ci.yml
└── README.md
```

### Ключевые принципы организации

**Клиент:**
- **store/** — глобальный стейт через React Context. Каждый провайдер отвечает за свою часть (auth, theme, socket, gamification).
- **pages/Admin/** — модульная админка. Один раздел = один файл в `tabs/`, всё сложное (редакторы курсов, wiki) — в подпапках.
- **components/messenger/** — вынесено отдельно, т.к. мессенджер — самая тяжёлая часть UI.
- **hooks/** — переиспользуемая логика (draft, pull-to-refresh, meta-теги).
- **lib/** — утилиты без React (modalStack, push).

**Сервер:**
- **lib/** — вся бизнес-логика. Роуты тонкие, они только валидируют и вызывают функции из lib.
- **routes/** — HTTP-слой. `admin.js` — намеренно большой, там десятки эндпоинтов админки.
- **prisma/seed/** — данные курсов отделены от кода. Каждый курс — свой файл.
- **cron-задачи** — регистрируются в `index.js` через `schedule*()`-функции из `lib/*Cron.js`.

### Особенности

- **Нет `prisma migrate`** — только `db push`. История миграций не ведётся.
- **`uploads/` и `backups/`** — не в git, создаются на сервере.
- **`.env`** — обязателен на сервере, шаблон в `.env.example`.
- **PWA-манифест** — генерируется `vite-plugin-pwa` из `vite.config.js`, в `public/` лежат только иконки.

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