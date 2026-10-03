import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from 'react';
import { useSettings } from './settings.jsx';

const STORAGE_KEY = 'mrr_theme';
const VALID = ['dark', 'light', 'system'];

const Ctx = createContext(null);

export const useTheme = () =>
    useContext(Ctx) || {
        theme: 'dark',
        resolved: 'dark',
        setTheme: () => {},
        toggle: () => {},
    };

function getSystemTheme() {
    if (typeof window === 'undefined') return 'dark';
    try {
        return window.matchMedia?.('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark';
    } catch {
        return 'dark';
    }
}

function readStoredTheme() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return VALID.includes(v) ? v : null;
    } catch {
        return null;
    }
}

function writeStoredTheme(v) {
    try {
        if (v == null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, v);
    } catch {}
}

export function ThemeProvider({ children }) {
    const { raw } = useSettings();

    // Пользовательская тема (localStorage). null = ещё не выбрана
    const [theme, setThemeState] = useState(() => readStoredTheme());
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    // Если пользователь не выбирал — применяем тему по умолчанию из админки
    useEffect(() => {
        if (theme !== null) return;
        // raw.theme_default приходит из SettingsProvider (Setting key-value)
        const def = raw?.theme_default === 'light' ? 'light' : 'dark';
        setThemeState(def);
    }, [theme, raw?.theme_default]);

    // Следим за сменой системной темы (для theme === 'system')
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const handler = () => setSystemTheme(mq.matches ? 'light' : 'dark');
        // Для старых браузеров используем addListener, если addEventListener нет
        if (mq.addEventListener) {
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        } else if (mq.addListener) {
            mq.addListener(handler);
            return () => mq.removeListener(handler);
        }
    }, []);

    const resolved = theme === 'system' ? systemTheme : theme || 'dark';

    // Применяем data-theme и обновляем <meta name="theme-color">
    useEffect(() => {
        const html = document.documentElement;
        html.setAttribute('data-theme', resolved);

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute(
                'content',
                resolved === 'light' ? '#f5f5f7' : '#08080F'
            );
        }
    }, [resolved]);

    const setTheme = useCallback((next) => {
        if (!VALID.includes(next)) return;
        setThemeState(next);
        writeStoredTheme(next);
    }, []);

    // Цикл переключения: dark → light → system → dark
    const toggle = useCallback(() => {
        const order = ['dark', 'light', 'system'];
        const idx = order.indexOf(theme || 'dark');
        const next = order[(idx + 1) % order.length];
        setTheme(next);
    }, [theme, setTheme]);

    const value = useMemo(
        () => ({ theme: theme || 'dark', resolved, setTheme, toggle }),
        [theme, resolved, setTheme, toggle]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}