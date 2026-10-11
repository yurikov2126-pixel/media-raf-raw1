import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../store/auth.jsx';
import { useSettings } from '../../store/settings.jsx';
import { useNotifications } from '../../store/notifications.jsx';
import { TABS, TAB_GROUPS } from './constants.js';

import AdminSkeleton from './components/AdminSkeleton.jsx';
import AdminCommandPalette from './components/AdminCommandPalette.jsx';

import Dashboard from './tabs/Dashboard.jsx';

const Analytics = lazy(() => import('./tabs/Analytics.jsx'));
const Users = lazy(() => import('./tabs/Users.jsx'));
const Certificates = lazy(() => import('./tabs/Certificates.jsx'));
const Broadcast = lazy(() => import('./tabs/Broadcast.jsx'));
const Push = lazy(() => import('./tabs/Push.jsx'));
const Backups = lazy(() => import('./tabs/Backups.jsx'));
const Moderation = lazy(() => import('./tabs/Moderation.jsx'));
const Settings = lazy(() => import('./tabs/Settings.jsx'));
const Modules = lazy(() => import('./tabs/Modules.jsx'));
const Gamification = lazy(() => import('./tabs/Gamification.jsx'));
const PasswordResets = lazy(() => import('./tabs/PasswordResets.jsx'));
const PracticalsHomework = lazy(() => import('./tabs/PracticalsHomework.jsx'));
const Actions = lazy(() => import('./tabs/Actions.jsx'));

const CoursesRoot = lazy(() => import('./tabs/Courses/index.jsx'));
const WikiRoot = lazy(() => import('./tabs/Wiki/index.jsx'));
const BulkRoot = lazy(() => import('./tabs/Bulk/index.jsx'));
const SiteDesignRoot = lazy(() => import('./tabs/SiteDesign/index.jsx'));

const VALID_TABS = new Set(TABS.map(([k]) => k));
const TAB_META = Object.fromEntries(TABS.map(([k, l, i]) => [k, { label: l, icon: i }]));

