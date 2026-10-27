import { config } from './config';
import { all, now, one } from './db';

const DAY = 86_400_000;
const offset = () => config.tzOffsetHours * 3_600_000;
/** Local-day index for a timestamp (days since epoch in the configured timezone). */
const dayIndex = (t: number) => Math.floor((t + offset()) / DAY);
const startOfToday = () => dayIndex(now()) * DAY - offset();

const n = async (q: string, ...p: any[]) => Number((await one<{ c: number }>(q, ...p))?.c ?? 0);

const distinctActive = (since: number) =>
  n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'app_open' AND created_at >= ?`, since);

/** Headline numbers (also used by the /admin bot command). */
export async function summary() {
  const t = now();
  const today = startOfToday();
  const [total, todayUsers, started, appUsers, subscribed, blocked, club] = await Promise.all([
    n('SELECT COUNT(*) c FROM users'),
    n('SELECT COUNT(*) c FROM users WHERE created_at >= ?', today),
    n('SELECT COUNT(*) c FROM users WHERE started_at IS NOT NULL'),
    n('SELECT COUNT(*) c FROM users WHERE first_app_open_at IS NOT NULL'),
    n('SELECT COUNT(*) c FROM users WHERE is_subscribed = 1'),
    n('SELECT COUNT(*) c FROM users WHERE blocked_at IS NOT NULL'),
    n('SELECT COUNT(*) c FROM users WHERE is_club = 1'),
  ]);
  const [activeToday, dau, wau, mau, startsTotal, startsToday, wlClub, wlCourse] = await Promise.all([
    distinctActive(today),
    distinctActive(t - DAY),
    distinctActive(t - 7 * DAY),
    distinctActive(t - 30 * DAY),
    n(`SELECT COUNT(*) c FROM events WHERE type = 'start'`),
    n(`SELECT COUNT(*) c FROM events WHERE type = 'start' AND created_at >= ?`, today),
    n(`SELECT COUNT(*) c FROM waitlist WHERE product = 'club'`),
    n(`SELECT COUNT(*) c FROM waitlist WHERE product = 'course'`),
  ]);
  return {
    users: { total, today: todayUsers, started, appUsers, subscribed, blocked, club },
    active: { today: activeToday, dau, wau, mau },
    startPresses: { total: startsTotal, today: startsToday },
    waitlist: { club: wlClub, course: wlCourse },
  };
}

async function series(days: number) {
  const first = dayIndex(now()) - days + 1;
  const since = first * DAY - offset();
  const off = offset();

  const byDay = (rows: { d: number; c: number }[]) => new Map(rows.map((r) => [Number(r.d), Number(r.c)]));
  const eventDistinct = async (type: string) =>
    byDay(
      await all(
        `SELECT (created_at + ?::bigint) / ${DAY} d, COUNT(DISTINCT user_id) c FROM events
         WHERE type = ? AND created_at >= ? GROUP BY 1`,
        off,
        type,
        since,
      ),
    );
  const [newUsers, active, starts, subs] = await Promise.all([
    all(`SELECT (created_at + ?::bigint) / ${DAY} d, COUNT(*) c FROM users WHERE created_at >= ? GROUP BY 1`, off, since).then(
      (r) => byDay(r as any),
    ),
    eventDistinct('app_open'),
    eventDistinct('start'),
    eventDistinct('subscribed'),
  ]);

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

export async function detailed(days = 30) {
  days = Math.min(Math.max(days, 7), 180);
  const since = now() - days * DAY;
  const [
    sum, ser, starts, uniqueStarts, appOpens, activeUsers, returning, postViews, newSubscribers, unsubscribed,
    fStarted, fOpened, fSubscribed, fWaitlist, fClub, sources, topPosts, keywords, banners, linkClicks,
  ] = await Promise.all([
    summary(),
    series(days),
    n(`SELECT COUNT(*) c FROM events WHERE type = 'start' AND created_at >= ?`, since),
    n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'start' AND created_at >= ?`, since),
    n(`SELECT COUNT(*) c FROM events WHERE type = 'app_open' AND created_at >= ?`, since),
    distinctActive(since),
    n(
      `SELECT COUNT(DISTINCT e.user_id) c FROM events e JOIN users u ON u.id = e.user_id
       WHERE e.type = 'app_open' AND e.created_at >= ? AND u.first_app_open_at < ?`,
      since,
      since,
    ),
    n(`SELECT COUNT(*) c FROM events WHERE type = 'post_view' AND created_at >= ?`, since),
    n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'subscribed' AND created_at >= ?`, since),
    n(`SELECT COUNT(DISTINCT user_id) c FROM events WHERE type = 'unsubscribed' AND created_at >= ?`, since),
    n('SELECT COUNT(*) c FROM users WHERE started_at IS NOT NULL'),
    n('SELECT COUNT(*) c FROM users WHERE first_app_open_at IS NOT NULL'),
    n('SELECT COUNT(*) c FROM users WHERE is_subscribed = 1'),
    n('SELECT COUNT(DISTINCT user_id) c FROM waitlist'),
    n('SELECT COUNT(*) c FROM users WHERE is_club = 1'),
    all(
      `SELECT COALESCE(source, '') source, COUNT(*) users,
              COUNT(*) FILTER (WHERE first_app_open_at IS NOT NULL) opened, SUM(is_subscribed) subscribed
       FROM users WHERE started_at IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    ),
    // Event refs are text; compare as text so non-numeric refs never break a cast.
    all(
      `SELECT p.id, p.title, p.type, COUNT(*) views, COUNT(DISTINCT e.user_id) uniq
       FROM events e JOIN posts p ON e.ref = p.id::text
       WHERE e.type = 'post_view' AND e.created_at >= ?
       GROUP BY p.id ORDER BY uniq DESC LIMIT 10`,
      since,
    ),
    all(
      `SELECT ref keyword, COUNT(*) hits, COUNT(DISTINCT user_id) uniq
       FROM events WHERE type = 'keyword' AND created_at >= ? GROUP BY ref ORDER BY hits DESC LIMIT 20`,
      since,
    ),
    all(
      `SELECT b.id, b.title, COUNT(e.id) clicks, COUNT(DISTINCT e.user_id) uniq
       FROM banners b LEFT JOIN events e ON e.type = 'banner_click' AND e.ref = b.id::text AND e.created_at >= ?
       GROUP BY b.id ORDER BY clicks DESC`,
      since,
    ),
    all(
      `SELECT p.id, p.title, COUNT(*) clicks, COUNT(DISTINCT e.user_id) uniq
       FROM events e JOIN posts p ON e.ref = p.id::text
       WHERE e.type = 'link_click' AND e.created_at >= ?
       GROUP BY p.id ORDER BY clicks DESC LIMIT 10`,
      since,
    ),
  ]);
  return {
    days,
    summary: sum,
    series: ser,
    period: { starts, uniqueStarts, appOpens, activeUsers, returning, postViews, newSubscribers, unsubscribed },
    funnel: [
      { label: '/start bosgan', value: fStarted },
      { label: 'Ilovani ochgan', value: fOpened },
      { label: 'Kanalga obuna', value: fSubscribed },
      { label: 'Waitlistda', value: fWaitlist },
      { label: "Club a'zosi", value: fClub },
    ],
    sources,
    topPosts,
    keywords,
    banners,
    linkClicks,
  };
}
