import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../store/auth.jsx';
import { useSettings } from '../../store/settings.jsx';
import { useNotifications } from '../../store/notifications.jsx';
import { TABS } from './constants.js';

import AdminSkeleton from './components/AdminSkeleton.jsx';
import AdminSidebar from './components/AdminSidebar.jsx';
import AdminCommandPalette from './components/AdminCommandPalette.jsx';

import Dashboard from './tabs/Dashboard.jsx';

const EditorialTeam = lazy(() => import('./tabs/EditorialTeam.jsx'));
const GeneralStudentChat = lazy(() => import('./tabs/GeneralStudentChat.jsx'));
const Roles = lazy(() => import('./tabs/Roles.jsx'));
const Analytics = lazy(() => import('./tabs/Analytics.jsx'));
const Users = lazy(() => import('./tabs/Users.jsx'));
const Certificates = lazy(() => import('./tabs/Certificates.jsx'));
const Broadcast = lazy(() => import('./tabs/Broadcast.jsx'));
const MessengerUI = lazy(() => import('./tabs/MessengerUI.jsx'));
const Push = lazy(() => import('./tabs/Push.jsx'));
const Backups = lazy(() => import('./tabs/Backups.jsx'));
const Moderation = lazy(() => import('./tabs/Moderation.jsx'));
const Settings = lazy(() => import('./tabs/Settings.jsx'));
const Modules = lazy(() => import('./tabs/Modules.jsx'));
const StorageCenter = lazy(() => import('./tabs/StorageCenter.jsx'));
const DashboardWidgets = lazy(() => import('./tabs/DashboardWidgets.jsx'));
const Gamification = lazy(() => import('./tabs/Gamification.jsx'));
const PasswordResets = lazy(() => import('./tabs/PasswordResets.jsx'));
const PracticalsHomework = lazy(() => import('./tabs/PracticalsHomework.jsx'));
const Actions = lazy(() => import('./tabs/Actions.jsx'));

const CoursesRoot = lazy(() => import('./tabs/Courses/index.jsx'));
const Competencies = lazy(() => import('./tabs/Competencies.jsx'));
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
    const [drawerOpen, setDrawerOpen] = useState(false);
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

    // Esc закрывает drawer
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

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

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-transparent via-transparent to-violet/5">
            <aside className="hidden xl:flex flex-col w-64 shrink-0 sticky top-0 h-screen py-7 px-4 overflow-y-auto border-r border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="mb-5">
                    <div className="font-bold text-xl">⚙️ Админка</div>
                    <div className="text-xs text-slate-500 dark:text-white/40 mt-1">Управление платформой</div>
                </div>
                <AdminSidebar tab={tab} onSelect={setTab} badges={badges} />
            </aside>

            <div className="flex-1 min-w-0 py-4 md:py-8 px-4 md:px-8 xl:px-10">
                <div className="hidden xl:flex items-center justify-between mb-6">
                    <div><div className="text-xs uppercase tracking-widest text-violet mb-1">Управление платформой</div><h1 className="text-3xl font-bold">{currentMeta.icon} {currentMeta.label}</h1><p className="text-sm text-slate-500 dark:text-white/45 mt-1">Администрирование Media_РАФ_RAW</p></div>
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="btn-ghost !py-2 text-sm flex items-center gap-2"
                    >
                        🔍 Поиск
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 dark:border-white/15 dark:text-white/50">
                            ⌘K
                        </kbd>
                    </button>
                </div>

                <div className="xl:hidden mb-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition text-left min-w-0"
                    >
                        <span className="text-xl shrink-0">☰</span>
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-wider text-white/40">
                                Раздел админки
                            </div>
                            <div className="text-sm font-semibold truncate">
                                {currentMeta.icon} {currentMeta.label}
                            </div>
                        </div>
                        {(badges.moderation > 0 || badges['password-resets'] > 0) && (
                            <span className="shrink-0 chip bg-pink/20 text-pink text-[10px]">
                                {(badges.moderation || 0) + (badges['password-resets'] || 0)}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className="shrink-0 w-12 rounded-2xl bg-white/5 hover:bg-white/10 transition grid place-items-center text-lg"
                        aria-label="Поиск"
                        title="Поиск (⌘K)"
                    >
                        🔍
                    </button>
                </div>

                <div className="max-w-7xl">
                    <Suspense fallback={<AdminSkeleton />}>
                        {tab === 'dash' && (
                            <Dashboard stats={stats} token={token} onReload={reloadAll} />
                        )}
                        {tab === 'roles' && <Roles token={token} />}
                        {tab === 'editorial-team' && <EditorialTeam token={token} />}
                        {tab === 'general-student-chat' && <GeneralStudentChat token={token} />}
                        {tab === 'analytics' && <Analytics token={token} />}
                        {tab === 'moderation' && (
                            <Moderation token={token} onChanged={reloadAll} />
                        )}
                        {tab === 'users' && (
                            <Users users={users} setUsers={setUsers} token={token} />
                        )}
                        {tab === 'competencies' && <Competencies token={token} />}
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
                        {tab === 'messenger-ui' && <MessengerUI token={token} />}
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
                        {tab === 'dashboard-widgets' && <DashboardWidgets token={token} />}
                        {tab === 'gamification' && <Gamification token={token} />}
                        {tab === 'backups' && <Backups token={token} />}
                        {tab === 'storage-center' && <StorageCenter token={token} />}
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

            {drawerOpen && (
                <AdminDrawer
                    tab={tab}
                    onSelect={(k) => {
                        setTab(k);
                        setDrawerOpen(false);
                    }}
                    badges={badges}
                    onClose={() => setDrawerOpen(false)}
                />
            )}

            {paletteOpen && (
                <AdminCommandPalette
                    token={token}
                    onClose={() => setPaletteOpen(false)}
                />
            )}
        </div>
    );
}

function AdminDrawer({ tab, onSelect, badges, onClose }) {
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm xl:hidden"
            onClick={onClose}
        >
            <div
                className="w-80 max-w-[88vw] h-full bg-ink-800 p-5 overflow-y-auto border-r border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <div className="font-bold text-xl">⚙️ Админка</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/40 hover:text-white text-2xl leading-none"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>
                <AdminSidebar tab={tab} onSelect={onSelect} badges={badges} />
            </div>
        </div>
    );
}