export default function Admin() {
    const { token } = useAuth();
    const { reload: reloadSettings } = useSettings();
    const { items: notifications } = useNotifications();
    const [searchParams, setSearchParams] = useSearchParams();

    const rawTab = searchParams.get('tab') || 'dash';
    const tab = VALID_TABS.has(rawTab) ? rawTab : 'dash';
    const setTab = (t) => setSearchParams({ tab: t }, { replace: true });

    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [settings, setSettings] = useState({});
    const [openReports, setOpenReports] = useState(0);
    const [pendingResets, setPendingResets] = useState(0);
    const [paletteOpen, setPaletteOpen] = useState(false);

    const reloadReportsBadge = () => {
        api('/admin/reports?status=NEW&limit=1', { token })
            .then((r) => setOpenReports(r.total || 0))
            .catch(() => {});
    };

    const reloadResetsBadge = () => {
        api('/admin/password-resets?status=PENDING', { token })
            .then((r) => setPendingResets(r.stats?.pending || 0))
            .catch(() => {});
    };

    const reloadAll = () => {
        api('/admin/stats', { token }).then(setStats).catch(() => {});
        api('/admin/users', { token }).then(setUsers).catch(() => {});
        api('/admin/courses', { token }).then(setCourses).catch(() => {});
        api('/admin/certificates', { token }).then(setCertificates).catch(() => {});
        api('/admin/settings', { token }).then(setSettings).catch(() => {});
        reloadReportsBadge();
        reloadResetsBadge();
    };

    useEffect(() => {
        reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        const hasUnreadReport = notifications.some(
            (n) => n.type === 'report' && !n.readAt
        );
        const hasUnreadReset = notifications.some(
            (n) => n.type === 'password_reset' && !n.readAt
        );
        if (hasUnreadReport) reloadReportsBadge();
        if (hasUnreadReset) reloadResetsBadge();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notifications]);

    useEffect(() => {
        const t = setInterval(() => {
            reloadReportsBadge();
            reloadResetsBadge();
        }, 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ⌘K / Ctrl+K открывает палитру
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const badges = {
        moderation: openReports || 0,
        'password-resets': pendingResets || 0,
    };

    const currentMeta = TAB_META[tab] || { icon: '⚙️', label: 'Админка' };
    const activeGroup = TAB_GROUPS.find(group => group.tabs.some(([key]) => key === tab)) || TAB_GROUPS[0];

    return (
        <section className="editorial-glass mx-auto max-w-7xl px-3 py-3 sm:px-5 md:py-5" aria-label="Администрирование">
            <header className="editorial-glass__header mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">MEDIA·RAF·RAW / Управление платформой</p>
                    <h1 className="mt-1 text-2xl font-semibold text-violet-700 dark:text-violet-100">Админка</h1>
                </div>
                <button type="button" onClick={() => setPaletteOpen(true)} className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800" aria-label="Поиск по админке">⌕ Поиск <kbd className="ml-1 hidden text-xs opacity-60 sm:inline">⌘K</kbd></button>
            </header>
            <nav aria-label="Группы разделов админки" className="editorial-workspace-nav editorial-glass__nav mb-3 flex flex-wrap gap-2" data-no-route-swipe>
                {TAB_GROUPS.map(group => <button key={group.key} type="button" aria-pressed={activeGroup.key === group.key} onClick={() => setTab(group.tabs[0][0])} className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${activeGroup.key === group.key ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{group.label}{group.key === 'people' && badges.moderation + badges['password-resets'] > 0 ? ` · ${badges.moderation + badges['password-resets']}` : ''}</button>)}
            </nav>
            <nav aria-label="Разделы группы" className="mb-5 flex flex-wrap gap-2" data-no-route-swipe>
                {activeGroup.tabs.map(([key, label, icon]) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)} className={`min-h-10 rounded-xl border px-3 py-2 text-sm transition-colors ${tab === key ? 'border-violet-500 bg-violet-100 font-semibold text-violet-900 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-100' : 'border-slate-200 bg-white/70 text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200'}`}>{icon} {label}{badges[key] > 0 ? ` · ${badges[key]}` : ''}</button>)}
            </nav>
            <div className="editorial-glass__surface min-w-0 rounded-2xl border border-current/10 p-3 sm:p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{currentMeta.icon} {currentMeta.label}</h2>
                <div className="min-w-0">
                    <Suspense fallback={<AdminSkeleton />}>
                        {tab === 'dash' && (
                            <Dashboard stats={stats} token={token} onReload={reloadAll} />
                        )}
                        {tab === 'analytics' && <Analytics token={token} />}
                        {tab === 'moderation' && (
                            <Moderation token={token} onChanged={reloadAll} />
                        )}
                        {tab === 'users' && (
                            <Users users={users} setUsers={setUsers} token={token} />
                        )}
                        {tab === 'courses' && (
                            <CoursesRoot
                                courses={courses}
                                setCourses={setCourses}
                                token={token}
                            />
                        )}
                        {tab === 'practicals-homework' && (
                            <PracticalsHomework token={token} courses={courses} />
                        )}
                        {tab === 'wiki' && <WikiRoot token={token} />}
                        {tab === 'certificates' && (
                            <Certificates
                                certificates={certificates}
                                setCertificates={setCertificates}
                                users={users}
                                courses={courses}
                                token={token}
                            />
                        )}
                        {tab === 'broadcast' && (
                            <Broadcast token={token} users={users} courses={courses} />
                        )}
                        {tab === 'push' && (
                            <Push token={token} users={users} courses={courses} />
                        )}
                        {tab === 'bulk' && (
                            <BulkRoot
                                token={token}
                                users={users}
                                courses={courses}
                                onReload={reloadAll}
                            />
                        )}
                        {tab === 'site' && (
                            <SiteDesignRoot
                                settings={settings}
                                setSettings={setSettings}
                                token={token}
                                onSaved={() => reloadSettings()}
                            />
                        )}
                        {tab === 'modules' && <Modules token={token} />}
                        {tab === 'gamification' && <Gamification token={token} />}
                        {tab === 'backups' && <Backups token={token} />}
                        {tab === 'actions' && <Actions token={token} />}
                        {tab === 'password-resets' && <PasswordResets token={token} />}
                        {tab === 'settings' && (
                            <Settings
                                settings={settings}
                                setSettings={setSettings}
                                token={token}
                            />
                        )}
                    </Suspense>
                </div>
            </div>
            {paletteOpen && <AdminCommandPalette token={token} onClose={() => setPaletteOpen(false)} />}
        </section>
    );
}
