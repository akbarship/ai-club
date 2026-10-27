import { useEffect, useState } from 'react';
import { api } from '../api';
import { IconCheckCircle } from '../components/Icons';
import { Markdown } from '../components/Markdown';
import { useSession } from '../session';
import { alert, haptic } from '../tg';

const PRODUCTS = [
  { key: 'club', cta: "AI Club waitlistiga yozilish" },
  { key: 'course', cta: 'Kurslar waitlistiga yozilish' },
] as const;

export function Club() {
  const { session, setWaitlist } = useSession();
  const s = session!;
  const [pitch, setPitch] = useState<{ club: string; course: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ club: string; course: string }>('/pitch').then(setPitch);
  }, []);

  const toggle = async (product: string) => {
    const joined = s.waitlist.includes(product);
    setBusy(product);
    try {
      if (joined) {
        await api.del(`/waitlist/${product}`);
        setWaitlist(s.waitlist.filter((p) => p !== product));
      } else {
        await api.post(`/waitlist/${product}`);
        setWaitlist([...s.waitlist, product]);
        haptic.success();
        await alert("Siz waitlistdasiz. Ochilganda bot orqali birinchi bo'lib xabar olasiz.");
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!pitch) return <div className="center-screen"><div className="spinner" /></div>;

  return (
    <div className="offers">
      {s.club && (
        <div className="notice">
          <span className="pill">A'ZO</span>
          <span>Siz AI Club a'zosisiz. Barcha yopiq materiallar ochiq.</span>
        </div>
      )}
      {PRODUCTS.map(({ key, cta }) => {
        const joined = s.waitlist.includes(key);
        return (
          <section key={key} className="offer">
            <Markdown source={pitch[key]} />
            {!(key === 'club' && s.club) && (
              <button
                className={joined ? 'btn btn-secondary btn-block' : 'btn btn-primary btn-block'}
                disabled={busy === key}
                onClick={() => toggle(key)}
              >
                {joined && <IconCheckCircle size={18} bold />}
                {joined ? 'Waitlistdasiz' : cta}
              </button>
            )}
            {joined && <p className="offer-note">Bekor qilish uchun tugmani yana bosing.</p>}
          </section>
        );
      })}
    </div>
  );
}
