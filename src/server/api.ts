import { Hono, type Context, type Next } from 'hono';
import { validateInitData } from './auth';
import { audienceSize, AUDIENCES, stepBroadcast } from './broadcast';
import { escapeHtml, notifyAdmins } from './bot';
import { config, isAdmin } from './config';
import {
  all,
  getSettings,
  getUser,
  logEvent,
  now,
  one,
  run,
  setSetting,
  settingDefaults,
  upsertUser,
  type Row,
} from './db';
import { detailed } from './stats';
import { checkSubscription } from './subscription';
import { uploadImage } from './storage';
import { botUsername, sendRich } from './telegram';

type Env = { Variables: { userId: number; startParam?: string } };
export const api = new Hono<Env>();

const POST_TYPES = ['guide', 'resource', 'skill', 'mcp'];
const ACCESS = ['free', 'channel', 'club'];
const PRODUCTS = ['club', 'course'];
const CLIENT_EVENTS = ['banner_click', 'link_click', 'share', 'copy_install'];

// ---------- auth ----------

api.use('*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const raw = header.startsWith('tma ') ? header.slice(4) : '';
  const data = raw ? validateInitData(raw) : null;
  if (data) {
    await upsertUser(data.user);
    c.set('userId', data.user.id);
    c.set('startParam', data.startParam);
    return next();
  }
  // Local development in a normal browser (never in production).
  if (!raw && !config.isProd && config.devUserId) {
    await upsertUser({ id: config.devUserId, first_name: 'Dev', username: 'dev' });
    c.set('userId', config.devUserId);
    return next();
  }
  return c.json({ error: 'unauthorized' }, 401);
});

const adminOnly = async (c: Context<Env>, next: Next) => {
  if (!isAdmin(c.get('userId'))) return c.json({ error: 'forbidden' }, 403);
  await next();
};

// ---------- access ----------

type Viewer = { id: number; subscribed: boolean; club: boolean; admin: boolean };

async function viewer(c: Context<Env>): Promise<Viewer> {
  const id = c.get('userId');
  const u = (await getUser(id))!;
  const admin = isAdmin(id);
  return { id, admin, club: !!u.is_club, subscribed: admin || (await checkSubscription(id)) };
}

/** Returns which gate blocks this post for the viewer, or null if it is open. */
function lockOf(post: Row, v: Viewer): 'channel' | 'club' | null {
  if (v.admin || post.access === 'free') return null;
  if (post.access === 'club') return v.club ? null : 'club';
  return v.subscribed || v.club ? null : 'channel';
}

const teaser = (p: Row, v: Viewer) => {
  const locked = lockOf(p, v);
  return {
  id: p.id,
  type: p.type,
  title: p.title,
  summary: p.summary,
  cover_url: p.cover_url,
  tags: p.tags,
  access: p.access,
  pinned: !!p.pinned,
  published_at: p.published_at,
  locked,
  // Never reveal where a locked resource points.
  link_url: locked ? null : p.link_url,
  };
};

async function activeBanners() {
  const t = now();
  return all(
    `SELECT id, eyebrow, title, subtitle, image_url, bg, cta_label, action_type, action_value FROM banners
     WHERE active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
     ORDER BY sort, id DESC`,
    t,
    t,
  );
}

// ---------- user endpoints ----------

api.post('/session', async (c) => {
  const id = c.get('userId');
  const startParam = c.get('startParam');
  const u = (await getUser(id))!;
  if (!u.first_app_open_at) await run('UPDATE users SET first_app_open_at = ? WHERE id = ?', now(), id);
  if (!u.source && startParam) await run('UPDATE users SET source = ? WHERE id = ?', `app:${startParam}`, id);
  await logEvent(id, 'app_open', startParam ?? null);

  const [v, s, waitlist, username] = await Promise.all([
    viewer(c),
    getSettings(),
    all<{ product: string }>('SELECT product FROM waitlist WHERE user_id = ?', id),
    botUsername(),
  ]);
  return c.json({
    user: { id, first_name: u.first_name, last_name: u.last_name, username: u.username, photo_url: u.photo_url },
    subscribed: v.subscribed,
    club: v.club,
    admin: v.admin,
    channelUrl: config.channelUrl,
    botUsername: username,
    channelTitle: s.channel_title,
    gateText: s.gate_text,
    author: { name: s.author_name, avatar: s.author_avatar || null },
    brandTitle: s.brand_title,
    waitlist: waitlist.map((r) => r.product),
  });
});

