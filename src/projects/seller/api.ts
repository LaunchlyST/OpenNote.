import { API_BASE, apiUrl } from '../../lib/api-base'
import type { DraftProduct, Page, PayMethod, PaymentSettings, SellerSetup, ShopProduct, StoreView } from './model'

export class SellerError extends Error {
  status: number
  setup: boolean
  constructor(message: string, status: number, setup = false) {
    super(message)
    this.status = status
    this.setup = setup
  }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method,
      credentials: 'include',
      headers: body === undefined || body instanceof Blob ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    })
  } catch {
    throw new SellerError('The Desknoty server didn’t answer. Check your connection and try again.', 0)
  }
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* not JSON: probably no server behind /api */
  }
  if (json === null) {
    // No JSON at all: there is no Desknoty API behind this site (e.g. a static host with no backend configured).
    const local = /^(localhost|127\.)/.test(window.location.hostname)
    if (!API_BASE && !local) throw new SellerError('This site isn’t connected to a Desknoty server yet, so stores can’t be loaded here. Nothing you saved is lost.', -1)
    throw new SellerError(`The Desknoty server isn’t responding (${res.status}). Try again in a moment.`, 0)
  }
  if (res.status === 401) throw new SellerError('Your session has ended. Sign in again to open Seller Studio.', 401)
  if (!res.ok) throw new SellerError(json?.error ?? `Request failed (${res.status}).`, res.status, Boolean(json?.setup))
  return json as T
}

export const sellerApi = {
  setup: () => call<SellerSetup>('GET', '/api/seller/setup'),
  store: (refresh = false) => call<{ store: StoreView | null }>('GET', `/api/seller/store${refresh ? '?refresh=1' : ''}`),
  handle: (h: string) => call<{ available: boolean; problem: string | null }>('GET', `/api/seller/handle/${encodeURIComponent(h)}`),
  create: (name: string, handle: string) => call<{ store: StoreView }>('POST', '/api/seller/store', { name, handle }),
  /** Delete the store to set it up again (only without orders). */
  startOver: (confirm: string) => call<{ store: null }>('DELETE', '/api/seller/store', { confirm }),
  changeHandle: (handle: string) => call<{ store: StoreView }>('PUT', '/api/seller/handle', { handle }),
  saveDraft: (page: Page, revision: number) => call<{ store: StoreView }>('PUT', '/api/seller/store/draft', { page, revision }),
  publish: () => call<{ store: StoreView }>('POST', '/api/seller/store/publish'),
  addProduct: (p: Partial<DraftProduct> = {}) => call<{ product: DraftProduct; store: StoreView }>('POST', '/api/seller/products', p),
  updateProduct: (id: string, p: Partial<Pick<DraftProduct, 'title' | 'description' | 'cover' | 'priceMinor' | 'currency' | 'listed' | 'extras' | 'archived'>>, revision: number) =>
    call<{ product: DraftProduct; store: StoreView }>('PATCH', `/api/seller/products/${id}`, { ...p, revision }),
  coupons: () => call<{ coupons: Coupon[] }>('GET', '/api/seller/coupons'),
  createCoupon: (c: CouponInput) => call<{ coupon: Coupon }>('POST', '/api/seller/coupons', c),
  updateCoupon: (id: string, c: Partial<CouponInput>) => call<{ coupon: Coupon }>('PATCH', `/api/seller/coupons/${id}`, c),
  deleteCoupon: (id: string) => call<{ deleted: boolean; deactivated: boolean }>('DELETE', `/api/seller/coupons/${id}`),
  uploadSample: (id: string, file: File) => call<{ product: DraftProduct }>('PUT', `/api/seller/products/${id}/sample`, file, { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }),
  removeSample: (id: string) => call<{ product: DraftProduct }>('DELETE', `/api/seller/products/${id}/sample`),
  duplicateProduct: (id: string) => call<{ product: DraftProduct; store: StoreView }>('POST', `/api/seller/products/${id}/duplicate`),
  deleteProduct: (id: string) => call<{ store: StoreView }>('DELETE', `/api/seller/products/${id}`),
  uploadFile: (id: string, file: File) =>
    call<{ product: DraftProduct }>('PUT', `/api/seller/products/${id}/file`, file, { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }),
  uploadMedia: (file: Blob) => call<{ id: string; url: string }>('POST', '/api/seller/media', file, { 'Content-Type': file.type }),
  onboard: (returnTo: string) => call<{ url: string }>('POST', '/api/seller/stripe/onboard', { returnTo }),
  manage: () => call<{ url: string }>('POST', '/api/seller/stripe/manage'),
  /** TikTok by bio code: get a code for a username, then check the bio. */
  tiktokCode: (username: string) => call<{ username: string; code: string; expiresInMinutes: number }>('POST', '/api/seller/tiktok/code', { username }),
  tiktokDisconnect: () => call<{ store: StoreView }>('POST', '/api/seller/tiktok/disconnect'),
  tiktokVerify: () => call<{ store: StoreView }>('POST', '/api/seller/tiktok/verify', {}),
  tiktok: (returnTo: string) => call<{ url: string }>('POST', '/api/seller/tiktok/start', { returnTo }),
  earnings: () => call<Earnings>('GET', '/api/seller/earnings'),
  withdraw: (currency: string, bankId?: string) => call<{ payout: { id: string; amountMinor: number; currency: string; status: string; arrival: string } }>('POST', '/api/seller/payouts', { currency, bankId }),
  orders: (offset = 0) => call<{ nextOffset: number | null; orders: Array<{ id: string; product: string; amountMinor: number; currency: string; status: string; buyer: string | null; createdAt: string; method?: PayMethod; reference?: string | null; buyerClaimedAt?: string | null; payerName?: string | null; payerBank?: string | null; hidden?: boolean }> }>('GET', `/api/seller/orders?offset=${offset}`),
  hideOrder: (id: string) => call<{ ok: true }>('DELETE', `/api/seller/orders/${encodeURIComponent(id)}`),
  useBank: (index: number) => call<{ store: StoreView }>('PUT', '/api/seller/payments', { useBank: index }),
  removeBank: (index: number) => call<{ store: StoreView }>('PUT', '/api/seller/payments', { removeBank: index }),
  savePayments: (p: Partial<{ [K in keyof PaymentSettings]: Partial<PaymentSettings[K]> }>) => call<{ store: StoreView }>('PUT', '/api/seller/payments', p),
  /** Bank transfer arrived: unlocks the order and sends the receipt. */
  confirmOrder: (id: string) => call<{ order: { id: string; status: string } }>('POST', `/api/seller/orders/${encodeURIComponent(id)}/confirm`),
  cancelOrder: (id: string) => call<{ order: { id: string; status: string } }>('POST', `/api/seller/orders/${encodeURIComponent(id)}/cancel`),
}

