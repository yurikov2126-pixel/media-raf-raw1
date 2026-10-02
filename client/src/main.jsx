import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { NetworkProvider } from './store/network.jsx';
import { AuthProvider } from './store/auth.jsx';
import { SocketProvider } from './store/socket.jsx';
import { NotificationsProvider } from './store/notifications.jsx';
import { SettingsProvider } from './store/settings.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        {/* NetworkProvider — снаружи остальных провайдеров:
            его слушатели событий успевают подключиться до того,
            как упадут первые запросы от Auth/Settings. */}
        <NetworkProvider>
            <SettingsProvider>
                <AuthProvider>
                    <SocketProvider>
                        <NotificationsProvider>
                            <App />
                        </NotificationsProvider>
                    </SocketProvider>
                </AuthProvider>
            </SettingsProvider>
        </NetworkProvider>
    </BrowserRouter>
);

/*
 * Снимаем inline-сплеш после того, как React отрисовал первый кадр.
 * Двойной requestAnimationFrame гарантирует, что React 18 уже закоммитил
 * первый рендер: <SplashScreen /> (или готовый контент) находится в DOM,
 * и переход происходит без мигания.
 */
requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        const inline = document.getElementById('mrr-splash-inline');
        if (!inline) return;
        inline.classList.add('mrr-splash--hidden');
        window.setTimeout(() => inline.remove(), 400);
    });
});