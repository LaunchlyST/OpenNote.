/**
 * Runs OpenNote's local SMTP catcher so the server's real SMTP code path can
 * be tested without any outside email service.
 *
 *   npm run mail:catcher
 *
 * Then in .env:  SMTP_HOST=127.0.0.1  SMTP_PORT=2525  SMTP_REQUIRE_TLS=false
 *                EMAIL_FROM="OpenNote <no-reply@opennote.local>"
 * and open http://localhost:5173/api/dev/mail to read what arrived.
 */
import { env } from '../server/env.ts'
import { startSmtpCatcher } from '../server/mail/smtp-catcher.ts'

const port = Number(process.env.CATCHER_PORT ?? 2525)
await startSmtpCatcher({
  port,
  mailboxDir: env.mail.mailboxDir,
  onMessage: (m) => console.log(`  caught: "${m.subject}" → ${m.to.join(', ')}`),
})
console.log(`OpenNote SMTP catcher listening on 127.0.0.1:${port} (loopback only).`)
console.log(`Messages are saved to ${env.mail.mailboxDir} and shown at http://localhost:5173/api/dev/mail`)
