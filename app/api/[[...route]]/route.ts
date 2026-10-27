import { handle } from 'hono/vercel';
import { app } from '@/server/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Broadcast steps run for ~8 s; leave headroom.
export const maxDuration = 30;

const handler = handle(app);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
