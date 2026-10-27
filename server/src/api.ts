import { Hono, type Context, type Next } from 'hono';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateInitData } from './auth.ts';
import { audienceSize, AUDIENCES, runQueue } from './broadcast.ts';
import { escapeHtml, notifyAdmins } from './bot.ts';
import { config, isAdmin } from './config.ts';
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
} from './db.ts';
import { detailed } from './stats.ts';
import { checkSubscription } from './subscription.ts';
import { botInfo } from './telegram.ts';

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
    upsertUser(data.user);
    c.set('userId', data.user.id);
    c.set('startParam', data.startParam);
    return next();
  }
  // Local development in a normal browser (never in production).
  if (!raw && !config.isProd && config.devUserId) {
    upsertUser({ id: config.devUserId, first_name: 'Dev', username: 'dev' });
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
  const u = getUser(id)!;
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

function activeBanners() {
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
  const u = getUser(id)!;
  if (!u.first_app_open_at) run('UPDATE users SET first_app_open_at = ? WHERE id = ?', now(), id);
  if (!u.source && startParam) run('UPDATE users SET source = ? WHERE id = ?', `app:${startParam}`, id);
  logEvent(id, 'app_open', startParam ?? null);

  const v = await viewer(c);
  const s = getSettings();
  return c.json({
    user: { id, first_name: u.first_name, last_name: u.last_name, username: u.username, photo_url: u.photo_url },
    subscribed: v.subscribed,
    club: v.club,
    admin: v.admin,
    channelUrl: config.channelUrl,
    botUsername: botInfo.username,
    channelTitle: s.channel_title,
    gateText: s.gate_text,
    author: { name: s.author_name, avatar: s.author_avatar || null },
    brandTitle: s.brand_title,
    waitlist: all<{ product: string }>('SELECT product FROM waitlist WHERE user_id = ?', id).map((r) => r.product),
  });
});

api.post('/subscription/check', async (c) => {
  const id = c.get('userId');
  return c.json({ subscribed: isAdmin(id) || (await checkSubscription(id, true)) });
});

api.get('/home', async (c) => {
  const v = await viewer(c);
  const type = c.req.query('type');
  const posts = all(
    `SELECT * FROM posts WHERE status = 'published' ${POST_TYPES.includes(type ?? '') ? 'AND type = ?' : ''}
     ORDER BY pinned DESC, published_at DESC LIMIT 200`,
    ...(POST_TYPES.includes(type ?? '') ? [type] : []),
  );
  return c.json({ banners: activeBanners(), posts: posts.map((p) => teaser(p, v)) });
});

api.get('/posts/:id', async (c) => {
  const v = await viewer(c);
  const p = one('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')));
  if (!p || (p.status !== 'published' && !v.admin)) return c.json({ error: 'not_found' }, 404);
  logEvent(v.id, 'post_view', String(p.id));
  const t = teaser(p, v);
  if (t.locked) return c.json(t);
  return c.json({ ...t, body: p.body, link_url: p.link_url, install: p.install });
});

api.post('/events', async (c) => {
  const { type, ref } = await c.req.json<{ type: string; ref?: string }>();
  if (!CLIENT_EVENTS.includes(type)) return c.json({ error: 'bad_event' }, 400);
  logEvent(c.get('userId'), type, ref ? String(ref).slice(0, 64) : null);
  return c.json({ ok: true });
});

api.get('/pitch', (c) => {
  const s = getSettings();
  return c.json({ club: s.club_pitch, course: s.course_pitch });
});

api.post('/waitlist/:product', async (c) => {
  const product = c.req.param('product');
  if (!PRODUCTS.includes(product)) return c.json({ error: 'bad_product' }, 400);
  const id = c.get('userId');
  const res = run('INSERT OR IGNORE INTO waitlist (user_id, product, created_at) VALUES (?, ?, ?)', id, product, now());
  if (res.changes) {
    logEvent(id, 'waitlist', product);
    const u = getUser(id)!;
    const name = escapeHtml([u.first_name, u.last_name].filter(Boolean).join(' ') || String(id));
    const total = one<{ c: number }>('SELECT COUNT(*) c FROM waitlist WHERE product = ?', product)!.c;
    notifyAdmins(
      `Yangi waitlist (${product}): <a href="tg://user?id=${id}">${name}</a>${u.username ? ` @${u.username}` : ''}\nJami: <b>${total}</b>`,
    );
  }
  return c.json({ ok: true });
});

