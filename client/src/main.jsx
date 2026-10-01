import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './store/auth.jsx';
import { SocketProvider } from './store/socket.jsx';
import { NotificationsProvider } from './store/notifications.jsx';
import { SettingsProvider } from './store/settings.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <SettingsProvider>
            <AuthProvider>
                <SocketProvider>
                    <NotificationsProvider>
                        <App />
                    </NotificationsProvider>
                </SocketProvider>
            </AuthProvider>
        </SettingsProvider>
    </BrowserRouter>
);