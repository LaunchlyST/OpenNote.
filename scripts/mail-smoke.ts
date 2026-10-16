/**
 * Tests OpenNote's own email system without any outside service.
 *
 * Run with: npm run test:mail
 *
 * Covers the templates, the outbox (queueing, retries with backoff, giving up,
 * erasing one-time links after delivery, rate limiting, header-injection
 * refusal) and the real SMTP client path, delivered to OpenNote's built-in
 * loopback SMTP catcher. Nothing here reaches a real inbox.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { createServer as createTlsServer } from 'node:tls'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'opennote-mail-'))
process.env.NODE_ENV = 'test'
process.env.BETTER_AUTH_URL = 'http://localhost:5173'
process.env.BETTER_AUTH_SECRET = 'c'.repeat(64)
process.env.DATABASE_PATH = join(tmp, 'test.db')
process.env.MAILBOX_DIR = join(tmp, 'mailbox')
process.env.MAIL_RATE_PER_HOUR = '5'
process.env.MAIL_MAX_ATTEMPTS = '3'
process.env.SMTP_HOST = ''
process.env.EMAIL_FROM = 'OpenNote <no-reply@opennote.test>'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const { db, ensureAppTables } = await import('../server/db.ts')
ensureAppTables()
const { env } = await import('../server/env.ts')
const { renderEmail, enqueueEmail, processOutbox, setTransport, outboxLog, maskEmail } = await import('../server/mail/index.ts')
const { localTransport, smtpTransport, productionMailProblem, createTransport } = await import('../server/mail/transport.ts')
const { startSmtpCatcher } = await import('../server/mail/smtp-catcher.ts')
const { readMailbox } = await import('../server/mail/dev-inbox.ts')

const row = (id: number) =>
  db.prepare('SELECT status, attempts, html, text, lastError, nextAttemptAt FROM email_outbox WHERE id = ?').get(id) as {
    status: string
    attempts: number
    html: string | null
    text: string | null
    lastError: string | null
    nextAttemptAt: number
  }
const LINK = 'http://localhost:5173/api/auth/reset-password/TOKEN123?callbackURL=%2Fapp'

try {
  console.log('\n  Templates')
  {
    const reset = renderEmail('reset-password', { url: LINK, name: 'Sam <script>' })
    check('reset subject is branded', reset.subject === 'Reset your OpenNote password')
    check('HTML carries the OpenNote name', reset.html.includes('OpenNote'))
    check('HTML has the action link', reset.html.includes(LINK.replace(/&/g, '&#38;')))
    check('plain-text version has the link', reset.text.includes(LINK))
    check('user input is escaped (no HTML injection)', !reset.html.includes('<script>') && reset.html.includes('&#60;script&#62;'))
    check('says the link expires in one hour', reset.text.includes('one hour'))
    const verify = renderEmail('verify-email', { url: LINK })
    check('verification email has its own subject', verify.subject === 'Confirm your OpenNote email')
  }

  console.log('\n  Outbox → local dev inbox')
  {
    setTransport(localTransport())
    const r = enqueueEmail('reset-password', 'Sam@Example.com', { url: LINK, name: 'Sam' })
    check('a message is queued', r.queued)
    const id = r.queued ? r.id : 0
    check('it is queued, not sent inline', row(id).status === 'queued')
    await processOutbox()
    check('the worker marks it sent', row(id).status === 'sent')
    check('the body (with the one-time link) is erased after sending', row(id).html === null && row(id).text === null)
    const inbox = readMailbox()
    check('it arrives in the local inbox', inbox.length === 1 && inbox[0].to === 'sam@example.com')
    check('the delivery log never contains bodies or links', !JSON.stringify(outboxLog()).includes('TOKEN123'))
    check('emails are masked in logs', maskEmail('sam@example.com') === 's***@example.com')
  }

  console.log('\n  Retries and giving up')
  {
    let calls = 0
    setTransport({
      name: 'smtp',
      async send() {
        calls += 1
        throw new Error('451 temporary failure')
      },
    })
    const r = enqueueEmail('verify-email', 'retry@example.com', { url: LINK })
    const id = r.queued ? r.id : 0
    await processOutbox()
    const after1 = row(id)
    check('a failure is retried later, not dropped', after1.status === 'retrying' && after1.attempts === 1)
    check('the retry is scheduled ~30s out', after1.nextAttemptAt - Date.now() > 20_000)
    check('the error is logged', after1.lastError === '451 temporary failure')

    await processOutbox()
    check('it is not retried before it is due', calls === 1)

    db.prepare('UPDATE email_outbox SET nextAttemptAt = 0 WHERE id = ?').run(id)
    await processOutbox()
    const after2 = row(id)
    check('backoff grows (~2 minutes after the 2nd failure)', after2.attempts === 2 && after2.nextAttemptAt - Date.now() > 100_000)

    db.prepare('UPDATE email_outbox SET nextAttemptAt = 0 WHERE id = ?').run(id)
    await processOutbox()
    const after3 = row(id)
    check(`after ${env.mail.maxAttempts} attempts it is marked failed`, after3.status === 'failed' && after3.attempts === 3)
    check('a failed message has its body erased too', after3.html === null)

    setTransport({
      name: 'smtp',
      async send() {
        throw Object.assign(new Error('550 5.1.1 mailbox does not exist'), { responseCode: 550 })
      },
    })
    const perm = enqueueEmail('verify-email', 'gone@example.com', { url: LINK })
    await processOutbox()
    check('a permanent 5xx refusal is not retried', perm.queued && row(perm.id).status === 'failed' && row(perm.id).attempts === 1)

    setTransport({ name: 'smtp', async send() {} })
    const ok = enqueueEmail('verify-email', 'recover@example.com', { url: LINK })
    await processOutbox()
    check('a message that later succeeds is marked sent', ok.queued && row(ok.id).status === 'sent')
  }

  console.log('\n  Rate limiting and input safety')
  {
    setTransport({ name: 'smtp', async send() {} })
    const results = Array.from({ length: 7 }, () => enqueueEmail('reset-password', 'flood@example.com', { url: LINK }))
    check('the first 5 per hour are queued', results.slice(0, 5).every((r) => r.queued))
    check('the rest are refused as rate-limited', results.slice(5).every((r) => !r.queued && r.reason === 'rate-limited'))
    check('another address is unaffected', enqueueEmail('reset-password', 'other@example.com', { url: LINK }).queued)
    const inj = enqueueEmail('reset-password', 'a@example.com\r\nBcc: victim@example.com', { url: LINK })
    check('header injection in the address is refused', !inj.queued && inj.reason === 'invalid-recipient')
    const two = enqueueEmail('reset-password', 'a@example.com, b@example.com', { url: LINK })
    check('a list of addresses is refused', !two.queued)
  }

  console.log('\n  Real SMTP path → OpenNote SMTP catcher (loopback)')
  {
    const caught: Array<{ to: string[]; subject: string; html: string; text: string }> = []
    const server = await startSmtpCatcher({ port: 0, onMessage: (m) => caught.push(m) })
    const port = (server.address() as AddressInfo).port

    env.smtp.host = '127.0.0.1'
    env.smtp.port = port
    env.smtp.secure = false
    env.smtp.requireTLS = false
    setTransport(smtpTransport())
    const r = enqueueEmail('reset-password', 'smtp@example.com', { url: LINK, name: 'Sam' })
    await processOutbox()
    const mine = caught.filter((m) => m.to.join() === 'smtp@example.com')
    check('the SMTP server accepted the message', r.queued && row(r.id).status === 'sent', r.queued ? String(row(r.id).lastError) : '')
    check('exactly one message reached that recipient', mine.length === 1)
    check('the subject survived SMTP encoding', mine[0]?.subject === 'Reset your OpenNote password', mine[0]?.subject)
    check('the HTML part arrived intact', Boolean(mine[0]?.html.includes('Choose a new password')))
    check('the plain-text part has the link', Boolean(mine[0]?.text.includes(LINK)))

    // With TLS required (the default), a server without STARTTLS is refused —
    // OpenNote never falls back to sending a reset link in clear text.
    env.smtp.requireTLS = true
    setTransport(smtpTransport())
    const t = enqueueEmail('reset-password', 'tls@example.com', { url: LINK })
    await processOutbox()
    check('without STARTTLS the send is refused (TLS is enforced)', t.queued && ['retrying', 'failed'].includes(row(t.id).status) && !caught.some((m) => m.to.join() === 'tls@example.com'), t.queued ? row(t.id).status : '')
    server.close()
  }

  console.log('\n  Certificate validation')
  {
    // A mail server presenting a self-signed (untrusted) certificate must be refused.
    const key = join(tmp, 'k.pem')
    const cert = join(tmp, 'c.pem')
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=evil.mail.test'], { stdio: 'ignore' })
    let handshakes = 0
    const fake = createTlsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (sock) => {
      handshakes += 1
      sock.write('220 fake ESMTP\r\n')
    })
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()))
    env.smtp.host = '127.0.0.1'
    env.smtp.port = (fake.address() as AddressInfo).port
    env.smtp.secure = true
    setTransport(smtpTransport())
    const r = enqueueEmail('reset-password', 'cert@example.com', { url: LINK })
    await processOutbox()
    const st = r.queued ? row(r.id) : null
    check('an untrusted certificate is refused (nothing sent)', st?.status !== 'sent', `${st?.status}: ${st?.lastError}`)
    check('the refusal names the certificate problem', /certificate|self[- ]signed/i.test(st?.lastError ?? ''), st?.lastError ?? '')
    check('no SMTP conversation took place over the untrusted link', handshakes === 0)
    fake.close()
    env.smtp.secure = false
  }

  console.log('\n  Production never fakes delivery')
  {
    const saved = { ...env.smtp, isProd: env.isProduction, base: env.baseURL, transport: env.mail.transport }
    env.isProduction = true
    env.baseURL = 'https://app.opennote.test'
    env.mail.transport = 'local'
    env.smtp.host = ''
    check('production without SMTP_HOST is reported', /no mail server/i.test(productionMailProblem() ?? ''))
    check('production never uses the dev inbox', createTransport().name === 'none')
    env.mail.transport = 'smtp'
    env.smtp.host = '127.0.0.1'
    env.smtp.requireTLS = false
    env.smtp.secure = false
    check('production refuses the plaintext local-catcher setting', /SMTP_REQUIRE_TLS/.test(productionMailProblem() ?? '') && createTransport().name === 'none')
    env.smtp.requireTLS = true
    env.baseURL = 'http://app.opennote.test'
    check('production refuses http:// links', /https/.test(productionMailProblem() ?? ''))
    env.baseURL = 'https://app.opennote.test'
    check('a correct production setup has no problems', productionMailProblem() === null && createTransport().name === 'smtp')
    setTransport(createTransport())
    env.mail.transport = 'local'
    env.smtp.host = ''
    setTransport(createTransport())
    const r = enqueueEmail('reset-password', 'prod@example.com', { url: LINK })
    await processOutbox()
    check('a misconfigured production email is marked failed, not silently dropped', r.queued && row(r.id).status === 'failed', r.queued ? row(r.id).status : '')
    Object.assign(env.smtp, saved)
    env.isProduction = saved.isProd
    env.baseURL = saved.base
    env.mail.transport = saved.transport
  }

  console.log('\n  Secrets stay on the server')
  {
    const dist = 'dist/assets'
    if (existsSync(dist)) {
      const bundle = readdirSync(dist).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, f), 'utf8')).join('')
      check('the browser bundle mentions no SMTP settings', !/SMTP_PASS|SMTP_USER|smtp\.pass|DKIM_PRIVATE/.test(bundle))
    } else {
      console.log('  SKIP  browser bundle check (run npm run build first)')
    }
  }
} finally {
  db.close()
  rmSync(tmp, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
