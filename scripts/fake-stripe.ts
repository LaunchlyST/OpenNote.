/**
 * A tiny local stand-in for the parts of the Stripe API that Seller Studio
 * uses, for tests only. The real Stripe SDK is pointed at it through
 * STRIPE_API_BASE (ignored in production), so the server code under test is
 * exactly the code that talks to Stripe.
 *
 * It also serves a fake hosted Checkout page (/pay/:id) and a fake hosted
 * onboarding page (/onboard/:account). "Pay" marks the session paid, sends a
 * correctly signed `checkout.session.completed` webhook to the API, then
 * redirects to the session's success_url, like Stripe does.
 *
 * Not a Stripe simulator: it accepts what the server sends and records it.
 */
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Stripe from 'stripe'

type Obj = Record<string, unknown>

function parseForm(body: string): Obj {
  const out: Obj = {}
  for (const [k, v] of new URLSearchParams(body)) {
    // a[b][c]=v → nested objects; a[0][b]=v → arrays as objects with numeric keys
    const path = k.replace(/\]/g, '').split('[')
    let cur = out as Obj
    path.forEach((p, i) => {
      if (i === path.length - 1) cur[p] = v
      else cur = (cur[p] ??= {}) as Obj
    })
  }
  return out
}

export interface FakeStripe {
  url: string
  accounts: Map<string, Obj>
  sessions: Map<string, Obj>
  calls: Array<{ method: string; path: string; account?: string; body: Obj }>
  /** Webhooks the fake hosted pages have sent, in order. */
  sent: Array<{ payload: string; header: string }>
  /** Seller finishes onboarding: 'ready' | 'pending' (verification) | 'incomplete'. */
  setAccount(id: string, state: 'ready' | 'pending' | 'incomplete'): Obj
  /** Buyer pays: marks the session paid and returns the signed webhook it would send. */
  pay(sessionId: string, email?: string): { payload: string; header: string }
  event(type: string, object: Obj, account?: string): { payload: string; header: string }
  /** Seller refunds a paid session: returns the signed charge.refunded webhook (full or partial). */
  refund(sessionId: string, amount?: number): { payload: string; header: string }
  close(): Promise<void>
}

