import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Markdown } from '../components/Markdown';
import { alert, confirm, haptic } from '../tg';
import { ACCESS_LABEL, TYPE_LABEL, type Access, type PostType } from '../types';
import { Field, ImageField } from './fields';
import { IconTrash } from '../components/Icons';

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
};

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
};

export function PostEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) api.get<any>(`/admin/posts/${id}`).then((p) => setForm({ ...EMPTY, ...p, pinned: !!p.pinned }));
  }, [id, isNew]);

  if (!form) return <div className="center-screen"><div className="spinner" /></div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const save = async (status?: Form['status']) => {
    setSaving(true);
    try {
      const body = { ...form, status: status ?? form.status };
      if (isNew) {
        const r = await api.post<{ id: number }>('/admin/posts', body);
        navigate(`/admin/posts/${r.id}`, { replace: true });
      } else {
        await api.put(`/admin/posts/${id}`, body);
      }
      setForm(body);
      haptic.success();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm("Materialni o'chirasizmi?"))) return;
    await api.del(`/admin/posts/${id}`);
    navigate('/admin/posts', { replace: true });
  };

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
