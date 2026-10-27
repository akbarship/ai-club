// Imports content/articles.uz.json into the posts table as drafts.
// Safe to re-run: an article whose link_url already exists is skipped.
// Usage: npm run import -w server [-- path/to/articles.json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, now, one, run } from '../src/db.ts';

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

const file = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../../content/articles.uz.json'));
const articles: Article[] = JSON.parse(readFileSync(file, 'utf8'));

let added = 0;
let skipped = 0;
const t = now();

db.exec('BEGIN');
try {
  for (const a of articles) {
    if (a.link_url && one('SELECT id FROM posts WHERE link_url = ?', a.link_url)) {
      skipped++;
      continue;
    }
    run(
      `INSERT INTO posts (type, title, summary, body, link_url, install, tags, access, status, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?)`,
      a.type, a.title, a.summary, a.body, a.link_url, a.install, a.tags, a.access || 'channel', t, t,
    );
    added++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

console.log(`${file}\nQoralama sifatida qo'shildi: ${added}. Allaqachon bor, o'tkazib yuborildi: ${skipped}.`);