api.post('/subscription/check', async (c) => {
  const id = c.get('userId');
  return c.json({ subscribed: isAdmin(id) || (await checkSubscription(id, true)) });
});

api.get('/home', async (c) => {
  const v = await viewer(c);
  const type = c.req.query('type');
  const posts = await all(
    `SELECT * FROM posts WHERE status = 'published' ${POST_TYPES.includes(type ?? '') ? 'AND type = ?' : ''}
     ORDER BY pinned DESC, published_at DESC LIMIT 200`,
    ...(POST_TYPES.includes(type ?? '') ? [type] : []),
  );
  return c.json({ banners: await activeBanners(), posts: posts.map((p) => teaser(p, v)) });
});

api.get('/posts/:id', async (c) => {
  const v = await viewer(c);
  const p = await one('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')) || 0);
  if (!p || (p.status !== 'published' && !v.admin)) return c.json({ error: 'not_found' }, 404);
  await logEvent(v.id, 'post_view', String(p.id));
  const t = teaser(p, v);
  if (t.locked) return c.json(t);
  return c.json({ ...t, body: p.body, link_url: p.link_url, install: p.install });
});

api.post('/events', async (c) => {
  const { type, ref } = await c.req.json<{ type: string; ref?: string }>();
  if (!CLIENT_EVENTS.includes(type)) return c.json({ error: 'bad_event' }, 400);
  await logEvent(c.get('userId'), type, ref ? String(ref).slice(0, 64) : null);
  return c.json({ ok: true });
});

api.get('/pitch', async (c) => {
  const s = await getSettings();
  return c.json({ club: s.club_pitch, course: s.course_pitch });
});

api.post('/waitlist/:product', async (c) => {
  const product = c.req.param('product');
  if (!PRODUCTS.includes(product)) return c.json({ error: 'bad_product' }, 400);
  const id = c.get('userId');
  const res = await run(
    'INSERT INTO waitlist (user_id, product, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    id,
    product,
    now(),
  );
  if (res.count) {
    await logEvent(id, 'waitlist', product);
    const u = (await getUser(id))!;
    const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(' ') || String(id));
    const total = (await one<{ c: number }>('SELECT COUNT(*) c FROM waitlist WHERE product = ?', product))!.c;
    await notifyAdmins(
      `Yangi waitlist (${product}): <a href="tg://user?id=${id}">${name}</a>${u.username ? ` @${u.username}` : ''}\nJami: <b>${total}</b>`,
    );
  }
  return c.json({ ok: true });
});

api.delete('/waitlist/:product', async (c) => {
  await run('DELETE FROM waitlist WHERE user_id = ? AND product = ?', c.get('userId'), c.req.param('product'));
  return c.json({ ok: true });
});

// ---------- admin ----------

const admin = new Hono<Env>();
admin.use('*', adminOnly);

admin.get('/meta', async (c) => c.json({ botUsername: await botUsername(), webappUrl: config.webappUrl }));

admin.get('/stats', async (c) => c.json(await detailed(Number(c.req.query('days') ?? 30))));

// posts
const postFields = (b: Row) => {
  const type = POST_TYPES.includes(b.type) ? b.type : 'guide';
  return {
    type,
    title: String(b.title ?? '').trim() || 'Nomsiz',
    summary: String(b.summary ?? ''),
    body: String(b.body ?? ''),
    cover_url: b.cover_url || null,
    link_url: b.link_url || null,
    install: b.install || null,
    tags: String(b.tags ?? ''),
    access: ACCESS.includes(b.access) ? b.access : 'channel',
    status: b.status === 'published' ? 'published' : 'draft',
    pinned: b.pinned ? 1 : 0,
  };
};

