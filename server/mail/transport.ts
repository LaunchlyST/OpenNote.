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
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' as const, ...(isIP(smtp.host) ? {} : { servername: smtp.host }) },
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
  if (!env.baseURL.startsWith('https://')) return `BETTER_AUTH_URL must be https:// in production (links would be sent as ${env.baseURL}).`
  return null
}

export function createTransport(): Transport {
  const problem = productionMailProblem()
  if (problem) return noTransport(problem)
  if (env.mail.transport === 'smtp' && env.smtp.host) return smtpTransport()
  if (!env.isProduction) return localTransport()
  return noTransport()
}
