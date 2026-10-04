import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../store/auth.jsx';
import { useSettings } from '../../store/settings.jsx';
import { useNotifications } from '../../store/notifications.jsx';
import { TABS } from './constants.js';

import Dashboard from './tabs/Dashboard.jsx';
import Analytics from './tabs/Analytics.jsx';
import Users from './tabs/Users.jsx';
import Certificates from './tabs/Certificates.jsx';
import Broadcast from './tabs/Broadcast.jsx';
import Push from './tabs/Push.jsx';
import Backups from './tabs/Backups.jsx';
import Moderation from './tabs/Moderation.jsx';
import Settings from './tabs/Settings.jsx';
import Modules from './tabs/Modules.jsx';
import Gamification from './tabs/Gamification.jsx';
import PasswordResets from './tabs/PasswordResets.jsx';

import CoursesRoot from './tabs/Courses/index.jsx';
import WikiRoot from './tabs/Wiki/index.jsx';
import BulkRoot from './tabs/Bulk/index.jsx';
import SiteDesignRoot from './tabs/SiteDesign/index.jsx';

const VALID_TABS = new Set(TABS.map(([k]) => k));

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

    return (
        <div className="p-5 md:p-10 max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-6">⚙️ Админ-панель</h1>

            <div className="flex gap-2 mb-6 flex-wrap">
                {TABS.map(([k, l, i]) => {
                    let badge = null;
                    if (k === 'moderation' && openReports > 0) badge = openReports;
                    if (k === 'password-resets' && pendingResets > 0) badge = pendingResets;
                    return (
                        <button
                            key={k}
                            onClick={() => setTab(k)}
                            className={`chip relative ${
                                tab === k
                                    ? 'bg-violet text-white'
                                    : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {i} {l}
                            {badge && (
                                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-white text-[10px] font-bold grid place-items-center">
                                    {badge > 99 ? '99+' : badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

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
            {tab === 'password-resets' && <PasswordResets token={token} />}
            {tab === 'settings' && (
                <Settings
                    settings={settings}
                    setSettings={setSettings}
                    token={token}
                />
            )}
        </div>
    );
}