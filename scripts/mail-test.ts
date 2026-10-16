/**
 * Sends one real test email through the SMTP settings in .env, so you can
 * confirm delivery before relying on password reset emails.
 *
 *   npm run mail:test -- you@example.com
 *
 * Prints whether the SMTP server accepted the login and the message. It never
 * prints the password.
 */
import nodemailer from 'nodemailer'
import { env, smtpConfigured } from '../server/env.ts'
import { sendActionEmail } from '../server/mail.ts'

const to = process.argv[2]?.trim()
if (!to) {
  console.error('Usage: npm run mail:test -- you@example.com')
  process.exit(1)
}

const missing = [
  !env.smtp.host && 'SMTP_HOST',
  !env.smtp.user && 'SMTP_USER',
  !env.smtp.pass && 'SMTP_PASS',
  !env.smtp.from && 'EMAIL_FROM',
].filter(Boolean)
if (!smtpConfigured || missing.length) {
  console.error(`SMTP is not configured. Missing in .env: ${missing.join(', ') || 'SMTP_HOST / EMAIL_FROM'}`)
  process.exit(1)
}

console.log(`Connecting to ${env.smtp.host}:${env.smtp.port} as ${env.smtp.user}…`)
try {
  await nodemailer
    .createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
    .verify()
  console.log('  Login accepted.')

  await sendActionEmail({
    to,
    subject: 'OpenNote test email',
    heading: 'Your email setup works',
    body: 'This is a test from your OpenNote server. Password reset and verification emails will be sent the same way. You can ignore this message.',
    action: 'Open OpenNote',
    url: `${env.baseURL}/app`,
  })
  console.log(`  Sent to ${to}. Check the inbox (and the spam folder).`)
} catch (err) {
  console.error(`  Failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
