import { config } from './config.ts';
import { getUser, logEvent, now, run } from './db.ts';
import { bot } from './telegram.ts';

const MEMBER = new Set(['creator', 'administrator', 'member']);

export function setSubscribed(userId: number, subscribed: boolean) {
  const prev = getUser(userId);
  run('UPDATE users SET is_subscribed = ?, sub_checked_at = ? WHERE id = ?', subscribed ? 1 : 0, now(), userId);
  if (prev && !!prev.is_subscribed !== subscribed) logEvent(userId, subscribed ? 'subscribed' : 'unsubscribed');
}

/**
 * Is the user a member of the gate channel? Results are cached on the user row;
 * pass force=true when the user explicitly taps "check".
 * Requires the bot to be an admin of the channel.
 */
export async function checkSubscription(userId: number, force = false): Promise<boolean> {
  if (!config.channelId) return true;
  const u = getUser(userId);
  if (!force && u?.sub_checked_at && now() - u.sub_checked_at < config.subscriptionTtlMs) return !!u.is_subscribed;
  try {
    const m = await bot.api.getChatMember(config.channelId, userId);
    const ok = MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member);
    setSubscribed(userId, ok);
    return ok;
  } catch (e) {
    console.warn('getChatMember failed (is the bot an admin of the channel?):', (e as Error).message);
    return u ? !!u.is_subscribed : false;
  }
}

export function isChannelChat(chat: { id: number; username?: string }) {
  const c = config.channelId;
  return c === String(chat.id) || (!!chat.username && c.replace(/^@/, '').toLowerCase() === chat.username.toLowerCase());
}
