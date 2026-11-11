/**
 * Payment methods besides Stripe: PayPal (Sandbox) and direct bank transfer.
 *
 * PayPal: the platform's own PayPal REST app (PAYPAL_CLIENT_ID /
 * PAYPAL_CLIENT_SECRET) creates an order whose payee is the seller's PayPal
 * account, so the money goes straight to the seller. An order is only marked
 * paid after the server itself captures (or re-reads) the PayPal order and
 * checks: completed capture, our order id, the seller's account, the exact
 * amount and currency. What the buyer's browser says is never trusted.
 *
 * Bank transfer: the seller's own details, a unique reference per order, and
 * only the seller can confirm the money arrived. The buyer saying "I've paid"
 * is recorded but never unlocks anything.
 */
import { createHash } from 'node:crypto'

/* --------------------------------------------------------- settings --- */

export interface PaymentSettings {
  stripe: { enabled: boolean }
  paypal: { enabled: boolean; email: string }
  bank: {
    enabled: boolean
    /** The seller's bank, as they named it (e.g. Revolut). */
    bankName: string
    accountName: string
    sortCode: string
    accountNumber: string
    iban: string
    bic: string
    instructions: string
  }
  /** Every bank account the seller saved. `bank` above is the one buyers pay into. */
  savedBanks: SavedBank[]
}
export type SavedBank = Omit<PaymentSettings['bank'], 'enabled'>
const BANK_FIELDS = ['bankName', 'accountName', 'sortCode', 'accountNumber', 'iban', 'bic', 'instructions'] as const
const pickBank = (b: PaymentSettings['bank'] | SavedBank): SavedBank => Object.fromEntries(BANK_FIELDS.map((k) => [k, b[k] ?? ''])) as SavedBank
const sameBank = (a: SavedBank, b: SavedBank) => (a.iban && a.iban === b.iban) || (Boolean(a.accountNumber) && a.accountNumber === b.accountNumber && a.sortCode === b.sortCode)

export const defaultPayments = (): PaymentSettings => ({
  stripe: { enabled: true },
  paypal: { enabled: false, email: '' },
  bank: { enabled: false, bankName: '', accountName: '', sortCode: '', accountNumber: '', iban: '', bic: '', instructions: '' },
  savedBanks: [],
})

