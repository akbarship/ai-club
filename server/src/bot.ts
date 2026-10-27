import { GrammyError, InlineKeyboard, type Context } from 'grammy';
import { config, isAdmin } from './config.ts';
import { getSettings, getUser, logEvent, now, one, run, upsertUser } from './db.ts';
import { checkSubscription, isChannelChat, setSubscribed } from './subscription.ts';
import { bot, botInfo, sendRich, type MsgButton } from './telegram.ts';
import { summary } from './stats.ts';

export const ALLOWED_UPDATES = ['message', 'callback_query', 'my_chat_member', 'chat_member'] as const;

const appUrl = (path = '/') => config.webappUrl + path;

async function welcomeKeyboard(userId: number) {
  const kb = new InlineKeyboard().webApp("AI Club'ni ochish", appUrl()).row();
  if (config.channelId && !(await checkSubscription(userId))) {
    kb.url("Kanalga obuna bo'lish", config.channelUrl).row();
    kb.text('Obunani tekshirish', 'check_sub');
  }
  return kb;
}

async function sendWelcome(ctx: Context) {
  const s = getSettings();
  await ctx.reply(s.welcome_text, {
    parse_mode: 'HTML',
    reply_markup: await welcomeKeyboard(ctx.from!.id),
    link_preview_options: { is_disabled: true },
  });
}

type Keyword = { id: number; keyword: string; response_text: string; photo_url: string | null; buttons: string };

async function sendKeyword(ctx: Context, kw: Keyword) {
  logEvent(ctx.from!.id, 'keyword', kw.keyword);
  let buttons: MsgButton[] = [];
  try {
    buttons = JSON.parse(kw.buttons);
  } catch {}
  await sendRich(ctx.chat!.id, kw.response_text, kw.photo_url, buttons);
}

const findKeyword = (word: string) =>
  one<Keyword>('SELECT * FROM keywords WHERE keyword = ? AND active = 1', word.trim().toLowerCase());

// Keep the users table fresh for every private interaction.
bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.from.is_bot && ctx.chat?.type === 'private') upsertUser(ctx.from);
  await next();
});

bot.command('start', async (ctx) => {
  const id = ctx.from!.id;
  const payload = ctx.match.trim();
  const u = getUser(id);
  if (u && !u.started_at) {
    run('UPDATE users SET started_at = ?, source = COALESCE(source, ?) WHERE id = ?', now(), payload || null, id);
  }
  if (u?.blocked_at) {
    run('UPDATE users SET blocked_at = NULL WHERE id = ?', id);
  }
  logEvent(id, 'start', payload || null);

  if (payload) {
    const kw = findKeyword(payload);
    if (kw) return sendKeyword(ctx, kw);

    const post = /^post_(\d+)$/.exec(payload);
    if (post) {
      const p = one('SELECT id, title FROM posts WHERE id = ? AND status = ?', Number(post[1]), 'published');
      if (p) {
        return ctx.reply(`<b>${escapeHtml(p.title)}</b>`, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().webApp('Ochish', appUrl(`/p/${p.id}`)),
        });
      }
    }
  }
  await sendWelcome(ctx);
});

bot.command('app', sendWelcome);

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from!.id)) return;
  const s = summary();
  const text = [
    '<b>Qisqa statistika</b>',
    '',
    `Foydalanuvchilar: <b>${s.users.total}</b> (bugun +${s.users.today})`,
    `/start bosganlar: <b>${s.users.started}</b>`,
    `Ilovani ochganlar: <b>${s.users.appUsers}</b>`,
    `DAU / WAU / MAU: <b>${s.active.dau} / ${s.active.wau} / ${s.active.mau}</b>`,
    `Kanalga obuna: <b>${s.users.subscribed}</b>`,
    `Botni bloklagan: <b>${s.users.blocked}</b>`,
    `Waitlist: club <b>${s.waitlist.club}</b>, kurs <b>${s.waitlist.course}</b>`,
  ].join('\n');
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().webApp('Admin panel', appUrl('/admin')),
  });
});

bot.callbackQuery('check_sub', async (ctx) => {
  const ok = await checkSubscription(ctx.from.id, true);
  if (!ok) {
    return ctx.answerCallbackQuery({ text: "Siz hali kanalga obuna bo'lmagansiz.", show_alert: true });
  }
  await ctx.answerCallbackQuery({ text: 'Rahmat! Hammasi ochildi.' });
  await ctx.editMessageReplyMarkup({ reply_markup: await welcomeKeyboard(ctx.from.id) }).catch(() => {});
});

// Plain-text keyword triggers (e.g. user types "club").
bot.on('message:text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const kw = one<Keyword>(
    'SELECT * FROM keywords WHERE keyword = ? AND active = 1 AND match_text = 1',
    ctx.message.text.trim().toLowerCase(),
  );
  if (kw) return sendKeyword(ctx, kw);
});

// User blocked / unblocked the bot.
bot.on('my_chat_member', (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const status = ctx.myChatMember.new_chat_member.status;
  const id = ctx.from.id;
  if (status === 'kicked') {
    run('UPDATE users SET blocked_at = ? WHERE id = ?', now(), id);
    logEvent(id, 'blocked');
  } else if (status === 'member') {
    run('UPDATE users SET blocked_at = NULL WHERE id = ?', id);
    logEvent(id, 'unblocked');
  }
});

// Instant subscription updates from the channel (bot must be a channel admin).
bot.on('chat_member', (ctx) => {
  if (!isChannelChat(ctx.chat)) return;
  const m = ctx.chatMember.new_chat_member;
  const userId = m.user.id;
  if (!getUser(userId)) return;
  setSubscribed(userId, ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member));
});

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError && e.error_code === 403) return;
  console.error('Bot error:', e);
});

export async function setupBot() {
  const me = await bot.api.getMe();
  botInfo.username = me.username;
  await bot.api.setMyCommands([
    { command: 'start', description: 'Boshlash' },
    { command: 'app', description: 'Ilovani ochish' },
  ]);
  for (const id of config.adminIds) {
    await bot.api
      .setMyCommands(
        [
          { command: 'start', description: 'Boshlash' },
          { command: 'app', description: 'Ilovani ochish' },
          { command: 'admin', description: 'Statistika va admin panel' },
        ],
        { scope: { type: 'chat', chat_id: id } },
      )
      .catch(() => {});
  }
  if (config.webappUrl.startsWith('https://')) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: appUrl() } } });
  } else {
    console.warn('WEBAPP_URL is not https — Telegram will not open the mini app. Use a tunnel in development.');
  }
  return me;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notifyAdmins(text: string) {
  for (const id of config.adminIds) {
    await bot.api.sendMessage(id, text, { parse_mode: 'HTML' }).catch(() => {});
  }
}
