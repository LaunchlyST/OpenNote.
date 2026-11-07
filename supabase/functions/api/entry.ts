/**
 * Supabase Edge Function "api": runs the Desknoty Express API (server/index.ts).
 * Requests arrive at https://<ref>.supabase.co/functions/v1/api/… and reach
 * Express as /api/…, the same paths the API uses everywhere else.
 * Built into index.js by `npm run build:edge`; deploy with scripts/deploy-supabase.ts.
 */
// process.env is read-only in the edge runtime, so NODE_ENV=production and
// API_PORT=8000 are set as function secrets, and server/db.ts falls back to the
// SUPABASE_DB_URL that Supabase provides.

import { Buffer } from 'node:buffer'
import process from 'node:process'

// Node globals some dependencies expect; the edge runtime only offers them as modules.
const g = globalThis as Record<string, unknown>
g.Buffer ??= Buffer
g.process ??= process
g.global ??= globalThis

try {
  await import('../../../server/index.ts')
} catch (e) {
  // Startup failed: log it, and answer every request with a plain 503 so the
  // cause shows up in the function logs instead of a bare WORKER_ERROR.
  console.error('[api] startup failed:', e)
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  // @ts-ignore Deno global in the edge runtime
  Deno.serve(() => new Response(JSON.stringify({ error: 'API failed to start', detail: msg.slice(0, 300) }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
}
