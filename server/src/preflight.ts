// Imported first by index.ts: ES modules evaluate imports in order, so this runs
// before telegram.ts constructs the Bot (which throws on an empty token).
import { config } from './config.ts';

if (!config.botToken) {
  console.error('BOT_TOKEN is not set. Copy .env.example to .env and fill it in.');
  console.error('Fill BOT_TOKEN in .env (from @BotFather).');
  process.exit(1);
}
