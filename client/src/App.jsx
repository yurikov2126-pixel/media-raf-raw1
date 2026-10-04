import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.jsx';
import { useNetwork } from './store/network.jsx';
import Layout from './components/Layout.jsx';
import SplashScreen, { useSplashGate } from './components/SplashScreen.jsx';
import OfflineScreen from './components/OfflineScreen.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import AchievementToast from './components/AchievementToast.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Feed from './pages/Feed.jsx';
import Profile from './pages/Profile.jsx';
import Messenger from './pages/Messenger.jsx';
import Notifications from './pages/Notifications.jsx';
import Courses from './pages/Courses.jsx';
import CourseView from './pages/CourseView.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Admin from './pages/Admin/index.jsx';
import Certificate from './pages/Certificate.jsx';
import Verify from './pages/Verify.jsx';
import Wiki from './pages/Wiki.jsx';
import WikiArticle from './pages/WikiArticle.jsx';

const Private = ({ children, roles }) => {
    const { user, loading } = useAuth();
    const { isOffline } = useNetwork();
    const showSplash = useSplashGate(loading);

    if (showSplash) return <SplashScreen />;
    if (isOffline && !user) return <OfflineScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
    return children;
};

function RootGate() {
    const { user, loading, token } = useAuth();
    const { isOffline } = useNetwork();
    const showSplash = useSplashGate(loading);

    if (showSplash) return <SplashScreen />;
    if (isOffline && token && !user) return <OfflineScreen />;
    if (user) return <Navigate to="/app" replace />;
    return <div className="page-enter"><Landing /></div>;
}

export default function App() {
    const { user } = useAuth();

    return (
        <>
            <Routes>
                <Route path="/" element={<RootGate />} />
                <Route
                    path="/login"
                    element={<div className="page-enter"><Login /></div>}
                />
                <Route
                    path="/verify/:serial"
                    element={<div className="page-enter"><Verify /></div>}
                />

                <Route
                    path="/app"
                    element={
                        <Private>
                            <Layout />
                        </Private>
                    }
                >
                    <Route index element={<Feed />} />
                    <Route path="u/:username" element={<Profile />} />
                    <Route path="chats" element={<Messenger />} />
                    <Route path="chats/:chatId" element={<Messenger />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="courses" element={<Courses />} />
                    <Route path="courses/:slug" element={<CourseView />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="wiki" element={<Wiki />} />
                    <Route path="wiki/:slug" element={<WikiArticle />} />
                    <Route path="certificates/:id" element={<Certificate />} />
                    <Route
                        path="admin"
                        element={
                            <Private roles={['ADMIN']}>
                                <Admin />
                            </Private>
                        }
                    />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>

            {/* Онбординг и попапы достижений — поверх всего, только для авторизованных */}
            {user && <OnboardingModal />}
            {user && <AchievementToast />}
        </>
    );
}