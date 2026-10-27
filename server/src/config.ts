import { resolve } from 'node:path';

const env = process.env;

function list(v: string | undefined): number[] {
  return (v ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export const config = {
  botToken: env.BOT_TOKEN ?? '',
  webappUrl: (env.WEBAPP_URL ?? '').replace(/\/$/, ''),
  adminIds: list(env.ADMIN_IDS),
  channelId: env.CHANNEL_ID?.trim() || '',
  channelUrl: env.CHANNEL_URL?.trim() || '',
  port: Number(env.PORT ?? 3000),
  dataDir: resolve(import.meta.dirname, '..', '..', env.DATA_DIR ?? 'data'),
  webDist: resolve(import.meta.dirname, '..', '..', 'web', 'dist'),
  tzOffsetHours: Number(env.TZ_OFFSET_HOURS ?? 5),
  webhookUrl: (env.WEBHOOK_URL ?? '').replace(/\/$/, ''),
  devUserId: Number(env.DEV_USER_ID) || 0,
  isProd: env.NODE_ENV === 'production',
  /** How long a cached channel-subscription result is trusted. */
  subscriptionTtlMs: 10 * 60 * 1000,
};

export const isAdmin = (userId: number) => config.adminIds.includes(userId);
