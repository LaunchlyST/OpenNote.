import nodemailer from 'nodemailer'
import { env, smtpConfigured } from './env.ts'

const transport = smtpConfigured
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** A plain, branded transactional email with one action button. */
function render(heading: string, body: string, action: string, url: string) {
  const safeUrl = escapeHtml(url)
  return `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#141a26">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
  <tr><td style="font-size:18px;font-weight:600;padding-bottom:16px">OpenNote</td></tr>
  <tr><td style="font-size:22px;font-weight:600;padding-bottom:8px">${escapeHtml(heading)}</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#4a5265;padding-bottom:24px">${escapeHtml(body)}</td></tr>
  <tr><td><a href="${safeUrl}" style="display:inline-block;background:#141a26;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(action)}</a></td></tr>
  <tr><td style="font-size:12px;color:#8a94a7;padding-top:24px">If the button does not work, paste this link into your browser:<br>${safeUrl}</td></tr>
  </table></td></tr></table></body></html>`
}

export async function sendActionEmail(opts: {
  to: string
  subject: string
  heading: string
  body: string
  action: string
  url: string
}) {
  if (!transport) {
    if (env.isProduction) {
      // Never print live tokens into production logs.
      console.error(`[mail] SMTP is not configured — could not send "${opts.subject}" to ${opts.to}.`)
    } else {
      console.info(`\n[mail:dev] SMTP not configured. "${opts.subject}" for ${opts.to}:\n  ${opts.url}\n`)
    }
    return
  }
  await transport.sendMail({
    from: env.smtp.from,
    to: opts.to,
    subject: opts.subject,
    text: `${opts.heading}\n\n${opts.body}\n\n${opts.action}: ${opts.url}`,
    html: render(opts.heading, opts.body, opts.action, opts.url),
  })
}
