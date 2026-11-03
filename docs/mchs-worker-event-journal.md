# Политех-FM — журнал событий ALARM внутри Radio Worker (PR #960)

## Что записывается

В ограниченном журнале текущего процесса Radio Worker хранятся до 100
завершённых **учебных** PCM-сессий с явной привязкой к событию:

- `eventId`, `eventType`, `assetId`;
- `repeats` и `completedRepeats`;
- `startRevision` и конечная `revision`;
- `startedAt`, `completedAt`, `lastStopReason`;
- `naturalCompletion` (только `FILE_COMPLETED` и точное число повторов);
- `trialOnly:true`, `publicPlaybackAuthorized:false`.

Аудиофайл проигрывается до конца автоматически. Журнал отмечает завершение
на основании фактического состояния PCM-оверлея, а не HTTP-ответа START.
Сессия с прерванным или недочитанным файлом не становится успешной.

## Доставка и совместимость

В существующий защищённый маршрут `/mchs-training-stream` можно передать
необязательные поля `eventId`, `eventType`, `trialOnly:true`
одновременно с `START`. Старые не привязанные к событию учебные
запуски продолжают работать, но не создают поддельных event-bound
подтверждений.

Ответ GET возвращает `trainingEvent` и `lastTrainingEvent`; отдельный
адаптер `mchsVerifiedWorkerTransport` при `eventBindingRequired:true`
проверяет совпадение события и ревизии при старте и полном завершении.
Без корректного подтверждения успешный ответ не выдаётся.

`GET /api/safety/missile-natural-completion` показывает
`isolatedTrainingReceipt` отдельно от проверки реальных каналов.

## Границы

- Журнал в памяти процесса: после рестарта Worker история не сохраняется
  и не является долговечным доказательством.
- Транспорт строго учебный, выключен по умолчанию.
- Нет автоматического START от Android и доступа к включению усилителя.
- Подтверждение работы PCM-оверлея не равно подтверждению слышимости PA.
- Для производственного аварийного вещания требуется независимое
  подтверждение происхождения сообщений и согласованная проверка
  фактической доставки на оба аудиовыхода.

## CI

```sh
cd server
node --test tests/mchsWorkerEventJournal.test.js \
 tests/mchsVerifiedWorkerTransport.test.js \
 tests/radioMchsTrainingOverlay.test.js
```