export interface PublicStore {
  handle: string
  page: Page
  products: ShopProduct[]
  checkoutReady: boolean
  /** Payment methods this seller accepts right now. */
  methods?: PayMethod[]
  /** The seller's bank accounts a buyer can pay into (bank name and last 4 digits only). */
  banks?: Array<{ index: number; bankName: string; last4: string; inUse: boolean }>
  /** Payments go through Stripe Sandbox: no real money moves. */
  testMode?: boolean
}
export interface PublicOrder {
  id: string
  /** Stage C: a bundle's items, each with its own download. */
  items?: Array<{ productId: string; title: string; fileName: string; downloadUrl: string }>
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'disputed'
  product: string
  productId?: string
  amountMinor: number
  currency: string
  email: string | null
  fileName: string
  downloadUrl: string | null
  retrievalUrl: string | null
  downloadExpiresAt: number | null
  receiptSent: boolean
  receiptStatus: string
  method?: PayMethod
  /** Bank transfer still to pay: where, how much and the reference. */
  bank?: { bankName?: string | null; accountName: string; sortCode: string | null; accountNumber: string | null; iban: string | null; bic: string | null; instructions: string | null; reference: string | null } | null
  buyerClaimedAt?: string | null
  /** Bank transfer: the bank the buyer said they pay from. */
  payerBank?: string | null
}

export interface Coupon {
  id: string
  code: string
  kind: 'percent' | 'amount'
  value: number
  currency: string | null
  productIds: string[]
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  perCustomer: number | null
  used: number
  active: boolean
  createdAt: string
}
export type CouponInput = { code: string; kind: 'percent' | 'amount'; value: number; currency?: string | null; productIds?: string[]; startsAt?: string | null; endsAt?: string | null; tz?: string; maxRedemptions?: number | null; perCustomer?: number | null; active?: boolean }

/** sent: the email provider accepted it. queued: not confirmed yet. failed: the provider refused it. */
export type EmailStatus = 'sent' | 'queued' | 'failed'

export interface PublicReview { id: string; rating: number; body: string; name: string; verified: boolean; createdAt: string; edited: boolean }

export interface PriceQuote {
  currency: string
  listMinor: number
  offer: { priceMinor: number; savedMinor: number; endsAt: string | null; countdown: boolean } | null
  coupon: { code: string; discountMinor: number } | null
  couponError: string | null
  totalMinor: number
  savedMinor: number
  needsEmail: boolean
  cardMinimum: number
}

