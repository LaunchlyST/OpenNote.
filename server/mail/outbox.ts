import { sql } from '../db.ts'
import type { Sql } from '../sql.ts'
import { env } from '../env.ts'
import { renderEmail } from './templates.ts'
import type { EmailData, EmailKind } from './templates.ts'
import { createTransport } from './transport.ts'
import type { Transport } from './transport.ts'

/**
 * OpenNote's email outbox.
 *
 * `enqueueEmail()` only writes a row and returns, so an auth request never
 * waits on (or reveals timing from) a mail server. A small worker then sends
 * due messages, retrying failures with exponential backoff. Bodies hold
 * one-time links, so they are erased as soon as a message is sent or given
 * up on; the row stays behind as the delivery log, without the link.
 */

type Row = {
  id: number
  kind: EmailKind
  recipient: string
  subject: string
  html: string
  text: string
  attempts: number
}

const HOUR = 60 * 60 * 1000
const BASE_DELAY = 30_000 // 30s, 2m, 8m, 32m, then capped at 1h
const KEEP_LOG_FOR = 30 * 24 * HOUR

let transport: Transport = createTransport()
let timer: NodeJS.Timeout | null = null
let running: Promise<void> | null = null

/** For tests: swap in a fake transport. */
export function setTransport(t: Transport) {
  transport = t
}

/** user@example.com → u***@example.com, for logs. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user.slice(0, 1)}***@${domain ?? ''}`
}

function log(message: string) {
  if (process.env.NODE_ENV !== 'test') console.log(`[mail] ${message}`)
}

export type EnqueueResult = { queued: true; id: number } | { queued: false; reason: 'rate-limited' | 'invalid-recipient' }

/**
 * Queues one email. Pass `via` to write it inside an open transaction (so the
 * message is only queued if the rest of that transaction commits).
 */
export async function enqueueEmail(kind: EmailKind, to: string, data: EmailData, via: Sql = sql): Promise<EnqueueResult> {
  const recipient = to.trim().toLowerCase()
  // A single address, no header injection.
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(recipient)) {
    log(`refused ${kind}: invalid recipient`)
    return { queued: false, reason: 'invalid-recipient' }
  }

  const now = Date.now()
  const recent = await via.get<{ n: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n FROM email_outbox WHERE recipient = ? AND "createdAt" > ? AND status != 'skipped'`,
    recipient,
    now - HOUR,
  )
  if (kind !== 'order-receipt' && (recent?.n ?? 0) >= env.mail.perRecipientPerHour) {
    await via.run(
      `INSERT INTO email_outbox (kind, recipient, subject, status, "nextAttemptAt", "lastError", "createdAt") VALUES (?, ?, ?, 'skipped', ?, 'rate limited', ?)`,
      kind,
      recipient,
      kind,
      now,
      now,
    )
    log(`rate-limited ${kind} for ${maskEmail(recipient)}`)
    return { queued: false, reason: 'rate-limited' }
  }

  const email = renderEmail(kind, data)
  const row = await via.get<{ id: number }>(
    'INSERT INTO email_outbox (kind, recipient, subject, html, text, "nextAttemptAt", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    kind,
    recipient,
    email.subject,
    email.html,
    email.text,
    kind === 'order-receipt' && (recent?.n ?? 0) >= env.mail.perRecipientPerHour ? now + HOUR : now,
    now,
  )
  const id = Number(row!.id)
  log(`queued ${kind} #${id} for ${maskEmail(recipient)}`)
  kick()
  return { queued: true, id }
}

/** How long a claimed message may stay in "sending" before it counts as abandoned. */
const CLAIM_MS = 10 * 60 * 1000

