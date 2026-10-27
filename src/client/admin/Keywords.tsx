import { useEffect, useState } from 'react';
import { api } from '../api';
import { alert, confirm, copy, haptic } from '../tg';
import type { MsgButton } from '../types';
import { ButtonsEditor, Field, HTML_HINT, ImageField } from './fields';
import { IconAdd, IconCopy } from '../components/Icons';

type Kw = {
  id?: number;
  keyword: string;
  match_text: number;
  response_text: string;
  photo_url: string | null;
  buttons: MsgButton[];
  active: number;
  hits?: number;
  users?: number;
};

const EMPTY: Kw = {
  keyword: '',
  match_text: 1,
  response_text: "<b>AI Club</b>\n\nBu yerda AI bo'yicha eng foydali materiallar. Pastdagi tugmani bosing.",
  photo_url: null,
  buttons: [{ text: 'Ilovani ochish', type: 'app', value: '/' }],
  active: 1,
};

export function Keywords() {
  const [rows, setRows] = useState<Kw[]>([]);
  const [edit, setEdit] = useState<Kw | null>(null);
  const [botUsername, setBotUsername] = useState('');

  const load = () => api.get<Kw[]>('/admin/keywords').then(setRows);
  useEffect(() => {
    load();
    api.get<{ botUsername: string }>('/admin/meta').then((m) => setBotUsername(m.botUsername));
  }, []);

  const deepLink = (k: string) => `https://t.me/${botUsername}?start=${k}`;

  const save = async () => {
    if (!edit) return;
    try {
      if (edit.id) await api.put(`/admin/keywords/${edit.id}`, edit);
      else await api.post('/admin/keywords', edit);
      haptic.success();
      setEdit(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (edit) {
    const set = (patch: Partial<Kw>) => setEdit({ ...edit, ...patch });
    return (
      <div className="stack form">
        <div className="page-head">
          <h1>{edit.id ? "Kalit so'zni tahrirlash" : "Yangi kalit so'z"}</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Bekor qilish</button>
        </div>
        <Field label="Kalit so'z" hint={edit.keyword ? <>Havola: <b>{deepLink(edit.keyword.toLowerCase())}</b></> : 'Lotin harflari, raqam, _ yoki -'}>
          <input className="input" value={edit.keyword} placeholder="club" onChange={(e) => set({ keyword: e.target.value.replace(/\s/g, '') })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={!!edit.match_text} onChange={(e) => set({ match_text: e.target.checked ? 1 : 0 })} />
          Foydalanuvchi shu so'zni botga yozsa ham javob berilsin
        </label>
        <Field label="Javob matni" hint={HTML_HINT}>
          <textarea className="input" rows={7} value={edit.response_text} onChange={(e) => set({ response_text: e.target.value })} />
        </Field>
        <ImageField label="Rasm (ixtiyoriy)" value={edit.photo_url} onChange={(v) => set({ photo_url: v })} />
        <ButtonsEditor value={edit.buttons} onChange={(buttons) => set({ buttons })} />
        <label className="check">
          <input type="checkbox" checked={!!edit.active} onChange={(e) => set({ active: e.target.checked ? 1 : 0 })} /> Faol
        </label>
        <div className="form-actions">
          {edit.id && (
            <>
              <button className="btn btn-ghost danger" onClick={async () => {
                if (!(await confirm("O'chirasizmi?"))) return;
                await api.del(`/admin/keywords/${edit.id}`);
                setEdit(null);
                load();
              }}>O'chirish</button>
              <button className="btn btn-ghost" onClick={async () => {
                try {
                  await api.post(`/admin/keywords/${edit.id}/test`);
                  alert('Saqlangan versiya sizga botda yuborildi');
                } catch (e) {
                  alert((e as Error).message);
                }
              }}>O'zimga sinab ko'rish</button>
            </>
          )}
          <button className="btn btn-primary" onClick={save}>Saqlash</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Kalit so'zlar</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY })}><IconAdd size={17} />Yangi kalit so'z</button>
      </div>
      <p className="page-hint">
        Har bir kalit so'z uchun tayyor havola: <code>t.me/{botUsername || 'bot'}?start=club</code>. Uni Reels, post yoki
        stories'ga qo'ying — bosgan odamga tayyor xabar va mini app tugmasi chiqadi. Kim qayerdan kelgani statistikada ko'rinadi.
      </p>
      {!rows.length && <div className="empty">Kalit so'z yo'q</div>}
      <div className="admin-list">
        {rows.map((r) => (
          <div key={r.id} className="admin-row">
            <button className="admin-row-main" onClick={() => setEdit(r)}>
              <span className="admin-row-title">{r.keyword}</span>
              <span className="admin-row-meta">
                {!r.active && <span className="status">O'chiq</span>}
                {r.hits} marta ishlatildi · {r.users} yangi foydalanuvchi keldi
              </span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => copy(deepLink(r.keyword))}><IconCopy size={16} />Havola</button>
          </div>
        ))}
      </div>
    </div>
  );
}
