# Политех-FM — поэтапный тест часовых объявлений в реальном эфире

Реальный эфир является выбранным испытательным окружением. **Включение прерывает текущую станцию при перезапуске службы**, поэтому выбирайте спокойный интервал и заранее сохраните журнал. CI подтверждает только синтаксис и модульные тесты — не качество реального звучания.

## 1. Перед включением

- Объединить PR и задеплоить новую версию. Проверить `git log -1 --format='%h %s'`.
- Убедиться, что выбранный час имеет прикреплённый корректный файл категории `TIME_SIGNAL`, а настройка объявления включена в админке.
- Сохранить текущий systemd override и узнать его источник: `sudo systemctl cat mediaraf-radio-playout.service`.
- Подготовить команду возврата обоих флагов в `false` ниже.

## 2. Первый час — только AutoDJ

```bash
sudo mkdir -p /etc/systemd/system/mediaraf-radio-playout.service.d
printf '[Service]\nEnvironment="RADIO_HOURLY_SIGNAL_PCM_ENABLED=true"\nEnvironment="RADIO_HOURLY_SCHEDULED_PCM_ENABLED=false"\n' \
  | sudo tee /etc/systemd/system/mediaraf-radio-playout.service.d/hourly-signal.conf
sudo systemctl daemon-reload
sudo systemctl restart mediaraf-radio-playout.service
sudo systemctl show mediaraf-radio-playout.service -p Environment
```

Наблюдать одну часовую границу в AutoDJ. Прослушать через сайт и Windows Radio Agent. Не продолжать этап при повторном треке, паузе, клике, срыве LIVE или дублировании объявления.

## 3. Второй этап — передачи по эфирной сетке

Только если первый час чистый, заменить `RADIO_HOURLY_SCHEDULED_PCM_ENABLED=false` на `true` в файле `hourly-signal.conf`; выполнить `daemon-reload` и `restart`. Проверить следующий час, когда играет передача по сетке. Тестировать переход с длинной песней, с короткой и во время Crossfade, не нарушая начало следующей программы.

## 4. Журнал наблюдений

```bash
sudo journalctl -u mediaraf-radio-playout.service --since "20 minutes ago" --no-pager \
  | grep -E 'RADIO_HOURLY_|RADIO_CROSSFADE|RADIO_SOURCE_BOUNDARY|RADIO_SLOT_END_MISMATCH|RADIO_REVERSE_AUTHORITY|ERROR' \
  | tee /tmp/politech-hourly-live-check.log
```

Прислать время (Москва), название и индекс песен до/после, слышимую проблему (если была) и журнал. Состояние `EMITTED` в журнале не доказывает корректное звучание — нужна прослушка.

## 5. Немедленный откат

```bash
sudo sed -i 's/RADIO_HOURLY_SIGNAL_PCM_ENABLED=true/RADIO_HOURLY_SIGNAL_PCM_ENABLED=false/; s/RADIO_HOURLY_SCHEDULED_PCM_ENABLED=true/RADIO_HOURLY_SCHEDULED_PCM_ENABLED=false/' \
  /etc/systemd/system/mediaraf-radio-playout.service.d/hourly-signal.conf
sudo systemctl daemon-reload
sudo systemctl restart mediaraf-radio-playout.service
```

После отката проверить фактическое окружение и отсутствие новых `RADIO_HOURLY_INTERRUPT_ARMED`. Если в службе есть другие `EnvironmentFile` или override с теми же именами, проверить их приоритет до начала испытаний.
