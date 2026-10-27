# Design

The AI Club Mini App follows the visual language of proninlearn.ru: ink on white, Google Sans, Solar icons, generous whitespace and no decoration. Tokens live in `web/src/styles.css`.

## Color
Always light. The active state is ink, never color.

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#ffffff` | Page background; also forced on Telegram's header, background and bottom bar |
| `--ink` | `#0f0f10` | Text, primary buttons, active nav and filter pills, chart bars |
| `--ink-2` | `#3a3a3e` | Body copy in summaries, secondary icons |
| `--muted` | `#6e6e73` | Secondary text, bylines, hints |
| `--faint` | `#a1a1a6` | Inactive tab labels, chevrons, placeholders |
| `--surface` / `--surface-2` | `#f2f2f3` / `#e9e9eb` | Cards, notices, gate, KPI tiles / hover and skeletons |
| `--line` | `#e6e6e8` | Hairlines between feed items, rows and sections |
| `--accent` | `#2f7cf6` | Small status pills (YOPIQ / OCHIQ), links in articles, chart hover, the featured card mark |
| `--ok` | `#1f8a4c` | Positive state only (subscribed, published) |
| `--danger` | `#d93025` | Destructive actions only |

## Type
- Google Sans 400/500/700 (Google Fonts); Google Sans Code for install commands and code blocks.
- Scale: 13 / 15 / 17 / 20 / 28. Headings 500 weight except the article title (700).
- Uppercase tracked labels only for banner eyebrows.
- Tabular numbers in all stats.

## Icons
Solar (480 Design, CC BY 4.0) via `@solar-icons/react`, wrapped in `web/src/components/Icons.tsx`. Linear for neutral elements, Bold for active nav items and accents. Never emoji or Unicode glyphs.

## Shape
- Radius: 12 controls, 16 cards, 20 media and panels.
- No shadows except the segmented-control thumb; no gradients except the bottom-button fade; blur only on the banner CTA pill over images.

## Components
- **Shell:** desktop sidebar (brand title, pill nav, "Kanalga o'tish" footer); mobile bottom tab bar.
- **Featured carousel:** eyebrow, title and subtitle above a 4:3 (mobile) / 16:10 (desktop) media card with a translucent CTA pill; the next card peeks in; slim progress segments.
- **Filter row:** ink pill for the active filter, a divider after "Hammasi", plain text tabs.
- **Feed post:** avatar, "Akbar · type · date" byline, title, summary, optional cover, then "O'qish" or a lock chip.
- **Locked teaser:** placeholder lines fading into a grey gate panel with an ink lock icon; the server never sends locked content.
- **Admin:** icon pill tabs, grey KPI tiles, ink bar chart with blue hover, hairline tables and lists, sticky form actions.

## Motion
Short ease-out transitions (`cubic-bezier(0.22, 1, 0.36, 1)`) on hover and state changes only; the read-link arrow nudges on hover.
