// Creates the tables (supabase/schema.sql) and the public "uploads" storage bucket.
// Safe to re-run. Usage: npm run db:setup
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../src/server/config';
import { sql } from '../src/server/db';
import { storageClient } from '../src/server/storage';

if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set (Supabase → Project Settings → Database → connection string).');
  process.exit(1);
}

await sql.unsafe(readFileSync(resolve(import.meta.dirname, '../supabase/schema.sql'), 'utf8'));
console.log('Jadvallar tayyor.');

if (config.supabaseUrl && config.supabaseKey) {
  const storage = storageClient().storage;
  const { data } = await storage.getBucket(config.storageBucket);
  if (data) {
    console.log(`Storage bucket "${config.storageBucket}" allaqachon bor.`);
  } else {
    const { error } = await storage.createBucket(config.storageBucket, { public: true });
    if (error) throw new Error(`Bucket yaratilmadi: ${error.message}`);
    console.log(`Storage bucket "${config.storageBucket}" yaratildi (ochiq).`);
  }
} else {
  console.warn('SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY yo\'q: rasm yuklash uchun bucket yaratilmadi.');
}

await sql.end();
