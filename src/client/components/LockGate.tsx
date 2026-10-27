import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../session';
import { alert, haptic, onActivated, openLink } from '../tg';
import { IconLock } from './Icons';
import { MainButton } from './MainButton';

/**
 * The locked teaser: the start of the article fades out under the gate.
 * The lines are placeholders; the server never sends a locked body.
 */
export function LockGate({ kind, onUnlocked }: { kind: 'channel' | 'club'; onUnlocked: () => void }) {
  const { session, checkSubscription } = useSession();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const check = async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const ok = await checkSubscription();
      if (ok) {
        haptic.success();
        onUnlocked();
      } else if (!silent) {
        haptic.error();
        await alert("Obuna hali ko'rinmayapti. Kanalga obuna bo'ling va yana tekshiring.");
      }
    } finally {
      setChecking(false);
    }
  };

  // Re-check automatically when the user returns from the channel.
  useEffect(() => (kind === 'channel' ? onActivated(() => check(true)) : undefined), [kind]);

  return (
    <div className="teaser">
      <div className="teaser-lines" aria-hidden>
        {[96, 88, 92, 70, 84, 60].map((w, i) => (
          <span key={i} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="gate">
        <span className="gate-icon"><IconLock size={24} bold /></span>
        {kind === 'club' ? (
          <>
            <h2>AI Club a'zolari uchun</h2>
            <p>Bu material yopiq hamjamiyat uchun. Club ochilganda birinchilardan bo'lib bilish uchun waitlistga yoziling.</p>
            <MainButton text="AI Club haqida" onClick={() => navigate('/club')} />
          </>
        ) : (
          <>
            <h2>Davomi kanal obunachilari uchun</h2>
            <p>{session?.gateText}</p>
            <button className="btn btn-secondary" onClick={() => session && openLink(session.channelUrl)}>
              {session?.channelTitle || 'Kanal'}ga o'tish
            </button>
            <MainButton text="Obunani tekshirish" loading={checking} onClick={() => check()} />
          </>
        )}
      </div>
    </div>
  );
}
