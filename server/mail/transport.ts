import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
function noTransport(): Transport {
  return {
    name: 'none',
    async send() {
      throw new Error('No mail server configured (set SMTP_HOST).')
    },
  }
}

export function createTransport(): Transport {
  if (env.mail.transport === 'smtp' && env.smtp.host) return smtpTransport()
  if (!env.isProduction) return localTransport()
  return noTransport()
}
