import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.ts';
import type { TgUser } from './db.ts';

const MAX_AGE_SEC = 7 * 24 * 3600;

const secret = createHmac('sha256', 'WebAppData').update(config.botToken).digest();

export type InitData = { user: TgUser; startParam?: string };

/**
 * Validates Telegram Mini App initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(raw: string): InitData | null {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const expected = createHmac('sha256', secret).update(checkString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    return { user: JSON.parse(userJson), startParam: params.get('start_param') ?? undefined };
  } catch {
    return null;
  }
}