export function readPayments(raw: string | null | undefined): PaymentSettings {
  const d = defaultPayments()
  if (!raw) return d
  try {
    const j = JSON.parse(raw) as Partial<PaymentSettings>
    const out: PaymentSettings = {
      stripe: { ...d.stripe, ...(j.stripe ?? {}) },
      paypal: { ...d.paypal, ...(j.paypal ?? {}) },
      bank: { ...d.bank, ...(j.bank ?? {}) },
      savedBanks: Array.isArray(j.savedBanks) ? j.savedBanks.slice(0, 10).map((x) => pickBank(x as SavedBank)) : [],
    }
    // older stores saved just one account: it becomes the first saved one
    if (!out.savedBanks.length && bankComplete(out)) out.savedBanks = [pickBank(out.bank)]
    return out
  } catch {
    return d
  }
}

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validates what the seller sent. Returns the clean settings or an error message. */
export function cleanPayments(input: unknown, current: PaymentSettings): PaymentSettings | string {
  const b = (input ?? {}) as Record<string, Record<string, unknown> | undefined>
  const next: PaymentSettings = JSON.parse(JSON.stringify(current))
  if (b.stripe) next.stripe.enabled = Boolean(b.stripe.enabled)
  if (b.paypal) {
    next.paypal.enabled = Boolean(b.paypal.enabled)
    if ('email' in b.paypal) next.paypal.email = str(b.paypal.email, 254).toLowerCase()
    if (next.paypal.email && !EMAIL.test(next.paypal.email)) return 'Enter the email address of your PayPal account.'
    if (next.paypal.enabled && !next.paypal.email) return 'Add your PayPal account email before turning PayPal on.'
  }
  if (b.bank) {
    const k = b.bank
    next.bank.enabled = Boolean(k.enabled)
    if ('bankName' in k) next.bank.bankName = str(k.bankName, 60)
    if ('accountName' in k) next.bank.accountName = str(k.accountName, 80)
    if ('sortCode' in k) next.bank.sortCode = str(k.sortCode, 8).replace(/[^\d]/g, '').replace(/^(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3')
    if ('accountNumber' in k) next.bank.accountNumber = str(k.accountNumber, 12).replace(/\s/g, '')
    if ('iban' in k) next.bank.iban = str(k.iban, 42).replace(/\s/g, '').toUpperCase()
    if ('bic' in k) next.bank.bic = str(k.bic, 11).replace(/\s/g, '').toUpperCase()
    if ('instructions' in k) next.bank.instructions = str(k.instructions, 300)
    if (next.bank.sortCode && !/^\d{2}-\d{2}-\d{2}$/.test(next.bank.sortCode)) return 'A sort code has 6 digits, e.g. 12-34-56.'
    if (next.bank.accountNumber && !/^\d{6,10}$/.test(next.bank.accountNumber)) return 'An account number has 6 to 10 digits.'
    if (next.bank.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(next.bank.iban)) return 'That IBAN doesn’t look right.'
    if (next.bank.bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(next.bank.bic)) return 'A BIC/SWIFT code has 8 or 11 characters.'
    if (next.bank.enabled && !bankComplete(next)) return 'Add the account name and either a sort code and account number or an IBAN before turning bank transfer on.'
    // remember it in the list (updating the same account rather than adding it twice)
    if (bankComplete(next)) {
      const saved = pickBank(next.bank)
      const i = next.savedBanks.findIndex((x) => sameBank(x, saved))
      if (i >= 0) next.savedBanks[i] = saved
      else if (next.savedBanks.length >= 10) return 'You can save up to 10 bank accounts. Remove one first.'
      else next.savedBanks.push(saved)
    }
  }
  // choose which saved account buyers pay into
  const use = (input as { useBank?: unknown })?.useBank
  if (typeof use === 'number') {
    const pick = next.savedBanks[use]
    if (!pick) return 'That bank account isn’t saved.'
    next.bank = { ...pick, enabled: true }
  }
  const remove = (input as { removeBank?: unknown })?.removeBank
  if (typeof remove === 'number') {
    const gone = next.savedBanks[remove]
    if (!gone) return 'That bank account isn’t saved.'
    if (sameBank(gone, pickBank(next.bank))) return 'Choose another account for buyers before removing this one.'
    next.savedBanks.splice(remove, 1)
  }
  return next
}

export const bankComplete = (p: PaymentSettings) =>
  Boolean(p.bank.accountName && ((p.bank.sortCode && p.bank.accountNumber) || p.bank.iban))

/** What a buyer is shown for a bank transfer (only after they choose it). */
export const bankDetails = (p: PaymentSettings) => ({
  bankName: p.bank.bankName || null,
  accountName: p.bank.accountName,
  sortCode: p.bank.sortCode || null,
  accountNumber: p.bank.accountNumber || null,
  iban: p.bank.iban || null,
  bic: p.bank.bic || null,
  instructions: p.bank.instructions || null,
})

/** Short, unique, typo-resistant reference for a bank transfer (no 0/O/1/I). */
export function bankReference(orderId: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const h = createHash('sha256').update(`bank-ref:${orderId}`).digest()
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[h[i] % alphabet.length]
  return `DK-${out}`
}

/* ------------------------------------------------------------ money --- */

const ZERO_DECIMAL = new Set(['jpy', 'krw', 'huf', 'twd'])
/** 1234 + gbp → "12.34" (PayPal's amount format). */
export const toPaypalValue = (minor: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toLowerCase()) ? String(minor) : (minor / 100).toFixed(2)

/* ----------------------------------------------------------- PayPal --- */

const paypal = {
  clientId: (process.env.PAYPAL_CLIENT_ID ?? '').trim(),
  secret: (process.env.PAYPAL_CLIENT_SECRET ?? '').trim(),
  webhookId: (process.env.PAYPAL_WEBHOOK_ID ?? '').trim(),
  // Sandbox unless explicitly configured otherwise; PAYPAL_API_BASE also points tests at a stand-in.
  base: (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(/\/+$/, ''),
}
export const paypalConfigured = () => Boolean(paypal.clientId && paypal.secret)
export const paypalMode = () => (/sandbox|127\.0\.0\.1|localhost/.test(paypal.base) ? 'sandbox' : 'live')

let token: { value: string; exp: number } | null = null
async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value
  const r = await fetch(`${paypal.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${paypal.clientId}:${paypal.secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error(`PayPal sign-in failed (${r.status})`)
  const j = (await r.json()) as { access_token: string; expires_in: number }
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return token.value
}

async function pp<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<{ status: number; json: T }> {
  const r = await fetch(`${paypal.base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, json: (await r.json().catch(() => ({}))) as T }
}

export interface PaypalOrder {
  id: string
  status: string
  links?: Array<{ rel: string; href: string }>
  payer?: { email_address?: string }
  purchase_units?: Array<{
    custom_id?: string
    reference_id?: string
    amount?: { currency_code: string; value: string }
    payee?: { email_address?: string; merchant_id?: string }
    payments?: { captures?: Array<{ id: string; status: string; amount: { currency_code: string; value: string } }> }
  }>
}

/** Creates the PayPal order paying the seller. Idempotent per Desknoty order id. */
export async function createPaypalOrder(o: { id: string; amountMinor: number; currency: string; title: string }, payeeEmail: string, returnUrl: string, cancelUrl: string) {
  const r = await pp<PaypalOrder & { message?: string }>(
    'POST',
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: o.id,
          custom_id: o.id,
          invoice_id: o.id,
          description: o.title.slice(0, 127),
          amount: { currency_code: o.currency.toUpperCase(), value: toPaypalValue(o.amountMinor, o.currency) },
          payee: { email_address: payeeEmail },
        },
      ],
      payment_source: { paypal: { experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' } } },
    },
    `create-${o.id}`,
  )
  if (r.status >= 300) throw new Error(`PayPal couldn’t start the payment (${r.status}).`)
  const approve = r.json.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
  if (!approve) throw new Error('PayPal didn’t return a payment link.')
  return { paypalOrderId: r.json.id, approveUrl: approve }
}

/** Captures the payment (idempotent), or re-reads it if it was already captured. */
export async function captureOrRead(paypalOrderId: string, desknotyOrderId: string): Promise<PaypalOrder> {
  const id = encodeURIComponent(paypalOrderId)
  const cap = await pp<PaypalOrder & { details?: Array<{ issue: string }> }>('POST', `/v2/checkout/orders/${id}/capture`, {}, `capture-${desknotyOrderId}`)
  if (cap.status < 300) return cap.json
  return (await pp<PaypalOrder>('GET', `/v2/checkout/orders/${id}`)).json
}
export async function readPaypalOrder(paypalOrderId: string): Promise<PaypalOrder> {
  return (await pp<PaypalOrder>('GET', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`)).json
}

/**
 * The only test that marks a PayPal order paid: PayPal says the order is
 * COMPLETED with a COMPLETED capture, for our order id, paid to this seller,
 * for exactly this amount and currency.
 */
export function verifyPaypalPayment(po: PaypalOrder, order: { id: string; amountMinor: number; currency: string; providerOrderId: string | null }, payeeEmail: string): { ok: true; payerEmail: string | null } | { ok: false; reason: string } {
  const pu = po.purchase_units?.[0]
  const cap = pu?.payments?.captures?.find((c) => c.status === 'COMPLETED')
  const want = { currency: order.currency.toUpperCase(), value: toPaypalValue(order.amountMinor, order.currency) }
  if (po.id !== order.providerOrderId) return { ok: false, reason: 'different PayPal order' }
  if (po.status !== 'COMPLETED' || !cap) return { ok: false, reason: `not completed (${po.status})` }
  if (pu?.custom_id !== order.id) return { ok: false, reason: 'order id mismatch' }
  if (cap.amount.currency_code !== want.currency || cap.amount.value !== want.value) return { ok: false, reason: `amount mismatch (${cap.amount.value} ${cap.amount.currency_code})` }
  if ((pu?.payee?.email_address ?? '').toLowerCase() !== payeeEmail.toLowerCase()) return { ok: false, reason: 'paid to a different PayPal account' }
  return { ok: true, payerEmail: po.payer?.email_address ?? null }
}

/** Asks PayPal whether a webhook notification is genuine (needs PAYPAL_WEBHOOK_ID). */
export async function verifyPaypalWebhook(headers: Record<string, string | string[] | undefined>, event: unknown): Promise<boolean> {
  if (!paypal.webhookId) return false
  const h = (n: string) => String(headers[n] ?? '')
  const r = await pp<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: paypal.webhookId,
    webhook_event: event,
  })
  return r.json.verification_status === 'SUCCESS'
}
