import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './store/toast.jsx';
import { NetworkProvider } from './store/network.jsx';
import { SettingsProvider } from './store/settings.jsx';
import { ThemeProvider } from './store/theme.jsx';
import { AuthProvider } from './store/auth.jsx';
import { ModulesProvider } from './store/modules.jsx';
import { SocketProvider } from './store/socket.jsx';
import { NotificationsProvider } from './store/notifications.jsx';
import { OnboardingProvider } from './store/onboarding.jsx';
import { GamificationProvider } from './store/gamification.jsx';
import './styles/index.css';
import './styles/ui2.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <ToastProvider>
            <NetworkProvider>
                <SettingsProvider>
                    <ThemeProvider>
                        <AuthProvider>
                            <ModulesProvider>
                                <SocketProvider>
                                    <NotificationsProvider>
                                        <GamificationProvider>
                                            <OnboardingProvider>
                                                <App />
                                            </OnboardingProvider>
                                        </GamificationProvider>
                                    </NotificationsProvider>
                                </SocketProvider>
                            </ModulesProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </SettingsProvider>
            </NetworkProvider>
        </ToastProvider>
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
