import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
const Ctx = createContext(null);

export const useSettings = () => {
    const v = useContext(Ctx);
    if (!v) throw new Error('useSettings must be used inside <SettingsProvider>');
    return v;
};

const DEFAULT_NAV = [
    { to: '/app', label: 'Главная', end: true, icon: 'dashboard' },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'book' },
];

const DEFAULTS = {
    site_name: 'MEDIA-RAF-RAW',
    site_description: 'Студенческий медиацентр',
    brand_logo_text: 'MEDIA·RAF·RAW',
    brand_logo_subtitle: 'Студенческий медиацентр',
    brand_accent_1: '#7C3AED',
    brand_accent_2: '#EC4899',
    brand_accent_3: '#06B6D4',

    landing_hero_badge: 'Студенческий медиацентр',
    landing_hero_title_prefix: 'Создаём',
    landing_hero_title_accent: 'контент',
    landing_hero_title_suffix: ', который цепляет',
    landing_hero_subtitle: 'Платформа для студентов MEDIA-RAF-RAW.',
    landing_hero_cta_primary: 'Присоединиться →',
    landing_hero_cta_secondary: 'Что внутри',
    landing_features_title: 'Что мы делаем',
    landing_features: '[]',
    landing_cta_title: 'Готов в эфир?',
    landing_cta_subtitle: 'Регистрируйся и становись частью команды',
    landing_cta_button: 'Создать аккаунт',

    nav_items: JSON.stringify(DEFAULT_NAV),

    dashboard_enabled: 'true',
    dashboard_show_greeting: 'true',
    dashboard_show_quick_actions: 'true',
    dashboard_show_learning: 'true',
    dashboard_show_gamification: 'true',
    dashboard_show_notifications: 'true',
    dashboard_show_feed_preview: 'true',
    dashboard_welcome_title: 'Твоя медиа-команда в одном месте',
    dashboard_welcome_subtitle: 'Публикуй, общайся, учись и следи за своим прогрессом в MEDIA·RAF·RAW.',

    command_palette_enabled: 'true',
    ui_font_scale: '1',
    ui_radius: 'standard',
    ui_motion: 'full',

    footer_description: 'MEDIA·RAF·RAW · Твоя медиа-команда',
    footer_copyright: '© MEDIA-RAF-RAW',
    footer_links: '[]',

    certificate_template: 'gradient',
    certificate_accent_1: '#7C3AED',
    certificate_accent_2: '#EC4899',
    certificate_org_name: 'MEDIA·RAF·RAW',
    certificate_subtitle: 'Студенческий медиацентр',
    certificate_signature: '',
};

function safeJSON(str, fallback) {
    try {
        const v = JSON.parse(str);
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

const asBool = (value, fallback = true) => {
    if (value == null || value === '') return fallback;
    return value !== false && value !== 'false';
};

export function SettingsProvider({ children }) {
    const [raw, setRaw] = useState(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BASE}/settings/public`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setRaw({ ...DEFAULTS, ...data });
        } catch (e) {
            setError(e.message);
            setRaw(DEFAULTS);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    useEffect(() => {
        const root = document.documentElement;
        const a1 = raw.brand_accent_1 || DEFAULTS.brand_accent_1;
        const a2 = raw.brand_accent_2 || DEFAULTS.brand_accent_2;
        const a3 = raw.brand_accent_3 || DEFAULTS.brand_accent_3;

        root.style.setProperty('--brand-accent-1', a1);
        root.style.setProperty('--brand-accent-2', a2);
        root.style.setProperty('--brand-accent-3', a3);
        root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${a1} 0%, ${a2} 50%, ${a3} 100%)`);

        const scale = ['0.95', '1', '1.05'].includes(String(raw.ui_font_scale))
            ? String(raw.ui_font_scale)
            : '1';
        root.style.setProperty('--ui-font-scale', scale);

        const radiusMap = {
            compact: { sm: '9px', md: '12px', lg: '17px', xl: '21px' },
            standard: { sm: '12px', md: '16px', lg: '22px', xl: '28px' },
            soft: { sm: '14px', md: '19px', lg: '26px', xl: '32px' },
        };
        const radius = radiusMap[raw.ui_radius] || radiusMap.standard;
        Object.entries(radius).forEach(([key, value]) => root.style.setProperty(`--ui-radius-${key}`, value));

        root.style.setProperty('--ui-motion', raw.ui_motion === 'reduced' ? '70ms' : '180ms');
    }, [raw.brand_accent_1, raw.brand_accent_2, raw.brand_accent_3, raw.ui_font_scale, raw.ui_radius, raw.ui_motion]);

    useEffect(() => {
        if (raw.site_name) document.title = raw.site_name;
    }, [raw.site_name]);

    const value = useMemo(() => {
        const features = safeJSON(raw.landing_features, []);
        const navItems = safeJSON(raw.nav_items, []);
        const footerLinks = safeJSON(raw.footer_links, []);

        return {
            raw,
            settings: raw,
            loading,
            error,
            reload,
            brand: {
                logoText: raw.brand_logo_text,
                logoSubtitle: raw.brand_logo_subtitle,
                accent1: raw.brand_accent_1,
                accent2: raw.brand_accent_2,
                accent3: raw.brand_accent_3,
            },
            landing: {
                badge: raw.landing_hero_badge,
                titlePrefix: raw.landing_hero_title_prefix,
                titleAccent: raw.landing_hero_title_accent,
                titleSuffix: raw.landing_hero_title_suffix,
                subtitle: raw.landing_hero_subtitle,
                ctaPrimary: raw.landing_hero_cta_primary,
                ctaSecondary: raw.landing_hero_cta_secondary,
                featuresTitle: raw.landing_features_title,
                features: Array.isArray(features) ? features : [],
                ctaTitle: raw.landing_cta_title,
                ctaSubtitle: raw.landing_cta_subtitle,
                ctaButton: raw.landing_cta_button,
            },
            nav: {
                items: Array.isArray(navItems) && navItems.length > 0 ? navItems : DEFAULT_NAV,
            },
            dashboard: {
                enabled: asBool(raw.dashboard_enabled),
                showGreeting: asBool(raw.dashboard_show_greeting),
                showQuickActions: asBool(raw.dashboard_show_quick_actions),
                showLearning: asBool(raw.dashboard_show_learning),
                showGamification: asBool(raw.dashboard_show_gamification),
                showNotifications: asBool(raw.dashboard_show_notifications),
                showFeedPreview: asBool(raw.dashboard_show_feed_preview),
                welcomeTitle: raw.dashboard_welcome_title || DEFAULTS.dashboard_welcome_title,
                welcomeSubtitle: raw.dashboard_welcome_subtitle || DEFAULTS.dashboard_welcome_subtitle,
            },
            commandPalette: {
                enabled: asBool(raw.command_palette_enabled),
                shortcutLabel: typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
            },
            footer: {
                description: raw.footer_description,
                copyright: raw.footer_copyright,
                links: Array.isArray(footerLinks) ? footerLinks : [],
            },
        };
    }, [raw, loading, error, reload]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
