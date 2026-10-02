import { useNetwork } from '../store/network.jsx';

/* Тонкая полоса сверху, когда связь пропала, но приложение уже
   открыто и пользователь продолжает работать с тем, что в памяти.
   Полноэкранный OfflineScreen здесь не нужен — жалко выкидывать
   человека из контекста (лента, чат, курс). */
export default function NetworkBanner() {
    const { isOffline } = useNetwork();
    if (!isOffline) return null;

    return (
        <div className="mrr-netbanner" role="status" aria-live="polite">
            <span className="mrr-netbanner__dot" aria-hidden="true" />
            <span>Нет подключения к серверу. Проверьте интернет или VPN.</span>
        </div>
    );
}