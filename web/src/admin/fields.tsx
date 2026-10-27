import { useState, type ReactNode } from 'react';
import { upload } from '../api';
import { IconAdd, IconTrash, IconUpload } from '../components/Icons';
import { alert } from '../tg';
import type { MsgButton } from '../types';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ImageField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="image-field">
        {value && <img src={value} alt="" />}
        <div className="image-field-controls">
          <input className="input" placeholder="https://… yoki rasm yuklang" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
          <div className="row-gap">
            <span className="btn btn-secondary btn-sm file-btn">
              <IconUpload size={17} />
              {busy ? 'Yuklanmoqda…' : 'Rasm yuklash'}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    onChange(await upload(f));
                  } catch (err) {
                    alert((err as Error).message);
                  } finally {
                    setBusy(false);
                    e.target.value = '';
                  }
                }}
              />
            </span>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
                Olib tashlash
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const BUTTON_TYPES: { v: MsgButton['type']; l: string; ph: string }[] = [
  { v: 'app', l: 'Mini app', ph: '/club yoki /p/12' },
  { v: 'url', l: 'Havola', ph: 'https://…' },
  { v: 'channel', l: 'Kanal', ph: '' },
];

/** Editor for inline keyboard buttons under bot messages. */
export function ButtonsEditor({ value, onChange }: { value: MsgButton[]; onChange: (v: MsgButton[]) => void }) {
  const set = (i: number, patch: Partial<MsgButton>) => onChange(value.map((b, j) => (i === j ? { ...b, ...patch } : b)));
  return (
    <div className="field">
      <span className="field-label">Tugmalar</span>
      {value.map((b, i) => {
        const t = BUTTON_TYPES.find((x) => x.v === b.type)!;
        return (
          <div key={i} className="button-row">
            <input className="input" placeholder="Tugma matni" value={b.text} onChange={(e) => set(i, { text: e.target.value })} />
            <select className="input" value={b.type} onChange={(e) => set(i, { type: e.target.value as MsgButton['type'] })}>
              {BUTTON_TYPES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
            </select>
            {b.type !== 'channel' ? (
              <input className="input" placeholder={t.ph} value={b.value ?? ''} onChange={(e) => set(i, { value: e.target.value })} />
            ) : (
              <span className="field-hint">Kanal havolasi .env dan olinadi</span>
            )}
            <button type="button" className="icon-btn" aria-label="Tugmani o'chirish" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <IconTrash size={18} />
            </button>
          </div>
        );
      })}
      <div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onChange([...value, { text: 'Ilovani ochish', type: 'app', value: '/' }])}
        >
          <IconAdd size={17} />
          Tugma qo'shish
        </button>
      </div>
    </div>
  );
}

export const HTML_HINT = (
  <>Telegram HTML: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;, &lt;a href="…"&gt;havola&lt;/a&gt;, &lt;code&gt;kod&lt;/code&gt;</>
);
