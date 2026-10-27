// Local development only: runs the bot with long polling instead of the webhook.
// This removes the webhook; run `npm run bot:setup` again before relying on the deployed bot.
import { ALLOWED_UPDATES, bot, registerHandlers } from '../src/server/bot';

if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN is not set. Fill it in .env (from @BotFather).');
  process.exit(1);
}

registerHandlers();
await bot.api.deleteWebhook();
console.log('Bot long polling rejimida ishlayapti (Ctrl+C bilan to\'xtating).');
await bot.start({ allowed_updates: [...ALLOWED_UPDATES] });
