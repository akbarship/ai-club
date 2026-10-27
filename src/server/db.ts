import postgres from 'postgres';
import { config } from './config';

export type Row = Record<string, any>;

// One small pool per server instance; reused across hot reloads in dev.
const g = globalThis as unknown as { __aiClubSql?: postgres.Sql };
export const sql =
  g.__aiClubSql ??
  (g.__aiClubSql = postgres(config.databaseUrl, {
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: Number(process.env.DB_POOL_MAX) || 3,
    idle_timeout: 20,
    // Timestamps and Telegram ids are bigint; they fit safely in a JS number.
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  }));

export const now = () => Date.now();

/** SQL is written with `?` placeholders; Postgres wants $1, $2, … */
const toPg = (q: string) => {
  let i = 0;
  return q.replace(/\?/g, () => `$${++i}`);
};

export async function all<T = Row>(q: string, ...params: any[]): Promise<T[]> {
  return (await sql.unsafe(toPg(q), params)) as unknown as T[];
}
export async function one<T = Row>(q: string, ...params: any[]): Promise<T | undefined> {
  return (await all<T>(q, ...params))[0];
}
/** Runs a statement; `count` is the number of affected rows, `rows` holds any RETURNING output. */
export async function run(q: string, ...params: any[]) {
  const res = await sql.unsafe(toPg(q), params);
  return { count: res.count, rows: res as unknown as Row[] };
}

// ---- users ----

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

export async function upsertUser(u: TgUser) {
  const t = now();
  await run(
    `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, is_premium, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       username = excluded.username,
       language_code = excluded.language_code,
       photo_url = COALESCE(excluded.photo_url, users.photo_url),
       is_premium = excluded.is_premium,
       last_seen_at = excluded.last_seen_at`,
    u.id,
    u.first_name ?? null,
    u.last_name ?? null,
    u.username ?? null,
    u.language_code ?? null,
    u.photo_url ?? null,
    u.is_premium ? 1 : 0,
    t,
    t,
  );
}

export const getUser = (id: number) => one('SELECT * FROM users WHERE id = ?', id);

export async function logEvent(userId: number | null, type: string, ref: string | null = null) {
  await run('INSERT INTO events (user_id, type, ref, created_at) VALUES (?, ?, ?, ?)', userId, type, ref, now());
}

// ---- settings ----

export const settingDefaults: Record<string, string> = {
  welcome_text:
    "<b>AI Club'ga xush kelibsiz!</b>\n\nBu yerda sun'iy intellekt bo'yicha qo'llanmalar, foydali resurslar, men yaratgan skill va MCP'lar jamlangan.\n\nPastdagi tugmani bosib ilovani oching.",
  gate_text:
    "Materiallarni ochish uchun avval kanalimizga obuna bo'ling, so'ng «Obunani tekshirish» tugmasini bosing.",
  club_pitch:
    "## AI Club\n\nYopiq hamjamiyat: haftalik jonli efirlar, yopiq chat, barcha premium skill va MCP'lar, savollaringizga shaxsan javob.\n\nHozir ishga tushirishga tayyorlanmoqdamiz — waitlistga yoziling va birinchilardan bo'lib maxsus narxda kiring.",
  course_pitch:
    "## Kurslar\n\nAmaliy kurslar ustida ishlayapman. Qaysi mavzu sizga kerakligini bildirish uchun waitlistga yoziling — chiqqanda birinchi bo'lib xabar olasiz.",
  channel_title: 'AI kanal',
  author_name: 'Akbar Olimjonov',
  author_avatar: '/author.png',
  brand_title: 'Akbarshokh Blogs',
};

export async function getSettings(): Promise<Record<string, string>> {
  const out = { ...settingDefaults };
  for (const r of await all<{ key: string; value: string }>('SELECT key, value FROM settings')) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string) {
  await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, value);
}
