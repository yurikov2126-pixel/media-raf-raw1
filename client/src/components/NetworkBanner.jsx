import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '../store/network.jsx';

// A brief outage should not interrupt an active screen. The recovery notice
// only appears if the offline notice was actually displayed.
export default function NetworkBanner() {
    const { isOffline } = useNetwork();
    const [notice, setNotice] = useState(null);
    const wasShown = useRef(false);

    useEffect(() => {
        let timer;
        if (isOffline) {
            setNotice(null);
            timer = window.setTimeout(() => {
                wasShown.current = true;
                setNotice('offline');
            }, 2500);
        } else if (wasShown.current) {
            wasShown.current = false;
            setNotice('restored');
            timer = window.setTimeout(() => setNotice(null), 3000);
        } else {
            setNotice(null);
        }
        return () => window.clearTimeout(timer);
    }, [isOffline]);

    if (!notice) return null;
    return (
        <div className={`mrr-netbanner ${notice === 'restored' ? 'mrr-netbanner--restored' : ''}`} role="status" aria-live="polite">
            <span className="mrr-netbanner__dot" aria-hidden="true" />
            <span>{notice === 'offline' ? 'Нет соединения. Ожидаем восстановления…' : 'Соединение восстановлено'}</span>
        </div>
    );
}