export const storeApi = {
  get: (handle: string) => call<PublicStore>('GET', `/api/store/${encodeURIComponent(handle)}`),
  checkout: (handle: string, productId: string, checkoutKey: string, method: PayMethod = 'stripe', email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }, coupon?: string) =>
    call<{ url?: string; orderUrl?: string; order?: PublicOrder; emailed?: boolean; email?: string; emailStatus?: EmailStatus; emailError?: string | null }>('POST', `/api/store/${encodeURIComponent(handle)}/checkout`, { productId, checkoutKey, method, email, coupon: coupon || undefined, ...(payer ?? {}) }),
  /** The authoritative price right now, optionally with a discount code. Nothing is reserved. */
  quote: (handle: string, productId: string, coupon?: string) => call<{ quote: PriceQuote }>('POST', `/api/store/${encodeURIComponent(handle)}/quote`, { productId, coupon: coupon || undefined }),
  /** Send the download email again for an existing order (rate limited by the server). */
  resend: (handle: string, id: string, k: string) => call<{ emailStatus: EmailStatus; to: string; emailError?: string }>('POST', `/api/store/${encodeURIComponent(handle)}/order/${encodeURIComponent(id)}/resend`, { k }),
  reviews: (handle: string, productId: string) => call<{ summary: { average: number; count: number; breakdown: number[] }; reviews: PublicReview[] }>('GET', `/api/store/${encodeURIComponent(handle)}/products/${encodeURIComponent(productId)}/reviews`),
  myReview: (handle: string, orderId: string, k: string, productId?: string) => call<{ review: { id: string; rating: number; body: string; name: string; status: string } | null; eligible: boolean }>('GET', `/api/store/${encodeURIComponent(handle)}/order/${encodeURIComponent(orderId)}/review?k=${encodeURIComponent(k)}${productId ? `&productId=${encodeURIComponent(productId)}` : ''}`),
  saveReview: (handle: string, orderId: string, k: string, r: { rating: number; body: string; name: string; productId?: string }) => call<{ review: { id: string; rating: number } }>('POST', `/api/store/${encodeURIComponent(handle)}/order/${encodeURIComponent(orderId)}/review`, { k, ...r }),
  reportReview: (handle: string, reviewId: string, reason: string) => call<{ reported: boolean }>('POST', `/api/store/${encodeURIComponent(handle)}/reviews/${encodeURIComponent(reviewId)}/report`, { reason }),
  favourites: () => call<{ productIds: string[] }>('GET', '/api/favourites'),
  favourite: (productId: string, on: boolean) => call<{ saved: boolean }>(on ? 'PUT' : 'DELETE', `/api/favourites/${encodeURIComponent(productId)}`),
  /** Bank transfer: "I've sent it" (never unlocks the download). */
  claim: (handle: string, id: string, k: string) => call<{ order: PublicOrder }>('POST', `/api/store/${encodeURIComponent(handle)}/order/${encodeURIComponent(id)}/claim`, { k }),
  /** Back from PayPal: the server verifies the payment with PayPal. */
  paypalConfirm: (handle: string, orderId: string, k: string) => call<{ order: PublicOrder }>('POST', `/api/store/${encodeURIComponent(handle)}/paypal/confirm`, { orderId, k }),
  session: (handle: string, sessionId: string) => call<{ order: PublicOrder }>('GET', `/api/store/${encodeURIComponent(handle)}/session/${encodeURIComponent(sessionId)}`),
  order: (handle: string, id: string, k: string) => call<{ order: PublicOrder }>('GET', `/api/store/${encodeURIComponent(handle)}/order/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`),
}

/** data: URL (old browser drafts) → Blob for upload. */
export async function dataUrlToBlob(u: string): Promise<Blob | null> {
  try {
    return await (await fetch(u)).blob()
  } catch {
    return null
  }
}

export interface Earnings {
  totals: Array<{ currency: string; totalMinor: number; monthMinor: number; lastMonthMinor: number; sales: number; byMethod: Record<string, number>; days: Array<{ date: string; amountMinor: number }> }>
  balance: {
    available: Array<{ amountMinor: number; currency: string }>
    pending: Array<{ amountMinor: number; currency: string }>
    payouts: Array<{ id: string; amountMinor: number; currency: string; status: string; arrival: string; bank: string | null }>
  } | null
  banks: Array<{ id: string; bankName: string; holder: string; last4: string; sortCode: string; currency: string; isDefault: boolean }>
  withdrawals: boolean
}
