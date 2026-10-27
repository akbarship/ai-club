import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../session';
import { haptic, nativeBackButton, nativeSettingsButton, openLink, WA } from '../tg';
import { IconChannel, IconClub, IconHome, IconSettings, IconUser, type IconComponent } from './Icons';

const ROOTS = ['/', '/club', '/profile', '/admin'];

function useTelegramButtons() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOTS.includes(location.pathname);

  useEffect(() => {
    if (!nativeBackButton) return;
    const back = () => {
      haptic.tap();
      // Opened directly via a deep link: there is no history to go back to.
      if (location.key === 'default') navigate('/', { replace: true });
      else navigate(-1);
    };
    if (isRoot) WA.BackButton.hide();
    else WA.BackButton.show();
    WA.BackButton.onClick(back);
    return () => WA.BackButton.offClick(back);
  }, [isRoot, location.key, navigate]);

  useEffect(() => {
    if (!nativeSettingsButton) return;
    const open = () => navigate('/profile');
    WA.SettingsButton.show();
    WA.SettingsButton.onClick(open);
    return () => WA.SettingsButton.offClick(open);
  }, [navigate]);
}

type NavItem = { to: string; label: string; Icon: IconComponent };

export function Layout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { session } = useSession();
  useTelegramButtons();

  const items: NavItem[] = [
    { to: '/', label: 'Bosh sahifa', Icon: IconHome },
    { to: '/club', label: 'AI Club', Icon: IconClub },
    { to: '/profile', label: 'Profil', Icon: IconUser },
    ...(session?.admin ? [{ to: '/admin', label: 'Admin', Icon: IconSettings }] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{session?.brandTitle || 'AI Club'}</div>
        <nav className="side-nav">
          {items.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="side-link" onClick={() => haptic.select()}>
              {({ isActive }) => (
                <>
                  <Icon bold={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {session?.channelUrl && (
          <button className="side-footer" onClick={() => openLink(session.channelUrl)}>
            <IconChannel size={18} />
            Kanalga o'tish
          </button>
        )}
      </aside>
      <main className={wide ? 'content content-wide' : 'content'}>{children}</main>
      <nav className="tabbar">
        {items.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="tab" onClick={() => haptic.select()}>
            {({ isActive }) => (
              <>
                <Icon size={24} bold={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
