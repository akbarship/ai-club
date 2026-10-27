import { Link } from 'react-router-dom';
import { useSession } from '../session';
import { track } from '../api';
import { haptic, openLink } from '../tg';
import { TYPE_LABEL, type PostTeaser } from '../types';
import { Avatar } from './Avatar';
import { IconArrowRight, IconLink, IconLock, IconPin } from './Icons';

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

// Browsers ship little or no Uzbek locale data, so format by hand.
export const formatDate = (t: number | null) => {
  if (!t) return '';
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
};

export const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const LOCK_LABEL = { channel: 'Obunachilar uchun', club: "Club a'zolari uchun" } as const;

export function Byline({ type, date, pinned }: { type: PostTeaser['type']; date: number | null; pinned?: boolean }) {
  const { session } = useSession();
  return (
    <div className="byline">
      <span className="byline-name">{session?.author.name}</span>
      <span className="byline-dim">· {TYPE_LABEL[type]}</span>
      {date && <span className="byline-dim byline-date">{formatDate(date)}</span>}
      {pinned && (
        <span className="byline-pin" title="Qadalgan">
          <IconPin size={15} bold />
        </span>
      )}
    </div>
  );
}

export function PostCard({ post }: { post: PostTeaser }) {
  const { session } = useSession();
  const to = `/p/${post.id}`;
  return (
    <article className="post">
      <Avatar name={session?.author.name} url={session?.author.avatar} size={36} />
      <div className="post-main">
        <Byline type={post.type} date={post.published_at} pinned={post.pinned} />
        <Link to={to} className="post-body" onClick={() => haptic.tap()}>
          <h3 className="post-title">{post.title}</h3>
          {post.summary && <p className="post-summary">{post.summary}</p>}
        </Link>
        {post.cover_url && (
          <Link to={to} className="post-cover" onClick={() => haptic.tap()} tabIndex={-1}>
            <img src={post.cover_url} alt="" loading="lazy" />
          </Link>
        )}
        <div className="post-foot">
          {post.locked ? (
            <Link to={to} className="chip-lock">
              <IconLock size={15} bold />
              {LOCK_LABEL[post.locked]}
            </Link>
          ) : (
            <>
              {post.link_url && (
                <button
                  className="chip-link"
                  onClick={() => {
                    haptic.tap();
                    track('link_click', post.id);
                    openLink(post.link_url!);
                  }}
                >
                  <IconLink size={15} />
                  {host(post.link_url)}
                </button>
              )}
              <Link to={to} className="read-link" onClick={() => haptic.tap()}>
                {post.type === 'guide' ? "O'qish" : "Ko'rish"}
                <IconArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
