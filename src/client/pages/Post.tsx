import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, track } from '../api';
import { Avatar } from '../components/Avatar';
import { IconCheckCircle, IconCopy, IconExternal, IconShare } from '../components/Icons';
import { LockGate } from '../components/LockGate';
import { MainButton } from '../components/MainButton';
import { Markdown } from '../components/Markdown';
import { Byline, host } from '../components/PostCard';
import { useSession } from '../session';
import { copy, haptic, openLink, shareLink } from '../tg';
import type { Post } from '../types';

function InstallBlock({ code, postId }: { code: string; postId: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="install">
      <div className="install-head">
        <span>O'rnatish</span>
        <button
          className="icon-text-btn"
          onClick={() => {
            copy(code);
            track('copy_install', postId);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <IconCheckCircle size={17} bold /> : <IconCopy size={17} />}
          {copied ? 'Nusxa olindi' : 'Nusxa olish'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function PostPage() {
  const { id } = useParams();
  const { session, refresh } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Post>(`/posts/${id}`).then(setPost, (e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    load();
  }, [load]);

  if (error) {
    return (
      <div className="empty">
        <p>Material topilmadi yoki o'chirilgan.</p>
        <Link className="text-link" to="/">Bosh sahifaga qaytish</Link>
      </div>
    );
  }
  if (!post) return <div className="center-screen"><div className="spinner" /></div>;

  const share = () => {
    haptic.tap();
    track('share', post.id);
    shareLink(`https://t.me/${session!.botUsername}?startapp=post_${post.id}`, post.title);
  };

  const openExternal = () => {
    if (!post.link_url) return;
    track('link_click', post.id);
    openLink(post.link_url);
  };

  return (
    <article className="article">
      <div className="article-byline">
        <Avatar name={session?.author.name} url={session?.author.avatar} size={36} />
        <Byline type={post.type} date={post.published_at} />
        <button className="icon-btn" onClick={share} aria-label="Ulashish">
          <IconShare size={20} />
        </button>
      </div>

      <h1 className="article-title">{post.title}</h1>
      {post.summary && <p className="lead">{post.summary}</p>}
      {post.cover_url && <img className="article-cover" src={post.cover_url} alt="" />}

      {post.locked ? (
        <LockGate
          kind={post.locked}
          onUnlocked={() => {
            refresh();
            load();
          }}
        />
      ) : (
        <>
          {post.install && <InstallBlock code={post.install} postId={post.id} />}
          {post.link_url && (
            <button className="link-card" onClick={openExternal}>
              <span>
                <span className="link-card-label">{post.type === 'resource' ? 'Sayt' : 'Havola'}</span>
                <span className="link-card-host">{host(post.link_url)}</span>
              </span>
              <IconExternal size={20} />
            </button>
          )}
          {post.body && <Markdown source={post.body} />}
          {post.tags && (
            <div className="tags">
              {post.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t}>#{t}</span>)}
            </div>
          )}
          {post.link_url && (
            <MainButton text={post.type === 'resource' ? "Saytga o'tish" : 'Havolani ochish'} onClick={openExternal} />
          )}
        </>
      )}
    </article>
  );
}
