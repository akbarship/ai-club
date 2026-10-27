import { useEffect, useState } from 'react';
import { api } from '../api';
import { alert, haptic } from '../tg';
import { Field, HTML_HINT, ImageField } from './fields';

export function Settings() {
  const [s, setS] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    api.get<Record<string, string>>('/admin/settings').then(setS);
  }, []);
  if (!s) return <div className="center-screen"><div className="spinner" /></div>;
  const set = (k: string) => (e: { target: { value: string } }) => setS({ ...s, [k]: e.target.value });

  const save = async () => {
    try {
      setS(await api.put('/admin/settings', s));
      haptic.success();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="stack form">
      <div className="page-head"><h1>Sozlamalar</h1></div>
      <div className="grid-2">
        <Field label="Muallif ismi" hint="Postlarda imzo sifatida ko'rinadi">
          <input className="input" value={s.author_name} onChange={set('author_name')} />
        </Field>
        <Field label="Ilova nomi" hint="Kompyuterdagi yon panel tepasida">
          <input className="input" value={s.brand_title} onChange={set('brand_title')} />
        </Field>
      </div>
      <ImageField label="Muallif rasmi" value={s.author_avatar || null} onChange={(v) => setS({ ...s, author_avatar: v ?? '' })} />
      <Field label="/start xabari" hint={HTML_HINT}>
        <textarea className="input" rows={6} value={s.welcome_text} onChange={set('welcome_text')} />
      </Field>
      <Field label="Kanal nomi (tugmalarda)">
        <input className="input" value={s.channel_title} onChange={set('channel_title')} />
      </Field>
      <Field label="Yopiq material matni" hint="Obuna bo'lmaganlar ko'radi">
        <textarea className="input" rows={3} value={s.gate_text} onChange={set('gate_text')} />
      </Field>
      <Field label="AI Club sahifasi (Markdown)">
        <textarea className="input mono" rows={8} value={s.club_pitch} onChange={set('club_pitch')} />
      </Field>
      <Field label="Kurslar bo'limi (Markdown)">
        <textarea className="input mono" rows={6} value={s.course_pitch} onChange={set('course_pitch')} />
      </Field>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save}>Saqlash</button>
      </div>
    </div>
  );
}
