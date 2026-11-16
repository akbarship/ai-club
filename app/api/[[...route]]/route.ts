import { handle } from 'hono/vercel';
import { app } from '@/server/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Broadcast steps run for ~8 s; the first send of a large PDF to Telegram can take longer.
export const maxDuration = 60;

const handler = handle(app);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