async function sendDue() {
  // No mail server configured: keep everything queued (sent once SMTP is set)
  // instead of marking receipts failed.
  if (transport.name === 'none') return
  const now = Date.now()
  // A worker that died mid-send leaves its claim behind; take it back only
  // after the claim has expired, so a live worker is never doubled.
  await sql.run(`UPDATE email_outbox SET status = 'retrying' WHERE status = 'sending' AND "nextAttemptAt" <= ?`, now)
  const due = await sql.all<Row>(
    `SELECT id, kind, recipient, subject, html, text, attempts FROM email_outbox WHERE (status IN ('queued','retrying') OR (kind = 'order-receipt' AND status = 'failed')) AND "nextAttemptAt" <= ? ORDER BY id LIMIT 20`,
    now,
  )

  for (const row of due) {
    // Claim the row so a second worker (or a restart) cannot send it twice.
    const claimed = await sql.run(`UPDATE email_outbox SET status = 'sending', "nextAttemptAt" = ? WHERE id = ? AND (status IN ('queued','retrying') OR (kind = 'order-receipt' AND status = 'failed'))`, now + CLAIM_MS, row.id)
    if (!claimed.changes) continue

    try {
      await transport.send({ id: row.id, to: row.recipient, subject: row.subject, html: row.html, text: row.text })
      await sql.run(
        `UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, "sentAt" = ?, "lastError" = NULL, html = NULL, text = NULL WHERE id = ?`,
        Date.now(),
        row.id,
      )
      log(`sent ${row.kind} #${row.id} to ${maskEmail(row.recipient)} via ${transport.name}`)
    } catch (err) {
      const attempts = row.attempts + 1
      const reason = (err instanceof Error ? err.message : String(err)).slice(0, 300)
      // 5xx from the server is a permanent refusal (bad address, policy,
      // authentication): retrying cannot help. 4xx and network errors can.
      const code = (err as { responseCode?: number }).responseCode
      const permanent = typeof code === 'number' && code >= 500 && code < 600
      if (row.kind === 'order-receipt') {
        await sql.run(`UPDATE email_outbox SET status = 'failed', attempts = ?, "lastError" = ?, "nextAttemptAt" = ? WHERE id = ?`, attempts, reason, Date.now() + Math.min(HOUR, BASE_DELAY * 4 ** Math.min(attempts - 1, 4)), row.id)
      } else if (permanent || attempts >= env.mail.maxAttempts) {
        await sql.run(
          `UPDATE email_outbox SET status = 'failed', attempts = ?, "lastError" = ?, html = NULL, text = NULL WHERE id = ?`,
          attempts,
          reason,
          row.id,
        )
        log(`gave up on ${row.kind} #${row.id} after ${attempts} attempt(s)${permanent ? ' (permanent error)' : ''}: ${reason}`)
      } else {
        const delay = Math.min(HOUR, BASE_DELAY * 4 ** (attempts - 1))
        await sql.run(
          `UPDATE email_outbox SET status = 'retrying', attempts = ?, "lastError" = ?, "nextAttemptAt" = ? WHERE id = ?`,
          attempts,
          reason,
          Date.now() + delay,
          row.id,
        )
        log(`retrying ${row.kind} #${row.id} in ${Math.round(delay / 1000)}s: ${reason}`)
      }
    }
  }

  // Housekeeping: old log rows go after 30 days.
  await sql.run(`DELETE FROM email_outbox WHERE "createdAt" < ? AND kind != 'order-receipt' AND status IN ('sent','skipped','failed')`, now - KEEP_LOG_FOR)
}

/** Runs one pass of the worker. Concurrent calls share the same pass. */
export function processOutbox(): Promise<void> {
  running ??= sendDue().finally(() => {
    running = null
  })
  return running
}

function kick() {
  setImmediate(() => void processOutbox().catch((err) => console.error('[mail] worker error', err)))
}

/** Starts the background worker. A message stuck in "sending" by a crash is retried. */
export function startMailWorker(intervalMs = 5_000) {
  timer ??= setInterval(() => void processOutbox().catch((err) => console.error('[mail] worker error', err)), intervalMs)
  ;(timer as { unref?: () => void }).unref?.()
  log(`worker started (transport: ${transport.name})`)
}

export function stopMailWorker() {
  if (timer) clearInterval(timer)
  timer = null
}

export function transportName() {
  return transport.name
}

/** Delivery log for the admin/dev view: never includes bodies or links. */
export function outboxLog(limit = 50) {
  return sql.all<Record<string, unknown>>(
    'SELECT id, kind, recipient, subject, status, attempts, "lastError", "createdAt", "sentAt" FROM email_outbox ORDER BY id DESC LIMIT ?',
    limit,
  )
}
