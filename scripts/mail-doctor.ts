/**
 * Delivery diagnostics for OpenNote's email: checks the configuration, the
 * DNS that Gmail and Outlook look at, the SMTP connection, and whether this
 * machine can reach the outside world on port 25.
 *
 *   npm run mail:doctor                 # checks only, sends nothing
 *   npm run mail:doctor -- --send you@gmail.com   # also sends one real test
 *
 * Prints PASS / WARN / FAIL lines and never prints passwords or keys.
 */
import { createPublicKey } from 'node:crypto'
import { promises as dns } from 'node:dns'
import { existsSync, readFileSync } from 'node:fs'
import { Socket } from 'node:net'
import nodemailer from 'nodemailer'
import { env } from '../server/env.ts'
import { renderEmail } from '../server/mail/templates.ts'
import { smtpTransport } from '../server/mail/transport.ts'

let fails = 0
const pass = (m: string) => console.log(`  PASS  ${m}`)
const warn = (m: string) => console.log(`  WARN  ${m}`)
const fail = (m: string) => {
  fails += 1
  console.log(`  FAIL  ${m}`)
}
const txt = async (name: string) => (await dns.resolveTxt(name).catch(() => [] as string[][])).map((r) => r.join(''))

function reachable(host: string, port: number, ms = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new Socket()
    const done = (ok: boolean) => {
      s.destroy()
      resolve(ok)
    }
    s.setTimeout(ms, () => done(false))
    s.once('error', () => done(false))
    s.connect(port, host, () => done(true))
  })
}

const fromDomain = /@([^>\s]+)>?\s*$/.exec(env.smtp.from)?.[1]?.toLowerCase() ?? ''

console.log('\n  Configuration')
env.smtp.host ? pass(`SMTP_HOST is set (${env.smtp.host}:${env.smtp.port})`) : fail('SMTP_HOST is empty — mail only goes to the local dev inbox')
fromDomain ? pass(`EMAIL_FROM domain: ${fromDomain}`) : fail('EMAIL_FROM is missing or has no domain')
if (/(^|\.)(example\.(com|org|net)|yourdomain\.com|localhost|local|test)$/.test(fromDomain)) fail(`${fromDomain} is a placeholder — real inboxes will reject it`)
if (/(^|\.)(gmail|outlook|hotmail|yahoo|icloud)\.com$/.test(fromDomain)) fail(`You cannot send as ${fromDomain} from your own server — Gmail/Outlook DMARC will reject it. Use your own domain.`)
env.baseURL.startsWith('https://') ? pass(`BETTER_AUTH_URL is https (${env.baseURL}) — reset links use it`) : warn(`BETTER_AUTH_URL is ${env.baseURL} — fine locally, must be your https domain in production`)
env.smtp.requireTLS || env.smtp.secure ? pass('TLS is required for SMTP') : warn('SMTP_REQUIRE_TLS=false — only acceptable for the local catcher')

if (fromDomain && !/\.(local|test)$/.test(fromDomain)) {
  console.log(`\n  DNS for ${fromDomain}`)
  const mx = await dns.resolveMx(fromDomain).catch(() => [])
  mx.length ? pass(`MX: ${mx.map((m) => m.exchange).join(', ')}`) : warn('no MX record (needed to receive bounces/replies)')

  const spf = (await txt(fromDomain)).find((r) => r.startsWith('v=spf1'))
  spf ? pass(`SPF: ${spf}`) : fail('no SPF record')

  const dmarc = (await txt(`_dmarc.${fromDomain}`)).find((r) => r.startsWith('v=DMARC1'))
  dmarc ? pass(`DMARC: ${dmarc}`) : fail('no DMARC record — Gmail requires one for bulk senders and scores without it')

  const sel = env.mail.dkim.selector || 'opennote'
  const dkim = (await txt(`${sel}._domainkey.${fromDomain}`)).find((r) => r.includes('p='))
  if (!dkim) fail(`no DKIM record at ${sel}._domainkey.${fromDomain}`)
  else {
    pass(`DKIM record found for selector "${sel}"`)
    if (env.mail.dkim.privateKeyPath && existsSync(env.mail.dkim.privateKeyPath)) {
      const local = createPublicKey(readFileSync(env.mail.dkim.privateKeyPath, 'utf8')).export({ type: 'spki', format: 'der' }).toString('base64')
      dkim.replace(/\s/g, '').includes(`p=${local}`) ? pass('DKIM DNS key matches OpenNote\'s private key') : fail('DKIM DNS key does NOT match DKIM_PRIVATE_KEY_PATH')
    }
  }

  if (env.smtp.host && !['127.0.0.1', 'localhost'].includes(env.smtp.host)) {
    const addrs = await dns.resolve4(env.smtp.host).catch(() => [])
    for (const a of addrs) {
      const ptr = await dns.reverse(a).catch(() => [])
      ptr.length ? pass(`reverse DNS for ${a}: ${ptr.join(', ')}`) : fail(`no reverse DNS (PTR) for ${a} — set it at your server provider`)
    }
  }
}

console.log('\n  Connectivity')
if (env.smtp.host) {
  try {
    await nodemailer
      .createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, requireTLS: !env.smtp.secure && env.smtp.requireTLS, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined, connectionTimeout: 8000 })
      .verify()
    pass(`connected to ${env.smtp.host}:${env.smtp.port}${env.smtp.user ? ' and logged in' : ''}`)
  } catch (err) {
    fail(`SMTP connection failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
const gmailMx = (await dns.resolveMx('gmail.com').catch(() => [])).sort((a, b) => a.priority - b.priority)[0]?.exchange
if (!gmailMx) warn('cannot resolve gmail.com MX from here (no outside DNS) — run this on the mail server')
else (await reachable(gmailMx, 25)) ? pass('this machine can reach Gmail on port 25') : warn('outbound port 25 is blocked from this machine — your mail server host must allow it')

const to = process.argv.includes('--send') ? process.argv[process.argv.indexOf('--send') + 1] : ''
if (to) {
  console.log(`\n  Real send to ${to}`)
  try {
    const email = renderEmail('test', { url: `${env.baseURL}/app` })
    await smtpTransport().send({ id: 0, to, ...email })
    pass(`accepted by ${env.smtp.host}. Delivery is only confirmed once it appears in ${to} — open it and use "Show original" to check SPF/DKIM/DMARC = PASS.`)
  } catch (err) {
    fail(`send failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log(fails ? `\n${fails} problem(s) to fix before real inboxes will accept OpenNote mail.` : '\nNo blocking problems found.')
process.exit(fails ? 1 : 0)
