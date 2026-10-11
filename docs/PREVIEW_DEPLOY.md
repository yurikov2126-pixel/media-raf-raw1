# MEDIA·RAF·RAW — Preview: эксплуатация, автодеплой и восстановление

> Состояние на 11.10.2026. Этот документ фиксирует **проверенное в ходе настройки** окружение, а не универсальную инструкцию для нового сервера. Перед опасными операциями сверяйте фактическую конфигурацию. **Никогда не копируйте production-секреты или базу в preview без отдельного плана обезличивания.**

## 1. Быстрый контекст для нового диалога

- Репозиторий: `yurikov2126-pixel/media-raf-raw1`.
- Ветка разработки и preview: `feature/editorial-student-navigation` (PR #167 на момент настройки; не считать номер/статус неизменным).
- Preview: https://preview.mediarafraw.ru ; production: https://mediarafraw.ru.
- Сервер Ubuntu; preview-корень: `/www/wwwroot/mediaraf-preview`; production-корень: `/www/wwwroot/mediarafraw.ru`. **Не менять production**.
- Preview API: `127.0.0.1:4001`; проверка: `https://preview.mediarafraw.ru/api/health`, ожидается `{"ok":true,"service":"MEDIA-RAF-RAW"}`.
- Preview PostgreSQL: отдельная БД `mediaraf_preview`. Production БД не использовать.
- Активный на момент последней проверки релиз: `4455d859f8cd9054899e0bebc8d447d7e77f6012` (документационный smoke-test commit).
- Первый релиз, на который успешно откатывались: `6d7197e3496ebe238fee60facc375f572b107241`.
- На 11.10.2026: timer `mediaraf-preview-deploy.timer` **enabled/active**, период 5 минут после завершения предыдущего запуска; последний наблюдавшийся запуск 03:22 МСК — `Result=success`, изменений в GitHub не было.
- Production работает отдельно. Preview НЕ является механизмом автоматического выпуска в production.

**Для продолжения в новом чате:** прочитать этот файл и `docs/EDITORIAL_README.md`; получить свежий `git rev-parse HEAD`, `readlink -f .deploy/current`, журналы systemd. Не полагаться на зафиксированные здесь SHA как на текущие.

## 2. Изоляция и структура каталогов

```text
/www/wwwroot/mediaraf-preview/
├── .deploy/
│   ├── current -> releases/<SHA>           # атомарно переключаемый активный релиз
│   ├── releases/<40-символьный SHA>/        # собранные неизменяемые релизы
│   ├── shared/
│   │   ├── preview.env                    # секреты preview; НЕ коммитить
│   │   ├── uploads/                       # постоянные загрузки
│   │   ├── private/                       # приватные материалы редакции
│   │   └── backups/                       # локальные резервные копии
│   ├── deploy-preview.sh                  # предварительная проверка
│   ├── build-release.sh                   # сборка без активации
│   ├── activate-release.sh                # активация + health + rollback
│   └── auto-deploy.sh                     # проверка GitHub → сборка → активация
└── ...                                    # checkout ветки и служебные файлы
```

В релизах `server/.env`, `server/uploads`, `server/private`, `server/backups` — символические ссылки на постоянное preview-хранилище. Удаление старого релиза **не должно** удалять общие данные. Перед любым удалением проверять `readlink` и `find`, не использовать бездумное `rm -rf`.

Скрипты `.deploy/*.sh` и приватный env находятся **только на сервере** (не отслеживаются Git); этот документ описывает их поведение, но не заменяет резервную копию самих скриптов, unit/drop-in-файлов, настроек веб-сервера и секретов. Их восстановление на чистом сервере требует отдельного безопасного бэкапа.

## 3. Службы, права и настройки

- `mediaraf-preview.service`: `Type=simple`, `User=www`, `Group=www`, `WorkingDirectory=/www/wwwroot/mediaraf-preview/.deploy/current/server`; `ExecStart=/www/server/nodejs/v24.21.0/bin/node src/index.js`; `Restart=on-failure`, `RestartSec=5`. Env из `.deploy/shared/preview.env` через drop-in.
- `mediaraf-preview-deploy.service`: `Type=oneshot`, `User=mediaraf-deploy`, `Group=mediaraf-deploy`; фактический `ExecStart` переопределён drop-in на `/usr/bin/bash /www/wwwroot/mediaraf-preview/.deploy/auto-deploy.sh`. Системная служба ограничена `ProtectSystem=strict` с `ReadWritePaths` только для preview и home пользователя деплоя.
- `mediaraf-preview-deploy.timer`: исходный unit был на 1 минуту; drop-in `/etc/systemd/system/mediaraf-preview-deploy.timer.d/override.conf` сбрасывает старые таймеры и задаёт `OnBootSec=5min`, `OnUnitInactiveSec=5min`, `AccuracySec=10s`, `Persistent=false`. При включении timer может запустить сервис **сразу**, если время от загрузки уже прошло.
- `mediaraf-deploy` имеет строго ограниченный sudo на `/usr/bin/systemctl restart mediaraf-preview.service`; не расширять на production.
- `.deploy/releases`: владелец `mediaraf-deploy:www`, режим `2750` (setgid). При сборке нормализуются группы/права; `www` должен читать клиентский `dist`, серверный код и Prisma.
- Локи: `/home/mediaraf-deploy/preview-deploy.lock` для сборки/активации и `preview-auto-deploy.lock` для оркестратора.

Посмотреть **эффективную**, а не только исходную конфигурацию:

```bash
SYSTEMD_PAGER=cat systemctl cat --no-pager mediaraf-preview.service
SYSTEMD_PAGER=cat systemctl cat --no-pager mediaraf-preview-deploy.service
SYSTEMD_PAGER=cat systemctl cat --no-pager mediaraf-preview-deploy.timer
systemctl show --no-pager mediaraf-preview-deploy.timer -p TimersMonotonic -p Persistent -p Unit
```

Не выводить `preview.env` или `DATABASE_URL` в чат/логи: в них могут быть пароли.

## 4. Путь коммита в preview

1. Изменение попадает в `feature/editorial-student-navigation`.
2. Таймер запускает `auto-deploy.sh` от `mediaraf-deploy`.
3. Preflight проверяет окружение, ветку, имя preview-БД и блокировки.
4. Git fetch и fast-forward-only обновление checkout. Если локальный SHA равен удалённому, сборка не выполняется.
5. `build-release.sh` создаёт `.deploy/releases/<SHA>` из git archive, устанавливает зависимости `npm ci`, запускает `prisma generate`, собирает клиент Vite/PWA, проверяет артефакты и права. **На этом этапе работающий релиз не меняется**.
6. `activate-release.sh` проверяет каталог, обязательные файлы и symlink-хранилище; сравнивает файлы `server/prisma/migrations` между старым и новым релизами. При различиях — **отказ, миграции автоматически не применяются**.
7. Атомарно переключается `.deploy/current`, выполняется `systemctl restart mediaraf-preview.service`; затем проверяются новый PID, состояние службы и `127.0.0.1:4001/api/health` (до 30 попыток с задержкой 2 с).
8. Если активация неудачна, EXIT-trap возвращает старую ссылку, перезапускает preview и повторяет health-check. Скрипт при этом завершается с ошибкой; журнал нужно обязательно просмотреть.

**Важно:** `Type=simple` не означает готовности приложения после успешного `systemctl restart`; решающая проверка — API health и PID. Успешный health-check не заменяет ручные функциональные проверки, особенно миграций, файлов, авторизации, PWA и Socket.IO.

## 5. Безопасные команды для диагностики

```bash
ROOT=/www/wwwroot/mediaraf-preview
readlink -f "$ROOT/.deploy/current"
systemctl is-active mediaraf-preview.service
systemctl show --no-pager mediaraf-preview-deploy.service -p ActiveState -p Result -p ExecMainStatus
systemctl is-enabled mediaraf-preview-deploy.timer
systemctl is-active mediaraf-preview-deploy.timer
systemctl list-timers --all --no-pager mediaraf-preview-deploy.timer
journalctl -u mediaraf-preview-deploy.service -n 100 --no-pager
journalctl -u mediaraf-preview.service -n 100 --no-pager
curl -fsS --max-time 10 https://preview.mediarafraw.ru/api/health
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' --max-time 10 https://preview.mediarafraw.ru/
```

Если SSH-подключение прервалось, **не повторять автоматически команду удаления/активации**: сначала проверить symlink, службу, API и наличие целевого каталога.

## 6. Ручной откат (только preview)

Использовать **только существующий, проверенный, совместимый с текущей БД** релиз. Откат к старому коду может быть несовместим с уже изменённой схемой или данными. Сначала при необходимости остановить timer:

```bash
sudo systemctl stop mediaraf-preview-deploy.timer
# Узнать доступные SHA и текущий релиз:
ls -1 /www/wwwroot/mediaraf-preview/.deploy/releases
readlink -f /www/wwwroot/mediaraf-preview/.deploy/current
# После проверки совместимости, заменить <FULL_40_CHAR_SHA>:
sudo -u mediaraf-deploy bash /www/wwwroot/mediaraf-preview/.deploy/activate-release.sh <FULL_40_CHAR_SHA>
curl -fsS https://preview.mediarafraw.ru/api/health
```

Пока timer остановлен, автоматическая проверка GitHub не запускается по расписанию. **Не запускать вручную auto-deploy во время контролируемого отката**, иначе он может снова активировать более новый SHA. После устранения проблемы и проверки состояния вернуть timer: `sudo systemctl start mediaraf-preview-deploy.timer` (если он был включён до инцидента).

## 7. Неудачный деплой: порядок действий

1. Проверить `readlink -f .deploy/current`, `systemctl is-active mediaraf-preview.service`, `curl /api/health`.
2. Просмотреть `journalctl -u mediaraf-preview-deploy.service -n 150 --no-pager` и журнал API.
3. Если сервис неработоспособен, временно остановить **только** preview timer; не запускать несколько деплоев одновременно.
4. Если rollback не восстановил приложение — исследовать ошибку и вернуть совместимый предыдущий релиз через `activate-release.sh`; при необходимости проверить systemd/Prisma/доступы.
5. При различии миграций не обходить guard. Сначала отдельный план миграции **preview-БД**, backup, проверка обратной совместимости и возможность восстановления данных. Автоматического rollback БД здесь **нет**.
6. При ошибке npm/Prisma проверить доступность registry, диск, группу файлов, журналы; не править активный релиз на месте.
7. После исправления причины повторно проверить API, frontend, ключевые сценарии и таймер.

## 8. Подтверждённые испытания (11.10.2026)

- Smoke-test документационный коммит `4455d859...` был автоматически собран, установлен и успешно прошёл health.
- Ручное переключение на `6d7197e...` успешно: новый PID, health OK; затем возврат на `4455d859...` успешно.
- Создавался временный **отдельный** неисправный релиз `0000000000000000000000000000000000000141` с `process.exit(42)` в его собственном `server/src/index.js`. Активация завершилась кодом 1, журнал сообщил `Rollback successful`; активный релиз восстановлен, API и frontend HTTP 200. Тестовый каталог затем удалён.
- Проверены чтение файлов пользователем `www`, группа `www` у релиза, доступность API и HTTP 200.
- Timer включён и активен, фактические параметры `OnBootSec=5min`, `OnUnitInactiveSec=5min`, `Persistent=no`.
- Первый наблюдавшийся запуск по timer в 03:22 МСК: `Result=success`, `ExecMainStatus=0`, local SHA = remote SHA = `4455d859...`, `Preview is already up to date`; следующий запуск был запланирован на 03:27 МСК.

**Что НЕ проверено полностью:** восстановление после потери диска/сервера, восстановление PostgreSQL из backup, изменения схемы, PWA-кэш и пользовательские сценарии, полнота резервирования серверных скриптов, веб-сервера и сертификатов.

## 9. Обслуживание и безопасность

- Не включать `main` или production в preview timer, не менять production runner/systemd/DB/папку.
- Не коммитить `.deploy/shared/preview.env`, приватные файлы, uploads, дампы БД, токены или ключи.
- Хранить несколько проверенных релизов; удалять старые только после проверки активного symlink, совместимости и структуры ссылок.
- Контролировать место (`df -h`, `du -sh .deploy/releases/*`); при настройке было ~71 ГБ свободно и ~658 МБ на релиз.
- Внешняя доступность preview не равна безопасной тестовой среде: использовать тестовые данные и учётные записи, не раскрывать приватные материалы.
- В документации корневого `README.md` production-CD через self-hosted runner описан **отдельно**: это другой процесс.
- Известное стороннее предупреждение `systemd-analyze verify`: `lshttpd.service` использует `KillMode=none`; это не ошибка preview timer, не менять без отдельного обслуживания веб-сервера.

## 10. Чеклист перед продолжением разработки

- [ ] Сверить актуальную ветку и PR в GitHub.
- [ ] Проверить `current`, health, timer, последний `Result`.
- [ ] Читать `docs/EDITORIAL_README.md` как спецификацию и журнал внедрения; отличать согласованное от предложений.
- [ ] Делать маленькие PR/коммиты; CI и ручное тестирование обязательны.
- [ ] Для изменений Prisma готовить отдельный согласованный план миграции preview-БД: обычный автодеплой её не выполнит.
- [ ] Проверять мобильный интерфейс, приватные вложения, подписи к каждому файлу, прогресс загрузки, просмотрщик, возвращение в чат к последнему сообщению.
- [ ] Никогда не переносить preview-изменения в production без отдельного подтверждения.

## 11. Короткий запрос для нового чата

> Продолжаем разработку MEDIA·RAF·RAW, репозиторий `yurikov2126-pixel/media-raf-raw1`, ветка `feature/editorial-student-navigation`. Прочитай `docs/EDITORIAL_README.md` и `docs/PREVIEW_DEPLOY.md`, проверь актуальный HEAD и статус preview. Preview развёртывается через systemd timer каждые 5 минут, production не трогать. Скрипты `.deploy/*.sh` находятся только на сервере. Работай небольшими безопасными шагами, проверяй CI, не применяй миграции автоматически. Перед изменением кода обсудим следующую задачу.
