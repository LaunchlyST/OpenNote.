/**
 * Desknoty's transactional email templates.
 *
 * Table-based HTML with inline styles (what every mail client renders the
 * same), a plain-text twin for clients that block HTML, and a hidden preheader
 * for the inbox preview line. Every value that reaches the HTML is escaped.
 */

export type EmailKind = 'reset-password' | 'verify-email' | 'test'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const BRAND = {
  ink: '#191919',
  body: '#4a4a46',
  muted: '#8f8e8a',
  line: '#ececea',
  paper: '#f7f7f5',
  lime: '#bef264',
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** The Desknoty calendar mark, drawn with tables so it survives Outlook. */
function logo(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:28px;height:28px;border:1.5px solid ${BRAND.ink};border-radius:7px;border-top-width:7px;text-align:center;font:600 12px/18px Inter,Segoe UI,Arial,sans-serif;color:${BRAND.ink}">✓</td>
    <td style="padding-left:10px;font:600 17px/1 Inter,Segoe UI,Arial,sans-serif;color:${BRAND.ink};letter-spacing:-0.02em">Desknoty</td>
  </tr></table>`
}

function layout(opts: {
  preheader: string
  heading: string
  paragraphs: string[]
  action: string
  url: string
  footnote: string
}): string {
  const url = esc(opts.url)
  const font = 'Inter,Segoe UI,Helvetica,Arial,sans-serif'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper}"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="padding:0 4px 20px">${logo()}</td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px;padding:32px">
      <h1 style="margin:0 0 12px;font:600 22px/1.3 ${font};color:${BRAND.ink};letter-spacing:-0.02em">${esc(opts.heading)}</h1>
      ${opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font:400 15px/1.6 ${font};color:${BRAND.body}">${esc(p)}</p>`).join('')}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>
        <td style="border-radius:10px;background:${BRAND.ink}">
          <a href="${url}" style="display:inline-block;padding:12px 22px;font:600 15px/1 ${font};color:#ffffff;text-decoration:none;border-radius:10px">${esc(opts.action)}</a>
        </td></tr></table>
      <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid ${BRAND.line};font:400 12px/1.6 ${font};color:${BRAND.muted}">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="${url}" style="color:${BRAND.muted};word-break:break-all">${url}</a>
      </p>
    </td></tr>
    <tr><td style="padding:18px 4px 0;font:400 12px/1.6 ${font};color:${BRAND.muted}">${esc(opts.footnote)}</td></tr>
  </table>
</td></tr></table>
</body></html>`
}

function text(heading: string, paragraphs: string[], action: string, url: string, footnote: string): string {
  return [`Desknoty`, '', heading, '', ...paragraphs.flatMap((p) => [p, '']), `${action}:`, url, '', '—', footnote].join('\n')
}

export function renderEmail(kind: EmailKind, data: { url: string; name?: string }): RenderedEmail {
  const hello = data.name ? `Hi ${data.name},` : 'Hi,'
  const footnote = 'You received this email because of activity on your Desknoty account. Desknoty will never ask for your password by email.'

  const spec = {
    'reset-password': {
      subject: 'Reset your Desknoty password',
      preheader: 'Use this link within one hour to choose a new password.',
      heading: 'Reset your password',
      paragraphs: [
        hello,
        'We received a request to reset the password for your Desknoty account. The link below works once and expires in one hour.',
        "If you didn't ask for this, you can safely ignore this email — your password won't change.",
      ],
      action: 'Choose a new password',
    },
    'verify-email': {
      subject: 'Confirm your Desknoty email',
      preheader: 'One click to finish setting up your Desknoty account.',
      heading: 'Confirm your email address',
      paragraphs: [hello, 'Thanks for signing up for Desknoty. Confirm your email address to finish creating your account.'],
      action: 'Confirm email',
    },
    test: {
      subject: 'Desknoty test email',
      preheader: 'Your Desknoty email setup is working.',
      heading: 'Your email setup works',
      paragraphs: ['This is a test from your Desknoty server. Password reset and verification emails are sent the same way.'],
      action: 'Open Desknoty',
    },
  }[kind]

  return {
    subject: spec.subject,
    html: layout({ ...spec, url: data.url, footnote }),
    text: text(spec.heading, spec.paragraphs, spec.action, data.url, footnote),
  }
}
