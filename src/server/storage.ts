import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { config } from './config';

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Vercel rejects request bodies over ~4.5 MB, so uploads stay under that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const storageClient = () =>
  createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

/** Stores an image in the public Supabase Storage bucket and returns its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const ext = IMAGE_EXT[file.type];
  if (!ext) throw new Error('Faqat JPG, PNG, WEBP yoki GIF');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Fayl 4 MB dan katta');
  if (!config.supabaseUrl || !config.supabaseKey) throw new Error('SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY sozlanmagan');

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
  const bucket = storageClient().storage.from(config.storageBucket);
  const { error } = await bucket.upload(name, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw new Error(error.message);
  return bucket.getPublicUrl(name).data.publicUrl;
}
