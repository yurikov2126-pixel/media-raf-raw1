# Проверка восстановления Политех-FM после ALARM

После объединения PR #961 завершение двух аудиофайлов считается успешным
только при подтверждении естественного окончания. Но это не равнозначно
доказательству, что обычная радиопрограмма снова воспроизводится.

В PR #962 добавлена независимая **только читающая** проверка:

- Worker: привязанная учебная ALARM-сессия завершилась `FILE_COMPLETED`
  с полным количеством повторов;
- PCM-оверлей выключен, его состояние — `NORMAL_PROGRAM`;
- Worker health возвращает известный источник (`AUTO_DJ`,
  `SCHEDULED`, `LIVE`, `MANUAL_PLAYLIST`, `AUTO_PLAYLIST`),
  без зарегистрированной ошибки;
- Windows Agent передал v2 отчёт того же ALARM с естественным
  завершением и полным числом повторов;
- после завершения ALARM получена свежая аудиотелеметрия Agent,
  где `playback=PLAYING`, `source=CENTRAL` и есть свежие пакеты.

Административный маршрут:

```
GET /api/safety/missile-station-resume
```

Он возвращает `workerReturnedToProgram`,
`agentReturnedToCentral`, `bothSoftwareChannelsResumed`,
`holds` и `physicalAudibilityVerified:false`.

**Важная разница:** успешное восстановление программной цепочки
не доказывает наличие звука на физических громкоговорителях.
`LOCAL_RESERVE` означает отдельный резерв Agent и не выдаётся
за возвращение центрального потока. Недоступная, устаревшая или
противоречивая телеметрия блокирует положительный вывод.

Результат `runMchsTwoChannelExecution` после
`NATURAL_COMPLETION_CONFIRMED` теперь явно содержит
`normalProgramVerified:false` и `resumeEvidenceRequired:true`.
Команды STOP при штатном завершении не добавляются.

Проверки:
```bash
cd server
node --test tests/mchsStationResumeEvidence.test.js \
  tests/mchsTwoChannelExecutor.test.js \
  tests/mchsNaturalCompletionEvidence.test.js
```

Ограничения: маршрут не запускает ALARM, не переключает источники
и не включает PA. Используются только существующие
учебные event-bound записи и телеметрия. Никакая авторизация
вещания не выводится из этих данных.
