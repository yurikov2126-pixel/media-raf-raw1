# PR #1028 — исправление ACK Android VM после включения реальных ракетных ALARM

## Подтверждённая причина предупреждений

`tools/mchs-sender/vm_observer.py` не подтверждал запись очереди, если API вернул `verified:true`. Это историческая проверка из режима observation-only, где все сообщения сохранялись как `verified:false`. После PR #1020 подписанные свежие ракетные опасности и отбои из разрешённого канала стали возвращать `verified:true` для допуска звукового эфира. Текущий VM-клиент трактовал **успешный HTTP 200 с корректным eventId и сохранённой записью** как ошибку `Invalid/mismatched event ACK`, увеличивал `attempt`, оставлял событие в локальной очереди и повторял отправку по backoff.

У пользователя 7 ноября 2026 года экран Android VM показал свежую связь и SQLite, но одну ожидающую запись, повторные отправки и две открытые неисправности (долгая очередь и просроченный retry). Это согласуется с обнаруженной несовместимостью ACK, не требует повторного воспроизведения тревоги.

## Исправление

- `valid_event_ack` проверяет: `accepted is True`, **точное** совпадение `eventId`, непустой серверный `id`, `bridgeAuthenticated is True`, `verified` — логический флаг.
- `verified` может быть `true` для разрешённого ракетного аудио либо `false` для прочих наблюдений: он не является подтверждением транспортной доставки.
- Сохранены HMAC, SSL, исходные eventId, детерминированный backoff, локальная SQLite-очередь, дедупликация на сервере.
- Существующая локальная просроченная запись получит ACK после следующего успешного штатного повтора; **очередь вручную не чистить**.
- Регрессионные тесты проверяют `verified:true/false`, отклонение чужого eventId и malformed ACK, снижение `queuedLocal/retryPending` после успешного ответа. CI запускает тесты VM Python.

## Развёртывание

**Это исправление на отдельной виртуальной машине `mchs-android`, а НЕ в API/ESP32/Windows Agent.** Одного merge и обычного deploy API недостаточно. На VM после merge:

```bash
sudo systemctl cat mchs-observer.service
# Убедитесь, что ExecStart читает /home/mchs-android/vm_observer.py.
sudo cp -a /home/mchs-android/vm_observer.py /home/mchs-android/vm_observer.py.bak-$(date +%Y%m%d-%H%M%S)
sudo -u mchs-android curl -fSL https://raw.githubusercontent.com/yurikov2126-pixel/media-raf-raw1/main/tools/mchs-sender/vm_observer.py -o /home/mchs-android/vm_observer.py
python3 -m py_compile /home/mchs-android/vm_observer.py
sudo systemctl restart mchs-observer.service
sudo journalctl -u mchs-observer.service --since '5 minutes ago' --no-pager | grep -E 'ACK|RETRY|HEARTBEAT_ACK|SNAPSHOT'
```

Если VM использует другой путь сервиса, сначала определите актуальный `ExecStart` и обновите только тот файл. Никогда не публикуйте переменную HMAC, локальную DB и содержимое сообщений. **Не удаляйте очередь и не сбрасывайте счётчик** для устранения ошибок.

После штатного подтверждения старого eventId монитор должен показать `queuedLocal:0` и `retryPending:0`, а две открытые технические неисправности автоматически закроются после свежих снимков. Значение `failedSends` в телеметрии — сумма `attempt` по *неподтверждённым* записям, поэтому после ACK оно также снизится.

PUSH из PR #1027 создаётся только для **новых** уникальных событий; этот PR не повторяет PUSH для старой тревоги и не изменяет звуковой эфир.
