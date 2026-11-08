# Автоматическое восстановление ADB после перезапуска Proxmox/VM/redroid

Наблюдение 8 ноября 2026: redroid на 127.0.0.1:5557 был запущен, но соединение ADB отсутствовало. `mchs-observer.service` работал и отправлял `HEARTBEAT_ACK`, однако фиксировал `SNAPSHOT -1`. Ручная команда `adb connect 127.0.0.1:5557` восстановила `SNAPSHOT 44`.

Теперь observer в каждом цикле опроса проверяет `adb -s 127.0.0.1:5557 get-state`, при отсутствии соединения выполняет `adb connect 127.0.0.1:5557` и повторно проверяет `get-state`. Это не вызывает Android-команды тревоги, не удаляет SQLite, не сбрасывает очередь и не отменяет регулярный heartbeat. Наличие `HEARTBEAT_ACK` **не означает** `snapshotOk=true`; соответствующие поля уже предусмотрены телеметрией.

## Развёртывание на mchs-android (после merge)

Сначала убедиться в отсутствии активного незавершённого уведомления и наличии локальной резервной копии проверенного файла. После merge в `main`:

```bash
curl -fsSL https://raw.githubusercontent.com/yurikov2126-pixel/media-raf-raw1/main/tools/mchs-sender/vm_observer.py -o /tmp/mchs-vm-observer-new.py
python3 -m py_compile /tmp/mchs-vm-observer-new.py
sudo install -o mchs-android -g mchs-android -m 0644 /tmp/mchs-vm-observer-new.py /home/mchs-android/vm_observer.py
sudo systemctl restart mchs-observer.service
sudo journalctl -u mchs-observer.service -n 30 --no-pager
```

Если Android ещё не запущен, Observer продолжает работать и сообщать о деградации; в следующем цикле ADB переподключится. Чтобы контейнер запускался после перезагрузки VM, в отдельном maintenance window применить:

```bash
sudo docker update --restart unless-stopped mchs-redroid-google
sudo docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' mchs-redroid-google
```

Это **не** включает автозапуск самой Proxmox VM: он настраивается на хосте Proxmox отдельно.

## Что проверять

В журнале после загрузки: `ADB_RECONNECTED` при восстановлении соединения, потом `SNAPSHOT N` с N >= 0 и `HEARTBEAT_ACK`. При недоступности Android: `ADB_UNAVAILABLE`, `SNAPSHOT_ERROR`, `SNAPSHOT -1` при продолжающемся heartbeat.

Не очищать `~/.local/state/mchs-observer/queue.db`. `pending 0` показывает отсутствие неотправленных локальных записей, а не подтверждение реального озвучивания предупреждений.
