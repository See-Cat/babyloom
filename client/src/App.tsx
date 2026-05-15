import { lazy, Suspense, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BottomNav from './components/BottomNav';
import EntryComposerSheet from './components/EntryComposerSheet';
import PageTransition from './components/PageTransition';
import { useAuthStore } from './stores/authStore';

const Timeline = lazy(() => import('./pages/Timeline'));
const Gallery = lazy(() => import('./pages/Gallery'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Profile = lazy(() => import('./pages/Profile'));
const Detail = lazy(() => import('./pages/Detail'));
const AddEntry = lazy(() => import('./pages/AddEntry'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Login = lazy(() => import('./pages/Login'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <div className="app">
      <div className="content">
        <Suspense fallback={<div className="loading">加载中...</div>}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <PageTransition><Login /></PageTransition>} />
              <Route path="/" element={<RequireAuth><PageTransition><Timeline /></PageTransition></RequireAuth>} />
              <Route path="/gallery" element={<RequireAuth><PageTransition><Gallery /></PageTransition></RequireAuth>} />
              <Route path="/calendar" element={<RequireAuth><PageTransition><CalendarPage /></PageTransition></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><PageTransition><Profile /></PageTransition></RequireAuth>} />
              <Route path="/detail/:id" element={<RequireAuth><PageTransition><Detail /></PageTransition></RequireAuth>} />
              <Route path="/add" element={<RequireAuth><PageTransition><AddEntry /></PageTransition></RequireAuth>} />
              <Route path="/milestones" element={<RequireAuth><PageTransition><Milestones /></PageTransition></RequireAuth>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      <BottomNav onAddClick={() => setIsComposerOpen(true)} />
      <EntryComposerSheet
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />
    </div>
  );
}

export default App;
