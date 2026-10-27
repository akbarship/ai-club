import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { api } from './api';
import { bot, registerHandlers } from './bot';
import { config } from './config';

registerHandlers();

/** Derived from the bot token so the webhook secret never needs its own env var. */
export const webhookSecret = () => createHash('sha256').update(config.botToken).digest('hex').slice(0, 32);

export const app = new Hono().basePath('/api');

// Registered before the API so the mini-app auth middleware never runs for Telegram's calls.
app.post('/tg/webhook', (c) => webhookCallback(bot, 'hono', { secretToken: webhookSecret() })(c));

app.route('/', api);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Server xatosi. Birozdan keyin qayta urinib ko\'ring.' }, 500);
});
