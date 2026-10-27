# AI Club — Telegram bot + Mini App

The bot and Telegram Mini App for the AI Club community: guides (qo'llanmalar), resources, skills and MCPs,
a channel subscription gate, banners, keyword deep links, broadcasts and a stats dashboard.

```
server/   Node 24 + grammY (bot) + Hono (API) + SQLite (node:sqlite). Runs TypeScript directly, no build step.
web/      React + Vite mini app. Includes the admin panel at /admin (visible only to ADMIN_IDS).
```

## Features

**For users (in the Mini App)**
- Home: a banner carousel, filter chips (Qo'llanmalar / Resurslar / Skills / MCP) and a feed.
- Guide pages written in Markdown. Resources get a link card. Skills and MCPs get a one-tap copy block for the install command.
- **Channel gate.** Each post is `free`, `channel` (subscribers only) or `club` (club members only). Locked posts still appear in the feed as teasers. The server never sends their body, link or install command. When the user comes back from the channel, the app checks their subscription again automatically.
- An AI Club / Kurslar page with **waitlists**. Admins get a notification in the bot every time someone joins.
- Native Telegram controls: MainButton, BackButton, SettingsButton, haptics, theme colors, alerts and confirms, `openTelegramLink`, and share links (`t.me/<bot>?startapp=post_12`).

**Bot**
- `/start` shows a welcome message with a Mini App button. Users who aren't subscribed also get "Subscribe" and "Check subscription" buttons.
- The menu button opens the Mini App. It's set automatically at startup.
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

## Setup

1. **@BotFather**
   - Create the bot and copy the token.
   - `Bot Settings → Configure Mini App → Enable` and set the URL to your `WEBAPP_URL`. This turns on `t.me/<bot>?startapp=…` links.
2. **Channel.** Add the bot to your channel as an **administrator**. No extra rights are needed. Without admin, `getChatMember` and join and leave updates don't work.
3. `cp .env.example .env` and fill it in. Get your Telegram ID from @userinfobot and put it in `ADMIN_IDS`.
4. `npm install`

### Local development

Telegram only opens Mini Apps over HTTPS, so you need a tunnel to Vite:

```bash
npm run dev
```

```bash
cloudflared tunnel --url http://localhost:5173
```

Put the tunnel URL into `WEBAPP_URL` (and BotFather), then restart `npm run dev`.

To work on the UI in a normal browser without Telegram, set `DEV_USER_ID=<your id>` in `.env` and open http://localhost:5173.

### Production

```bash
docker compose up -d --build
```

The server serves the built Mini App and the API on port 3000. Put it behind HTTPS (Caddy, nginx or Cloudflare). The data (SQLite and uploads) lives in `./data`, so back that folder up. To use a webhook instead of long polling, set `WEBHOOK_URL` to the public base URL.

Without Docker: run `npm run build`, then `NODE_ENV=production npm start`.

## Importing articles

`content/articles.uz.json` holds ready-written Uzbek articles. To add them to the database as drafts:

```bash
npm run import -w server
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
