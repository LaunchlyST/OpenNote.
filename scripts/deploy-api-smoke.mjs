/**
 * Checks the deployment API's safety properties without ever publishing.
 *
 * Run with: node scripts/deploy-api-smoke.mjs
 *
 * The important cases are the negative ones: that a browser with no session
 * cannot deploy, that a wrong passphrase is rejected, and that the kill switch
 * refuses even a fully authenticated administrator while `DEPLOY_ENABLED` is
 * unset. The one positive case points the deploy hook at a throwaway HTTP
 * server on localhost, so the real request path is exercised without touching
 * a hosting provider.
 */
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '')

let failures = 0
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Minimal stand-in for the Vercel request/response pair. */
function makeReq({ method = 'GET', body, cookie, headers = {} } = {}) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
  stream.method = method
  stream.headers = { host: 'localhost', ...(cookie ? { cookie } : {}), ...headers }
  return stream
}

function makeRes() {
  const headers = {}
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

async function call(handler, req) {
  const res = makeRes()
  await handler(req, res)
  return res
}

/** Runs `fn` with an exact set of deployment environment variables. */
async function withEnv(env, fn) {
  const keys = [
    'DEPLOY_PROVIDER',
    'DEPLOY_HOOK_URL',
    'DEPLOY_PRODUCTION_URL',
    'DEPLOY_ENABLED',
    'DEPLOY_ADMIN_PASSWORD',
    'SESSION_SECRET',
    'DEPLOY_ADMIN_EMAILS',
  ]
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  for (const k of keys) delete process.env[k]
  Object.assign(process.env, env)
  try {
    return await fn()
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

const PASSPHRASE = 'correct horse battery staple'
const SECRET = 'a'.repeat(64)

/* ------------------------------------------------------------------ */
/* A throwaway provider that stands in for Vercel's deploy hook         */
/* ------------------------------------------------------------------ */

const hookHits = []
const hook = createHttpServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    hookHits.push({ method: req.method, body: Buffer.concat(chunks).toString('utf8') })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
})
await new Promise((resolve) => hook.listen(0, '127.0.0.1', resolve))
const HOOK_URL = `http://127.0.0.1:${hook.address().port}/deploy-hook`

/* ------------------------------------------------------------------ */

const vite = await createServer({
  root,
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
})

const health = await vite.ssrLoadModule('/api/health.ts')
const session = await vite.ssrLoadModule('/api/session.ts')
const deploy = await vite.ssrLoadModule('/api/deploy.ts')

try {
  console.log('\n  Service is mounted')
  {
    const res = await call(health.default, makeReq())
    check('GET /api/health returns ok', res.statusCode === 200 && res.body.ok === true)
  }

  console.log('\n  Unconfigured server fails closed')
  await withEnv({}, async () => {
    const s = await call(session.default, makeReq())
    check(
      'GET /api/session reports no admin session',
      s.statusCode === 200 && s.body.authenticated === false && s.body.authConfigured === false,
    )

    const d = await call(deploy.default, makeReq())
    check('GET /api/deploy refuses without auth secrets', d.statusCode === 503)

    const p = await call(deploy.default, makeReq({ method: 'POST' }))
    check('POST /api/deploy refuses without auth secrets', p.statusCode === 401)
  })

  console.log('\n  Anonymous access is refused')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'vercel',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_PRODUCTION_URL: 'https://opennote.example.com',
      DEPLOY_ENABLED: 'true',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
    },
    async () => {
      const before = hookHits.length

      const d = await call(deploy.default, makeReq())
      check('GET /api/deploy is 401 without a session', d.statusCode === 401)

      const p = await call(deploy.default, makeReq({ method: 'POST' }))
      check('POST /api/deploy is 401 without a session', p.statusCode === 401)

      await delay(50)
      check('no deployment request reached the provider', hookHits.length === before, `${hookHits.length - before} hit(s)`)

      const forged = await call(
        deploy.default,
        makeReq({ method: 'POST', cookie: 'opennote_deploy_session=9999999999.abc.deadbeef' }),
      )
      check('a forged session cookie is rejected', forged.statusCode === 401)
    },
  )

  console.log('\n  Administrator authentication')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'vercel',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_PRODUCTION_URL: 'https://opennote.example.com',
      DEPLOY_ENABLED: 'false',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
    },
    async () => {
      const bad = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: 'wrong' } }),
      )
      check('a wrong passphrase is rejected', bad.statusCode === 401, `got ${bad.statusCode}`)

      const empty = await call(
        session.default,
        makeReq({ method: 'POST', body: {} }),
      )
      check('an empty passphrase is rejected', empty.statusCode === 401)

      const good = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: PASSPHRASE } }),
      )
      check('the correct passphrase is accepted', good.statusCode === 200 && good.body.authenticated === true)

      const cookie = good.headers['set-cookie']
      check('the session cookie is HttpOnly', String(cookie).includes('HttpOnly'))
      check('the session cookie is SameSite=Strict', String(cookie).includes('SameSite=Strict'))
      check('the session cookie is scoped to /', String(cookie).includes('Path=/'))
      check(
        'the session cookie does not carry the passphrase',
        !String(cookie).includes(PASSPHRASE),
      )

      const jar = String(cookie).split(';')[0]
      const me = await call(session.default, makeReq({ cookie: jar }))
      check('the issued cookie is accepted afterwards', me.body.authenticated === true)

      const out = await call(session.default, makeReq({ method: 'DELETE', cookie: jar }))
      check('signing out clears the cookie', String(out.headers['set-cookie']).includes('Max-Age=0'))

      const after = await call(session.default, makeReq({ cookie: `${jar}=; Max-Age=0` }))
      check('a cleared cookie no longer authenticates', after.body.authenticated === false)
    },
  )

  console.log('\n  Optional administrator email allowlist')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'vercel',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_ENABLED: 'true',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
      DEPLOY_ADMIN_EMAILS: 'owner@opennote.example',
    },
    async () => {
      const wrongAccount = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: PASSPHRASE, email: 'someone@else.com' } }),
      )
      check('a non-listed account is refused', wrongAccount.statusCode === 401)

      const listed = await call(
        session.default,
        makeReq({
          method: 'POST',
          body: { passphrase: PASSPHRASE, email: 'Owner@OpenNote.example' },
        }),
      )
      check('the listed account is accepted (case-insensitive)', listed.statusCode === 200)
    },
  )

  console.log('\n  The kill switch keeps publishing off')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'vercel',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_PRODUCTION_URL: 'https://opennote.example.com',
      DEPLOY_ENABLED: 'false',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
    },
    async () => {
      const login = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: PASSPHRASE } }),
      )
      const jar = String(login.headers['set-cookie']).split(';')[0]
      const before = hookHits.length

      const status = await call(deploy.default, makeReq({ cookie: jar }))
      check('status reports deployments switched off', status.body.enabled === false)
      check('status reports the provider connected', status.body.connected === true)
      check('status reports not ready while off', status.body.ready === false)
      check('status has never recorded a deployment', status.body.lastDeployment === null)

      const attempt = await call(deploy.default, makeReq({ method: 'POST', cookie: jar }))
      check('an authenticated deploy is refused while off', attempt.statusCode === 403, `got ${attempt.statusCode}`)

      await delay(50)
      check('nothing was sent to the provider', hookHits.length === before, `${hookHits.length - before} hit(s)`)
    },
  )

  console.log('\n  A real deployment request reaches the provider')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'vercel',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_PRODUCTION_URL: 'https://opennote.example.com',
      DEPLOY_ENABLED: 'true',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
    },
    async () => {
      const login = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: PASSPHRASE } }),
      )
      const jar = String(login.headers['set-cookie']).split(';')[0]

      const ok = await call(deploy.default, makeReq({ method: 'POST', cookie: jar }))
      check('an enabled, authenticated deploy is accepted', ok.statusCode === 202, `got ${ok.statusCode}`)
      check('the response confirms it is ready', ok.body.ready === true)
      check(
        'the last deployment is recorded',
        Boolean(ok.body.lastDeployment && ok.body.lastDeployment.accepted),
      )
      await delay(50)
      check('the provider received exactly one request', hookHits.length === 1, `${hookHits.length} hit(s)`)
      check(
        'the provider received a POST',
        hookHits[0]?.method === 'POST',
        String(hookHits[0]?.method),
      )
      check(
        'the request body identifies the source',
        String(hookHits[0]?.body).includes('opennote-admin'),
      )

      const again = await call(deploy.default, makeReq({ method: 'POST', cookie: jar }))
      check('a second deploy within a minute is throttled', again.statusCode === 429, `got ${again.statusCode}`)

      const read = await call(deploy.default, makeReq({ cookie: jar }))
      check('the recorded deployment is readable afterwards', Boolean(read.body.lastDeployment))
    },
  )

  console.log('\n  No secret ever reaches the browser')
  await withEnv(
    {
      DEPLOY_PROVIDER: 'cloudflare-pages',
      DEPLOY_HOOK_URL: HOOK_URL,
      DEPLOY_PRODUCTION_URL: 'https://opennote.example.com',
      DEPLOY_ENABLED: 'true',
      DEPLOY_ADMIN_PASSWORD: PASSPHRASE,
      SESSION_SECRET: SECRET,
    },
    async () => {
      const login = await call(
        session.default,
        makeReq({ method: 'POST', body: { passphrase: PASSPHRASE } }),
      )
      const jar = String(login.headers['set-cookie']).split(';')[0]
      const status = await call(deploy.default, makeReq({ cookie: jar }))
      const serialised = JSON.stringify(status.body)

      check('the status response does not leak the hook URL', !serialised.includes(HOOK_URL))
      check('the status response does not leak the passphrase', !serialised.includes(PASSPHRASE))
      check('the status response does not leak the session secret', !serialised.includes(SECRET))
      check('the provider label is reported', status.body.providerLabel === 'Cloudflare Pages')
      check('the production URL is reported', status.body.productionUrl === 'https://opennote.example.com')
      check('missing setup items are listed', Array.isArray(status.body.missing))
    },
  )
} finally {
  await vite.close()
  hook.close()
}

console.log(
  failures === 0
    ? '\nAll checks passed.'
    : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)