# МЧС #972 — полный цикл внутри работающего центрального Windows Agent

В отличие от #970, это **не** отдельный VLC-пилот с локальной музыкой.
Оператор вручную запускает **сам `central_playout.py`** с дополнительными
аргументами. Его обычная программа идёт с медиа-сервера: `primary` VLC
принимает авторизованный MP3 через `Relay`, а при обрыве используется кэш.

## Локальный учебный цикл

1. Agent подключает **реальную центральную программу** и дожидается её
   новых пакетов (`PRIMARY_CONNECTING` и поток данных).
2. Один раз останавливает собственные primary и fallback VLC, не затрагивая
   Worker, общественный эфир или другие приложения Windows.
3. Воспроизводит подготовленный учебный WAV **опасности** 1–5 раз через
   `AlarmPlaybackSession`; каждое воспроизведение должно завершиться
   самостоятельно и с кодом VLC 0.
4. **Не используя STOP при штатном завершении**, восстанавливает центральную
   программу и проверяет новые байты центрального потока через монитор #968.
5. После четырёх секунд слышимой программы (программно подтверждено только
   поступление пакетов) повторяет переключение на отдельный учебный WAV
   **отбоя**, ровно один раз.
6. Снова восстанавливает центральную программу и подтверждает свежие пакеты.
   Конец помечается `MCHS_INTEGRATED_CYCLE_COMPLETE`.

Если нет разрешения устройства, WAV не проигрывается. При отказе VLC,
тайм-ауте или недостающем подтверждении завершения Agent пытается вернуть
музыку, **не переходит к отбою** и регистрирует
`MCHS_INTEGRATED_CYCLE_FAILED`. После успеха основной Agent продолжает
обычную работу до остановки оператором.

## Запуск на Windows

**Только при физически отсоединённом AA-300, любых других линиях PA и
подключённых наушниках.** Это одноразовый операторский тест; удалённое
событие и Android НЕ запускают его. Использовать только учебные WAV.

Перед запуском закройте предыдущий экземпляр центрального Agent, иначе
два экземпляра могут одновременно воспроизводить музыку. Публичное радио
на Worker на время испытания **не переключать**.

```powershell
cd "C:\Users\andrejurikov\MEDIA-RAF-RAW\radio-agent\windows"
$env:RADIO_AGENT_TOKEN = Read-Host "Radio Agent device token"

py .\central_playout.py `
  --vlc "C:\Program Files\VideoLAN\VLC\vlc.exe" `
  --enable-headphones-test `
  --isolated-cycle-danger-wav "C:\MchsTest\alarm_missile_start_pcm16.wav" `
  --isolated-cycle-all-clear-wav "C:\MchsTest\alarm_missile_end_pcm16.wav" `
  --isolated-cycle-repeats 4

Remove-Item Env:\RADIO_AGENT_TOKEN
```

После проверки файлов требуется вручную ввести `ISOLATED`.
**Токен никому не пересылать и не включать в скриншоты или логи.**

Признаки:
```text
MCHS_INTEGRATED_HEADPHONES_LOCAL_ONLY
PRIMARY_CONNECTING
MCHS_INTEGRATED_DANGER_START repeats=4
MCHS_INTEGRATED_RESTORE_REQUESTED DANGER True
MCHS_CENTRAL_RETURN_CONFIRMED
MCHS_INTEGRATED_ALL_CLEAR_START repeats=1
MCHS_INTEGRATED_RESTORE_REQUESTED ALL_CLEAR True
MCHS_CENTRAL_RETURN_CONFIRMED
MCHS_INTEGRATED_CYCLE_COMPLETE
```

Это свидетельство программной доставки и успешных выходов VLC. Агент
**не может программно подтвердить акустическую слышимость в PA**.

## Границы

- Никакого Android-триггера, API-команды START, управления Worker
  `MCHS_TRAINING`, публичного `/radio/live`, усилителем или ESP32.
- Учебные WAV существуют **локально** на Windows; GUI/автообновление EXE
  не активирует эксперимент по умолчанию.
- Это не финальная реализация реальной МЧС-тревоги. В реальном случае
  нужна проверка сквозного event-bound статуса и полной доставки в
  программный и физический каналы с соответствующими полномочиями.
- Монитор #968 проверяет поступление новых байтов в VLC после обоих
  сообщений, но это не измерение выходного звукового давления.

## Регрессионные тесты

```powershell
cd radio-agent/windows
py -m unittest -v test_mchs_integrated_headphones_cycle
```
