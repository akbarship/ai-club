import { config } from './config';
import { getUser, logEvent, now, run } from './db';
import { bot } from './telegram';

const MEMBER = new Set(['creator', 'administrator', 'member']);

export async function setSubscribed(userId: number, subscribed: boolean) {
  const prev = await getUser(userId);
  await run('UPDATE users SET is_subscribed = ?, sub_checked_at = ? WHERE id = ?', subscribed ? 1 : 0, now(), userId);
  if (prev && !!prev.is_subscribed !== subscribed) await logEvent(userId, subscribed ? 'subscribed' : 'unsubscribed');
}

/**
 * Is the user a member of the gate channel? Results are cached on the user row;
 * pass force=true when the user explicitly taps "check".
 * Requires the bot to be an admin of the channel.
 */
export async function checkSubscription(userId: number, force = false): Promise<boolean> {
  if (!config.channelId) return true;
  const u = await getUser(userId);
  if (!force && u?.sub_checked_at && now() - u.sub_checked_at < config.subscriptionTtlMs) return !!u.is_subscribed;
  try {
    const m = await bot.api.getChatMember(config.channelId, userId);
    const ok = MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member);
    await setSubscribed(userId, ok);
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
