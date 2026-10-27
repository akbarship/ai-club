// Thin wrapper around window.Telegram.WebApp with graceful fallbacks for a normal browser.
// https://core.telegram.org/bots/webapps

/* eslint-disable @typescript-eslint/no-explicit-any */
export const WA: any = (window as any).Telegram?.WebApp;
export const inTelegram = !!WA?.initData;
export const initData: string = WA?.initData ?? '';
export const startParam: string | undefined = WA?.initDataUnsafe?.start_param;

const supports = (v: string) => !!WA?.isVersionAtLeast?.(v);

export function initTelegram() {
  if (!WA) return;
  WA.ready();
  WA.expand();
  if (supports('7.7')) WA.disableVerticalSwipes();
  // The app is always light, whatever the user's Telegram theme.
  if (supports('6.1')) {
    WA.setHeaderColor('#ffffff');
    WA.setBackgroundColor('#ffffff');
  }
  if (supports('7.10')) WA.setBottomBarColor('#ffffff');
  document.documentElement.dataset.platform = WA.platform;
}

export const haptic = {
  tap: () => supports('6.1') && WA.HapticFeedback.impactOccurred('light'),
  select: () => supports('6.1') && WA.HapticFeedback.selectionChanged(),
  success: () => supports('6.1') && WA.HapticFeedback.notificationOccurred('success'),
  error: () => supports('6.1') && WA.HapticFeedback.notificationOccurred('error'),
};

export function openLink(url: string) {
  if (/^https?:\/\/t\.me\//.test(url)) {
    if (supports('6.1')) return WA.openTelegramLink(url);
  } else if (WA) {
    return WA.openLink(url);
  }
  window.open(url, '_blank', 'noopener');
}

export function alert(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (supports('6.2')) WA.showAlert(message, () => resolve());
    else {
      window.alert(message);
      resolve();
    }
  });
}

export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (supports('6.2')) WA.showConfirm(message, (ok: boolean) => resolve(ok));
    else resolve(window.confirm(message));
  });
}

export function shareLink(url: string, text: string) {
  openLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
}

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  haptic.success();
}

export const nativeBackButton = supports('6.1');
export const nativeMainButton = !!WA && inTelegram;
export const nativeSettingsButton = supports('7.0');

/** Listen for the app regaining focus (e.g. coming back from the channel). */
export function onActivated(fn: () => void) {
  const vis = () => document.visibilityState === 'visible' && fn();
  document.addEventListener('visibilitychange', vis);
  if (supports('8.0')) WA.onEvent('activated', fn);
  return () => {
    document.removeEventListener('visibilitychange', vis);
    if (supports('8.0')) WA.offEvent('activated', fn);
  };
}