admin.get('/posts', async (c) =>
  c.json(
    await all(
      `SELECT p.id, p.type, p.title, p.access, p.status, p.pinned, p.updated_at, p.published_at,
              (SELECT COUNT(DISTINCT user_id) FROM events e WHERE e.type = 'post_view' AND e.ref = CAST(p.id AS TEXT)) views
       FROM posts p ORDER BY p.pinned DESC, p.updated_at DESC`,
    ),
  ),
);
admin.get('/posts/:id', async (c) => {
  const p = await one('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')) || 0);
  return p ? c.json(p) : c.json({ error: 'not_found' }, 404);
});
admin.post('/posts', async (c) => {
  const f = postFields(await c.req.json());
  const t = now();
  const r = await run(
    `INSERT INTO posts (type, title, summary, body, cover_url, link_url, install, tags, access, status, pinned, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    f.type, f.title, f.summary, f.body, f.cover_url, f.link_url, f.install, f.tags, f.access, f.status, f.pinned, t, t,
    f.status === 'published' ? t : null,
  );
  return c.json({ id: r.rows[0].id });
});
admin.put('/posts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const f = postFields(await c.req.json());
  await run(
    `UPDATE posts SET type = ?, title = ?, summary = ?, body = ?, cover_url = ?, link_url = ?, install = ?, tags = ?,
       access = ?, status = ?, pinned = ?, updated_at = ?,
       published_at = CASE WHEN ?::text = 'published' THEN COALESCE(published_at, ?::bigint) ELSE published_at END
     WHERE id = ?`,
    f.type, f.title, f.summary, f.body, f.cover_url, f.link_url, f.install, f.tags, f.access, f.status, f.pinned, now(),
    f.status, now(), id,
  );
  return c.json({ id });
});
admin.delete('/posts/:id', async (c) => {
  await run('DELETE FROM posts WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

// banners
const bannerFields = (b: Row) => [
  String(b.eyebrow ?? ''),
  String(b.title ?? '').trim(),
  String(b.subtitle ?? ''),
  b.image_url || null,
  /^#[0-9a-f]{3,8}$/i.test(b.bg ?? '') ? b.bg : '#1f1f22',
  String(b.cta_label ?? '').trim(),
  ['post', 'page', 'url', 'none'].includes(b.action_type) ? b.action_type : 'none',
  String(b.action_value ?? ''),
  b.active ? 1 : 0,
  Number(b.sort) || 0,
  b.starts_at ? Number(b.starts_at) : null,
  b.ends_at ? Number(b.ends_at) : null,
];
admin.get('/banners', async (c) => c.json(await all('SELECT * FROM banners ORDER BY sort, id DESC')));
admin.post('/banners', async (c) => {
  const r = await run(
    `INSERT INTO banners (eyebrow, title, subtitle, image_url, bg, cta_label, action_type, action_value, active, sort, starts_at, ends_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ...bannerFields(await c.req.json()),
    now(),
  );
  return c.json({ id: r.rows[0].id });
});
admin.put('/banners/:id', async (c) => {
  await run(
    `UPDATE banners SET eyebrow = ?, title = ?, subtitle = ?, image_url = ?, bg = ?, cta_label = ?, action_type = ?,
       action_value = ?, active = ?, sort = ?, starts_at = ?, ends_at = ? WHERE id = ?`,
    ...bannerFields(await c.req.json()),
    Number(c.req.param('id')),
  );
  return c.json({ ok: true });
});
admin.delete('/banners/:id', async (c) => {
  await run('DELETE FROM banners WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

// keywords
const KEYWORD_RE = /^[a-z0-9_-]{1,64}$/;
const keywordFields = (b: Row) => {
  const keyword = String(b.keyword ?? '').trim().toLowerCase();
  if (!KEYWORD_RE.test(keyword)) throw new Error("Kalit so'z faqat lotin harflari, raqam, _ va - dan iborat bo'lishi kerak");
  if (!String(b.response_text ?? '').trim()) throw new Error("Javob matni bo'sh");
  return [
    keyword,
    b.match_text ? 1 : 0,
    String(b.response_text),
    b.photo_url || null,
    JSON.stringify(Array.isArray(b.buttons) ? b.buttons : []),
    b.active ? 1 : 0,
  ];
};
admin.get('/keywords', async (c) =>
  c.json(
    (await all(
      `SELECT k.*, (SELECT COUNT(*) FROM events e WHERE e.type = 'keyword' AND e.ref = k.keyword) hits,
              (SELECT COUNT(*) FROM users u WHERE u.source = k.keyword) users
       FROM keywords k ORDER BY k.id DESC`,
    )).map((k) => ({ ...k, buttons: JSON.parse(k.buttons) })),
  ),
);
admin.post('/keywords', async (c) => {
  try {
    const r = await run(
      `INSERT INTO keywords (keyword, match_text, response_text, photo_url, buttons, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ...keywordFields(await c.req.json()),
      now(),
    );
    return c.json({ id: r.rows[0].id });
  } catch (e) {
    return c.json({ error: friendlyError(e) }, 400);
  }
});
admin.put('/keywords/:id', async (c) => {
  try {
    await run(
      `UPDATE keywords SET keyword = ?, match_text = ?, response_text = ?, photo_url = ?, buttons = ?, active = ? WHERE id = ?`,
      ...keywordFields(await c.req.json()),
      Number(c.req.param('id')),
    );
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: friendlyError(e) }, 400);
  }
});
admin.delete('/keywords/:id', async (c) => {
  await run('DELETE FROM keywords WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});
admin.post('/keywords/:id/test', async (c) => {
  const k = await one('SELECT * FROM keywords WHERE id = ?', Number(c.req.param('id')) || 0);
  if (!k) return c.json({ error: 'not_found' }, 404);
  try {
    await sendRich(c.get('userId'), k.response_text, k.photo_url, JSON.parse(k.buttons));
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// broadcasts
admin.get('/broadcasts', async (c) => c.json(await all('SELECT * FROM broadcasts ORDER BY id DESC LIMIT 50')));
admin.get('/broadcasts/audience', async (c) =>
  c.json(Object.fromEntries(await Promise.all(Object.keys(AUDIENCES).map(async (a) => [a, await audienceSize(a)])))),
);
admin.post('/broadcasts', async (c) => {
  const b = await c.req.json();
  if (!String(b.text ?? '').trim()) return c.json({ error: "Matn bo'sh" }, 400);
  const audience = b.audience in AUDIENCES ? b.audience : 'all';
  const buttons = JSON.stringify(Array.isArray(b.buttons) ? b.buttons : []);
  if (b.test) {
    try {
      await sendRich(c.get('userId'), b.text, b.photo_url || null, JSON.parse(buttons));
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  }
  const r = await run(
    `INSERT INTO broadcasts (text, photo_url, buttons, audience, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    b.text, b.photo_url || null, buttons, audience, now(),
  );
  return c.json({ id: r.rows[0].id });
});
// The admin page calls this repeatedly until the broadcast reports status "done".
admin.post('/broadcasts/:id/step', async (c) => c.json(await stepBroadcast(Number(c.req.param('id')) || 0)));

// users
admin.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim().replace(/^@/, '');
  const filter = c.req.query('filter') ?? 'all';
  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    where.push(`(id::text = ? OR username ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?)`);
    params.push(q, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (filter === 'club') where.push('is_club = 1');
  if (filter === 'waitlist') where.push('id IN (SELECT user_id FROM waitlist)');
  if (filter === 'subscribed') where.push('is_subscribed = 1');
  if (filter === 'blocked') where.push('blocked_at IS NOT NULL');
  const rows = await all(
    `SELECT u.*, (SELECT string_agg(product, ',') FROM waitlist w WHERE w.user_id = u.id) waitlist
     FROM users u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT 100`,
    ...params,
  );
  return c.json(rows);
});
admin.patch('/users/:id', async (c) => {
  const b = await c.req.json();
  await run('UPDATE users SET is_club = ? WHERE id = ?', b.is_club ? 1 : 0, Number(c.req.param('id')) || 0);
  return c.json({ ok: true });
});

// settings
admin.get('/settings', async (c) => c.json(await getSettings()));
admin.put('/settings', async (c) => {
  const b = await c.req.json();
  for (const key of Object.keys(settingDefaults)) if (typeof b[key] === 'string') await setSetting(key, b[key]);
  return c.json(await getSettings());
});

// uploads (Supabase Storage)
admin.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'Fayl topilmadi' }, 400);
  try {
    return c.json({ url: await uploadImage(file) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

api.route('/admin', admin);

function friendlyError(e: unknown) {
  const m = (e as Error).message ?? String(e);
  return m.includes('duplicate key') ? "Bunday kalit so'z allaqachon mavjud" : m;
}
