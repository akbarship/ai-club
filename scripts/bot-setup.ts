// Points Telegram at the deployed app: webhook, commands and the menu button.
// Run once after each deploy to a new URL. Usage: npm run bot:setup
import { webhookSecret } from '../src/server/app';
import { setupBot } from '../src/server/bot';
import { config } from '../src/server/config';
import { sql } from '../src/server/db';

if (!config.botToken) {
  console.error('BOT_TOKEN is not set. Fill it in .env (from @BotFather).');
  process.exit(1);
}
if (!config.webappUrl.startsWith('https://')) {
  console.error('WEBAPP_URL must be your https Vercel address, e.g. https://ai-club.vercel.app');
  process.exit(1);
}

const url = `${config.webappUrl}/api/tg/webhook`;
const me = await setupBot(url, webhookSecret());
console.log(`@${me.username}: webhook -> ${url}, buyruqlar va menyu tugmasi sozlandi.`);
await sql.end();
