import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './store/auth.jsx';
import { useNetwork } from './store/network.jsx';
import { useModules } from './store/modules.jsx';
import Layout from './components/Layout.jsx';
import PwaUpdateNotice from './components/PwaUpdateNotice.jsx';
import SplashScreen, { useSplashGate } from './components/SplashScreen.jsx';
import OfflineScreen from './components/OfflineScreen.jsx';
import NetworkBanner from './components/NetworkBanner.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import AchievementToast from './components/AchievementToast.jsx';
import GlobalCommandPalette from './components/GlobalCommandPalette.jsx';
import Landing from './pages/Landing.jsx';
import { EditorialSection } from './pages/Editorial.jsx';
const Editorial = lazy(() => import('./pages/Editorial.jsx'));
const EditorialProjects = lazy(() => import('./pages/EditorialProjects.jsx'));
const EditorialMyTasks = lazy(() => import('./pages/EditorialMyTasks.jsx'));
import Login from './pages/Login.jsx';
const Feed = lazy(() => import('./pages/Feed.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Messenger = lazy(() => import('./pages/Messenger.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Courses = lazy(() => import('./pages/Courses.jsx'));
const CourseView = lazy(() => import('./pages/CourseView.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Admin = lazy(() => import('./pages/Admin/index.jsx'));
const Certificate = lazy(() => import('./pages/Certificate.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const Wiki = lazy(() => import('./pages/Wiki.jsx'));
const WikiArticle = lazy(() => import('./pages/WikiArticle.jsx'));
const MentorReviews = lazy(() => import('./pages/MentorReviews.jsx'));

const LazyPage = ({ children }) => (
    <Suspense fallback={<div className="min-h-[45vh] flex items-center justify-center text-sm text-white/50" role="status">Загружаем раздел…</div>}>
        {children}
    </Suspense>
);

const EditorialGate = ({ children }) => {
    const { modules, loading } = useModules();
    if (loading || !Object.prototype.hasOwnProperty.call(modules, 'editorial')) {
        return <div role="status" className="p-6">Проверяем доступ к редакции…</div>;
    }
    return modules.editorial ? children : <Navigate to="/app" replace />;
};

const Private = ({ children, roles }) => {
    const { user, loading } = useAuth();
    const { isOffline } = useNetwork();
    const showSplash = useSplashGate(loading);

    if (isOffline && !user) return <OfflineScreen />;
    if (showSplash) return <SplashScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
    return children;
};

function RootGate() {
    const { user, loading, token } = useAuth();
    const { isOffline } = useNetwork();
    const showSplash = useSplashGate(loading);

    if (isOffline && token) return <OfflineScreen />;
    if (showSplash) return <SplashScreen />;
    if (user) return <Navigate to="/app" replace />;
    return <div className="page-enter"><Landing /></div>;
}

export default function App() {
    const { user } = useAuth();
    const { isOffline } = useNetwork();
    // Only cold-start offline needs a blocking screen. After the user has
    // opened the app online, preserve the mounted route during outages.
    const [sessionWasOnline, setSessionWasOnline] = useState(() => !isOffline);
    useEffect(() => {
        if (!isOffline) setSessionWasOnline(true);
    }, [isOffline]);

    return (
        <>
            <Routes>
                <Route path="/" element={<RootGate />} />
                <Route path="/login" element={<div className="page-enter"><Login /></div>} />
                <Route path="/verify/:serial" element={<div className="page-enter"><Verify /></div>} />

                <Route
                    path="/app"
                    element={
                        <Private>
                            <Layout />
                        </Private>
                    }
                >
                    <Route index element={<LazyPage><Dashboard /></LazyPage>} />
                    <Route path="feed" element={<LazyPage><Feed /></LazyPage>} />
                    <Route path="editorial" element={<EditorialGate><LazyPage><Editorial /></LazyPage></EditorialGate>}>
                        <Route index element={<EditorialSection title="Обзор" />} />
                        <Route path="projects" element={<LazyPage><EditorialProjects /></LazyPage>} />
                        <Route path="my-tasks" element={<LazyPage><EditorialMyTasks /></LazyPage>} />
                        {['calendar', 'files', 'shares', 'reviews', 'ideas', 'content'].map((section) => (
                            <Route key={section} path={section} element={<EditorialSection title={{
                                projects: 'Проекты', calendar: 'Календарь', files: 'Файлы',
                                shares: 'Общий доступ', reviews: 'На проверке',
                                ideas: 'Идеи', content: 'Контент-план',
                            }[section]} />} />
                        ))}
                    </Route>
                    <Route path="u/:username" element={<LazyPage><Profile /></LazyPage>} />
                    <Route path="chats" element={<LazyPage><Messenger /></LazyPage>} />
                    <Route path="chats/:chatId" element={<LazyPage><Messenger /></LazyPage>} />
                    <Route path="notifications" element={<LazyPage><Notifications /></LazyPage>} />
                    <Route path="courses" element={<LazyPage><Courses /></LazyPage>} />
                    <Route path="courses/:slug" element={<LazyPage><CourseView /></LazyPage>} />
                    <Route path="leaderboard" element={<LazyPage><Leaderboard /></LazyPage>} />
                    <Route path="wiki" element={<LazyPage><Wiki /></LazyPage>} />
                    <Route path="wiki/:slug" element={<LazyPage><WikiArticle /></LazyPage>} />
                    <Route path="certificates/:id" element={<LazyPage><Certificate /></LazyPage>} />
                    <Route path="mentor" element={<LazyPage><MentorReviews /></LazyPage>} />
                    <Route
                        path="admin"
                        element={
                            <Private roles={['ADMIN']}>
                                <LazyPage><Admin /></LazyPage>
                            </Private>
                        }
                    />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Keep the current route mounted while offline, so returning online
                restores the same screen without losing navigation state. */}
            {user && isOffline && !sessionWasOnline && <OfflineScreen />}

            {user && sessionWasOnline && <NetworkBanner />}

            <PwaUpdateNotice />
            {user && <GlobalCommandPalette />}
            {user && <OnboardingModal />}
            {user && <AchievementToast />}
        </>
    );
}
