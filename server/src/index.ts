import './preflight.ts';
import { serve } from '@hono/node-server';
import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { api } from './api.ts';
import { ALLOWED_UPDATES, setupBot } from './bot.ts';
import { runQueue } from './broadcast.ts';
import { config } from './config.ts';
import { bot } from './telegram.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

async function fileResponse(root: string, rel: string, cache: string) {
  const path = normalize(join(root, rel));
  if (!path.startsWith(root)) return null;
  try {
    if (!(await stat(path)).isFile()) return null;
    return new Response(await readFile(path), {
      headers: { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': cache },
    });
  } catch {
    return null;
  }
}

const app = new Hono();
app.route('/api', api);

const webhookSecret = createHash('sha256').update(config.botToken).digest('hex').slice(0, 32);
if (config.webhookUrl) {
  app.post('/tg/webhook', webhookCallback(bot, 'hono', { secretToken: webhookSecret }));
}

app.get('/uploads/*', async (c) => {
  const res = await fileResponse(join(config.dataDir, 'uploads'), c.req.path.slice('/uploads/'.length), 'public, max-age=31536000, immutable');
  return res ?? c.notFound();
});

// Built mini app + SPA fallback.
app.get('*', async (c) => {
  const asset = c.req.path.startsWith('/assets/')
    ? await fileResponse(config.webDist, c.req.path, 'public, max-age=31536000, immutable')
    : await fileResponse(config.webDist, c.req.path, 'no-cache');
  if (asset) return asset;
  return (await fileResponse(config.webDist, 'index.html', 'no-cache')) ?? c.text('Mini app is not built. Run `npm run build`.', 404);
});

serve({ fetch: app.fetch, port: config.port }, () => console.log(`HTTP on :${config.port}`));

const me = await setupBot();
console.log(`Bot @${me.username} ready`);

if (config.webhookUrl) {
  await bot.api.setWebhook(`${config.webhookUrl}/tg/webhook`, {
    secret_token: webhookSecret,
    allowed_updates: [...ALLOWED_UPDATES],
  });
  console.log('Webhook mode');
} else {
  await bot.api.deleteWebhook();
  bot.start({ allowed_updates: [...ALLOWED_UPDATES] });
  console.log('Long polling mode');
}

runQueue();

const shutdown = () => {
  bot.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
