import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';

mkdirSync(join(config.dataDir, 'uploads'), { recursive: true });

export const db = new DatabaseSync(join(config.dataDir, 'club.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY,   -- Telegram user id
  first_name         TEXT,
  last_name          TEXT,
  username           TEXT,
  language_code      TEXT,
  photo_url          TEXT,
  is_premium         INTEGER NOT NULL DEFAULT 0,
  source             TEXT,                  -- first /start payload (where the user came from)
  started_at         INTEGER,               -- first /start press
  first_app_open_at  INTEGER,
  last_seen_at       INTEGER,
  is_subscribed      INTEGER NOT NULL DEFAULT 0,
  sub_checked_at     INTEGER,
  is_club            INTEGER NOT NULL DEFAULT 0,
  blocked_at         INTEGER,               -- user blocked the bot
  created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  type        TEXT NOT NULL,
  ref         TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type_time ON events(type, created_at);
CREATE INDEX IF NOT EXISTS events_user ON events(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,                 -- guide | resource | skill | mcp
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',      -- markdown
  cover_url     TEXT,
  link_url      TEXT,                          -- resources / repo links
  install       TEXT,                          -- install command or config snippet (skills, MCPs)
  tags          TEXT NOT NULL DEFAULT '',
  access        TEXT NOT NULL DEFAULT 'channel', -- free | channel | club
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | published
  pinned        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  published_at  INTEGER
);

CREATE TABLE IF NOT EXISTS banners (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  subtitle      TEXT NOT NULL DEFAULT '',
  image_url     TEXT,
  bg            TEXT NOT NULL DEFAULT '#1f1f22',
  cta_label     TEXT NOT NULL DEFAULT 'Ochish',
  action_type   TEXT NOT NULL DEFAULT 'post',  -- post | page | url | none
  action_value  TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  starts_at     INTEGER,
  ends_at       INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword        TEXT NOT NULL UNIQUE,          -- lowercase; used as /start payload and text trigger
  match_text     INTEGER NOT NULL DEFAULT 1,    -- also reply when a user just types the keyword
  response_text  TEXT NOT NULL,                 -- Telegram HTML
  photo_url      TEXT,
  buttons        TEXT NOT NULL DEFAULT '[]',    -- [{text, type: app|url|channel, value}]
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist (
  user_id     INTEGER NOT NULL,
  product     TEXT NOT NULL,                    -- club | course
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, product)
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  text         TEXT NOT NULL,
  photo_url    TEXT,
  buttons      TEXT NOT NULL DEFAULT '[]',
  audience     TEXT NOT NULL,                   -- all | subscribed | unsubscribed | waitlist | club
  status       TEXT NOT NULL DEFAULT 'queued',  -- queued | sending | done | failed
  total        INTEGER NOT NULL DEFAULT 0,
  sent         INTEGER NOT NULL DEFAULT 0,
  failed       INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  finished_at  INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`);

export type Row = Record<string, any>;

export const now = () => Date.now();

export function one<T = Row>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function all<T = Row>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
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

export function upsertUser(u: TgUser) {
  const t = now();
  run(
    `INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, is_premium, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
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

export function logEvent(userId: number | null, type: string, ref: string | null = null) {
  run('INSERT INTO events (user_id, type, ref, created_at) VALUES (?, ?, ?, ?)', userId, type, ref, now());
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

export function getSettings(): Record<string, string> {
  const out = { ...settingDefaults };
  for (const r of all<{ key: string; value: string }>('SELECT key, value FROM settings')) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
