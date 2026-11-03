# МЧС: Windows Agent — испытание звука в наушниках

Это **ручное локальное испытание**, не автоматическая тревога. Компьютер с
Windows Agent должен быть физически отсоединён от усилителя AA-300 и любых
иных путей громкоговорящего оповещения. Оператор лично подтверждает изоляцию.
Не используется ESP32, Radio Worker public encoder или START реального события.

## Сервер

После объединения PR и развёртывания в согласованное окно перезапуска:
- Worker продолжает работать на loopback и должен иметь
  `RADIO_MCHS_ISOLATED_WAV_ENABLED=true` только на время испытания.
- У API должен быть задан `MCHS_AGENT_LAB_DEVICE_ID` устройства Agent.
- В окружении API на время испытания задать
  `MCHS_AGENT_HEADPHONES_SELF_TEST_ENABLED=true`.
- Перезапустить только службы, где изменилось окружение/код.
- Секрет Worker `RADIO_PLAYOUT_SECRET` не переносится на Windows.

Проверка: `GET /api/radio-agent/agent/mchs-headphones-self-test.wav`
с авторизацией Bearer устройства возвращает 2-секундный WAV 48kHz stereo PCM16.
Этот API не выдаёт START и не может включить публичный сигнал.

## Windows (командная строка PowerShell)

Нужна установленная Python-среда или совместимая сборка скрипта,
`RADIO_AGENT_TOKEN`, VLC и код `radio-agent/windows`. Обычный Agent
может оставаться запущенным; отдельный WAV-процесс не переключает его эфир.

```powershell
$env:RADIO_AGENT_TOKEN = Read-Host "Radio Agent token"
python .\mchs_headphones_trial.py --server https://mediarafraw.ru --vlc "C:\Program Files\VideoLAN\VLC\vlc.exe" --repeats 5
```

Сначала будет скачан WAV с сервера и проверен его формат. Ввести
`ISOLATED` только после физического отключения усилителя и проверки
наушников. В консоли появится `LOCAL_START`. Нажать Enter до завершения
повторов — это местный STOP. Итог `LOCAL_STOP` должен содержать
`stopConfirmed: True`. Вывод не подтверждает физическую тишину и не
переключает радио. Аварийный STOP от сервера проверяется отдельно.

После испытания выключить оба тестовых env-флага, перезапустить
соответствующие службы в согласованное окно и удалить переменную токена
из сеанса PowerShell:

```powershell
Remove-Item Env:\RADIO_AGENT_TOKEN
```

Если при тесте звук слышен в публичном `/radio/live`, немедленно остановить
локальный сеанс и прекратить испытание. Не подключать усилитель до завершения
всех проверок изоляции.

## Режим естественного завершения (PR #965)

Для испытания всех повторов без ручного STOP используйте:

```powershell
python .\mchs_headphones_trial.py --server https://mediarafraw.ru --vlc "C:\Program Files\VideoLAN\VLC\vlc.exe" --repeats 4 --natural --completion-timeout 60
```

После подтверждения `ISOLATED` дождитесь `LOCAL_COMPLETE`:
`state=COMPLETED`, `naturalCompletion=True`,
`completedRepeats=expectedRepeats=4`, `processRunning=False`.
Этот режим естественно завершает отдельный VLC после каждого проигрывания,
не отправляя STOP при успешном окончании. При тайм-ауте или ошибке
выполняется локальная остановка с `LOCAL_FAULT_STOP`. Для прежнего
ручного теста просто не указывайте `--natural`.

Ограничение: это **локальное воспроизведение тестового WAV**, а не
реальный сигнал опасности, не общий Worker overlay и не автоматическая
двухканальная тревога. Действующий Radio Agent не переключается:
тестовый VLC может звучать одновременно с обычной музыкой.
