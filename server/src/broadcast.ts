import { GrammyError } from 'grammy';
import { all, logEvent, now, one, run } from './db.ts';
import { sendRich, type MsgButton } from './telegram.ts';

export const AUDIENCES: Record<string, string> = {
  all: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL`,
  subscribed: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_subscribed = 1`,
  unsubscribed: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_subscribed = 0`,
  waitlist: `SELECT DISTINCT u.id FROM users u JOIN waitlist w ON w.user_id = u.id WHERE u.blocked_at IS NULL AND u.started_at IS NOT NULL`,
  club: `SELECT id FROM users WHERE blocked_at IS NULL AND started_at IS NOT NULL AND is_club = 1`,
};

export const audienceSize = (audience: string) => all(AUDIENCES[audience] ?? AUDIENCES.all).length;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let running = false;

/** Sends queued broadcasts one at a time, ~25 messages per second. */
export async function runQueue() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const b = one(`SELECT * FROM broadcasts WHERE status IN ('queued', 'sending') ORDER BY id LIMIT 1`);
      if (!b) break;
      await sendBroadcast(b);
    }
  } finally {
    running = false;
  }
}

async function sendBroadcast(b: any) {
  const ids = all<{ id: number }>(AUDIENCES[b.audience] ?? AUDIENCES.all).map((r) => r.id);
  let buttons: MsgButton[] = [];
  try {
    buttons = JSON.parse(b.buttons);
  } catch {}
  // Resume support: skip what was already processed if the server restarted mid-send.
  let sent = b.status === 'sending' ? b.sent : 0;
  let failed = b.status === 'sending' ? b.failed : 0;
  const start = sent + failed;
  run(`UPDATE broadcasts SET status = 'sending', total = ? WHERE id = ?`, ids.length, b.id);

  for (let i = start; i < ids.length; i++) {
    const id = ids[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await sendRich(id, b.text, b.photo_url, buttons);
        sent++;
        break;
      } catch (e) {
        if (e instanceof GrammyError && e.error_code === 429) {
          await sleep(((e.parameters.retry_after ?? 3) + 1) * 1000);
          continue;
        }
        if (e instanceof GrammyError && e.error_code === 403) {
          run('UPDATE users SET blocked_at = ? WHERE id = ? AND blocked_at IS NULL', now(), id);
          logEvent(id, 'blocked');
        }
        failed++;
        break;
      }
    }
    if (i % 20 === 0) run('UPDATE broadcasts SET sent = ?, failed = ? WHERE id = ?', sent, failed, b.id);
    await sleep(40);
  }
  run(`UPDATE broadcasts SET status = 'done', sent = ?, failed = ?, finished_at = ? WHERE id = ?`, sent, failed, now(), b.id);
}
