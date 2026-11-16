import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Markdown } from '../components/Markdown';
import { alert, confirm, copy, haptic } from '../tg';
import { ACCESS_LABEL, TYPE_LABEL, type Access, type PostType } from '../types';
import { Field, FileField, HTML_HINT, ImageField, type FileValue } from './fields';
import { formatDate } from '../components/PostCard';
import { IconCopy, IconTrash } from '../components/Icons';

type Form = {
  type: PostType;
  title: string;
  summary: string;
  body: string;
  cover_url: string | null;
  link_url: string | null;
  install: string | null;
  tags: string;
  access: Access;
  status: 'draft' | 'published';
  pinned: boolean;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  tg_post: boolean;
  tg_text: string;
  /** Read-only: set by the server once the channel announcement is sent. */
  tg_posted_at?: number | null;
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Same fallback the server sends when the channel text is left empty. */
const defaultTgText = (f: Form) =>
  [`<b>${escapeHtml(f.title)}</b>`, f.summary ? escapeHtml(f.summary) : ''].filter(Boolean).join('\n\n');

const EMPTY: Form = {
  type: 'guide',
  title: '',
  summary: '',
  body: '',
  cover_url: null,
  link_url: null,
  install: null,
  tags: '',
  access: 'channel',
  status: 'draft',
  pinned: false,
  file_path: null,
  file_name: null,
  file_size: null,
  tg_post: true,
  tg_text: '',
};

export function PostEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botUsername, setBotUsername] = useState('');

  const load = () =>
    api.get<any>(`/admin/posts/${id}`).then((p) => setForm({ ...EMPTY, ...p, pinned: !!p.pinned, tg_post: !!p.tg_post }));

  useEffect(() => {
    if (!isNew) load();
  }, [id, isNew]);

  useEffect(() => {
    api.get<{ botUsername: string }>('/admin/meta').then((m) => setBotUsername(m.botUsername));
  }, []);

  if (!form) return <div className="center-screen"><div className="spinner" /></div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const save = async (status?: Form['status']) => {
    setSaving(true);
    try {
      const body = { ...form, status: status ?? form.status };
      type Saved = { id: number; channelError?: string };
      if (isNew) {
        const r = await api.post<Saved>('/admin/posts', body);
        // The new route loads the post again, including the channel status.
        navigate(`/admin/posts/${r.id}`, { replace: true });
        if (r.channelError) alert(`Material saqlandi, lekin kanalga yuborilmadi: ${r.channelError}`);
      } else {
        const r = await api.put<Saved>(`/admin/posts/${id}`, body);
        setForm(body);
        await load();
        if (r.channelError) alert(`Material saqlandi, lekin kanalga yuborilmadi: ${r.channelError}`);
      }
      haptic.success();
      return true;
    } catch (e) {
      alert((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Saves first, so the test shows exactly what the channel will get.
  const testChannel = async () => {
    if (!(await save())) return;
    try {
      await api.post(`/admin/posts/${id}/tg-test`);
      alert('Post sizga botda yuborildi.');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const postNow = async () => {
    const again = !!form.tg_posted_at;
    if (!(await confirm(again ? 'Kanalga yana bir marta yuborilsinmi?' : 'Kanalga hozir yuborilsinmi?'))) return;
    if (!(await save())) return;
    // Saving may already have posted it (first publish with the switch on).
    if (!again && (await api.get<Form>(`/admin/posts/${id}`)).tg_posted_at) return;
    try {
      const r = await api.post<{ tg_posted_at: number }>(`/admin/posts/${id}/tg-post`);
      setForm((f) => (f ? { ...f, tg_posted_at: r.tg_posted_at } : f));
      haptic.success();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const remove = async () => {
    if (!(await confirm("Materialni o'chirasizmi?"))) return;
    await api.del(`/admin/posts/${id}`);
    navigate('/admin/posts', { replace: true });
  };

  const fileValue: FileValue = form.file_path ? { path: form.file_path, name: form.file_name ?? 'file.pdf', size: form.file_size } : null;
  const shareUrl = botUsername && !isNew ? `https://t.me/${botUsername}?start=post_${id}` : '';
  const tgText = form.tg_text.trim() || defaultTgText(form);
  const tgLength = tgText.replace(/<[^>]*>/g, '').length;

  const showLink = form.type !== 'guide';
  const showInstall = form.type === 'skill' || form.type === 'mcp';

  return (
    <div className="stack form">
      <div className="page-head">
        <h1>{isNew ? 'Yangi material' : 'Materialni tahrirlash'}</h1>
        {!isNew && <button className="btn btn-ghost btn-sm danger" onClick={remove}><IconTrash size={17} />O'chirish</button>}
      </div>

      <div className="grid-2">
        <Field label="Turi">
          <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as PostType)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Kim ko'ra oladi" hint="Yopiq bo'lsa, ro'yxatda ko'rinadi, lekin ichi ochilmaydi">
          <select className="input" value={form.access} onChange={(e) => set('access', e.target.value as Access)}>
            {Object.entries(ACCESS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Sarlavha">
        <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </Field>
      <Field label="Qisqa tavsif" hint="Ro'yxatda va yopiq holatda ham ko'rinadi — qiziqtiradigan qilib yozing">
        <textarea className="input" rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
      </Field>
      <ImageField label="Muqova rasmi" value={form.cover_url} onChange={(v) => set('cover_url', v)} />

      {showLink && (
        <Field label={form.type === 'resource' ? 'Sayt havolasi' : 'Havola (GitHub, sahifa)'}>
          <input className="input" placeholder="https://" value={form.link_url ?? ''} onChange={(e) => set('link_url', e.target.value || null)} />
        </Field>
      )}
      {showInstall && (
        <Field label="O'rnatish buyrug'i / konfiguratsiya" hint="Foydalanuvchi bir bosishda nusxa oladi">
          <textarea className="input mono" rows={4} value={form.install ?? ''} onChange={(e) => set('install', e.target.value || null)} />
        </Field>
      )}

      <FileField
        label="Yuklab olinadigan fayl (PDF)"
        hint="Foydalanuvchi «Yuklab olish» ni bossa, bot faylni chatiga yuboradi. 50 MB gacha."
        value={fileValue}
        onChange={(v) => setForm({ ...form, file_path: v?.path ?? null, file_name: v?.name ?? null, file_size: v?.size ?? null })}
      />

      <div className="field">
        <div className="field-label row-between">
          <span>Matn (Markdown)</span>
          <div className="seg">
            <button className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Yozish</button>
            <button className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Ko'rish</button>
          </div>
        </div>
        {preview ? (
          <div className="preview-frame"><Markdown source={form.body} /></div>
        ) : (
          <textarea
            className="input mono"
            rows={18}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={'## Sarlavha\n\nMatn, **qalin**, [havola](https://…)\n\n```\nkod\n```\n\n![rasm](https://…)'}
          />
        )}
      </div>

      <Field label="Teglar" hint="Vergul bilan: claude, cursor, video">
        <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
        Ro'yxat tepasiga qadash
      </label>

      {shareUrl && (
        <div className="field">
          <span className="field-label">Ulashish havolasi</span>
          <div className="copy-row">
            <code>{shareUrl}</code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(shareUrl)}>
              <IconCopy size={17} />Nusxa
            </button>
          </div>
          <span className="field-hint">Avval botga /start bosiladi, keyin bot materialni ochish tugmasini yuboradi</span>
        </div>
      )}

      <section className="panel stack tg-panel">
        <div className="row-between">
          <h2 className="section-title">Telegram kanal</h2>
          {form.tg_posted_at && <span className="status status-ok">Yuborilgan: {formatDate(form.tg_posted_at)}</span>}
        </div>
        <label className="check">
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={form.tg_post}
            onChange={(e) => set('tg_post', e.target.checked)}
          />
          Chop etilganda kanalga post yuborish
        </label>
        {form.tg_post && (
          <>
            <Field
              label="Post matni"
              hint={<>{HTML_HINT}. Bo'sh qolsa, sarlavha va qisqa tavsif yuboriladi. Muqova bo'lsa post rasm bilan chiqadi. Ostida «O'qish» tugmasi bo'ladi.</>}
            >
              <textarea
                className="input"
                rows={7}
                value={form.tg_text}
                placeholder={defaultTgText(form)}
                onChange={(e) => set('tg_text', e.target.value)}
              />
            </Field>
            <div className="row-gap">
              <span className={form.cover_url && tgLength > 1024 ? 'field-hint danger' : 'field-hint'}>
                {tgLength} belgi{form.cover_url ? ' / 1024 (rasm bilan)' : ''}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('tg_text', defaultTgText(form))}>
                Sarlavha va tavsifdan to'ldirish
              </button>
            </div>
            {!form.tg_posted_at && (
              <p className="field-hint">
                {form.status === 'published' ? 'Saqlaganingizda kanalga yuboriladi.' : '«Chop etish» ni bosganingizda kanalga yuboriladi.'}
              </p>
            )}
          </>
        )}
        {!isNew && (
          <div className="row-gap">
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={testChannel}>
              O'zimga test
            </button>
            {form.status === 'published' && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={postNow}>
                {form.tg_posted_at ? 'Qayta yuborish' : 'Kanalga hozir yuborish'}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="form-actions">
        <span className="muted">Holat: {form.status === 'published' ? 'Chop etilgan' : 'Qoralama'}</span>
        <button className="btn btn-secondary" disabled={saving} onClick={() => save()}>Saqlash</button>
        {form.status === 'draft' ? (
          <button className="btn btn-primary" disabled={saving} onClick={() => save('published')}>Chop etish</button>
        ) : (
          <button className="btn btn-ghost" disabled={saving} onClick={() => save('draft')}>Qoralamaga qaytarish</button>
        )}
      </div>
    </div>
  );
}
