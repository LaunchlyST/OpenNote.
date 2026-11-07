import { API_BASE, apiUrl } from '../../lib/api-base'
import type { DraftProduct, Page, SellerSetup, ShopProduct, StoreView } from './model'

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
  changeHandle: (handle: string) => call<{ store: StoreView }>('PUT', '/api/seller/handle', { handle }),
  saveDraft: (page: Page) => call<{ store: StoreView }>('PUT', '/api/seller/store/draft', { page }),
  publish: () => call<{ store: StoreView }>('POST', '/api/seller/store/publish'),
  addProduct: (p: Partial<DraftProduct> = {}) => call<{ product: DraftProduct; store: StoreView }>('POST', '/api/seller/products', p),
  updateProduct: (id: string, p: Partial<Pick<DraftProduct, 'title' | 'description' | 'cover' | 'priceMinor' | 'currency' | 'listed'>>) =>
    call<{ product: DraftProduct; store: StoreView }>('PATCH', `/api/seller/products/${id}`, p),
  deleteProduct: (id: string) => call<{ store: StoreView }>('DELETE', `/api/seller/products/${id}`),
  uploadFile: (id: string, file: File) =>
    call<{ product: DraftProduct }>('PUT', `/api/seller/products/${id}/file`, file, { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }),
  uploadMedia: (file: Blob) => call<{ id: string; url: string }>('POST', '/api/seller/media', file, { 'Content-Type': file.type }),
  onboard: (returnTo: string) => call<{ url: string }>('POST', '/api/seller/stripe/onboard', { returnTo }),
  manage: () => call<{ url: string }>('POST', '/api/seller/stripe/manage'),
  tiktok: (returnTo: string) => call<{ url: string }>('POST', '/api/seller/tiktok/start', { returnTo }),
  orders: () => call<{ orders: Array<{ id: string; product: string; amountMinor: number; currency: string; status: string; buyer: string | null; createdAt: string }> }>('GET', '/api/seller/orders'),
}

export interface PublicStore {
  handle: string
  page: Page
  products: ShopProduct[]
  checkoutReady: boolean
  /** Payments go through Stripe Sandbox: no real money moves. */
  testMode?: boolean
}
export interface PublicOrder {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  product: string
  amountMinor: number
  currency: string
  email: string | null
  fileName: string
  downloadUrl: string | null
  retrievalUrl: string | null
  /** Only 'sent' means the receipt left Desknoty's mail server. */
  receipt?: 'sent' | 'queued' | 'failed' | null
}

export const storeApi = {
  get: (handle: string) => call<PublicStore>('GET', `/api/store/${encodeURIComponent(handle)}`),
  /** `requestId` makes a retry of the same click reuse the same order and Stripe session. */
  checkout: (handle: string, productId: string, requestId?: string) => call<{ url: string }>('POST', `/api/store/${encodeURIComponent(handle)}/checkout`, { productId, requestId }),
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
