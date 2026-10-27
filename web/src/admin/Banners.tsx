import { useEffect, useState } from 'react';
import { api, upload } from '../api';
import { BannerCarousel } from '../components/BannerCarousel';
import { alert, confirm, haptic } from '../tg';
import type { Banner } from '../types';
import { Field, ImageField } from './fields';
import { IconAdd, IconGallery, IconTrash } from '../components/Icons';

const ACTION_LABEL = { post: 'Material', page: 'Sahifa', url: 'Havola', none: 'Faqat rasm' } as const;

const IMAGE_HINT = "Rasm telefonda 4:3, kompyuterda 16:10 ko'rinadi. Kamida 1200×900; muhim qism markazda bo'lsin.";

export const bannerName = (b: { id: number; title: string }) => b.title || `Rasmli slayd #${b.id}`;

type Row = Banner & { active: number; sort: number; starts_at: number | null; ends_at: number | null };

const EMPTY: Omit<Row, 'id'> = {
  eyebrow: '',
  title: '',
  subtitle: '',
  image_url: null,
  bg: '#1f1f22',
  cta_label: 'Ochish',
  action_type: 'page',
  action_value: '/club',
  active: 1,
  sort: 0,
  starts_at: null,
  ends_at: null,
};

const toInput = (t: number | null) => (t ? new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromInput = (v: string) => (v ? new Date(v).getTime() : null);

export function Banners() {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<(Omit<Row, 'id'> & { id?: number }) | null>(null);
  const [adding, setAdding] = useState<{ done: number; total: number } | null>(null);

  const load = () => api.get<Row[]>('/admin/banners').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!edit) return;
    try {
      if (edit.id) await api.put(`/admin/banners/${edit.id}`, edit);
      else await api.post('/admin/banners', edit);
      haptic.success();
      setEdit(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm("Bannerni o'chirasizmi?"))) return;
    await api.del(`/admin/banners/${id}`);
    setEdit(null);
    load();
  };

  /** Uploads each picked image and adds it as an image-only slide at the end of the carousel. */
  const addImages = async (files: File[]) => {
    if (!files.length) return;
    let sort = rows.reduce((m, r) => Math.max(m, r.sort), 0);
    setAdding({ done: 0, total: files.length });
    try {
      for (const [i, file] of files.entries()) {
        const image_url = await upload(file);
        await api.post('/admin/banners', { ...EMPTY, cta_label: '', action_type: 'none', action_value: '', image_url, sort: ++sort });
        setAdding({ done: i + 1, total: files.length });
      }
      haptic.success();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAdding(null);
      load();
    }
  };

  if (edit) {
    const set = (patch: Partial<Row>) => setEdit({ ...edit, ...patch });
    return (
      <div className="stack form">
        <div className="page-head">
          <h1>{edit.id ? 'Bannerni tahrirlash' : 'Yangi banner'}</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Bekor qilish</button>
        </div>
        <div className="preview-frame"><BannerCarousel banners={[{ ...edit, id: edit.id ?? 0 } as Banner]} /></div>
        <Field label="Kichik yozuv (ixtiyoriy)" hint="Sarlavha ustidagi qisqa belgi, masalan: QO'LLANMA"><input className="input" value={edit.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
        <Field label="Sarlavha (ixtiyoriy)" hint="Bo'sh qoldirsangiz, slayd faqat rasmdan iborat bo'ladi"><input className="input" value={edit.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Tavsif (ixtiyoriy)"><input className="input" value={edit.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
        <ImageField label="Rasm" value={edit.image_url} onChange={(v) => set({ image_url: v })} />
        <p className="field-hint" style={{ marginTop: -10 }}>{IMAGE_HINT}</p>
        <div className="grid-2">
          <Field label="Fon rangi"><input className="input" type="color" value={edit.bg} onChange={(e) => set({ bg: e.target.value })} /></Field>
          <Field label="Tugma matni (ixtiyoriy)" hint="Rasm burchagidagi tugma, masalan: Ochish"><input className="input" value={edit.cta_label} onChange={(e) => set({ cta_label: e.target.value })} /></Field>
        </div>
        <div className="grid-2">
          <Field label="Bosilganda">
            <select className="input" value={edit.action_type} onChange={(e) => set({ action_type: e.target.value as Row['action_type'] })}>
              <option value="none">Hech narsa (faqat rasm)</option>
              <option value="post">Material ochiladi (ID)</option>
              <option value="page">Ilova sahifasi (/club)</option>
              <option value="url">Havola (https:// yoki t.me)</option>
            </select>
          </Field>
          <Field label="Qiymat">
            <input className="input" disabled={edit.action_type === 'none'} value={edit.action_value} onChange={(e) => set({ action_value: e.target.value })}
              placeholder={edit.action_type === 'post' ? '12' : edit.action_type === 'page' ? '/club' : 'https://t.me/…'} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Boshlanishi (ixtiyoriy)"><input className="input" type="datetime-local" value={toInput(edit.starts_at)} onChange={(e) => set({ starts_at: fromInput(e.target.value) })} /></Field>
          <Field label="Tugashi (ixtiyoriy)"><input className="input" type="datetime-local" value={toInput(edit.ends_at)} onChange={(e) => set({ ends_at: fromInput(e.target.value) })} /></Field>
        </div>
        <div className="grid-2">
          <Field label="Tartib" hint="Kichik raqam — birinchi"><input className="input" type="number" value={edit.sort} onChange={(e) => set({ sort: Number(e.target.value) })} /></Field>
          <label className="check"><input type="checkbox" checked={!!edit.active} onChange={(e) => set({ active: e.target.checked ? 1 : 0 })} /> Faol</label>
        </div>
        <div className="form-actions">
          {edit.id && <button className="btn btn-ghost danger" onClick={() => remove(edit.id!)}><IconTrash size={17} />O'chirish</button>}
          <button className="btn btn-primary" onClick={save}>Saqlash</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Bannerlar</h1>
        <div className="row-gap">
          <span className="btn btn-secondary btn-sm file-btn">
            <IconGallery size={17} />
            {adding ? `Yuklanmoqda ${adding.done}/${adding.total}` : "Rasm qo'shish"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!!adding}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                addImages(files);
              }}
            />
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY })}><IconAdd size={17} />Yangi banner</button>
        </div>
      </div>
      <p className="page-hint">
        Bosh sahifaning tepasida har 5 soniyada aylanadi. «Rasm qo'shish» bilan bir yo'la bir nechta rasm tanlang: har biri alohida
        slayd bo'ladi. Sarlavha yoki tugma qo'shish uchun slaydni bosing. {IMAGE_HINT}
      </p>
      {!rows.length && <div className="empty">Hali slayd yo'q</div>}
      <div className="admin-list">
        {rows.map((r) => (
          <button key={r.id} className="admin-row" onClick={() => setEdit(r)}>
            <span className="swatch" style={{ backgroundColor: r.bg, backgroundImage: r.image_url ? `url(${r.image_url})` : undefined }} />
            <span className="admin-row-main">
              <span className="admin-row-title">{bannerName(r)}</span>
              <span className="admin-row-meta">{r.action_type === 'none' ? ACTION_LABEL.none : `${ACTION_LABEL[r.action_type]}: ${r.action_value || '—'}`}</span>
            </span>
            <span className={r.active ? 'status status-ok' : 'status'}>{r.active ? 'Faol' : "O'chiq"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
