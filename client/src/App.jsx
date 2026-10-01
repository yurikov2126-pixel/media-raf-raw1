import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './store/auth.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Feed from './pages/Feed.jsx';
import Profile from './pages/Profile.jsx';
import Messenger from './pages/Messenger.jsx';
import Courses from './pages/Courses.jsx';
import CourseView from './pages/CourseView.jsx';
import Admin from './pages/Admin.jsx';
import Certificate from './pages/Certificate.jsx';
import Verify from './pages/Verify.jsx';
import Wiki from './pages/Wiki.jsx';
import WikiArticle from './pages/WikiArticle.jsx';

const Private = ({ children, roles }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="p-10 text-center">Загрузка…</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
    return children;
};

function PageTransition({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ minHeight: '100%' }}
        >
            {children}
        </motion.div>
    );
}

function AnimatedRoutes() {
    const location = useLocation();
    return (
        <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
                <Route
                    path="/"
                    element={<PageTransition><Landing /></PageTransition>}
                />
                <Route
                    path="/login"
                    element={<PageTransition><Login /></PageTransition>}
                />
                <Route
                    path="/verify/:serial"
                    element={<PageTransition><Verify /></PageTransition>}
                />

                <Route
                    path="/app"
                    element={
                        <Private>
                            <Layout />
                        </Private>
                    }
                >
                    <Route index element={<PageTransition><Feed /></PageTransition>} />
                    <Route
                        path="u/:username"
                        element={<PageTransition><Profile /></PageTransition>}
                    />
                    <Route
                        path="chats"
                        element={<PageTransition><Messenger /></PageTransition>}
                    />
                    <Route
                        path="chats/:chatId"
                        element={<PageTransition><Messenger /></PageTransition>}
                    />
                    <Route
                        path="courses"
                        element={<PageTransition><Courses /></PageTransition>}
                    />
                    <Route
                        path="courses/:slug"
                        element={<PageTransition><CourseView /></PageTransition>}
                    />
                    <Route
                        path="wiki"
                        element={<PageTransition><Wiki /></PageTransition>}
                    />
                    <Route
                        path="wiki/:slug"
                        element={<PageTransition><WikiArticle /></PageTransition>}
                    />
                    <Route
                        path="certificates/:id"
                        element={<PageTransition><Certificate /></PageTransition>}
                    />
                    <Route
                        path="admin"
                        element={
                            <Private roles={['ADMIN']}>
                                <PageTransition><Admin /></PageTransition>
                            </Private>
                        }
                    />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </AnimatePresence>
    );
}

export default function App() {
    return <AnimatedRoutes />;
}