import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { BannerCarousel } from '../components/BannerCarousel';
import { IconClose } from '../components/Icons';
import { PostCard } from '../components/PostCard';
import { useSession } from '../session';
import { haptic, openLink } from '../tg';
import type { Banner, PostTeaser, PostType } from '../types';

const FILTERS: { key: PostType | 'all'; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'guide', label: "Qo'llanmalar" },
  { key: 'resource', label: 'Resurslar' },
  { key: 'skill', label: 'Skills' },
  { key: 'mcp', label: 'MCP' },
];

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

let cache: { banners: Banner[]; posts: PostTeaser[] } | null = null;

export function Home() {
  const { session } = useSession();
  const s = session!;
  const [data, setData] = useState(cache);
  const [filter, setFilter] = useState<PostType | 'all'>(() => (storage.get('filter') as PostType) || 'all');
  const [openNoticeSeen, setOpenNoticeSeen] = useState(() => storage.get('open-notice') === '1');

  useEffect(() => {
    api.get<typeof cache>('/home').then((d) => {
      cache = d;
      setData(d);
    });
  }, [s.subscribed]);

  const posts = useMemo(
    () => (data?.posts ?? []).filter((p) => filter === 'all' || p.type === filter),
    [data, filter],
  );
  const name = [s.user.first_name, s.user.last_name].filter(Boolean).join(' ');

  return (
    <>
      <header className="greeting">
        <h1>
          Salom, <span>{s.user.first_name || "do'stim"}</span>
        </h1>
        <Link to="/profile" aria-label="Profil">
          <Avatar name={name} url={s.user.photo_url} size={36} />
        </Link>
      </header>

      <BannerCarousel banners={data?.banners ?? []} />

      <div className="filters" role="tablist">
        {FILTERS.map((f, i) => (
          <Fragment key={f.key}>
            <button
              role="tab"
              aria-selected={filter === f.key}
              className={filter === f.key ? 'filter active' : 'filter'}
              onClick={() => {
                haptic.select();
                setFilter(f.key);
                storage.set('filter', f.key);
              }}
            >
              {f.label}
            </button>
            {i === 0 && <span className="filters-divider" aria-hidden />}
          </Fragment>
        ))}
      </div>

      {!s.subscribed ? (
        <div className="notice">
          <span className="pill">YOPIQ</span>
          <span>
            Barcha materiallar ochilishi uchun{' '}
            <button className="text-link" onClick={() => openLink(s.channelUrl)}>kanalga obuna bo'ling</button>
          </span>
        </div>
      ) : (
        !openNoticeSeen && (
          <div className="notice">
            <span className="pill">OCHIQ</span>
            <span>Kanalga obuna bo'lganingiz uchun materiallar ochiq</span>
            <button
              className="notice-close"
              aria-label="Yopish"
              onClick={() => {
                storage.set('open-notice', '1');
                setOpenNoticeSeen(true);
              }}
            >
              <IconClose size={18} />
            </button>
          </div>
        )
      )}

      {!data ? (
        <div className="feed">
          {[0, 1, 2].map((i) => (
            <div key={i} className="post post-skeleton">
              <span className="avatar sk" style={{ width: 36, height: 36 }} />
              <div className="post-main">
                <span className="sk sk-line" style={{ width: '40%' }} />
                <span className="sk sk-line" style={{ width: '85%' }} />
                <span className="sk sk-line" style={{ width: '65%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length ? (
        <div className="feed">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
      ) : (
        <div className="empty">
          <p>Bu bo'limda hozircha material yo'q.</p>
          {filter !== 'all' && (
            <button className="text-link" onClick={() => setFilter('all')}>Hamma materiallarni ko'rish</button>
          )}
        </div>
      )}
    </>
  );
}
