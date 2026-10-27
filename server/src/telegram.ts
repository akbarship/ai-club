import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { join } from 'node:path';
import { config } from './config.ts';

export const bot = new Bot(config.botToken);

/** Filled in at startup from getMe(). */
export const botInfo = { username: '' };

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

/** Uploaded images are sent as files; external URLs are passed through to Telegram. */
export function photoInput(url: string): string | InputFile {
  if (url.startsWith('/uploads/')) return new InputFile(join(config.dataDir, url));
  return url;
}

/** Sends text or a photo with caption + keyboard to a chat. */
export async function sendRich(chatId: number, text: string, photoUrl: string | null | undefined, buttons: MsgButton[]) {
  const reply_markup = buildKeyboard(buttons);
  if (photoUrl) {
    return bot.api.sendPhoto(chatId, photoInput(photoUrl), { caption: text, parse_mode: 'HTML', reply_markup });
  }
  return bot.api.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup,
    link_preview_options: { is_disabled: true },
  });
}
