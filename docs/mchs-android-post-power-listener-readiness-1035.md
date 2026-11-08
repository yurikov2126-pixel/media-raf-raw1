# Этап 1035: готовность Android NotificationListener после аварийного восстановления VM

После отключения питания 8 ноября redroid и Observer были запущены, а `HEARTBEAT_ACK` поступал, но Android SQLite оставалась недоступна до восстановления ADB. Исправление PR #1034 восстановило транспорт. На этом этапе отделяем состояние `NotificationListener` от heartbeat на стороне read-only API.

## Что меняется
- `GET /api/safety/telemetry-alerts` теперь использует уже сохраняемые сведения о `listener` и `snapshotOk` из трёх последовательных свежих heartbeat-снимков, а не только факт наличия heartbeat.
- Появляется отдельное предупреждение `ANDROID_LISTENER_DISCONNECTED`, если у Android выключен или не поднялся NotificationListener после рестарта, хотя VM отправляет heartbeat.
- При трёх последовательных сбоях чтения SQLite отображается `ANDROID_SNAPSHOT_UNAVAILABLE` (вместо неверного впечатления, что всё работает по heartbeat).
- В ответ добавлен объект `receiver` с текущей классификацией: `RECEIVER_OBSERVED`, `LISTENER_DISCONNECTED`, `SNAPSHOT_UNAVAILABLE`, `RECOVERING_OR_UNKNOWN`, `INSUFFICIENT_SAMPLES`, `HEARTBEAT_STALE`.
- Нет нового способа активировать эфир, нет синтетических событий или изменения доверия к Android. `RECEIVER_OBSERVED` никогда не означает, что FCM/push-доставка будущих уведомлений доказана.

## Проверка на VM
После доставки PR в production проверить штатный приём уведомлений без генерации тестовой тревоги. На VM безопасно:
```bash
adb -s 127.0.0.1:5557 shell getprop sys.boot_completed
adb -s 127.0.0.1:5557 shell dumpsys notification | grep -A 12 'Live notification listeners'
sudo journalctl -u mchs-observer.service --since '10 minutes ago' --no-pager | grep -E 'ADB_|SNAPSHOT|HEARTBEAT_ACK|POLL_ERROR' | tail -30
```
Не публикуйте полную информацию о телефонах или текст уведомлений. Наличие `CONNECTED` означает доступность listener, а не доставку будущих push.
