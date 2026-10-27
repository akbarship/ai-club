import { GrammyError } from 'grammy';
import { all, logEvent, now, one, run } from './db';
import { sendRich, type MsgButton } from './telegram';

// Ordered by id so each step can resume at an offset.
export const AUDIENCES: Record<string, string> = {
  all: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL ORDER BY id`,
  subscribed: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_subscribed = 1 ORDER BY id`,
  unsubscribed: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_subscribed = 0 ORDER BY id`,
  waitlist: `SELECT DISTINCT u.id FROM users u JOIN waitlist w ON w.user_id = u.id WHERE u.blocked_at IS NULL AND u.started_at IS NOT NULL ORDER BY u.id`,
  club: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_club = 1 ORDER BY id`,
};

export const audienceSize = async (audience: string) => (await all(AUDIENCES[audience] ?? AUDIENCES.all)).length;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A serverless function has a short time limit, so a broadcast is sent in steps of this length. */
const STEP_MS = 8_000;
const LOCK_MS = 20_000;

/**
 * Sends the next slice of a broadcast (~25 messages/second for up to STEP_MS) and returns its state.
 * The admin page calls this repeatedly until status is "done". A row lock keeps two tabs from sending twice.
 */
export async function stepBroadcast(id: number) {
  const t = now();
  const locked = await run(
    `UPDATE broadcasts SET lock_until = ? WHERE id = ? AND status <> 'done' AND (lock_until IS NULL OR lock_until < ?)`,
    t + LOCK_MS,
    id,
    t,
  );
  const b = await one('SELECT * FROM broadcasts WHERE id = ?', id);
  if (!b || !locked.count) return b;

  try {
    const ids = (await all<{ id: number }>(AUDIENCES[b.audience] ?? AUDIENCES.all)).map((r) => r.id);
    let buttons: MsgButton[] = [];
    try {
      buttons = JSON.parse(b.buttons);
    } catch {}
    let sent: number = b.sent;
    let failed: number = b.failed;
    let i = sent + failed;

    while (i < ids.length && now() - t < STEP_MS) {
      const userId = ids[i];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await sendRich(userId, b.text, b.photo_url, buttons);
          sent++;
          break;
        } catch (e) {
          if (e instanceof GrammyError && e.error_code === 429) {
            await sleep(((e.parameters.retry_after ?? 3) + 1) * 1000);
            continue;
          }
          if (e instanceof GrammyError && e.error_code === 403) {
            await run('UPDATE users SET blocked_at = ? WHERE id = ? AND blocked_at IS NULL', now(), userId);
            await logEvent(userId, 'blocked');
          }
          failed++;
          break;
        }
      }
      i++;
      await sleep(40);
    }

    const done = i >= ids.length;
    await run(
      `UPDATE broadcasts SET status = ?, total = ?, sent = ?, failed = ?, finished_at = ?, lock_until = NULL WHERE id = ?`,
      done ? 'done' : 'sending',
      ids.length,
      sent,
      failed,
      done ? now() : null,
      id,
    );
  } catch (e) {
    await run('UPDATE broadcasts SET lock_until = NULL WHERE id = ?', id);
    throw e;
  }
  return one('SELECT * FROM broadcasts WHERE id = ?', id);
}
