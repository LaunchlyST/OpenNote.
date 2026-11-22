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
  charges: Map<string, Obj>
  disputes: Map<string, Obj>
  accounts: Map<string, Obj>
  sessions: Map<string, Obj>
  intents: Map<string, Obj>
  calls: Array<{ method: string; path: string; account?: string; body: Obj }>
  /** Webhooks the fake hosted pages have sent, in order. */
  sent: Array<{ payload: string; header: string }>
  /** Seller finishes onboarding: 'ready' | 'pending' (verification) | 'incomplete'. */
  setAccount(id: string, state: 'ready' | 'pending' | 'incomplete'): Obj
  /** Makes Checkout Session creation fail, as a real outage would. */
  failSessions(on: boolean): void
  /** Buyer pays: marks the session paid and returns the signed webhook it would send. */
  pay(sessionId: string, email?: string): { payload: string; header: string }
  /** The bank asks the buyer to authenticate (3-D Secure): the intent needs another step. */
  requireAction(intentId: string): Obj
  /** The buyer finishes authentication: marks the intent succeeded and returns its webhook. */
  succeedIntent(intentId: string, opts?: { email?: string }): { payload: string; header: string }
  /** The card is declined: keeps the intent retryable and returns its failed webhook. */
  failIntent(intentId: string, message?: string): { payload: string; header: string }
  /** The buyer abandons the payment: marks the intent canceled and returns its webhook. */
  cancelIntent(intentId: string): { payload: string; header: string }
  event(type: string, object: Obj, account?: string): { payload: string; header: string }
  close(): Promise<void>
}

