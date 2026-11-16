import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, track } from '../api';
import { Avatar } from '../components/Avatar';
import { IconCheckCircle, IconCopy, IconDownload, IconExternal, IconShare } from '../components/Icons';
import { LockGate } from '../components/LockGate';
import { MainButton } from '../components/MainButton';
import { Markdown } from '../components/Markdown';
import { Byline, fileSize, host } from '../components/PostCard';
import { useSession } from '../session';
import { alert, confirm, copy, haptic, openLink, shareLink } from '../tg';
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

function ShareBlock({ link, text, postId }: { link: string; text: string; postId: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="share-block">
      <button
        className="btn btn-primary"
        onClick={() => {
          haptic.tap();
          track('share', postId);
          shareLink(link, text);
        }}
      >
        <IconShare size={19} />
        Do'stlarga ulashish
      </button>
      <button
        className="btn btn-secondary"
        onClick={() => {
          copy(link);
          track('copy_link', postId);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <IconCheckCircle size={19} bold /> : <IconCopy size={19} />}
        {copied ? 'Nusxa olindi' : 'Havolani nusxalash'}
      </button>
    </div>
  );
}

export function PostPage() {
  const { id } = useParams();
  const { session, refresh } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  // A start link: new readers press /start first (so the bot can message them), then open the post.
  const botLink = `https://t.me/${session!.botUsername}`;
  const startLink = `${botLink}?start=post_${post.id}`;
  const shareText = [post.title, post.summary].filter(Boolean).join('\n\n');

  const share = () => {
    haptic.tap();
    track('share', post.id);
    shareLink(startLink, shareText);
  };

  const download = async () => {
    if (downloading) return;
    haptic.tap();
    setDownloading(true);
    try {
      await api.post(`/posts/${post.id}/download`);
      haptic.success();
      if (await confirm('Fayl bot chatiga yuborildi. Chatni ochasizmi?')) openLink(botLink);
    } catch (e) {
      haptic.error();
      if ((e as Error).message === 'bot_blocked') {
        if (await confirm("Faylni yuborish uchun avval botni ishga tushiring (/start). Botni ochaymi?")) openLink(startLink);
      } else {
        alert((e as Error).message);
      }
    } finally {
      setDownloading(false);
    }
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
          {post.file && (
            <button className="link-card file-card" onClick={download} disabled={downloading}>
              <span>
                <span className="link-card-label">PDF{post.file.size ? ` · ${fileSize(post.file.size)}` : ''}</span>
                <span className="link-card-host">{post.file.name}</span>
              </span>
              {downloading ? <span className="spinner spinner-sm" /> : <IconDownload size={20} />}
            </button>
          )}
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
          {post.link_url ? (
            <MainButton text={post.type === 'resource' ? "Saytga o'tish" : 'Havolani ochish'} onClick={openExternal} />
          ) : (
            post.file && <MainButton text="PDF yuklab olish" onClick={download} loading={downloading} />
          )}
        </>
      )}

      <ShareBlock link={startLink} text={shareText} postId={post.id} />
    </article>
  );
}
