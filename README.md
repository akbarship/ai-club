# AI Club — Telegram bot + Mini App

The bot and Telegram Mini App for the AI Club community: guides (qo'llanmalar), resources, skills and MCPs,
a channel subscription gate, banners, keyword deep links, broadcasts and a stats dashboard.

```
app/          Next.js App Router: the mini app page and the API route (Hono)
src/client/   the mini app (React), including the admin panel at /admin
src/server/   API, bot handlers (webhook), stats, broadcasts — Postgres via Supabase
scripts/      db-setup, import, bot-setup, bot-poll
supabase/     schema.sql
```

This is the **Vercel + Supabase** version. The self-hosted version (Node + SQLite + Docker, long polling, background broadcasts) is kept on the [`vps`](../../tree/vps) branch.

## Features

**For users (in the Mini App)**
- Home: a banner carousel, filter chips (Qo'llanmalar / Resurslar / Skills / MCP) and a feed.
- Guide pages written in Markdown. Resources get a link card. Skills and MCPs get a one-tap copy block for the install command.
- **Channel gate.** Each post is `free`, `channel` (subscribers only) or `club` (club members only). Locked posts still appear in the feed as teasers. The server never sends their body, link or install command. When the user comes back from the channel, the app checks their subscription again automatically.
- An AI Club / Kurslar page with **waitlists**. Admins get a notification in the bot every time someone joins.
- Native Telegram controls: MainButton, BackButton, SettingsButton, haptics, theme colors, alerts and confirms, `openTelegramLink`, and share links (`t.me/<bot>?startapp=post_12`).

**Bot**
- `/start` shows a welcome message with a Mini App button. Users who aren't subscribed also get "Subscribe" and "Check subscription" buttons.
- The menu button opens the Mini App. `npm run bot:setup` sets it.
- **Keywords.** `t.me/<bot>?start=club` sends a prepared message (text, optional photo and buttons such as "open Mini App at /club"). A user typing `club` in the chat gets the same message. Each keyword also counts as a traffic source in stats.
- `/admin` (admins only) shows quick stats and a button that opens the admin panel.
- The bot tracks who blocked it (`my_chat_member`) and channel joins and leaves in real time (`chat_member`).

**Admin panel** (`/admin` inside the Mini App)
- Stats:
  - total users, `/start` presses, Mini App users, DAU/WAU/MAU, subscribers and blocked users
  - a daily chart (active, new users, /start, new subscribers)
  - a funnel: start → opened app → subscribed → waitlist → club
  - traffic sources (start payload) with each source's open and subscribe rates
  - top posts, keyword hits, and clicks on banners and resource links
- Posts: create, edit, publish or unpublish, and pin. Includes a Markdown preview and image upload.
- Banners: color or image, CTA, a target (a post, an app page or a URL), an optional schedule and an order.
- Keywords: a deep link you can copy, a button editor, and "send a test to me".
- Broadcasts: pick an audience (all / subscribed / not subscribed / waitlist / club). You can send a test to yourself first, and progress is shown live. Sending is rate-limited, and users who blocked the bot get marked.
- Users: search, filters, and a way to grant or remove club membership by hand until payments exist.
- Settings: the welcome text, the gate text, and the Club and Courses pitch pages.

## Setup (Vercel + Supabase)

1. **Supabase**: create a project (free tier works).
   - Project Settings → Database → Connection string → **Transaction pooler** (port 6543) → `DATABASE_URL`. Put your database password into it.
   - Project Settings → API → Project URL → `SUPABASE_URL`, and the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`.
2. **@BotFather**: create the bot and copy the token.
3. **Channel**: add the bot to your channel as an **administrator** (no extra rights needed).
4. **Vercel**: Add New → Project → import `akbarship/ai-club` (branch `main`). In Environment Variables add every key from `.env.example`. Deploy, then copy the address (e.g. `https://ai-club.vercel.app`) into `WEBAPP_URL` and redeploy.
5. **@BotFather** → Bot Settings → Configure Mini App → Enable, URL = your `WEBAPP_URL`.
6. **Once, from your computer** (fill `.env` with the same values first):

```bash
npm install
```

```bash
npm run db:setup
```

```bash
npm run import
```

```bash
npm run bot:setup
```

`db:setup` creates the tables and the public `uploads` storage bucket. `import` adds the 36 articles as drafts. `bot:setup` points Telegram at `WEBAPP_URL/api/tg/webhook` and sets the commands and the menu button — run it again whenever `WEBAPP_URL` changes.

### Local development

```bash
npm run dev
```

Set `DEV_USER_ID=<your id>` in `.env` to use the app in a normal browser at http://localhost:3000. To test the bot locally, `npm run bot:poll` runs it with long polling; it removes the webhook, so run `npm run bot:setup` afterwards.

### Limits of the Vercel version

- **Broadcasts** are sent in ~8-second steps driven by the admin page: keep Admin → Xabar yuborish open until it finishes. Closing it pauses sending; reopening resumes.
- **Image uploads** are limited to 4 MB (Vercel request size limit).

## Importing articles

`content/articles.uz.json` holds ready-written Uzbek articles. To add them to the database as drafts:

```bash
npm run import
```

Re-running is safe: an article whose link already exists is skipped. Review the drafts in Admin → Materiallar and publish the ones you want.

## Message formatting

Bot messages (welcome, keywords, broadcasts) use Telegram HTML: `<b>`, `<i>`, `<a href="…">`, `<code>`, `<blockquote>`.
Posts and the Club page use Markdown.

## Deep links

| Link | What it does |
| --- | --- |
| `t.me/<bot>?start=club` | Sends the reply for keyword `club` and records the source `club` |
| `t.me/<bot>?start=instagram` | Not a keyword: sends the normal welcome and records the source `instagram` |
| `t.me/<bot>?start=post_12` | Sends a button that opens post 12 |
| `t.me/<bot>?startapp=post_12` | Opens the Mini App directly on post 12 |
| `t.me/<bot>?startapp=club` | Opens the Mini App on the Club page |

## Credits

Icons: Solar by 480 Design, licensed CC BY 4.0, via `@solar-icons/react` (MIT).
Font: Google Sans (Google Fonts).