api.delete('/waitlist/:product', (c) => {
  run('DELETE FROM waitlist WHERE user_id = ? AND product = ?', c.get('userId'), c.req.param('product'));
  return c.json({ ok: true });
});

// ---------- admin ----------

const admin = new Hono<Env>();
admin.use('*', adminOnly);

admin.get('/meta', (c) => c.json({ botUsername: botInfo.username, webappUrl: config.webappUrl }));

admin.get('/stats', (c) => c.json(detailed(Number(c.req.query('days') ?? 30))));

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

admin.get('/posts', (c) =>
  c.json(
    all(
      `SELECT p.id, p.type, p.title, p.access, p.status, p.pinned, p.updated_at, p.published_at,
              (SELECT COUNT(DISTINCT user_id) FROM events e WHERE e.type = 'post_view' AND e.ref = CAST(p.id AS TEXT)) views
       FROM posts p ORDER BY p.pinned DESC, p.updated_at DESC`,
    ),
  ),
);
admin.get('/posts/:id', (c) => {
  const p = one('SELECT * FROM posts WHERE id = ?', Number(c.req.param('id')));
  return p ? c.json(p) : c.json({ error: 'not_found' }, 404);
});
admin.post('/posts', async (c) => {
  const f = postFields(await c.req.json());
  const t = now();
  const r = run(
    `INSERT INTO posts (type, title, summary, body, cover_url, link_url, install, tags, access, status, pinned, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.type, f.title, f.summary, f.body, f.cover_url, f.link_url, f.install, f.tags, f.access, f.status, f.pinned, t, t,
    f.status === 'published' ? t : null,
  );
  return c.json({ id: Number(r.lastInsertRowid) });
});
admin.put('/posts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const f = postFields(await c.req.json());
  run(
    `UPDATE posts SET type = ?, title = ?, summary = ?, body = ?, cover_url = ?, link_url = ?, install = ?, tags = ?,
       access = ?, status = ?, pinned = ?, updated_at = ?,
       published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END
     WHERE id = ?`,
    f.type, f.title, f.summary, f.body, f.cover_url, f.link_url, f.install, f.tags, f.access, f.status, f.pinned, now(),
    f.status, now(), id,
  );
  return c.json({ id });
});
admin.delete('/posts/:id', (c) => {
  run('DELETE FROM posts WHERE id = ?', Number(c.req.param('id')));
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
admin.get('/banners', (c) => c.json(all('SELECT * FROM banners ORDER BY sort, id DESC')));
admin.post('/banners', async (c) => {
  const r = run(
    `INSERT INTO banners (eyebrow, title, subtitle, image_url, bg, cta_label, action_type, action_value, active, sort, starts_at, ends_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...bannerFields(await c.req.json()),
    now(),
  );
  return c.json({ id: Number(r.lastInsertRowid) });
});
admin.put('/banners/:id', async (c) => {
  run(
    `UPDATE banners SET eyebrow = ?, title = ?, subtitle = ?, image_url = ?, bg = ?, cta_label = ?, action_type = ?,
       action_value = ?, active = ?, sort = ?, starts_at = ?, ends_at = ? WHERE id = ?`,
    ...bannerFields(await c.req.json()),
    Number(c.req.param('id')),
  );
  return c.json({ ok: true });
});
admin.delete('/banners/:id', (c) => {
  run('DELETE FROM banners WHERE id = ?', Number(c.req.param('id')));
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
admin.get('/keywords', (c) =>
  c.json(
    all(
      `SELECT k.*, (SELECT COUNT(*) FROM events e WHERE e.type = 'keyword' AND e.ref = k.keyword) hits,
              (SELECT COUNT(*) FROM users u WHERE u.source = k.keyword) users
       FROM keywords k ORDER BY k.id DESC`,
    ).map((k) => ({ ...k, buttons: JSON.parse(k.buttons) })),
  ),
);
admin.post('/keywords', async (c) => {
  try {
    const r = run(
      `INSERT INTO keywords (keyword, match_text, response_text, photo_url, buttons, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ...keywordFields(await c.req.json()),
      now(),
    );
    return c.json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    return c.json({ error: friendlyError(e) }, 400);
  }
});
admin.put('/keywords/:id', async (c) => {
  try {
    run(
      `UPDATE keywords SET keyword = ?, match_text = ?, response_text = ?, photo_url = ?, buttons = ?, active = ? WHERE id = ?`,
      ...keywordFields(await c.req.json()),
      Number(c.req.param('id')),
    );
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: friendlyError(e) }, 400);
  }
});
admin.delete('/keywords/:id', (c) => {
  run('DELETE FROM keywords WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});
admin.post('/keywords/:id/test', async (c) => {
  const k = one('SELECT * FROM keywords WHERE id = ?', Number(c.req.param('id')));
  if (!k) return c.json({ error: 'not_found' }, 404);
  const { sendRich } = await import('./telegram.ts');
  try {
    await sendRich(c.get('userId'), k.response_text, k.photo_url, JSON.parse(k.buttons));
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// broadcasts
admin.get('/broadcasts', (c) => c.json(all('SELECT * FROM broadcasts ORDER BY id DESC LIMIT 50')));
admin.get('/broadcasts/audience', (c) =>
  c.json(Object.fromEntries(Object.keys(AUDIENCES).map((a) => [a, audienceSize(a)]))),
);
admin.post('/broadcasts', async (c) => {
  const b = await c.req.json();
  if (!String(b.text ?? '').trim()) return c.json({ error: "Matn bo'sh" }, 400);
  const audience = b.audience in AUDIENCES ? b.audience : 'all';
  const buttons = JSON.stringify(Array.isArray(b.buttons) ? b.buttons : []);
  if (b.test) {
    const { sendRich } = await import('./telegram.ts');
    try {
      await sendRich(c.get('userId'), b.text, b.photo_url || null, JSON.parse(buttons));
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  }
  const r = run(
    `INSERT INTO broadcasts (text, photo_url, buttons, audience, created_at) VALUES (?, ?, ?, ?, ?)`,
    b.text, b.photo_url || null, buttons, audience, now(),
  );
  runQueue();
  return c.json({ id: Number(r.lastInsertRowid) });
});

// users
admin.get('/users', (c) => {
  const q = (c.req.query('q') ?? '').trim().replace(/^@/, '');
  const filter = c.req.query('filter') ?? 'all';
  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    where.push(`(CAST(id AS TEXT) = ? OR username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`);
    params.push(q, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (filter === 'club') where.push('is_club = 1');
  if (filter === 'waitlist') where.push('id IN (SELECT user_id FROM waitlist)');
  if (filter === 'subscribed') where.push('is_subscribed = 1');
  if (filter === 'blocked') where.push('blocked_at IS NOT NULL');
  const rows = all(
    `SELECT u.*, (SELECT GROUP_CONCAT(product) FROM waitlist w WHERE w.user_id = u.id) waitlist
     FROM users u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT 100`,
    ...params,
  );
  return c.json(rows);
});
admin.patch('/users/:id', async (c) => {
  const b = await c.req.json();
  run('UPDATE users SET is_club = ? WHERE id = ?', b.is_club ? 1 : 0, Number(c.req.param('id')));
  return c.json({ ok: true });
});

// settings
admin.get('/settings', (c) => c.json(getSettings()));
admin.put('/settings', async (c) => {
  const b = await c.req.json();
  for (const key of Object.keys(settingDefaults)) if (typeof b[key] === 'string') setSetting(key, b[key]);
  return c.json(getSettings());
});

// uploads
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
admin.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'Fayl topilmadi' }, 400);
  const ext = IMAGE_EXT[file.type];
  if (!ext) return c.json({ error: 'Faqat JPG, PNG, WEBP yoki GIF' }, 400);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'Fayl 10 MB dan katta' }, 400);
  const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
  await writeFile(join(config.dataDir, 'uploads', name), Buffer.from(await file.arrayBuffer()));
  return c.json({ url: `/uploads/${name}` });
});

api.route('/admin', admin);

function friendlyError(e: unknown) {
  const m = (e as Error).message ?? String(e);
  return m.includes('UNIQUE') ? "Bunday kalit so'z allaqachon mavjud" : m;
}
