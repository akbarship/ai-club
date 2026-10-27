import { config } from './config.ts';
import { all, now, one } from './db.ts';

const DAY = 86_400_000;
const offset = () => config.tzOffsetHours * 3_600_000;
/** Local-day index for a timestamp (days since epoch in the configured timezone). */
const dayIndex = (t: number) => Math.floor((t + offset()) / DAY);
const startOfToday = () => dayIndex(now()) * DAY - offset();

const n = (sql: string, ...p: any[]) => Number(one<{ c: number }>(sql, ...p)?.c ?? 0);

const distinctActive = (since: number) =>
  n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'app_open' AND created_at >= ?`, since);

/** Headline numbers (also used by the /admin bot command). */
export function summary() {
  const t = now();
  const today = startOfToday();
  return {
    users: {
      total: n('SELECT COUNT(*) c FROM users'),
      today: n('SELECT COUNT(*) c FROM users WHERE created_at >= ?', today),
      started: n('SELECT COUNT(*) c FROM users WHERE started_at IS NOT NULL'),
      appUsers: n('SELECT COUNT(*) c FROM users WHERE first_app_open_at IS NOT NULL'),
      subscribed: n('SELECT COUNT(*) c FROM users WHERE is_subscribed = 1'),
      blocked: n('SELECT COUNT(*) c FROM users WHERE blocked_at IS NOT NULL'),
      club: n('SELECT COUNT(*) c FROM users WHERE is_club = 1'),
    },
    active: {
      today: distinctActive(today),
      dau: distinctActive(t - DAY),
      wau: distinctActive(t - 7 * DAY),
      mau: distinctActive(t - 30 * DAY),
    },
    startPresses: {
      total: n(`SELECT COUNT(*) c FROM events WHERE type = 'start'`),
      today: n(`SELECT COUNT(*) c FROM events WHERE type = 'start' AND created_at >= ?`, today),
    },
    waitlist: {
      club: n(`SELECT COUNT(*) c FROM waitlist WHERE product = 'club'`),
      course: n(`SELECT COUNT(*) c FROM waitlist WHERE product = 'course'`),
    },
  };
}

function series(days: number) {
  const first = dayIndex(now()) - days + 1;
  const since = first * DAY - offset();
  const off = offset();

  const byDay = (rows: { d: number; c: number }[]) => new Map(rows.map((r) => [Number(r.d), Number(r.c)]));
  const newUsers = byDay(
    all(`SELECT CAST((created_at + ?) / ${DAY} AS INTEGER) d, COUNT(*) c FROM users WHERE created_at >= ? GROUP BY d`, off, since) as any,
  );
  const eventDistinct = (type: string) =>
    byDay(
      all(
        `SELECT CAST((created_at + ?) / ${DAY} AS INTEGER) d, COUNT(DISTINCT user_id) c FROM events
         WHERE type = ? AND created_at >= ? GROUP BY d`,
        off,
        type,
        since,
      ) as any,
    );
  const active = eventDistinct('app_open');
  const starts = eventDistinct('start');
  const subs = eventDistinct('subscribed');

  return Array.from({ length: days }, (_, i) => {
    const d = first + i;
    return {
      date: new Date(d * DAY).toISOString().slice(0, 10),
      newUsers: newUsers.get(d) ?? 0,
      active: active.get(d) ?? 0,
      starts: starts.get(d) ?? 0,
      subscribed: subs.get(d) ?? 0,
    };
  });
}

export function detailed(days = 30) {
  days = Math.min(Math.max(days, 7), 180);
  const since = now() - days * DAY;
  return {
    days,
    summary: summary(),
    series: series(days),
    period: {
      starts: n(`SELECT COUNT(*) c FROM events WHERE type = 'start' AND created_at >= ?`, since),
      uniqueStarts: n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'start' AND created_at >= ?`, since),
      appOpens: n(`SELECT COUNT(*) c FROM events WHERE type = 'app_open' AND created_at >= ?`, since),
      activeUsers: distinctActive(since),
      returning: n(
        `SELECT COUNT(DISTINCT e.user_id) c FROM events e JOIN users u ON u.id = e.user_id
         WHERE e.type = 'app_open' AND e.created_at >= ? AND u.first_app_open_at < ?`,
        since,
        since,
      ),
      postViews: n(`SELECT COUNT(*) c FROM events WHERE type = 'post_view' AND created_at >= ?`, since),
      newSubscribers: n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'subscribed' AND created_at >= ?`, since),
      unsubscribed: n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'unsubscribed' AND created_at >= ?`, since),
    },
    funnel: [
      { label: '/start bosgan', value: n('SELECT COUNT(*) c FROM users WHERE started_at IS NOT NULL') },
      { label: 'Ilovani ochgan', value: n('SELECT COUNT(*) c FROM users WHERE first_app_open_at IS NOT NULL') },
      { label: 'Kanalga obuna', value: n('SELECT COUNT(*) c FROM users WHERE is_subscribed = 1') },
      { label: 'Waitlistda', value: n('SELECT COUNT(DISTINCT user_id) c FROM waitlist') },
      { label: "Club a'zosi", value: n('SELECT COUNT(*) c FROM users WHERE is_club = 1') },
    ],
    sources: all(
      `SELECT COALESCE(source, '') source, COUNT(*) users,
              SUM(first_app_open_at IS NOT NULL) opened, SUM(is_subscribed) subscribed
       FROM users WHERE started_at IS NOT NULL GROUP BY source ORDER BY users DESC LIMIT 20`,
    ),
    topPosts: all(
      `SELECT p.id, p.title, p.type, COUNT(*) views, COUNT(DISTINCT e.user_id) uniq
       FROM events e JOIN posts p ON p.id = CAST(e.ref AS INTEGER)
       WHERE e.type = 'post_view' AND e.created_at >= ?
       GROUP BY p.id ORDER BY uniq DESC LIMIT 10`,
      since,
    ),
    keywords: all(
      `SELECT ref keyword, COUNT(*) hits, COUNT(DISTINCT user_id) uniq
       FROM events WHERE type = 'keyword' AND created_at >= ? GROUP BY ref ORDER BY hits DESC LIMIT 20`,
      since,
    ),
    banners: all(
      `SELECT b.id, b.title, COUNT(e.id) clicks, COUNT(DISTINCT e.user_id) uniq
       FROM banners b LEFT JOIN events e ON e.type = 'banner_click' AND CAST(e.ref AS INTEGER) = b.id AND e.created_at >= ?
       GROUP BY b.id ORDER BY clicks DESC`,
      since,
    ),
    linkClicks: all(
      `SELECT p.id, p.title, COUNT(*) clicks, COUNT(DISTINCT e.user_id) uniq
       FROM events e JOIN posts p ON p.id = CAST(e.ref AS INTEGER)
       WHERE e.type = 'link_click' AND e.created_at >= ?
       GROUP BY p.id ORDER BY clicks DESC LIMIT 10`,
      since,
    ),
  };
}
