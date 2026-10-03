import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { NetworkProvider } from './store/network.jsx';
import { SettingsProvider } from './store/settings.jsx';
import { ThemeProvider } from './store/theme.jsx';
import { AuthProvider } from './store/auth.jsx';
import { ModulesProvider } from './store/modules.jsx';
import { SocketProvider } from './store/socket.jsx';
import { NotificationsProvider } from './store/notifications.jsx';
import { OnboardingProvider } from './store/onboarding.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <NetworkProvider>
            <SettingsProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <ModulesProvider>
                            <SocketProvider>
                                <NotificationsProvider>
                                    <OnboardingProvider>
                                        <App />
                                    </OnboardingProvider>
                                </NotificationsProvider>
                            </SocketProvider>
                        </ModulesProvider>
                    </AuthProvider>
                </ThemeProvider>
            </SettingsProvider>
        </NetworkProvider>
    </BrowserRouter>
);

requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        const inline = document.getElementById('mrr-splash-inline');
        if (!inline) return;
        inline.classList.add('mrr-splash--hidden');
        window.setTimeout(() => inline.remove(), 400);
    });
});