export function startFakeStripe(opts: { webhookUrl: string; webhookSecret: string }): Promise<FakeStripe> {
  const accounts = new Map<string, Obj>()
  const sessions = new Map<string, Obj>()
  const intents = new Map<string, Obj>()
  const calls: FakeStripe['calls'] = []
  const sent: FakeStripe['sent'] = []
  const signer = new Stripe('sk_test_fake')
  let n = 0
  let base = ''

  const sign = (payload: string) => signer.webhooks.generateTestHeaderString({ payload, secret: opts.webhookSecret })
  const event = (type: string, object: Obj, account?: string) => {
    const payload = JSON.stringify({ id: `evt_${++n}_${Date.now()}`, object: 'event', type, account, data: { object } })
    return { payload, header: sign(payload) }
  }
  const send = (e: { payload: string; header: string }) =>
    (sent.push(e), fetch)(opts.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': e.header }, body: e.payload })

  const setAccount: FakeStripe['setAccount'] = (id, state) => {
    const a = accounts.get(id)!
    Object.assign(a, {
      details_submitted: state !== 'incomplete',
      charges_enabled: state === 'ready',
      payouts_enabled: state === 'ready',
      capabilities: { card_payments: state === 'ready' ? 'active' : 'inactive', transfers: state === 'ready' ? 'active' : 'inactive' },
      requirements: {
        currently_due: state === 'incomplete' ? ['external_account'] : [],
        past_due: [],
        pending_verification: state === 'pending' ? ['individual.verification.document'] : [],
        disabled_reason: state === 'ready' ? null : state === 'pending' ? 'requirements.pending_verification' : 'requirements.past_due',
      },
    })
    return a
  }
  const pay: FakeStripe['pay'] = (id, email = 'buyer@example.test') => {
    const s = sessions.get(id)!
    const pi = `pi_${id.slice(8)}`
    intents.set(pi, { id: pi, object: 'payment_intent', metadata: s._piMetadata ?? {}, _account: s._account })
    Object.assign(s, { payment_status: 'paid', status: 'complete', customer_details: { email }, payment_intent: pi })
    return event('checkout.session.completed', s, s._account as string)
  }
  const refund: FakeStripe['refund'] = (id, amount) => {
    const s = sessions.get(id)!
    const total = Number(s.amount_total)
    const refunded = amount ?? total
    const charge = { id: `ch_${id.slice(8)}`, object: 'charge', payment_intent: s.payment_intent, amount: total, amount_refunded: refunded, refunded: refunded >= total }
    return event('charge.refunded', charge, s._account as string)
  }

  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    let body = ''
    for await (const chunk of req) body += chunk
    const url = new URL(req.url ?? '/', base)
    const p = url.pathname
    const form = parseForm(body)
    const account = req.headers['stripe-account'] as string | undefined
    if (p.startsWith('/v1/') || p.startsWith('/v2/')) calls.push({ method: req.method ?? 'GET', path: p, account, body: form })

    if (req.method === 'POST' && p === '/v2/core/accounts') {
      const j = JSON.parse(body || '{}') as Obj
      calls[calls.length - 1].body = j
      const id = `acct_test${++n}`
      const a: Obj = { id, object: 'account', type: 'standard', email: j.contact_email, metadata: j.metadata }
      accounts.set(id, a)
      setAccount(id, 'incomplete')
      Object.assign(a, { details_submitted: false })
      return json(res, 200, a)
    }
    let m = p.match(/^\/v1\/accounts\/(acct_\w+)$/)
    if (req.method === 'GET' && m) return accounts.has(m[1]) ? json(res, 200, accounts.get(m[1])) : json(res, 404, { error: { message: 'No such account' } })
    m = p.match(/^\/v1\/accounts\/(acct_\w+)\/login_links$/)
    if (req.method === 'POST' && m) return json(res, 200, { object: 'login_link', url: `${base}/dashboard/${m[1]}` })
    if (req.method === 'POST' && p === '/v1/account_links') {
      return json(res, 200, { object: 'account_link', url: `${base}/onboard/${form.account}?return=${encodeURIComponent(String(form.return_url))}&refresh=${encodeURIComponent(String(form.refresh_url))}` })
    }
    if (req.method === 'POST' && p === '/v1/checkout/sessions') {
      if (!account || !accounts.has(account)) return json(res, 400, { error: { message: 'Missing or unknown Stripe-Account' } })
      const item = ((form.line_items as Obj)['0'] as Obj).price_data as Obj
      const id = `cs_test_${++n}${Date.now()}`
      const s: Obj = {
        id,
        object: 'checkout.session',
        url: `${base}/pay/${id}`,
        mode: form.mode,
        status: 'open',
        payment_status: 'unpaid',
        amount_total: Number(item.unit_amount),
        currency: item.currency,
        success_url: form.success_url,
        cancel_url: form.cancel_url,
        metadata: form.metadata,
        customer_details: null,
        _account: account,
        _name: (item.product_data as Obj).name,
        _piMetadata: ((form.payment_intent_data as Obj | undefined)?.metadata as Obj | undefined) ?? {},
      }
      sessions.set(id, s)
      return json(res, 200, s)
    }
    m = p.match(/^\/v1\/payment_intents\/(pi_\w+)$/)
    if (req.method === 'GET' && m) {
      const pi = intents.get(m[1])
      if (!pi || pi._account !== account) return json(res, 404, { error: { message: 'No such payment_intent' } })
      return json(res, 200, pi)
    }
    m = p.match(/^\/v1\/checkout\/sessions\/(cs_\w+)$/)
    if (req.method === 'GET' && m) {
      const s = sessions.get(m[1])
      if (!s || s._account !== account) return json(res, 404, { error: { message: 'No such checkout.session' } })
      return json(res, 200, s)
    }

    // ---- fake hosted pages (what a browser sees) ----
    m = p.match(/^\/pay\/(cs_\w+)$/)
    if (m && sessions.has(m[1])) {
      const s = sessions.get(m[1])!
      if (req.method === 'POST') {
        const action = new URLSearchParams(body).get('action')
        if (action === 'cancel') {
          res.writeHead(303, { location: String(s.cancel_url) })
          return res.end()
        }
        await send(pay(m[1], new URLSearchParams(body).get('email') || undefined))
        res.writeHead(303, { location: String(s.success_url).replace('{CHECKOUT_SESSION_ID}', m[1]) })
        return res.end()
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Test checkout</title>
<body style="font-family:system-ui;padding:24px"><p>TEST MODE · fake Stripe Checkout</p><h1>${s._name}</h1>
<p>${(Number(s.amount_total) / 100).toFixed(2)} ${String(s.currency).toUpperCase()}</p>
<form method="post"><input name="email" value="buyer@example.test"><p>Card 4242 4242 4242 4242</p>
<button name="action" value="pay">Pay</button> <button name="action" value="cancel">Back</button></form></body>`)
    }
    m = p.match(/^\/onboard\/(acct_\w+)$/)
    if (m) {
      const to = req.method === 'POST' ? url.searchParams.get('return') : null
      if (to) {
        setAccount(m[1], (new URLSearchParams(body).get('state') as 'ready') ?? 'ready')
        res.writeHead(303, { location: to })
        return res.end()
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(`<!doctype html><title>Test onboarding</title><body><p>TEST MODE · fake Stripe onboarding</p>
<form method="post"><button name="state" value="ready">Finish (ready)</button><button name="state" value="pending">Finish (verification pending)</button><button name="state" value="incomplete">Leave (incomplete)</button></form></body>`)
    }
    json(res, 404, { error: { message: `fake-stripe: no route ${req.method} ${p}` } })
  }

  return new Promise((resolve) => {
    const srv = createServer((req, res) => void handle(req, res).catch((e) => json(res, 500, { error: { message: String(e) } })))
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as { port: number }
      base = `http://127.0.0.1:${addr.port}`
      resolve({ url: base, accounts, sessions, calls, sent, setAccount, pay, refund, event, close: () => new Promise((r) => srv.close(() => r())) })
    })
  })
}

export const sendWebhook = (url: string, e: { payload: string; header: string }) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': e.header }, body: e.payload })
