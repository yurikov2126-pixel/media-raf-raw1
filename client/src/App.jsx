import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './store/auth.jsx';
import { useNetwork } from './store/network.jsx';
import { useModules } from './store/modules.jsx';
import Layout from './components/Layout.jsx';
import { RadioUploadProvider } from './components/RadioUploadManager.jsx';
import PwaUpdateNotice from './components/PwaUpdateNotice.jsx';
import PwaInstallInvite from './components/PwaInstallInvite.jsx';
import SplashScreen, { useSplashGate } from './components/SplashScreen.jsx';
import OfflineScreen from './components/OfflineScreen.jsx';
import NetworkBanner from './components/NetworkBanner.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import AchievementToast from './components/AchievementToast.jsx';
import CertificateCelebration from './components/CertificateCelebration.jsx';
import GlobalCommandPalette from './components/GlobalCommandPalette.jsx';
import Landing from './pages/Landing.jsx';
import { EditorialSection } from './pages/Editorial.jsx';
const Editorial = lazy(() => import('./pages/Editorial.jsx'));
const EditorialOverview = lazy(() => import('./pages/EditorialOverview.jsx'));
const EditorialCalendar = lazy(() => import('./pages/EditorialCalendar.jsx'));
const EditorialContentPlan = lazy(() => import('./pages/EditorialContentPlan.jsx'));
const EditorialProjects = lazy(() => import('./pages/EditorialProjects.jsx'));
const EditorialProductionBoard = lazy(() => import('./pages/EditorialProductionBoard.jsx'));
const EditorialFiles = lazy(() => import('./pages/EditorialFiles.jsx'));
const EditorialShares = lazy(() => import('./pages/EditorialShares.jsx'));
const EditorialShareLanding = lazy(() => import('./pages/EditorialShareLanding.jsx'));
const EditorialMyTasks = lazy(() => import('./pages/EditorialMyTasks.jsx'));
const EditorialReviewInbox = lazy(() => import('./pages/EditorialReviewInbox.jsx'));
import Login from './pages/Login.jsx';
const Feed = lazy(() => import('./pages/Feed.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Dashboard2 = lazy(() => import('./pages/Dashboard2.jsx'));
function DashboardMode() {
    const { modules, loading } = useModules();
    if (loading) return null;
    return modules.dashboard2 === true ? <Dashboard2 /> : <Dashboard />;
}
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Messenger = lazy(() => import('./pages/Messenger.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Courses = lazy(() => import('./pages/Courses.jsx'));
const AcademyDashboard = lazy(() => import('./pages/AcademyDashboard.jsx'));
const CourseView = lazy(() => import('./pages/CourseView.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Seasons = lazy(() => import('./pages/Seasons.jsx'));
const Stickers = lazy(() => import('./pages/Stickers.jsx'));
const Admin = lazy(() => import('./pages/Admin/index.jsx'));
const DelegatedAnalytics = lazy(() => import('./pages/DelegatedAnalytics.jsx'));
const Certificate = lazy(() => import('./pages/Certificate.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const Wiki = lazy(() => import('./pages/Wiki.jsx'));
const WikiArticle = lazy(() => import('./pages/WikiArticle.jsx'));
import { useRadioAccess } from './hooks/useRadioAccess.js';
const Radio = lazy(() => import('./pages/Radio.jsx'));
const RadioListen = lazy(() => import('./pages/RadioListen.jsx'));
const SafetyConsole = lazy(() => import('./pages/SafetyConsole.jsx'));
const RadioStudentPlaylists = lazy(() => import('./pages/RadioStudentPlaylists.jsx'));
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

function RadioGate({ admin = false, children }) {
    const { user } = useAuth();
    const { allowed, loading } = useRadioAccess();
    if (loading) return <div role="status" className="p-6">Проверяем доступ к Радио…</div>;
    if (!allowed) return <Navigate to="/app" replace />;
    // One public entry point; authorized student presenters enter their own studio.
    if (admin && user?.role === 'STUDENT') return <Navigate to="/app/radio/playlists/my" replace />;
    if (admin && user?.role !== 'ADMIN') return <Navigate to="/app" replace />;
    return children;
}

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
        <RadioUploadProvider>
            <Routes>
                <Route path="/" element={<RootGate />} />
                <Route path="/radio/live" element={<LazyPage><RadioListen /></LazyPage>} />
                <Route path="/login" element={<div className="page-enter"><Login /></div>} />
                <Route path="/share/editorial/:token" element={<LazyPage><EditorialShareLanding /></LazyPage>} />
                <Route path="/verify/:serial" element={<div className="page-enter"><Verify /></div>} />

                <Route
                    path="/app"
                    element={
                        <Private>
                            <Layout />
                        </Private>
                    }
                >
                    <Route index element={<LazyPage><DashboardMode /></LazyPage>} />
                    <Route path="feed" element={<LazyPage><Feed /></LazyPage>} />
                    <Route path="safety" element={<LazyPage><SafetyConsole /></LazyPage>} />
                    <Route path="radio" element={<Private><RadioGate admin><LazyPage><Radio /></LazyPage></RadioGate></Private>} />
                    <Route path="radio/playlists/my" element={<Private roles={['STUDENT']}><RadioGate><LazyPage><RadioStudentPlaylists /></LazyPage></RadioGate></Private>} />
                    <Route path="editorial" element={<EditorialGate><LazyPage><Editorial /></LazyPage></EditorialGate>}>
                        <Route index element={<LazyPage><EditorialOverview /></LazyPage>} />
                        <Route path="projects" element={<LazyPage><EditorialProjects /></LazyPage>} />
                        <Route path="production" element={<LazyPage><EditorialProductionBoard /></LazyPage>} />
                        <Route path="my-tasks" element={<LazyPage><EditorialMyTasks /></LazyPage>} />
                        <Route path="reviews" element={<LazyPage><EditorialReviewInbox /></LazyPage>} />
                        <Route path="calendar" element={<LazyPage><EditorialCalendar /></LazyPage>} />
                        <Route path="content" element={<LazyPage><EditorialContentPlan /></LazyPage>} />
                        <Route path="files" element={<LazyPage><EditorialFiles /></LazyPage>} />
                        <Route path="shares" element={<LazyPage><EditorialShares /></LazyPage>} />
                        {['ideas'].map((section) => (
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
                    <Route path="academy/me" element={<LazyPage><AcademyDashboard /></LazyPage>} />
                    <Route path="courses/:slug" element={<LazyPage><CourseView /></LazyPage>} />
                    <Route path="analytics" element={<LazyPage><DelegatedAnalytics /></LazyPage>} />
                    <Route path="leaderboard" element={<LazyPage><Leaderboard /></LazyPage>} />
                    <Route path="seasons" element={<LazyPage><Seasons /></LazyPage>} />
                    <Route path="stickers" element={<LazyPage><Stickers /></LazyPage>} />
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
            <PwaInstallInvite />
            {user && <GlobalCommandPalette />}
            {user && <OnboardingModal />}
            {user && <AchievementToast />}
            {user && <CertificateCelebration />}
        </RadioUploadProvider>
    );
}
