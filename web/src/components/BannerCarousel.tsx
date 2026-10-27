import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../api';
import { haptic, openLink } from '../tg';
import type { Banner } from '../types';
import { IconArrowRight } from './Icons';

const INTERVAL_MS = 5000;
/** After the user touches the carousel, wait this long before auto-advancing again. */
const RESUME_MS = 6000;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.visibilityState === 'hidden');
  const [reduced] = useState(prefersReducedMotion);

  const autoplay = banners.length > 1 && !reduced;
  const running = autoplay && !paused && !hidden;

  // Keep the indicator in sync with manual swipes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (first) setIndex(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearTimeout(resumeTimer.current);
    };
  }, []);

  const goTo = useCallback((i: number) => {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    const item = el?.children[i] as HTMLElement | undefined;
    if (!el || !first || !item) return;
    el.scrollTo({ left: item.offsetLeft - first.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    setIndex(i);
  }, [reduced]);

  /** Pause now; resume automatically unless the pointer stays over the carousel. */
  const interact = (resume = true) => {
    setPaused(true);
    window.clearTimeout(resumeTimer.current);
    if (resume) resumeTimer.current = window.setTimeout(() => setPaused(false), RESUME_MS);
  };

  if (!banners.length) return null;

  const open = (b: Banner) => {
    if (b.action_type === 'none') return;
    haptic.tap();
    track('banner_click', b.id);
    if (b.action_type === 'post') navigate(`/p/${b.action_value}`);
    else if (b.action_type === 'page') navigate(b.action_value.startsWith('/') ? b.action_value : `/${b.action_value}`);
    else if (b.action_value) openLink(b.action_value);
  };

  return (
    <section
      className="features"
      aria-label="Asosiy"
      aria-roledescription="karusel"
      onMouseEnter={() => interact(false)}
      onMouseLeave={() => interact()}
      onTouchStart={() => interact()}
      onWheel={() => interact()}
      onFocus={() => interact(false)}
      onBlur={() => interact()}
    >
      <div className={banners.length > 1 ? 'feature-track' : 'feature-track single'} ref={ref}>
        {banners.map((b, i) => {
          const hasText = !!(b.eyebrow || b.title || b.subtitle);
          return (
            <button
              key={b.id}
              className={['feature', b.action_type === 'none' && 'feature-static', !hasText && 'feature-image-only'].filter(Boolean).join(' ')}
              onClick={() => open(b)}
              aria-label={hasText ? undefined : `Slayd ${i + 1}`}
              tabIndex={b.action_type === 'none' ? -1 : 0}
            >
              {hasText && (
                <span className="feature-head">
                  {b.eyebrow && <span className="eyebrow">{b.eyebrow}</span>}
                  {b.title && <span className="feature-title">{b.title}</span>}
                  {b.subtitle && <span className="feature-subtitle">{b.subtitle}</span>}
                </span>
              )}
              <span className="feature-media" style={{ backgroundColor: b.bg }}>
                {b.image_url ? (
                  <img src={b.image_url} alt="" draggable={false} />
                ) : (
                  <span className="feature-mark">
                    <IconArrowRight size={30} bold />
                  </span>
                )}
                {b.cta_label && b.action_type !== 'none' && <span className="feature-cta">{b.cta_label}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="feature-progress">
          {banners.map((b, i) => (
            <button
              key={b.id}
              className={i === index ? 'active' : ''}
              aria-label={`${i + 1}-slayd`}
              aria-current={i === index}
              onClick={() => {
                interact();
                goTo(i);
              }}
            >
              {i === index && autoplay && (
                // The fill's animation is the timer: pausing it pauses the carousel.
                <i
                  key={index}
                  className="fill"
                  style={{ animationDuration: `${INTERVAL_MS}ms`, animationPlayState: running ? 'running' : 'paused' }}
                  onAnimationEnd={() => goTo((index + 1) % banners.length)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
