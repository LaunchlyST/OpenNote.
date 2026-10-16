/**
 * Sends one test email right now through whatever .env configures, and says
 * honestly where it went.
 *
 *   npm run mail:test -- you@example.com
 *
 * - No SMTP_HOST: written to the local dev inbox (never leaves this computer).
 * - SMTP_HOST=127.0.0.1 + the catcher: goes over real SMTP to the local catcher.
 * - SMTP_HOST=<your mail server>: handed to that server. "Accepted" means the
 *   server took it — check the real inbox (and spam) to confirm delivery.
 */
import { env } from '../server/env.ts'
import { renderEmail } from '../server/mail/templates.ts'
import { createTransport } from '../server/mail/transport.ts'

const to = process.argv[2]?.trim()
if (!to) {
  console.error('Usage: npm run mail:test -- you@example.com')
  process.exit(1)
}

const transport = createTransport()
const email = renderEmail('test', { url: `${env.baseURL}/app` })
const where =
  transport.name === 'local'
    ? `the local dev inbox (${env.mail.mailboxDir}) — open http://localhost:5173/api/dev/mail`
    : `${env.smtp.host}:${env.smtp.port}`

console.log(`Sending a test email to ${to} via ${where}…`)
try {
  await transport.send({ id: 0, to, ...email })
  if (transport.name === 'local') {
    console.log('  Saved to the local dev inbox. This is a LOCAL test: nothing was sent to a real inbox.')
  } else if (['127.0.0.1', 'localhost', '::1'].includes(env.smtp.host)) {
    console.log('  Accepted by the local SMTP server. This is a LOCAL test: nothing was sent to a real inbox.')
  } else {
    console.log(`  Accepted by ${env.smtp.host}. Now check ${to} (and its spam folder) to confirm real delivery.`)
  }
} catch (err) {
  console.error(`  Failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
