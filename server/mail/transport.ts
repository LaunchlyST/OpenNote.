import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../env.ts'

export interface OutgoingMessage {
  id: number
  to: string
  subject: string
  html: string
  text: string
}

export interface Transport {
  name: 'smtp' | 'local' | 'none'
  send(message: OutgoingMessage): Promise<void>
}

/** Delivers over SMTP: your own server, or the local catcher in development. */
/** Always verify the server's certificate (TLS 1.2+); optionally trust an extra CA. */
function tlsOptions() {
  const { smtp } = env
  return {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2' as const,
    ...(isIP(smtp.host) ? {} : { servername: smtp.host }),
    ...(smtp.caFile ? { ca: readFileSync(smtp.caFile, 'utf8') } : {}),
  }
}

export function smtpTransport(): Transport {
  const { smtp, mail } = env
  const dkim =
    mail.dkim.domain && mail.dkim.selector && mail.dkim.privateKeyPath
      ? {
          domainName: mail.dkim.domain,
          keySelector: mail.dkim.selector,
          privateKey: readFileSync(mail.dkim.privateKeyPath, 'utf8'),
        }
      : undefined

  const transporter: Transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure && smtp.requireTLS,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // Always verify the server's certificate; never accept old TLS.
    tls: tlsOptions(),
    ...(dkim ? { dkim } : {}),
  })

  return {
    name: 'smtp',
    async send(m) {
      await transporter.sendMail({
        from: smtp.from,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { 'X-OpenNote-Message': String(m.id) },
      })
    },
  }
}

/**
 * Development mailbox: each message becomes a JSON file under MAILBOX_DIR,
 * readable at /api/dev/mail. Nothing leaves the machine.
 */
export function localTransport(): Transport {
  return {
    name: 'local',
    async send(m) {
      mkdirSync(env.mail.mailboxDir, { recursive: true })
      const file = join(env.mail.mailboxDir, `${Date.now()}-${m.id}.json`)
      writeFileSync(file, JSON.stringify({ ...m, receivedAt: new Date().toISOString(), via: 'local' }, null, 2))
    },
  }
}

/** Production without a mail server: refuse loudly rather than drop silently. */
function noTransport(reason = 'No mail server configured (set SMTP_HOST).'): Transport {
  return {
    name: 'none',
    async send() {
      throw Object.assign(new Error(reason), { responseCode: 550 })
    },
  }
}

/**
 * Why production mail would be unsafe or fake, if it would be. Production
 * never falls back to the dev inbox or the local catcher, and never sends a
 * one-time link in clear text or over plain http.
 */
export function productionMailProblem(): string | null {
  if (!env.isProduction) return null
  if (env.mail.transport !== 'smtp' || !env.smtp.host) return 'Production has no mail server: set SMTP_HOST (the dev inbox is never used in production).'
  if (!env.smtp.secure && !env.smtp.requireTLS) return 'SMTP_REQUIRE_TLS=false is not allowed in production (that setting is only for the local catcher).'
  if (!env.smtp.from) return 'EMAIL_FROM is not set.'
  if (!env.baseURL.startsWith('https://')) return `BETTER_AUTH_URL must be https:// in production (links would be sent as ${env.baseURL}).`
  return null
}

/**
 * Mailbox providers (Gmail, Outlook) only send as the signed-in mailbox: a
 * different From is rewritten or rejected, and looks like spoofing.
 */
export function senderProblem(): string | null {
  const { host, user, from } = env.smtp
  if (!['smtp.gmail.com', 'smtp-mail.outlook.com', 'smtp.office365.com'].includes(host)) return null
  const addr = /<([^>]+)>/.exec(from)?.[1] ?? from.trim()
  if (user && addr.toLowerCase() !== user.toLowerCase()) {
    return `EMAIL_FROM (${addr}) must be the same address as SMTP_USER (${user}) when sending through ${host}.`
  }
  return null
}

/** Checks the SMTP login once, so a wrong password shows up at startup, not at the first sign-up. */
export async function verifySmtp(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (env.mail.transport !== 'smtp' || !env.smtp.host) return { ok: false, error: 'SMTP is not configured' }
  try {
    const { smtp } = env
    await nodemailer
      .createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: !smtp.secure && smtp.requireTLS,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        connectionTimeout: 10_000,
        tls: tlsOptions(),
      })
      .verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function createTransport(): Transport {
  const problem = productionMailProblem()
  if (problem) return noTransport(problem)
  if (env.mail.transport === 'smtp' && env.smtp.host) return smtpTransport()
  if (!env.isProduction) return localTransport()
  return noTransport()
}
