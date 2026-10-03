import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './auth.jsx';

const Ctx = createContext(null);

export const useOnboarding = () =>
    useContext(Ctx) || {
        shouldShow: false,
        steps: [],
        loading: false,
        complete: () => {},
        reload: () => {},
    };

export function OnboardingProvider({ children }) {
    const { token, user } = useAuth();
    const [steps, setSteps] = useState([]);
    const [shouldShow, setShouldShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const reload = useCallback(async () => {
        if (!token || !user) {
            setSteps([]);
            setShouldShow(false);
            return;
        }
        setLoading(true);
        try {
            const r = await api('/onboarding/config', { token });
            setSteps(r.steps || []);
            setShouldShow(!!r.needsOnboarding);
        } catch {
            setSteps([]);
            setShouldShow(false);
        } finally {
            setLoading(false);
        }
    }, [token, user?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    const complete = useCallback(async () => {
        setShouldShow(false);
        setSteps([]);
        try {
            await api('/onboarding/complete', { method: 'POST', token });
        } catch {}
    }, [token]);

    return (
        <Ctx.Provider value={{ shouldShow, steps, loading, complete, reload }}>
            {children}
        </Ctx.Provider>
    );
}