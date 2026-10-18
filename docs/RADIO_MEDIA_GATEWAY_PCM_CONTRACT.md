# Radio 2.0 — Media Gateway PCM Contract

Это подготовка доверенного медиашлюза, а **не** реализация WebRTC/Opus-декодера.

Worker по умолчанию не принимает вход (`RADIO_LIVE_PCM_INTAKE_ENABLED=false`). При включении только внутренний loopback принимает POST `/live-pcm/session` с секретом Worker. В ответ выдаётся токен одной сессии. Каждый запрос POST `/live-pcm/ingest` требует секрет Worker, токен сессии и заголовок `x-radio-pcm-frame-index` (беззнаковый целочисленный номер первого PCM-фрейма, начиная с 0). PCM: 48 000 Гц, signed 16-bit little-endian, 2 interleaved channels; ровно 4 байта/фрейм, максимум 100 мс. Следующий запрос обязан начинаться ровно с `previous frame-index + previous frames`.

Некорректный индекс, повторение, пропуск, перестановка, неправильный размер или формат дают HTTP 400/413 без помещения PCM в буфер. При нарушении очереди нужно завершить сессию и начать новую с индекса 0: старые данные повторно не проигрываются. GET `/live-pcm/status` включает `gatewayClock` с expectedFrame, acceptedFrames, discontinuities и статусом сессии. При старте и завершении сессии clock сбрасывается.

**Никакой автоматический live audio switching или выход в энкодер не реализован.** Реального WebRTC receiver, Opus decoder, jitter-buffer и ресемплера пока нет. Внешне публиковать ingest endpoints нельзя. Испытания только на изолированном Worker с наушниками; усилитель, школьную PA, ESP32 и реле не подключать.
