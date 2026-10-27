// Imports content/articles.uz.json into the posts table as drafts.
// Safe to re-run: an article whose link_url already exists is skipped.
// Usage: npm run import [-- path/to/articles.json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { now, sql } from '../src/server/db';

type Article = {
  type: string;
  title: string;
  summary: string;
  body: string;
  link_url: string | null;
  install: string | null;
  tags: string;
  access: string;
};

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (Supabase → Project Settings → Database → connection string).');
  process.exit(1);
}

const file = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../content/articles.uz.json'));
const articles: Article[] = JSON.parse(readFileSync(file, 'utf8'));
const t = now();

const { added, skipped } = await sql.begin(async (tx) => {
  let added = 0;
  let skipped = 0;
  for (const a of articles) {
    if (a.link_url && (await tx`SELECT 1 FROM posts WHERE link_url = ${a.link_url}`).length) {
      skipped++;
      continue;
    }
    await tx`
      INSERT INTO posts (type, title, summary, body, link_url, install, tags, access, status, pinned, created_at, updated_at)
      VALUES (${a.type}, ${a.title}, ${a.summary}, ${a.body}, ${a.link_url}, ${a.install}, ${a.tags},
              ${a.access || 'channel'}, 'draft', 0, ${t}, ${t})`;
    added++;
  }
  return { added, skipped };
});

console.log(`${file}\nQoralama sifatida qo'shildi: ${added}. Allaqachon bor, o'tkazib yuborildi: ${skipped}.`);
await sql.end();
