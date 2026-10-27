import { useEffect, useRef } from 'react';
import { nativeMainButton, WA } from '../tg';

type Props = { text: string; onClick: () => void; loading?: boolean; disabled?: boolean };

/**
 * Telegram's native bottom MainButton. Outside Telegram (browser dev) it renders a sticky button instead.
 */
export function MainButton({ text, onClick, loading, disabled }: Props) {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    if (!nativeMainButton) return;
    const mb = WA.MainButton;
    const fn = () => handler.current();
    mb.onClick(fn);
    return () => {
      mb.offClick(fn);
      mb.hideProgress();
      mb.hide();
    };
  }, []);

  useEffect(() => {
    if (!nativeMainButton) return;
    const mb = WA.MainButton;
    mb.setParams({
      text,
      is_visible: true,
      is_active: !disabled,
      color: '#0f0f10',
      text_color: '#ffffff',
    });
    if (loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [text, loading, disabled]);

  if (nativeMainButton) return null;
  return (
    <div className="main-button-fallback">
      <button className="btn btn-primary btn-block" onClick={onClick} disabled={disabled || loading}>
        {loading ? <span className="spinner" aria-label="Yuklanmoqda" /> : text}
      </button>
    </div>
  );
}
