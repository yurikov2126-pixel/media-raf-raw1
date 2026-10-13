import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import Analytics from './Admin/tabs/Analytics.jsx';

// Только просмотр аналитики. Нет загрузки иных ресурсов админки.
export default function DelegatedAnalytics() {
  const { token } = useAuth();
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setAccess(null);
    api('/admin/access', { token })
      .then(data => { if (active) setAccess(Boolean(data.analytics)); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  return <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
    <h1 className="mb-5 text-2xl font-bold">📈 Аналитика платформы</h1>
    {error ? <p role="alert">{error}</p> :
      access === null ? <p role="status">Проверяем права…</p> :
      access ? <Analytics token={token} /> :
      <p role="alert">Нет разрешения на просмотр аналитики.</p>}
  </div>;
}
