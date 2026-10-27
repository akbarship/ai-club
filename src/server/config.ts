const env = process.env;

function list(v: string | undefined): number[] {
  return (v ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export const config = {
  botToken: env.BOT_TOKEN ?? '',
  /** Optional: skips a getMe call on cold starts when set. */
  botUsername: env.BOT_USERNAME ?? '',
  /** Optional: a self-hosted Bot API server (or a stub in tests). */
  telegramApiRoot: env.TELEGRAM_API_ROOT?.replace(/\/$/, '') || undefined,
  webappUrl: (env.WEBAPP_URL ?? '').replace(/\/$/, ''),
  adminIds: list(env.ADMIN_IDS),
  channelId: env.CHANNEL_ID?.trim() || '',
  channelUrl: env.CHANNEL_URL?.trim() || '',
  databaseUrl: env.DATABASE_URL ?? '',
  supabaseUrl: (env.SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  storageBucket: 'uploads',
  tzOffsetHours: Number(env.TZ_OFFSET_HOURS ?? 5),
  devUserId: Number(env.DEV_USER_ID) || 0,
  isProd: env.NODE_ENV === 'production',
  /** How long a cached channel-subscription result is trusted. */
  subscriptionTtlMs: 10 * 60 * 1000,
};

export const isAdmin = (userId: number) => config.adminIds.includes(userId);