export function startFakeStripe(opts: { webhookUrl: string; webhookSecret: string }): Promise<FakeStripe> {
  const charges = new Map<string, Obj>()
  const disputes = new Map<string, Obj>()
  const idempotent = new Map<string, Obj>()
  const accounts = new Map<string, Obj>()
  const sessions = new Map<string, Obj>()
  const intents = new Map<string, Obj>()
  const payouts: Obj[] = []
  const calls: FakeStripe['calls'] = []
  const sent: FakeStripe['sent'] = []
  let failSession = false
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

  const requireAction: FakeStripe['requireAction'] = (id) => {
    const pi = intents.get(id)!
    Object.assign(pi, { status: 'requires_action', next_action: { type: 'use_stripe_sdk', use_stripe_sdk: { type: 'three_d_secure_redirect' } } })
    return pi
  }
  const succeedIntent: FakeStripe['succeedIntent'] = (id, opts) => {
    const pi = intents.get(id)!
    Object.assign(pi, {
      status: 'succeeded',
      amount_received: pi.amount,
      receipt_email: opts?.email ?? pi.receipt_email ?? 'buyer@example.test',
      latest_charge: `ch_${id}`,
      next_action: null,
      last_payment_error: null,
    })
    charges.set(`ch_${id}`, { id: `ch_${id}`, payment_intent: id, amount_refunded: 0, disputed: false, amount: pi.amount, currency: pi.currency, _account: pi._account })
    return event('payment_intent.succeeded', pi, pi._account as string)
  }
  const failIntent: FakeStripe['failIntent'] = (id, message = 'Your card was declined.') => {
    const pi = intents.get(id)!
    Object.assign(pi, {
      status: 'requires_payment_method',
      amount_received: 0,
      last_payment_error: { code: 'card_declined', decline_code: 'generic_decline', message },
      next_action: null,
    })
    return event('payment_intent.payment_failed', pi, pi._account as string)
  }
  const cancelIntent: FakeStripe['cancelIntent'] = (id) => {
    const pi = intents.get(id)!
    Object.assign(pi, { status: 'canceled', canceled_at: Math.floor(Date.now() / 1000) })
    return event('payment_intent.canceled', pi, pi._account as string)
  }
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
    charges.set(`ch_${id}`, { id: `ch_${id}`, payment_intent: `pi_${id}`, amount_refunded: 0, disputed: false })
    Object.assign(s, { payment_intent: `pi_${id}`, payment_status: 'paid', status: 'complete', customer_details: { email } })
    return event('checkout.session.completed', s, s._account as string)
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

    const idem = String(req.headers['idempotency-key'] ?? '')
    if (idem && idempotent.has(idem)) return json(res, 200, idempotent.get(idem))
    if (req.method === 'POST' && p === '/v2/core/accounts') {
      const j = JSON.parse(body || '{}') as Obj
      calls[calls.length - 1].body = j
      const id = `acct_test${++n}`
      const a: Obj = { id, object: 'account', type: 'standard', email: j.contact_email, metadata: j.metadata }
      accounts.set(id, a)
      if (idem) idempotent.set(idem, a)
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
      if (failSession) return json(res, 500, { error: { message: 'The payment service is unavailable.' } })
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
      }
      sessions.set(id, s)
      if (idem) idempotent.set(idem, s)
      return json(res, 200, s)
    }
    m = p.match(/^\/v1\/checkout\/sessions\/(cs_\w+)$/)
    if (req.method === 'GET' && m) {
      const s = sessions.get(m[1])
      if (!s || s._account !== account) return json(res, 404, { error: { message: 'No such checkout.session' } })
      return json(res, 200, s)
    }

    // ---- PaymentIntents (the embedded card / wallet flow) ----
    if (req.method === 'POST' && p === '/v1/payment_intents') {
      if (!account || !accounts.has(account)) return json(res, 400, { error: { message: 'Missing or unknown Stripe-Account' } })
      const amount = Number(form.amount)
      if (!Number.isInteger(amount) || amount <= 0) return json(res, 400, { error: { message: 'Amount must be a positive integer' } })
      const id = `pi_test_${++n}${Date.now()}`
      const pi: Obj = {
        id, object: 'payment_intent', amount, amount_received: 0,
        currency: String(form.currency ?? 'gbp').toLowerCase(),
        status: 'requires_payment_method',
        client_secret: `${id}_secret_${Math.random().toString(36).slice(2)}`,
        description: form.description ?? null,
        receipt_email: form.receipt_email ?? null,
        metadata: form.metadata ?? {},
        automatic_payment_methods: form.automatic_payment_methods ?? null,
        last_payment_error: null, next_action: null, _account: account,
      }
      intents.set(id, pi)
      if (idem) idempotent.set(idem, pi)
      return json(res, 200, pi)
    }
    m = p.match(/^\/v1\/payment_intents\/(pi_\w+)$/)
    if (req.method === 'GET' && m) {
      const pi = intents.get(m[1])
      if (!pi || pi._account !== account) return json(res, 404, { error: { message: 'No such payment_intent' } })
      return json(res, 200, pi)
    }
    m = p.match(/^\/v1\/payment_intents\/(pi_\w+)\/confirm$/)
    if (req.method === 'POST' && m) {
      const pi = intents.get(m[1])
      if (!pi || pi._account !== account) return json(res, 404, { error: { message: 'No such payment_intent' } })
      Object.assign(pi, { status: 'succeeded', amount_received: pi.amount, last_payment_error: null, next_action: null })
      return json(res, 200, pi)
    }
    m = p.match(/^\/v1\/payment_intents\/(pi_\w+)\/cancel$/)
    if (req.method === 'POST' && m) {
      const pi = intents.get(m[1])
      if (!pi || pi._account !== account) return json(res, 404, { error: { message: 'No such payment_intent' } })
      if (pi.status === 'succeeded') return json(res, 400, { error: { message: 'PaymentIntent already succeeded' } })
      Object.assign(pi, { status: 'canceled', canceled_at: Math.floor(Date.now() / 1000) })
      return json(res, 200, pi)
    }
    // Two bank accounts on every connected account, for payout destinations.
    m = p.match(/^\/v1\/accounts\/(acct_\w+)\/external_accounts(?:\/(ba_\w+))?$/)
    if (req.method === 'GET' && m) {
      const banks = [
        { id: 'ba_test_revolut', object: 'bank_account', bank_name: 'Revolut', account_holder_name: 'Ava Makes', last4: '4877', routing_number: '040075', currency: 'gbp', default_for_currency: true },
        { id: 'ba_test_monzo', object: 'bank_account', bank_name: 'Monzo', account_holder_name: 'Ava Makes', last4: '1234', routing_number: '040004', currency: 'gbp', default_for_currency: false },
      ]
      if (m[2]) { const b = banks.find((x) => x.id === m![2]); return b ? json(res, 200, b) : json(res, 404, { error: { message: 'No such external account' } }) }
      return json(res, 200, { object: 'list', data: banks, has_more: false })
    }
    // Balance = paid checkouts on that account minus payouts already sent (all "available").
    if (req.method === 'GET' && p === '/v1/balance') {
      const by = new Map<string, number>()
      for (const x of sessions.values()) if (x._account === account && x.payment_status === 'paid') by.set(String(x.currency), (by.get(String(x.currency)) ?? 0) + Number(x.amount_total))
      for (const po of payouts) if (po._account === account) by.set(String(po.currency), (by.get(String(po.currency)) ?? 0) - Number(po.amount))
      return json(res, 200, { object: 'balance', available: [...by].map(([currency, amount]) => ({ currency, amount })), pending: [] })
    }
    if (p === '/v1/payouts') {
      if (req.method === 'GET') return json(res, 200, { object: 'list', data: payouts.filter((x) => x._account === account), has_more: false })
      const po: Obj = { id: `po_test_${++n}`, object: 'payout', amount: Number(form.amount), currency: form.currency, destination: form.destination ?? 'ba_test_revolut', status: 'pending', arrival_date: Math.floor(Date.now() / 1000) + 2 * 86400, _account: account }
      payouts.unshift(po)
      if (idem) idempotent.set(idem, po)
      return json(res, 200, po)
    }
    if (p.startsWith('/v1/charges/')) return json(res, 200, charges.get(p.split('/').pop()!) ?? {})
    if (p.startsWith('/v1/disputes/')) return json(res, 200, disputes.get(p.split('/').pop()!) ?? {})

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
      resolve({ url: base, charges, disputes, accounts, sessions, intents, calls, sent, setAccount, failSessions: (on) => { failSession = on }, pay, requireAction, succeedIntent, failIntent, cancelIntent, event, close: () => new Promise((r) => srv.close(() => r())) })
    })
  })
}

export const sendWebhook = (url: string, e: { payload: string; header: string }) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': e.header }, body: e.payload })
