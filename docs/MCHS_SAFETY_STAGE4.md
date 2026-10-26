# Этап 4 — диагностический heartbeat MCHS Android

Добавлен `POST /api/safety-ingest/heartbeat`, защищённый точно такой же подписью HMAC SHA-256, как событийный POST. Включается только при `MCHS_INGEST_ENABLED=true` и наличии отдельного ключа `MCHS_INGEST_HMAC_KEY` длиной не менее 32 символов. Глобально отключён по умолчанию.

JSON body: `{"source":"mchs-android","listener":"CONNECTED","push":"UNKNOWN"}`.
Возможные значения listener: `CONNECTED`, `DISCONNECTED`, `UNKNOWN`; push: `REGISTERED`, `ERROR`, `UNKNOWN`. Передающий агент должен использовать истинно измеренные значения; не подставлять `REGISTERED` без проверки FCM.

Шлюз применяет подпись к `timestamp + "." + raw JSON bytes`, ±120 секунд. `X-MCHS-Timestamp` — Unix seconds. `X-MCHS-Signature` — `sha256=<HMAC hex>`. Только проверенный отправитель может обновить `SafetyMchsHealth`.

Панель показывает `HEARTBEAT_RECENT`, если последний heartbeat получен менее 180 секунд назад; `HEARTBEAT_STALE` после этого; `NOT_CONFIGURED` до первого сигнала. **Недавний heartbeat означает лишь доступность агента, а не доставку push и не подтверждение сообщения МЧС.** Автоматическое оповещение всегда отключено.

## Проверки preview
- Без ключа или флага — 503.
- Подмена подписи, изменённый body, неверная дата — 401.
- Неверный source или state — 400.
- Корректный heartbeat -> обновление UTC timestamp в БД; получение через dashboard под ролью safety.view.
- Через 180 секунд статус должен стать STALE.
- При перезагрузке API состояние должно сохраниться, без ложного ONLINE.
- Убедиться, что endpoint не управляет radio и speakers.

Android sender, очереди и реальная доставка ещё не интегрированы. В production не включать до испытаний и проверки сетевых ограничений.
