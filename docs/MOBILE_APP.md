# MEDIA·RAF·RAW Mobile — Android и iOS

## Статус
Первый этап: отдельная ветка, конфигурация Capacitor и инструкции по локальной сборке. **APK/IPA пока не собраны и не проверены на устройствах.** Production не изменяется.

## Принципы
- Общий React-клиент и существующий сервер Express/Socket.IO.
- Мобильная сборка содержит локальный `dist`, а не загружает удалённый сайт в WebView.
- Для тестирования использовать только preview API; не переносить секреты или production-БД.
- Для production нужны отдельная конфигурация и тестирование перед выпуском.

## Подготовка
В каталоге `client`:

```bash
npm ci
npm install --save @capacitor/core @capacitor/app @capacitor/keyboard @capacitor/status-bar @capacitor/splash-screen
npm install --save-dev @capacitor/cli @capacitor/android @capacitor/ios
cp .env.mobile.example .env.mobile
npm run build -- --mode mobile
npx cap add android
npx cap add ios
npx cap sync
```

Android: `npx cap open android` (Android Studio). iOS: `npx cap open ios` (Xcode на macOS). Сгенерированные нативные проекты нужно сохранять в репозитории отдельным PR после проверки сборки.

## Обязательные задачи перед рабочим релизом
1. Сделать независимую от `window.location.origin` обработку API и ссылок на файлы, проверить CORS.
2. Защищённое хранение JWT на устройстве и корректный logout/refresh.
3. Отключить регистрацию PWA Service Worker в нативной сборке; адаптировать роутинг и возврат назад.
4. Нативные push через FCM/APNs с серверной регистрацией устройств и deeplink.
5. Camera/Photos/files permissions, загрузка с прогрессом и восстановление Socket.IO.
6. Проверить safe areas, клавиатуру, жизненный цикл приложения и все ключевые сценарии.
7. Автоматизированные проверки, сборки Android/iOS, подпись и политика магазинов.

**Не подключать мобильную ветку к preview auto-deploy без отдельного решения.**
