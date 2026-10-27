import { useEffect, useState } from 'react';
import { api } from '../api';
import { alert, confirm, haptic } from '../tg';
import type { MsgButton } from '../types';
import { ButtonsEditor, Field, HTML_HINT, ImageField } from './fields';
import { IconLetter } from '../components/Icons';

type B = { id: number; text: string; audience: string; status: string; total: number; sent: number; failed: number; created_at: number };

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Hammaga',
  subscribed: 'Kanal obunachilariga',
  unsubscribed: "Obuna bo'lmaganlarga",
  waitlist: 'Waitlistdagilarga',
  club: "Club a'zolariga",
};

export function Broadcast() {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [buttons, setButtons] = useState<MsgButton[]>([{ text: 'Ilovani ochish', type: 'app', value: '/' }]);
  const [audience, setAudience] = useState('all');
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<B[]>([]);

  const load = () => api.get<B[]>('/admin/broadcasts').then(setHistory);
  useEffect(() => {
    load();
    api.get<Record<string, number>>('/admin/broadcasts/audience').then(setSizes);
  }, []);

  // Serverless functions are short-lived, so this page drives the sending: each step sends a slice
  // and the next one starts when it returns. Closing the page pauses; reopening resumes.
  const pending = history.find((h) => h.status === 'queued' || h.status === 'sending');
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await api.post(`/admin/broadcasts/${pending.id}/step`);
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) load();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pending?.id, pending?.sent, pending?.failed, pending?.status]);

  const body = { text, photo_url: photo, buttons, audience };

  const test = async () => {
    try {
      await api.post('/admin/broadcasts', { ...body, test: true });
      alert('Sinov xabari sizga yuborildi');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const send = async () => {
    if (!(await confirm(`${AUDIENCE_LABEL[audience]} (${sizes[audience] ?? 0} kishi) yuborilsinmi?`))) return;
    try {
      await api.post('/admin/broadcasts', body);
      haptic.success();
      setText('');
      setPhoto(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="stack form">
      <div className="page-head"><h1>Xabar yuborish</h1></div>
      <Field label="Kimga">
        <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {Object.entries(AUDIENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v} ({sizes[k] ?? '…'})</option>)}
        </select>
      </Field>
      <Field label="Matn" hint={<>{HTML_HINT}. Rasm bilan bo'lsa — 1024 belgigacha.</>}>
        <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <ImageField label="Rasm (ixtiyoriy)" value={photo} onChange={setPhoto} />
      <ButtonsEditor value={buttons} onChange={setButtons} />
      <div className="form-actions">
        <button className="btn btn-secondary" disabled={!text.trim()} onClick={test}>O'zimga sinov</button>
        <button className="btn btn-primary" disabled={!text.trim()} onClick={send}><IconLetter size={18} />Yuborish</button>
      </div>

      <h2 className="section-title" style={{ marginTop: 12 }}>Yuborilganlar</h2>
      {pending && <p className="page-hint">Yuborilmoqda. Tugaguncha bu sahifani yopmang: yopilsa, yuborish to'xtaydi va sahifa qayta ochilganda davom etadi.</p>}
      <div className="admin-list">
        {history.map((h) => (
          <div key={h.id} className="admin-row">
            <div className="admin-row-main">
              <span className="admin-row-title">{h.text.replace(/<[^>]+>/g, '')}</span>
              <span className="admin-row-meta">{AUDIENCE_LABEL[h.audience]} · {new Date(h.created_at).toLocaleString('ru-RU')}</span>
              {h.status !== 'done' && h.total > 0 && (
                <div className="progress"><div style={{ width: `${((h.sent + h.failed) / h.total) * 100}%` }} /></div>
              )}
            </div>
            <div className="admin-row-num">
              {h.sent}/{h.total}
              <span>{h.status === 'done' ? `xato: ${h.failed}` : 'yuborilmoqda…'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
