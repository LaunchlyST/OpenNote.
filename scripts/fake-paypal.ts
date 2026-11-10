/**
 * A tiny local stand-in for PayPal's REST API (orders v2, OAuth, webhook
 * verification), so the PayPal flow can be tested with no network and no
 * PayPal account. Behaves like the parts Desknoty uses:
 *
 *   POST /v1/oauth2/token                          client credentials
 *   POST /v2/checkout/orders                       create (idempotent per PayPal-Request-Id)
 *   GET  /v2/checkout/orders/:id                   read
 *   POST /v2/checkout/orders/:id/capture           capture (only after approve(); idempotent)
 *   POST /v1/notifications/verify-webhook-signature  SUCCESS only for signature "good-sig"
 *
 * Test helpers: approve(id) is the buyer clicking Pay on PayPal; tamper(id, …)
 * makes PayPal report a different amount or payee, to prove those are refused.
 */
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Obj = Record<string, any>
export interface FakePaypal {
  url: string
  orders: Map<string, Obj>
  captures: number
  approve(id: string, payerEmail?: string): void
  tamper(id: string, change: { value?: string; payee?: string }): void
  close(): Promise<void>
}

export function startFakePaypal(opts: { clientId: string; secret: string }): Promise<FakePaypal> {
  const orders = new Map<string, Obj>()
  const byRequest = new Map<string, Obj>()
  let n = 0
  let base = ''
  const state = { captures: 0 }
  const json = (res: ServerResponse, code: number, body: unknown) => (res.writeHead(code, { 'content-type': 'application/json' }), res.end(JSON.stringify(body)))

  async function handle(req: IncomingMessage, res: ServerResponse) {
    let body = ''
    for await (const c of req) body += c
    const p = new URL(req.url ?? '/', 'http://x').pathname
    if (p === '/v1/oauth2/token') {
      const want = `Basic ${Buffer.from(`${opts.clientId}:${opts.secret}`).toString('base64')}`
      if (req.headers.authorization !== want) return json(res, 401, { error: 'invalid_client' })
      return json(res, 200, { access_token: 'fake-access-token', expires_in: 3600 })
    }
    if (req.headers.authorization !== 'Bearer fake-access-token') return json(res, 401, { name: 'AUTHENTICATION_FAILURE' })
    const rid = String(req.headers['paypal-request-id'] ?? '')
    if (req.method === 'POST' && p === '/v2/checkout/orders') {
      if (rid && byRequest.has(rid)) return json(res, 201, byRequest.get(rid))
      const j = JSON.parse(body || '{}') as Obj
      const id = `PP${String(++n).padStart(6, '0')}${Date.now().toString(36).toUpperCase()}`
      const pu = j.purchase_units[0]
      const o: Obj = {
        id,
        status: 'CREATED',
        purchase_units: [{ reference_id: pu.reference_id, custom_id: pu.custom_id, amount: pu.amount, payee: { email_address: pu.payee.email_address, merchant_id: 'MERCHANT' + n } }],
        links: [{ rel: 'payer-action', href: `${base}/approve/${id}` }],
        _return: j.payment_source?.paypal?.experience_context?.return_url,
      }
      orders.set(id, o)
      if (rid) byRequest.set(rid, o)
      return json(res, 201, o)
    }
    let m = p.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)$/)
    if (req.method === 'GET' && m) return orders.has(m[1]) ? json(res, 200, orders.get(m[1])) : json(res, 404, { name: 'RESOURCE_NOT_FOUND' })
    m = p.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/)
    if (req.method === 'POST' && m) {
      const o = orders.get(m[1])
      if (!o) return json(res, 404, { name: 'RESOURCE_NOT_FOUND' })
      if (o.status === 'COMPLETED') return json(res, 422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] })
      if (o.status !== 'APPROVED') return json(res, 422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_NOT_APPROVED' }] })
      state.captures++
      o.status = 'COMPLETED'
      const pu = o.purchase_units[0]
      pu.payments = { captures: [{ id: `CAP${o.id}`, status: 'COMPLETED', amount: { ...pu.amount, ...(o._tamperValue ? { value: o._tamperValue } : {}) } }] }
      if (o._tamperPayee) pu.payee = { email_address: o._tamperPayee }
      return json(res, 201, o)
    }
    if (req.method === 'POST' && p === '/v1/notifications/verify-webhook-signature') {
      const j = JSON.parse(body || '{}') as Obj
      return json(res, 200, { verification_status: j.transmission_sig === 'good-sig' && j.webhook_id ? 'SUCCESS' : 'FAILURE' })
    }
    return json(res, 404, { name: 'NOT_FOUND', path: p })
  }

  return new Promise((resolve) => {
    const srv = createServer((req, res) => void handle(req, res).catch((e) => json(res, 500, { error: String(e) })))
    srv.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`
      resolve({
        url: base,
        orders,
        get captures() {
          return state.captures
        },
        approve(id, payerEmail = 'buyer@paypal.test') {
          const o = orders.get(id)!
          o.status = 'APPROVED'
          o.payer = { email_address: payerEmail }
        },
        tamper(id, change) {
          const o = orders.get(id)!
          if (change.value) o._tamperValue = change.value
          if (change.payee) o._tamperPayee = change.payee
        },
        close: () => new Promise((r) => srv.close(() => r())),
      })
    })
  })
}
