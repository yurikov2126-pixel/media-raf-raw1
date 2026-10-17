import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export function useRadioAccess() {
  const { token, user } = useAuth();
  const [allowed, setAllowed] = useState(user?.role === 'ADMIN');
  const [loading, setLoading] = useState(user?.role !== 'ADMIN');
  useEffect(() => {
    let active = true;
    if (!token || !user) { setAllowed(false); setLoading(false); return; }
    if (user.role === 'ADMIN') { setAllowed(true); setLoading(false); return; }
    setAllowed(false);
    setLoading(true);
    api('/radio/access', { token }).then(result => {
      if (active) setAllowed(result.allowed === true);
    }).catch(() => { if (active) setAllowed(false); }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token,user?.id,user?.role]);
  return { allowed, loading };
}
