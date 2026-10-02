import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../store/auth.jsx';
import { useSettings } from '../../store/settings.jsx';
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

import CoursesRoot from './tabs/Courses/index.jsx';
import WikiRoot from './tabs/Wiki/index.jsx';
import BulkRoot from './tabs/Bulk/index.jsx';
import SiteDesignRoot from './tabs/SiteDesign/index.jsx';

export default function Admin() {
    const { token } = useAuth();
    const { reload: reloadSettings } = useSettings();
    const [tab, setTab] = useState('dash');

    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [settings, setSettings] = useState({});
    const [openReports, setOpenReports] = useState(0);

    const reloadAll = () => {
        api('/admin/stats', { token }).then(setStats).catch(() => {});
        api('/admin/users', { token }).then(setUsers).catch(() => {});
        api('/admin/courses', { token }).then(setCourses).catch(() => {});
        api('/admin/certificates', { token }).then(setCertificates).catch(() => {});
        api('/admin/settings', { token }).then(setSettings).catch(() => {});
        api('/admin/reports?status=NEW&limit=1', { token })
            .then((r) => setOpenReports(r.total || 0))
            .catch(() => {});
    };

    useEffect(() => {
        reloadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="p-5 md:p-10 max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-6">⚙️ Админ-панель</h1>

            <div className="flex gap-2 mb-6 flex-wrap">
                {TABS.map(([k, l, i]) => {
                    const badge = k === 'moderation' && openReports > 0 ? openReports : null;
                    return (
                        <button
                            key={k}
                            onClick={() => setTab(k)}
                            className={`chip relative ${
                                tab === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
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

            {tab === 'dash' && <Dashboard stats={stats} token={token} onReload={reloadAll} />}
            {tab === 'analytics' && <Analytics token={token} />}
            {tab === 'moderation' && <Moderation token={token} onChanged={reloadAll} />}
            {tab === 'users' && <Users users={users} setUsers={setUsers} token={token} />}
            {tab === 'courses' && <CoursesRoot courses={courses} setCourses={setCourses} token={token} />}
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
            {tab === 'broadcast' && <Broadcast token={token} users={users} courses={courses} />}
            {tab === 'push' && <Push token={token} users={users} courses={courses} />}
            {tab === 'bulk' && <BulkRoot token={token} users={users} courses={courses} onReload={reloadAll} />}
            {tab === 'site' && (
                <SiteDesignRoot
                    settings={settings}
                    setSettings={setSettings}
                    token={token}
                    onSaved={() => reloadSettings()}
                />
            )}
            {tab === 'backups' && <Backups token={token} />}
            {tab === 'settings' && <Settings settings={settings} setSettings={setSettings} token={token} />}
        </div>
    );
}