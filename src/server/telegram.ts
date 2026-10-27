import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';

const g = globalThis as unknown as { __aiClubBot?: Bot };
// "missing" lets the app boot without a token so pages and errors render; Telegram calls will fail.
export const bot =
  g.__aiClubBot ??
  (g.__aiClubBot = new Bot(config.botToken || 'missing', { client: { apiRoot: config.telegramApiRoot } }));

/** The bot's @username, needed for share links. Fetched once per server instance. */
export async function botUsername(): Promise<string> {
  if (config.botUsername) return config.botUsername;
  if (!bot.isInited()) await bot.init().catch(() => {});
  return bot.isInited() ? bot.botInfo.username : '';
}

export type MsgButton = { text: string; type: 'app' | 'url' | 'channel'; value?: string };

/** Builds an inline keyboard from admin-defined buttons (one button per row). */
export function buildKeyboard(buttons: MsgButton[]): InlineKeyboard | undefined {
  if (!buttons?.length) return undefined;
  const kb = new InlineKeyboard();
  for (const b of buttons) {
    if (!b.text) continue;
    if (b.type === 'app') {
      const path = (b.value ?? '').trim();
      kb.webApp(b.text, config.webappUrl + (path.startsWith('/') ? path : path ? `/${path}` : '/'));
    } else if (b.type === 'channel') {
      kb.url(b.text, config.channelUrl);
    } else if (b.value) {
      kb.url(b.text, b.value);
    }
    kb.row();
  }
  return kb;
}

/** Telegram fetches photos by URL; app-relative paths (e.g. /author.png) are made absolute. */
export const absoluteUrl = (url: string) => (url.startsWith('/') ? config.webappUrl + url : url);

/** Sends text or a photo with caption + keyboard to a chat. */
export async function sendRich(chatId: number, text: string, photoUrl: string | null | undefined, buttons: MsgButton[]) {
  const reply_markup = buildKeyboard(buttons);
  if (photoUrl) {
    return bot.api.sendPhoto(chatId, absoluteUrl(photoUrl), { caption: text, parse_mode: 'HTML', reply_markup });
  }
  return bot.api.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup,
    link_preview_options: { is_disabled: true },
  });
}
