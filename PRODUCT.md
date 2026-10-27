# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Uzbek-speaking people learning to use AI tools: guides, useful resources, and the skills and MCP servers the author built. They arrive from the author's channel, Reels, posts and stories, and open the app inside Telegram, mostly on phones.

## Product Purpose
A Telegram bot with a Mini App that anchors Akbar's AI community. Free and channel-gated content builds trust and grows the Telegram channel; it is the entry point for selling a paid club membership ("AI Club") and, later, courses. Success means: people pressing /start, opening the app, subscribing to the channel, joining the club and course waitlists, and later paying.

## Positioning
A personal author's library in the reader's own language, inside Telegram: the author's own guides, his own skills and MCP servers with copyable install commands, and his curated resources, not a generic course marketplace.

## Operating Context
- Opened from the bot's menu button, /start, keyword deep links (`t.me/<bot>?start=club`) and direct Mini App links (`?startapp=post_12`).
- Content is gated by subscription to the author's Telegram channel; some posts are reserved for club members.
- The author manages everything from an admin panel inside the same Mini App: posts, banners, keyword replies, broadcasts, users, settings and stats.

## Capabilities and Constraints
- Post types: Qo'llanma (guide), Resurs, Skill, MCP. Access levels: free, channel subscribers, club members.
- Club payments do not exist yet; club membership is granted by hand. Waitlists exist for the club and for courses.
- All interface copy is in Uzbek (Latin script).
- Stack: Node 24 + grammY + Hono + SQLite server; React + Vite Mini App.

## Brand Commitments
- Visual reference the owner made binding: proninlearn.ru (minimal, Google Sans, ink on white).
- Icons: the Solar set, Linear for neutral and Bold for active/accent.
- No emojis anywhere: interface, defaults and bot messages.
- Always light theme, regardless of the user's Telegram theme.
- Author identity: "Akbar" plus his photo (configurable in admin settings).

## Evidence on Hand
No real posts, testimonials, member counts or prices exist yet. Do not invent them; demo content is for local preview only.

## Product Principles
1. Every screen should move a reader one step closer to subscribing or joining the club, without nagging.
2. The author's voice leads: posts read like a personal channel, not a catalog.
3. Locked content teases, it never hides that it exists.
4. Native Telegram behaviour (MainButton, BackButton, haptics) over web imitations.
