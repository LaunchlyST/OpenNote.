/**
 * Resend delivery events (sent through Svix). Signature-checked with RESEND_WEBHOOK_SECRET;
 * nothing is trusted without it.
 * - email.bounced with a Permanent bounce: the message is marked bounced (never "delivered"),
 *   the address is suppressed, and a free-product claim using it shows the bounce message.
 * - email.delivered: recorded as delivered (the receiving server accepted it).
 * Provider acceptance alone is never treated as delivery.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { sql } from '../db.ts'

const TOLERANCE_S = 5 * 60

export function verifySvix(secret: string, headers: { id?: string; timestamp?: string; signature?: string }, body: string, nowS = Math.floor(Date.now() / 1000)): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false
  if (Math.abs(nowS - Number(timestamp)) > TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const want = Buffer.from(createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64'))
  return signature.split(' ').some((part) => {
    const [v, sig] = part.split(',')
    if (v !== 'v1' || !sig) return false
    const got = Buffer.from(sig)
    return got.length === want.length && timingSafeEqual(got, want)
  })
}

export async function resendWebhook(req: Request, res: Response) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? '').trim()
  if (!secret) return void res.status(503).json({ error: 'Webhook signing secret is not configured.' })
  const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
  const h = (n: string) => String(req.headers[n] ?? '') || undefined
  if (!verifySvix(secret, { id: h('svix-id'), timestamp: h('svix-timestamp'), signature: h('svix-signature') }, body)) return void res.status(401).json({ error: 'Bad signature.' })
  let event: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string; message?: string } } }
  try { event = JSON.parse(body) } catch { return void res.status(400).json({ error: 'Bad JSON.' }) }
  // each event once, however often it is re-sent
  const first = await sql.run(`INSERT INTO mail_event (id, type, "receivedAt") VALUES (?, ?, ?) ON CONFLICT DO NOTHING`, h('svix-id')!, String(event.type ?? ''), Date.now())
  if (!first.changes) return void res.json({ ok: true, duplicate: true })
  const emailId = String(event.data?.email_id ?? '')
  const row = emailId ? await sql.get<{ id: number; recipient: string }>(`SELECT id, recipient FROM email_outbox WHERE "providerId" = ?`, emailId) : undefined
  if (event.type === 'email.bounced') {
    const permanent = String(event.data?.bounce?.type ?? '').toLowerCase() === 'permanent'
    if (permanent) {
      const to = [...(event.data?.to ?? []), ...(row ? [row.recipient] : [])].map((e) => String(e).trim().toLowerCase()).filter(Boolean)
      for (const addr of new Set(to)) await sql.run(`INSERT INTO email_suppression (email, reason, "createdAt") VALUES (?, ?, ?) ON CONFLICT DO NOTHING`, addr, `bounce: ${String(event.data?.bounce?.message ?? '').slice(0, 200)}`, new Date().toISOString())
      if (row) {
        await sql.run(`UPDATE email_outbox SET status = 'bounced', "bouncedAt" = ?, "lastError" = ? WHERE id = ?`, Date.now(), `permanent bounce: ${String(event.data?.bounce?.message ?? '').slice(0, 200)}`, row.id)
        await sql.run(`UPDATE seller_claim SET delivery = 'bounced' WHERE "outboxId" = ?`, row.id)
      }
    } else if (row) {
      await sql.run(`UPDATE email_outbox SET "lastError" = ? WHERE id = ?`, `temporary bounce: ${String(event.data?.bounce?.message ?? '').slice(0, 200)}`, row.id)
    }
  } else if (event.type === 'email.delivered' && row) {
    await sql.run(`UPDATE email_outbox SET "deliveredAt" = ? WHERE id = ? AND status <> 'bounced'`, Date.now(), row.id)
    await sql.run(`UPDATE seller_claim SET delivery = 'delivered' WHERE "outboxId" = ? AND (delivery IS NULL OR delivery = 'accepted')`, row.id)
  }
  res.json({ ok: true })
}
