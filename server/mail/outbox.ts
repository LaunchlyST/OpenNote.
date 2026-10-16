import { db } from '../db.ts'
import { env } from '../env.ts'
import { renderEmail } from './templates.ts'
import type { EmailKind } from './templates.ts'
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

export function enqueueEmail(kind: EmailKind, to: string, data: { url: string; name?: string }): EnqueueResult {
  const recipient = to.trim().toLowerCase()
  // A single address, no header injection.
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(recipient)) {
    log(`refused ${kind}: invalid recipient`)
    return { queued: false, reason: 'invalid-recipient' }
  }

  const now = Date.now()
  const recent = db
    .prepare("SELECT count(*) AS n FROM email_outbox WHERE recipient = ? AND createdAt > ? AND status != 'skipped'")
    .get(recipient, now - HOUR) as { n: number }
  if (recent.n >= env.mail.perRecipientPerHour) {
    db.prepare(
      "INSERT INTO email_outbox (kind, recipient, subject, status, nextAttemptAt, lastError, createdAt) VALUES (?, ?, ?, 'skipped', ?, 'rate limited', ?)",
    ).run(kind, recipient, kind, now, now)
    log(`rate-limited ${kind} for ${maskEmail(recipient)}`)
    return { queued: false, reason: 'rate-limited' }
  }

  const email = renderEmail(kind, data)
  const info = db
    .prepare(
      'INSERT INTO email_outbox (kind, recipient, subject, html, text, nextAttemptAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(kind, recipient, email.subject, email.html, email.text, now, now)
  log(`queued ${kind} #${info.lastInsertRowid} for ${maskEmail(recipient)}`)
  kick()
  return { queued: true, id: Number(info.lastInsertRowid) }
}

async function sendDue() {
  const now = Date.now()
  const due = db
    .prepare(
      "SELECT id, kind, recipient, subject, html, text, attempts FROM email_outbox WHERE status IN ('queued','retrying') AND nextAttemptAt <= ? ORDER BY id LIMIT 20",
    )
    .all(now) as Row[]

  for (const row of due) {
    // Claim the row so a second worker (or a restart) cannot send it twice.
    const claimed = db
      .prepare("UPDATE email_outbox SET status = 'sending' WHERE id = ? AND status IN ('queued','retrying')")
      .run(row.id)
    if (!claimed.changes) continue

    try {
      await transport.send({ id: row.id, to: row.recipient, subject: row.subject, html: row.html, text: row.text })
      db.prepare(
        "UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, sentAt = ?, lastError = NULL, html = NULL, text = NULL WHERE id = ?",
      ).run(Date.now(), row.id)
      log(`sent ${row.kind} #${row.id} to ${maskEmail(row.recipient)} via ${transport.name}`)
    } catch (err) {
      const attempts = row.attempts + 1
      const reason = (err instanceof Error ? err.message : String(err)).slice(0, 300)
      if (attempts >= env.mail.maxAttempts) {
        db.prepare(
          "UPDATE email_outbox SET status = 'failed', attempts = ?, lastError = ?, html = NULL, text = NULL WHERE id = ?",
        ).run(attempts, reason, row.id)
        log(`gave up on ${row.kind} #${row.id} after ${attempts} attempts: ${reason}`)
      } else {
        const delay = Math.min(HOUR, BASE_DELAY * 4 ** (attempts - 1))
        db.prepare(
          "UPDATE email_outbox SET status = 'retrying', attempts = ?, lastError = ?, nextAttemptAt = ? WHERE id = ?",
        ).run(attempts, reason, Date.now() + delay, row.id)
        log(`retrying ${row.kind} #${row.id} in ${Math.round(delay / 1000)}s: ${reason}`)
      }
    }
  }

  // Housekeeping: old log rows go after 30 days.
  db.prepare('DELETE FROM email_outbox WHERE createdAt < ?').run(now - KEEP_LOG_FOR)
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
  db.prepare("UPDATE email_outbox SET status = 'retrying' WHERE status = 'sending'").run()
  timer ??= setInterval(() => void processOutbox().catch((err) => console.error('[mail] worker error', err)), intervalMs)
  timer.unref()
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
  return db
    .prepare(
      'SELECT id, kind, recipient, subject, status, attempts, lastError, createdAt, sentAt FROM email_outbox ORDER BY id DESC LIMIT ?',
    )
    .all(limit) as Array<Record<string, unknown>>
}
