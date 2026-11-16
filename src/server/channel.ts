import { InlineKeyboard } from 'grammy';
import { postCaption } from './bot';
import { config } from './config';
import { now, run, type Row } from './db';
import { absoluteUrl, bot, postStartLink } from './telegram';

/** Telegram limits photo captions to 1024 characters (counted without HTML tags). */
const CAPTION_LIMIT = 1024;

/**
 * Sends a post's announcement to a chat. Channels cannot open the mini app directly,
 * so the button is the bot's start link: the reader presses /start, then opens the post.
 */
export async function sendAnnouncement(chatId: number | string, p: Row) {
  const text = String(p.tg_text ?? '').trim() || postCaption(p as { title: string; summary: string });
  const reply_markup = new InlineKeyboard().url(p.type === 'guide' ? "O'qish" : "Ko'rish", await postStartLink(p.id));
  const plainLength = text.replace(/<[^>]*>/g, '').length;
  if (p.cover_url && plainLength <= CAPTION_LIMIT) {
    return bot.api.sendPhoto(chatId, absoluteUrl(p.cover_url), { caption: text, parse_mode: 'HTML', reply_markup });
  }
  return bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup });
}

/** Posts the announcement to the channel once and records it on the post. */
export async function postToChannel(p: Row) {
  if (!config.channelId) throw new Error('CHANNEL_ID sozlanmagan');
  const msg = await sendAnnouncement(config.channelId, p);
  await run('UPDATE posts SET tg_message_id = ?, tg_posted_at = ? WHERE id = ?', msg.message_id, now(), p.id);
}
