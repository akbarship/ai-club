import { NavLink, Route, Routes } from 'react-router-dom';
import { IconChart, IconDocument, IconGallery, IconKey, IconLetter, IconSettings, IconUsers, type IconComponent } from '../components/Icons';
import { haptic } from '../tg';
import { Banners } from './Banners';
import { Broadcast } from './Broadcast';
import { Keywords } from './Keywords';
import { PostEdit } from './PostEdit';
import { Posts } from './Posts';
import { Settings } from './Settings';
import { Stats } from './Stats';
import { Users } from './Users';

const TABS: { to: string; label: string; Icon: IconComponent; end?: boolean }[] = [
  { to: '/admin', label: 'Statistika', Icon: IconChart, end: true },
  { to: '/admin/posts', label: 'Materiallar', Icon: IconDocument },
  { to: '/admin/banners', label: 'Bannerlar', Icon: IconGallery },
  { to: '/admin/keywords', label: "Kalit so'zlar", Icon: IconKey },
  { to: '/admin/broadcast', label: 'Xabar yuborish', Icon: IconLetter },
  { to: '/admin/users', label: 'Foydalanuvchilar', Icon: IconUsers },
  { to: '/admin/settings', label: 'Sozlamalar', Icon: IconSettings },
];

export function AdminApp() {
  return (
    <>
      <nav className="admin-tabs" aria-label="Admin">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="admin-tab" onClick={() => haptic.select()}>
            {({ isActive }) => (
              <>
                <Icon size={18} bold={isActive} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Stats />} />
        <Route path="posts" element={<Posts />} />
        <Route path="posts/:id" element={<PostEdit />} />
        <Route path="banners" element={<Banners />} />
        <Route path="keywords" element={<Keywords />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </>
  );
}
