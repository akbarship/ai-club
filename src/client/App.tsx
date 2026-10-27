import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AdminApp } from './admin/AdminApp';
import { Layout } from './components/Layout';
import { Club } from './pages/Club';
import { Home } from './pages/Home';
import { PostPage } from './pages/Post';
import { Profile } from './pages/Profile';
import { useSession } from './session';
import { inTelegram, startParam } from './tg';

/** Handles t.me/<bot>?startapp=<param> deep links: post_12, club, profile. */
function useStartParam() {
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !startParam) return;
    done.current = true;
    const post = /^post_(\d+)$/.exec(startParam);
    if (post) navigate(`/p/${post[1]}`, { replace: true });
    else if (startParam === 'club' || startParam === 'profile') navigate(`/${startParam}`, { replace: true });
  }, [navigate]);
}

export function App() {
  const { session, error, refresh } = useSession();
  useStartParam();

  if (error) {
    return (
      <div className="center-screen">
        <h2>Ulanib bo'lmadi</h2>
        <p>
          {inTelegram ? error : "Ilovani Telegram ichida oching (yoki .env da DEV_USER_ID ni o'rnating)."}
        </p>
        <button className="btn btn-primary" onClick={() => refresh()}>Qayta urinish</button>
      </div>
    );
  }
  if (!session) return <div className="center-screen"><div className="spinner" /></div>;

  return (
    <Routes>
      <Route path="/" element={<Layout><Home /></Layout>} />
      <Route path="/p/:id" element={<Layout><PostPage /></Layout>} />
      <Route path="/club" element={<Layout><Club /></Layout>} />
      <Route path="/profile" element={<Layout><Profile /></Layout>} />
      <Route
        path="/admin/*"
        element={session.admin ? <Layout wide><AdminApp /></Layout> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
