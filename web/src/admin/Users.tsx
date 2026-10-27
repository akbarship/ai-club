import { useEffect, useState } from 'react';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { haptic, openLink } from '../tg';
import { IconCheckCircle } from '../components/Icons';

type U = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  source: string | null;
  is_subscribed: number;
  is_club: number;
  blocked_at: number | null;
  last_seen_at: number | null;
  waitlist: string | null;
};

const FILTERS = [
  ['all', 'Hammasi'],
  ['waitlist', 'Waitlist'],
  ['club', 'Club'],
  ['subscribed', 'Obunachilar'],
  ['blocked', 'Bloklagan'],
];

export function Users() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<U[]>([]);

  const load = () => api.get<U[]>(`/admin/users?q=${encodeURIComponent(q)}&filter=${filter}`).then(setRows);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, filter]);

  const toggleClub = async (u: U) => {
    await api.patch(`/admin/users/${u.id}`, { is_club: !u.is_club });
    haptic.success();
    load();
  };

  return (
    <div className="stack">
      <div className="page-head"><h1>Foydalanuvchilar</h1></div>
      <input className="input" placeholder="Ism, @username yoki ID" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={filter === k ? 'filter active' : 'filter'} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="admin-list">
        {rows.map((u) => {
          const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.id);
          return (
            <div key={u.id} className="admin-row">
              <Avatar name={name} url={u.photo_url} size={38} />
              <div className="admin-row-main">
                <span className="admin-row-title">
                  {u.username ? <button className="text-link" onClick={() => openLink(`https://t.me/${u.username}`)}>{name}</button> : name}
                </span>
                <span className="admin-row-meta">
                  <span className={u.is_subscribed ? 'status status-ok' : 'status'}>{u.is_subscribed ? 'Obunachi' : 'Obuna emas'}</span>
                  {u.blocked_at && <span className="status">Bloklagan</span>}
                  {u.waitlist && <span>Waitlist: {u.waitlist}</span>}
                  {u.source && <span>Manba: {u.source}</span>}
                </span>
              </div>
              <button className={u.is_club ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => toggleClub(u)}>
                {u.is_club && <IconCheckCircle size={16} bold />}
                {u.is_club ? "Club a'zosi" : "Club'ga qo'shish"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
