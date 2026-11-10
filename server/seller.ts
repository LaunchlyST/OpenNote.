/**
 * Seller Studio backend: one store per Desknoty account, a draft and a
 * published version of its page, digital products with private files,
 * Stripe Connect payouts, Stripe Checkout, webhook fulfilment and
 * expiring download links.
 *
 * Money moves as *direct charges* on the seller's connected Stripe account:
 * the buyer pays the seller, Stripe takes its processing fee from the seller's
 * balance, and Desknoty takes no application fee (0% platform fee).
 *
 * Every external service is optional. Without STRIPE_SECRET_KEY the seller can
 * still build and publish a page and add products, and the UI shows that
 * payouts and paid checkout need setting up; without TikTok credentials the
 * TikTok step says so and "Continue without TikTok" works.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { makeBlobs } from './blobs.ts'
import type { Blobs } from './blobs.ts'
import { resolve } from 'node:path'
import express, { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import Stripe from 'stripe'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { sql } from './db.ts'
import { ddl } from './sql.ts'
import type { Sql } from './sql.ts'
import { env } from './env.ts'
import { enqueueEmail, transportName } from './mail/index.ts'
import { migrateSeller } from './seller-migrations.ts'
import { bankComplete, bankDetails, bankReference, captureOrRead, cleanPayments, createPaypalOrder, paypalConfigured, paypalMode, readPaypalOrder, readPayments, verifyPaypalPayment, verifyPaypalWebhook } from './payments.ts'
import type { PaymentSettings } from './payments.ts'

/* ------------------------------------------------------------- config --- */

export const PLATFORM_FEE_PERCENT = 0

const stripeMode = process.env.STRIPE_MODE === 'live' ? 'live' : 'test'
const modeKey = process.env[stripeMode === 'live' ? 'STRIPE_LIVE_SECRET_KEY' : 'STRIPE_TEST_SECRET_KEY']
const legacyKey = process.env.STRIPE_SECRET_KEY ?? ''
const seller = {
  stripeSecret: (modeKey || (legacyKey.includes(`_${stripeMode}_`) ? legacyKey : '')).trim(),
  webhookSecret: (process.env[stripeMode === 'live' ? 'STRIPE_LIVE_WEBHOOK_SECRET' : 'STRIPE_TEST_WEBHOOK_SECRET'] || (stripeMode === 'test' ? process.env.STRIPE_WEBHOOK_SECRET : '') || '').trim(),
  /** Test-only: point the Stripe SDK at a local stand-in. Ignored in production. */
  stripeApiBase: env.isProduction ? '' : (process.env.STRIPE_API_BASE ?? '').trim(),
  tiktokKey: (process.env.TIKTOK_CLIENT_KEY ?? '').trim(),
  tiktokSecret: (process.env.TIKTOK_CLIENT_SECRET ?? '').trim(),
  /** Public origin of this API (download links, OAuth callbacks). Defaults to the site origin. */
  apiUrl: (process.env.PUBLIC_API_URL || env.baseURL).replace(/\/+$/, ''),
  /** Public origin of the site (store pages, return URLs), e.g. https://desknoty.com when the API is on its own host. */
  siteUrl: (process.env.PUBLIC_SITE_URL || env.baseURL).replace(/\/+$/, ''),
  filesDir: resolve(process.env.SELLER_FILES_DIR ?? 'data/seller-files'),
  mediaDir: resolve(process.env.SELLER_MEDIA_DIR ?? 'data/seller-media'),
  maxFileBytes: Number(process.env.SELLER_MAX_FILE_MB ?? 50) * 1024 * 1024,
  /** Country for new connected accounts (the seller can't change it later). */
  accountCountry: (process.env.STRIPE_ACCOUNT_COUNTRY || 'GB').toUpperCase(),
}
const STRIPE_V2_VERSION = '2026-10-28.endive'
const tiktokRedirect = () => (process.env.TIKTOK_REDIRECT_URI ?? `${seller.apiUrl}/api/seller/tiktok/callback`).trim()

export const sellerSetup = () => ({
  stripe: Boolean(seller.stripeSecret),
  webhook: Boolean(seller.webhookSecret),
  tiktok: Boolean(seller.tiktokKey && seller.tiktokSecret),
  /** PayPal is available to sellers (platform app configured), and in which mode. */
  paypal: paypalConfigured(),
  paypalMode: paypalConfigured() ? paypalMode() : 'none',
  email: transportName() === 'smtp' || transportName() === 'resend',
  /** Never the key itself: only whether it is a Sandbox (test) key. */
  stripeMode: seller.stripeSecret.startsWith('sk_test_') || seller.stripeSecret.startsWith('rk_test_') ? 'sandbox' : seller.stripeSecret ? 'live' : 'none',
})

/** The Stripe platform account the configured key belongs to (an id, not a secret). Cached. */
let platformAccount: Promise<string | null> | null = null
const platformAccountId = () =>
  (platformAccount ??= (stripe()?.accounts.retrieve() ?? Promise.resolve(null)).then((a) => (a ? a.id : null)).catch(() => null))

let stripeClient: Stripe | null = null
function stripe(): Stripe | null {
  if (!seller.stripeSecret) return null
  if (!stripeClient) {
    // The fetch client honours the host's HTTPS proxy settings (NODE_USE_ENV_PROXY), unlike node:http.
    const opts: Stripe.StripeConfig = { maxNetworkRetries: 2, appInfo: { name: 'Desknoty Seller' }, httpClient: Stripe.createFetchHttpClient() }
    if (seller.stripeApiBase) {
      const u = new URL(seller.stripeApiBase)
      Object.assign(opts, { host: u.hostname, port: Number(u.port), protocol: u.protocol.replace(':', '') as 'http' | 'https' })
    }
    stripeClient = new Stripe(seller.stripeSecret, opts)
  }
  return stripeClient
}

/* ------------------------------------------------------------- tables --- */

let blobStore: Blobs | null = null
const blobs = () => (blobStore ??= makeBlobs({ files: seller.filesDir, media: seller.mediaDir }))

export async function ensureSellerTables() {
  blobs()
  const t = ddl(sql.dialect)
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS seller_store (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      handle TEXT NOT NULL UNIQUE,
      draft TEXT NOT NULL,
      published TEXT,
      "publishedAt" TEXT,
      tiktok TEXT,
      "stripeAccountId" TEXT,
      "stripeStatus" TEXT NOT NULL DEFAULT 'not_connected',
      "chargesReady" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS seller_store_account ON seller_store ("stripeAccountId");

    CREATE TABLE IF NOT EXISTS seller_product (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover TEXT,
      "priceMinor" INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'gbp',
      "fileId" TEXT,
      "fileName" TEXT,
      "fileSize" INTEGER,
      "fileType" TEXT,
      listed INTEGER NOT NULL DEFAULT 1,
      "pubTitle" TEXT,
      "pubDescription" TEXT,
      "pubCover" TEXT,
      "pubPriceMinor" INTEGER,
      "pubCurrency" TEXT,
      "pubFileId" TEXT,
      "pubFileName" TEXT,
      "pubAt" TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS seller_product_store ON seller_product ("storeId");

    CREATE TABLE IF NOT EXISTS seller_media (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    -- One row per Checkout Session. status: pending | paid | failed | cancelled
    CREATE TABLE IF NOT EXISTS seller_order (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      "productId" TEXT NOT NULL,
      "productTitle" TEXT NOT NULL,
      "fileId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "sessionId" TEXT UNIQUE,
      "accountId" TEXT NOT NULL,
      "amountMinor" INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "buyerEmail" TEXT,
      "accessKey" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "paidAt" TEXT,
      "emailedAt" TEXT
    );
    CREATE INDEX IF NOT EXISTS seller_order_store ON seller_order ("storeId", "createdAt");

    -- Stripe event ids already handled, so a re-delivered webhook is a no-op.
    CREATE TABLE IF NOT EXISTS stripe_event (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      "receivedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_state (
      state TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      provider TEXT NOT NULL,
      "returnTo" TEXT NOT NULL,
      verifier TEXT,
      "expiresAt" ${t.big} NOT NULL
    );
  `)
  await migrateSeller()
}

/* -------------------------------------------------------------- types --- */

interface StoreRow {
  /** JSON PaymentSettings (PayPal, bank transfer, Stripe on/off); private to the seller. */
  payments: string | null
  revision: number
  stripeMode: string
  id: string
  userId: string
  handle: string
  draft: string
  published: string | null
  publishedAt: string | null
  tiktok: string | null
  stripeAccountId: string | null
  stripeStatus: PayoutStatus
  chargesReady: number
  createdAt: string
  updatedAt: string
}
interface ProductRow {
  revision: number
  id: string
  storeId: string
  title: string
  description: string
  cover: string | null
  priceMinor: number
  currency: string
  fileId: string | null
  fileName: string | null
  fileSize: number | null
  fileType: string | null
  listed: number
  pubTitle: string | null
  pubDescription: string | null
  pubCover: string | null
  pubPriceMinor: number | null
  pubCurrency: string | null
  pubFileId: string | null
  pubFileName: string | null
  pubAt: string | null
  sort: number
  createdAt: string
  updatedAt: string
}
interface OrderRow {
  /** stripe | paypal | bank */
  method: string
  /** Bank transfer reference the buyer quotes. */
  reference: string | null
  /** PayPal order id. */
  providerOrderId: string | null
  /** When the buyer said they had paid (bank transfer): informational only, never unlocks. */
  buyerClaimedAt: string | null
  checkoutKey: string | null
  checkoutUrl: string | null
  receiptId: number | null
  paymentIntent: string | null
  refunded: number
  disputed: number
  stripeMode: string
  id: string
  storeId: string
  productId: string
  productTitle: string
  fileId: string
  fileName: string
  sessionId: string | null
  accountId: string
  amountMinor: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'disputed'
  buyerEmail: string | null
  accessKey: string
  createdAt: string
  paidAt: string | null
  emailedAt: string | null
}

export type PayoutStatus = 'not_connected' | 'incomplete' | 'pending' | 'ready'

/* ------------------------------------------------------------ helpers --- */

const now = () => new Date().toISOString()
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'dashboard', 'help', 'blog', 'store', 'desknoty', 'support', 'signin', 'signup', 'login', 'logout', 'account', 'landing', 'design', 'video', 'pro', 'free', 'assets', 'fonts', 'icons', 'settings', 'projects', 'privacy', 'terms', 'pricing', 'legal', 'about', 'contact', 'static', 'favicon'])
export function handleProblem(h: unknown): string | null {
  if (typeof h !== 'string') return 'Choose a handle.'
  if (h.length < 3) return 'At least 3 characters.'
  if (h.length > 30) return 'At most 30 characters.'
  if (!/^[a-z0-9-]+$/.test(h)) return 'Only lowercase letters, numbers and hyphens.'
  if (h.startsWith('-') || h.endsWith('-')) return 'Can’t start or end with a hyphen.'
  if (RESERVED.has(h)) return 'That name is reserved.'
  return null
}

const CURRENCIES = new Set(['gbp', 'usd', 'eur'])
/** Stripe's minimum charge is around 0.30–0.50 in these currencies. */
const MIN_MINOR = 50

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const safeUrl = (v: unknown) => {
  const s = str(v, 500).trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}
const mediaRef = (v: unknown) => (typeof v === 'string' && /^med_[a-f0-9]{24}$/.test(v) ? v : null)

/* ------------------------------------------------------- page schema --- */

export const BLOCK_TYPES = ['header', 'text', 'image', 'links', 'featured', 'grid', 'faq', 'footer'] as const
type BlockType = (typeof BLOCK_TYPES)[number]
interface Block {
  id: string
  type: BlockType
  hidden: boolean
  data: Record<string, unknown>
}
interface Page {
  name: string
  bio: string
  avatar: string | null
  theme: { preset: string; accent: string; font: string; button: string; background: string }
  socials: { instagram: string; youtube: string; x: string; website: string }
  blocks: Block[]
}

/** Accepts a page from the editor, keeping only known fields and products this store owns. */
function cleanPage(input: unknown, productIds: Set<string>): Page | string {
  if (!input || typeof input !== 'object') return 'Missing page.'
  const p = input as Record<string, unknown>
  const t = (p.theme ?? {}) as Record<string, unknown>
  const blocksIn = Array.isArray(p.blocks) ? p.blocks : []
  if (blocksIn.length > 60) return 'Too many blocks (60 max).'
  const seen = new Set<string>()
  const blocks: Block[] = []
  for (const raw of blocksIn) {
    if (!raw || typeof raw !== 'object') continue
    const b = raw as Record<string, unknown>
    const type = b.type as BlockType
    if (!BLOCK_TYPES.includes(type)) return `Unknown block type ${String(b.type)}.`
    let id = str(b.id, 40)
    if (!/^[a-z0-9_-]{4,40}$/i.test(id) || seen.has(id)) id = `blk_${randomBytes(6).toString('hex')}`
    seen.add(id)
    const d = (b.data ?? {}) as Record<string, unknown>
    let data: Record<string, unknown> = {}
    switch (type) {
      case 'header':
        data = { showSocials: d.showSocials !== false }
        break
      case 'text':
        data = { heading: str(d.heading, 120), body: str(d.body, 4000) }
        break
      case 'image':
        data = { media: mediaRef(d.media), alt: str(d.alt, 200), caption: str(d.caption, 200) }
        break
      case 'links':
        data = {
          links: (Array.isArray(d.links) ? d.links : []).slice(0, 20).map((l) => {
            const x = (l ?? {}) as Record<string, unknown>
            return { label: str(x.label, 80), url: safeUrl(x.url) }
          }),
        }
        break
      case 'featured':
        data = { productId: typeof d.productId === 'string' && productIds.has(d.productId) ? d.productId : null, note: str(d.note, 200) }
        break
      case 'grid':
        data = {
          heading: str(d.heading, 120),
          productIds: (Array.isArray(d.productIds) ? d.productIds : []).filter((x): x is string => typeof x === 'string' && productIds.has(x)).slice(0, 48),
        }
        break
      case 'faq':
        data = {
          heading: str(d.heading, 120),
          items: (Array.isArray(d.items) ? d.items : []).slice(0, 20).map((q) => {
            const x = (q ?? {}) as Record<string, unknown>
            return { q: str(x.q, 200), a: str(x.a, 1500) }
          }),
        }
        break
      case 'footer':
        data = { text: str(d.text, 200) }
        break
    }
    blocks.push({ id, type, hidden: b.hidden === true, data })
  }
  // Pinned: exactly one profile header, always first, and one footer, always last; both shown.
  const head = blocks.find((b) => b.type === 'header') ?? { id: `blk_${randomBytes(6).toString('hex')}`, type: 'header' as BlockType, hidden: false, data: { showSocials: true } }
  const foot = blocks.find((b) => b.type === 'footer') ?? { id: `blk_${randomBytes(6).toString('hex')}`, type: 'footer' as BlockType, hidden: false, data: { text: '' } }
  const ordered = [{ ...head, hidden: false }, ...blocks.filter((b) => b.type !== 'footer' && b.type !== 'header'), { ...foot, hidden: false }]
  blocks.length = 0
  blocks.push(...ordered)
  const socials = (p.socials ?? {}) as Record<string, unknown>
  return {
    name: str(p.name, 60),
    bio: str(p.bio, 160),
    avatar: mediaRef(p.avatar),
    theme: {
      preset: str(t.preset, 20) || 'clean',
      accent: /^#[0-9a-f]{6}$/i.test(String(t.accent)) ? String(t.accent) : '#111114',
      font: str(t.font, 20) || 'geist',
      button: ['rounded', 'pill', 'sharp'].includes(String(t.button)) ? String(t.button) : 'rounded',
      background: t.background === 'gradient' ? 'gradient' : 'solid',
    },
    socials: { instagram: safeUrl(socials.instagram), youtube: safeUrl(socials.youtube), x: safeUrl(socials.x), website: safeUrl(socials.website) },
    blocks,
  }
}

export function defaultPage(name: string): Page {
  const id = () => `blk_${randomBytes(6).toString('hex')}`
  return {
    name,
    bio: '',
    avatar: null,
    theme: { preset: 'clean', accent: '#111114', font: 'geist', button: 'rounded', background: 'solid' },
    blocks: [
      { id: id(), type: 'header', hidden: false, data: { showSocials: true } },
      { id: id(), type: 'grid', hidden: false, data: { heading: 'Shop', productIds: [] } },
      { id: id(), type: 'footer', hidden: false, data: { text: '' } },
    ],
    socials: { instagram: '', youtube: '', x: '', website: '' },
  }
}

/* -------------------------------------------------------------- views --- */

function productDraftView(p: ProductRow) {
  return {
    id: p.id,
    revision: p.revision,
    title: p.title,
    description: p.description,
    cover: p.cover,
    priceMinor: p.priceMinor,
    currency: p.currency,
    file: p.fileId ? { name: p.fileName, size: p.fileSize, type: p.fileType } : null,
    listed: Boolean(p.listed),
    published: Boolean(p.pubAt),
    changed: Boolean(p.pubAt) && (p.title !== p.pubTitle || p.description !== p.pubDescription || p.cover !== p.pubCover || p.priceMinor !== p.pubPriceMinor || p.currency !== p.pubCurrency || p.fileId !== p.pubFileId),
    problem: productProblem(p),
  }
}
function productPublicView(p: ProductRow) {
  return {
    id: p.id,
    title: p.pubTitle ?? '',
    description: p.pubDescription ?? '',
    cover: p.pubCover,
    priceMinor: p.pubPriceMinor ?? 0,
    currency: p.pubCurrency ?? 'gbp',
  }
}
function productProblem(p: ProductRow): string | null {
  if (!p.title.trim()) return 'Add a title.'
  if (!CURRENCIES.has(p.currency)) return 'Choose a currency.'
  if (p.priceMinor < MIN_MINOR) return 'Set a price of at least 0.50.'
  if (!p.fileId) return 'Upload the file buyers will download.'
  return null
}

/** Which payment methods a buyer can use at this store right now. */
function readyMethods(s: StoreRow, p: PaymentSettings = readPayments(s.payments)): Array<'stripe' | 'paypal' | 'bank'> {
  const out: Array<'stripe' | 'paypal' | 'bank'> = []
  if (p.stripe.enabled && s.stripeMode === stripeMode && Boolean(s.chargesReady) && Boolean(stripe())) out.push('stripe')
  if (p.paypal.enabled && p.paypal.email && paypalConfigured()) out.push('paypal')
  if (p.bank.enabled && bankComplete(p)) out.push('bank')
  return out
}

function payoutView(s: StoreRow) {
  const p = readPayments(s.payments)
  const methods = readyMethods(s, p)
  return {
    status: s.stripeStatus,
    accountId: s.stripeAccountId ? `…${s.stripeAccountId.slice(-6)}` : null,
    // Buy works when any method is ready, not only Stripe.
    checkoutReady: methods.length > 0,
    stripeReady: methods.includes('stripe'),
    methods,
    // The seller's own settings (only ever sent to the seller).
    payments: p,
  }
}

/* --------------------------------------------------------- statements --- */

/** Lookups used everywhere. Pass `via` to read inside an open transaction. */
const q = {
  storeByUser: (id: string, via: Sql = sql) => via.get<StoreRow>(`SELECT * FROM seller_store WHERE "userId" = ?`, id),
  storeByHandle: (h: string, via: Sql = sql) => via.get<StoreRow>(`SELECT * FROM seller_store WHERE handle = ?`, h),
  storeById: (id: string, via: Sql = sql) => via.get<StoreRow>(`SELECT * FROM seller_store WHERE id = ?`, id),
  storeByAccount: (id: string, via: Sql = sql) => via.get<StoreRow>(`SELECT * FROM seller_store WHERE "stripeAccountId" = ?`, id),
  products: (storeId: string, via: Sql = sql) => via.all<ProductRow>(`SELECT * FROM seller_product WHERE "storeId" = ? ORDER BY sort, "createdAt"`, storeId),
  product: (id: string, storeId: string, via: Sql = sql) => via.get<ProductRow>(`SELECT * FROM seller_product WHERE id = ? AND "storeId" = ?`, id, storeId),
  order: (id: string, via: Sql = sql) => via.get<OrderRow>(`SELECT * FROM seller_order WHERE id = ?`, id),
  orderBySession: (id: string, via: Sql = sql) => via.get<OrderRow>(`SELECT * FROM seller_order WHERE "sessionId" = ?`, id),
}

/* -------------------------------------------------------- auth guard --- */

interface Authed extends Request {
  userId?: string
  userEmail?: string
}
async function requireUser(req: Authed, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) return void res.status(401).json({ error: 'Not signed in.' })
    if (!session.user.emailVerified) return void res.status(403).json({ error: 'Verify your email before using Seller Studio.', code: 'EMAIL_NOT_VERIFIED' })
    if ((session.user as { plan?: string }).plan !== 'pro') return void res.status(403).json({ error: 'Seller Studio requires the Pro plan.', code: 'SELLER_PLAN_REQUIRED' })
    req.userId = session.user.id
    req.userEmail = session.user.email
    next()
  } catch (err) {
    next(err)
  }
}

/* ----------------------------------------------------------- Stripe --- */

/** Maps a connected account to the four states the seller sees. */
export function payoutStatusOf(a: Pick<Stripe.Account, 'details_submitted' | 'charges_enabled' | 'payouts_enabled' | 'requirements' | 'capabilities'>): { status: PayoutStatus; chargesReady: boolean } {
  const req = a.requirements
  const due = [...(req?.currently_due ?? []), ...(req?.past_due ?? [])]
  const pendingVerification = (req?.pending_verification ?? []).length > 0 || req?.disabled_reason === 'requirements.pending_verification'
  const chargesReady = Boolean(a.charges_enabled) && a.capabilities?.card_payments === 'active'
  let status: PayoutStatus
  if (!a.details_submitted) status = 'incomplete'
  else if (a.charges_enabled && a.payouts_enabled && due.length === 0) status = 'ready'
  else if (due.length > 0 && !pendingVerification) status = 'incomplete'
  else status = 'pending'
  return { status, chargesReady }
}

async function activeConnection(s: StoreRow): Promise<StoreRow> {
  if (s.stripeMode === stripeMode) return s
  const connection = await sql.get<{accountId: string}>('SELECT "accountId" FROM seller_connections WHERE "storeId" = ? AND mode = ?', s.id, stripeMode)
  return { ...s, stripeMode, stripeAccountId: connection?.accountId ?? null, stripeStatus: 'not_connected', chargesReady: 0 }
}

async function refreshAccount(s: StoreRow): Promise<StoreRow> {
  s = await activeConnection(s)
  const st = stripe()
  if (!st || !s.stripeAccountId) return s
  const a = await st.accounts.retrieve(s.stripeAccountId)
  const { status, chargesReady } = payoutStatusOf(a)
  await sql.run(`UPDATE seller_store SET "stripeStatus" = ?, "chargesReady" = ?, "updatedAt" = ? WHERE id = ?`, status, chargesReady ? 1 : 0, now(), s.id)
  return { ...s, stripeStatus: status, chargesReady: chargesReady ? 1 : 0 }
}

const safeReturn = (v: unknown) => (typeof v === 'string' && /^\/app\/[\w\-/?=&.%]*$/.test(v) && !v.startsWith('//') ? v : '/app/pro')

/* -------------------------------------------------- download tokens --- */

const DOWNLOAD_TTL = 24 * 60 * 60 * 1000
function signDownload(orderId: string, exp = Date.now() + DOWNLOAD_TTL) {
  const body = `${orderId}.${exp}`
  const sig = createHmac('sha256', env.secret).update(`download:${body}`).digest('base64url')
  return `${body}.${sig}`
}
function verifyDownload(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [orderId, exp, sig] = parts
  const want = createHmac('sha256', env.secret).update(`download:${orderId}.${exp}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null
  return orderId
}
const retrievalUrl = (o: OrderRow, _handle?: string) => `${seller.siteUrl}/store/${o.storeId}/order/${o.id}?k=${o.accessKey}`

/* ------------------------------------------------------- fulfilment --- */

/**
 * Marks an order paid once Stripe confirms it, and sends the receipt exactly
 * once. Safe to call any number of times, from the webhook or the return page.
 */
export async function fulfil(order: OrderRow, session: Pick<Stripe.Checkout.Session, 'payment_status' | 'amount_total' | 'currency' | 'customer_details' | 'id' | 'payment_intent'>): Promise<OrderRow> {
  if (session.id !== order.sessionId) return order
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return order
  if (session.amount_total !== order.amountMinor || (session.currency ?? '').toLowerCase() !== order.currency) {
    console.error(`[seller] order ${order.id}: paid amount does not match, not fulfilling`)
    return order
  }
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  return completeOrder(order, session.customer_details?.email ?? null, intent ?? null)
}

/**
 * Marks a verified payment's order paid and sends its receipt exactly once.
 * Every payment method ends here, after its own verification.
 */
export async function completeOrder(order: OrderRow, email: string | null, paymentRef: string | null = null): Promise<OrderRow> {
  await sql.tx(async (tx) => {
    await tx.run(
      `UPDATE seller_order SET status = 'paid', "paidAt" = ?, "buyerEmail" = COALESCE(?, "buyerEmail") WHERE id = ? AND status IN ('pending','failed','cancelled')`,
      now(),
      email,
      order.id,
    )
    if (paymentRef && order.method === 'stripe') await tx.run('UPDATE seller_order SET "paymentIntent" = ? WHERE id = ?', paymentRef, order.id)
    // Claim the receipt atomically: only the call that sets emailedAt sends it.
    const claim = await tx.run(`UPDATE seller_order SET "emailedAt" = ? WHERE id = ? AND status = 'paid' AND "emailedAt" IS NULL AND "buyerEmail" IS NOT NULL`, now(), order.id)
    if (!claim.changes) return
    const row = (await q.order(order.id, tx))!
    const store = await q.storeById(row.storeId, tx)
    if (store) {
      const queued = await enqueueEmail(
        'order-receipt',
        row.buyerEmail!,
        { url: retrievalUrl(row, store.handle), name: row.productTitle, amount: new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency.toUpperCase() }).format(row.amountMinor / 100), email: (JSON.parse(store.published ?? store.draft) as Page).name || store.handle },
        tx,
      )
      if (queued.queued) await tx.run('UPDATE seller_order SET "receiptId" = ? WHERE id = ?', queued.id, row.id)
      else await tx.run('UPDATE seller_order SET "emailedAt" = NULL WHERE id = ?', row.id)
    }
  })
  return (await q.order(order.id))!
}

async function markOrder(sessionId: string, status: 'failed' | 'cancelled') {
  await sql.run(`UPDATE seller_order SET status = ? WHERE "sessionId" = ? AND status = 'pending'`, status, sessionId)
}

/* ---------------------------------------------------------- webhook --- */

/** Mounted with a raw body parser, before express.json. */
export function stripeWebhookHandler() {
  return [
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req: Request, res: Response) => {
      const st = stripe()
      if (!st || !seller.webhookSecret) return void res.status(503).json({ error: 'Stripe webhooks are not configured.' })
      let event: Stripe.Event
      try {
        event = await st.webhooks.constructEventAsync(req.body as Buffer, String(req.headers['stripe-signature'] ?? ''), seller.webhookSecret)
      } catch {
        return void res.status(400).json({ error: 'Invalid signature.' })
      }
      const fresh = (await sql.run(`INSERT INTO stripe_event (id, type, "receivedAt") VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING`, event.id, event.type, now())).changes
      try {
        // A repeat of a recorded event is handled again rather than skipped:
        // if the first attempt died mid-way (worker killed after recording the
        // event), the retry finishes it. Fulfilment is idempotent (the order
        // is marked paid once; the receipt is claimed atomically), so a true
        // duplicate changes nothing.
        await handleEvent(event)
        if (!fresh) return void res.json({ received: true, duplicate: true })
      } catch (err) {
        // Let Stripe retry: forget the event so the retry is processed.
        if (fresh) await sql.run(`DELETE FROM stripe_event WHERE id = ?`, event.id)
        console.error('[seller] webhook failed', event.type, err)
        return void res.status(500).json({ error: 'Webhook handling failed.' })
      }
      res.json({ received: true })
    },
  ]
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object as Stripe.Checkout.Session
      let order = s.id ? await q.orderBySession(s.id) : undefined
      if (!order && s.metadata?.desknotyOrderId) {
        const reserved = await q.order(s.metadata.desknotyOrderId)
        if (reserved && reserved.accountId === event.account && reserved.stripeMode === stripeMode && !reserved.sessionId) {
          await sql.run('UPDATE seller_order SET "sessionId" = ? WHERE id = ? AND "sessionId" IS NULL', s.id, reserved.id)
          order = await q.order(reserved.id)
        }
      }
      if (!order) throw new Error('Checkout reservation is not available yet')
      if (event.account !== order.accountId || order.stripeMode !== stripeMode) return
      await fulfil(order, s)
      return
    }
    case 'checkout.session.async_payment_failed': {
      const s = event.data.object as Stripe.Checkout.Session
      const order = await q.orderBySession(s.id)
      if (!order || order.accountId !== event.account) return
      await markOrder(s.id, 'failed')
      return
    }
    case 'checkout.session.expired': {
      const s = event.data.object as Stripe.Checkout.Session
      const order = await q.orderBySession(s.id)
      if (!order || order.accountId !== event.account) return
      await markOrder(s.id, 'cancelled')
      return
    }
    case 'charge.refunded':
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.closed': {
      const st = stripe()
      if (!st || !event.account) return
      const obj = event.data.object as unknown as { id: string; charge?: string }
      const isDispute = event.type.startsWith('charge.dispute.')
      const dispute = isDispute ? await st.disputes.retrieve(obj.id, { stripeAccount: event.account }) : null
      const chargeId = dispute ? (typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id) : obj.id
      const charge = await st.charges.retrieve(chargeId, { stripeAccount: event.account })
      const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (!intent) return
      const disputed = dispute ? !['won', 'warning_closed'].includes(dispute.status) : Boolean(charge.disputed)
      await sql.run(`UPDATE seller_order SET refunded = ?, disputed = ?, status = CASE WHEN ? > 0 THEN 'refunded' WHEN ? = 1 THEN 'disputed' WHEN "paidAt" IS NOT NULL THEN 'paid' ELSE status END WHERE "paymentIntent" = ? AND "accountId" = ? AND "stripeMode" = ?`, charge.amount_refunded, disputed ? 1 : 0, charge.amount_refunded, disputed ? 1 : 0, intent, event.account, stripeMode)
      return
    }
    case 'account.updated': {
      const a = event.data.object as Stripe.Account
      const store = await q.storeByAccount(a.id)
      if (!store) return
      const { status, chargesReady } = payoutStatusOf(a)
      await sql.run(`UPDATE seller_store SET "stripeStatus" = ?, "chargesReady" = ?, "updatedAt" = ? WHERE id = ?`, status, chargesReady ? 1 : 0, now(), store.id)
      return
    }
  }
}

/* ------------------------------------------------------ seller API --- */

async function storeView(s: StoreRow) {
  const products = await q.products(s.id)
  return {
    id: s.id,
    revision: s.revision,
    handle: s.handle,
    // the short public address: desknoty.com/<handle> (old /store/<handle> links still work)
    url: `${seller.siteUrl}/${s.handle}`,
    draft: JSON.parse(s.draft) as Page,
    published: s.published ? (JSON.parse(s.published) as Page) : null,
    publishedAt: s.publishedAt,
    unpublishedChanges: s.published !== s.draft || products.some((p) => productDraftView(p).changed || (Boolean(p.listed) !== Boolean(p.pubAt) && !productProblem(p))),
    tiktok: s.tiktok ? (JSON.parse(s.tiktok) as { username: string; displayName: string; avatarUrl: string }) : null,
    payouts: payoutView(s),
    products: products.map(productDraftView),
  }
}

/**
 * After TikTok connects: the store page takes the TikTok display name and
 * profile photo (copied into Desknoty's own image storage, since TikTok's
 * image links expire), and the TikTok username becomes the store handle when
 * it's a valid, free handle. Changes go to the draft; the seller publishes.
 */
async function applyTiktokProfile(store: StoreRow, t: { username: string; displayName: string; avatarUrl: string }) {
  const draft = JSON.parse(store.draft) as Page
  if (t.displayName) draft.name = t.displayName.slice(0, 60)
  if (/^https:\/\//.test(t.avatarUrl)) {
    const img = await fetch(t.avatarUrl, { signal: AbortSignal.timeout(10_000) })
    const type = (img.headers.get('content-type') ?? '').split(';')[0]
    const body = Buffer.from(await img.arrayBuffer())
    if (img.ok && /^image\/(png|jpe?g|gif|webp)$/.test(type) && body.length > 0 && body.length <= 5 * 1024 * 1024) {
      const id = `med_${randomBytes(12).toString('hex')}`
      await blobs().put('media', id, body, type)
      await sql.run(`INSERT INTO seller_media (id, "storeId", type, size, "createdAt") VALUES (?, ?, ?, ?, ?)`, id, store.id, type, body.length, now())
      draft.avatar = id
    }
  }
  await sql.run(`UPDATE seller_store SET draft = ?, "updatedAt" = ? WHERE id = ?`, JSON.stringify(draft), now(), store.id)
  const handle = t.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  if (handle && handle !== store.handle && !handleProblem(handle) && !(await q.storeByHandle(handle))) {
    await sql.run(`UPDATE seller_store SET handle = ?, "updatedAt" = ? WHERE id = ?`, handle, now(), store.id).catch(() => {})
  }
}

export function sellerRouter() {
  const r = Router()

  r.get('/api/seller/setup', async (_req, res) => res.set('Cache-Control', 'no-store').json({ ...sellerSetup(), platformAccount: await platformAccountId(), platformFeePercent: PLATFORM_FEE_PERCENT }))

  const me = Router()
  me.use(requireUser)
  me.use((_req, res, next) => (res.set('Cache-Control', 'no-store'), next()))

  async function mine(req: Authed, res: Response): Promise<StoreRow | null> {
    const s = await q.storeByUser(req.userId!)
    if (!s) {
      res.status(404).json({ error: 'You have no store yet.' })
      return null
    }
    return activeConnection(s)
  }

  me.get('/store', async (req: Authed, res) => {
    let s = await q.storeByUser(req.userId!)
    if (!s) return void res.json({ store: null })
    s = await activeConnection(s)
    if (req.query.refresh === '1') s = await refreshAccount(s).catch(() => s!)
    res.json({ store: await storeView(s) })
  })

  me.get('/handle/:h', async (req: Authed, res) => {
    const h = String(req.params.h).toLowerCase()
    const problem = handleProblem(h)
    const taken = !problem && await q.storeByHandle(h)
    const own = taken && taken.userId === req.userId
    res.json({ available: !problem && (!taken || own), problem: problem ?? (taken && !own ? 'That handle is taken.' : null) })
  })

  me.post('/store', async (req: Authed, res) => {
    if (await q.storeByUser(req.userId!)) return void res.status(409).json({ error: 'You already have a store.' })
    const b = (req.body ?? {}) as Record<string, unknown>
    const handle = String(b.handle ?? '').toLowerCase()
    const problem = handleProblem(handle)
    if (problem) return void res.status(400).json({ error: problem })
    if (await q.storeByHandle(handle)) return void res.status(409).json({ error: 'That handle is taken.' })
    const name = str(b.name, 60).trim() || handle
    const t = now()
    const row = { id: `sto_${randomUUID()}`, userId: req.userId!, handle, draft: JSON.stringify(defaultPage(name)), createdAt: t, updatedAt: t }
    try {
      await sql.run(`INSERT INTO seller_store (id, "userId", handle, draft, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)`, row.id, row.userId, row.handle, row.draft, row.createdAt, row.updatedAt)
    } catch {
      return void res.status(409).json({ error: 'That handle is taken.' })
    }
    res.status(201).json({ store: await storeView((await q.storeByUser(req.userId!))!) })
  })

  me.put('/handle', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const handle = String((req.body as { handle?: unknown })?.handle ?? '').toLowerCase()
    const problem = handleProblem(handle)
    if (problem) return void res.status(400).json({ error: problem })
    const other = await q.storeByHandle(handle)
    if (other && other.id !== s.id) return void res.status(409).json({ error: 'That handle is taken.' })
    await sql.run(`UPDATE seller_store SET handle = ?, "updatedAt" = ? WHERE id = ?`, handle, now(), s.id)
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  /** Saves the draft page. The published page is untouched until Publish. */
  me.put('/store/draft', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    if (req.body?.revision !== s.revision) return void res.status(409).json({ error: 'This page changed elsewhere. Reload before saving; your edits are kept locally.' })
    const ids = new Set((await q.products(s.id)).map((p) => p.id))
    const page = cleanPage((req.body as { page?: unknown })?.page, ids)
    if (typeof page === 'string') return void res.status(400).json({ error: page })
    const saved = await sql.run(`UPDATE seller_store SET draft = ?, "updatedAt" = ?, revision = revision + 1 WHERE id = ? AND revision = ?`, JSON.stringify(page), now(), s.id, s.revision)
    if (!saved.changes) return void res.status(409).json({ error: 'Page changed elsewhere. Your edits are kept locally.' })
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  /** Copies the draft page and every complete, listed product to the live store. */
  me.post('/store/publish', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const t = now()
    await sql.tx(async (tx) => {
      for (const p of await q.products(s.id, tx)) {
        if (p.listed && !productProblem(p)) {
          await tx.run(`UPDATE seller_product SET "pubTitle" = title, "pubDescription" = description, "pubCover" = cover, "pubPriceMinor" = "priceMinor", "pubCurrency" = currency, "pubFileId" = "fileId", "pubFileName" = "fileName", "pubAt" = ? WHERE id = ?`, t, p.id)
        } else {
          await tx.run(`UPDATE seller_product SET "pubAt" = NULL WHERE id = ?`, p.id)
        }
      }
      await tx.run(`UPDATE seller_store SET published = draft, "publishedAt" = ?, "updatedAt" = ? WHERE id = ?`, t, t, s.id)
    })
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  /* products */
  function cleanProduct(b: Record<string, unknown>) {
    const out: Partial<ProductRow> = {}
    if ('title' in b) out.title = str(b.title, 80)
    if ('description' in b) out.description = str(b.description, 2000)
    if ('cover' in b) out.cover = mediaRef(b.cover)
    if ('priceMinor' in b) {
      const n = Number(b.priceMinor)
      if (!Number.isInteger(n) || n < 0 || n > 99_999_99) return 'Price must be between 0 and 99,999.99.'
      out.priceMinor = n
    }
    if ('currency' in b) {
      const c = String(b.currency).toLowerCase()
      if (!CURRENCIES.has(c)) return 'Unsupported currency.'
      out.currency = c
    }
    if ('listed' in b) out.listed = b.listed ? 1 : 0
    return out
  }

  me.post('/products', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const fields = cleanProduct((req.body ?? {}) as Record<string, unknown>)
    if (typeof fields === 'string') return void res.status(400).json({ error: fields })
    const count = (await q.products(s.id)).length
    if (count >= 200) return void res.status(400).json({ error: 'Product limit reached.' })
    const t = now()
    const id = `prd_${randomBytes(10).toString('hex')}`
    await sql.run(`INSERT INTO seller_product (id, "storeId", title, description, cover, "priceMinor", currency, listed, sort, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, s.id, fields.title ?? '', fields.description ?? '', fields.cover ?? null, fields.priceMinor ?? 900, fields.currency ?? 'gbp', fields.listed ?? 1, count, t, t)
    res.status(201).json({ product: productDraftView((await q.product(id, s.id))!), store: await storeView((await q.storeById(s.id))!) })
  })

  me.patch('/products/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    const fields = cleanProduct((req.body ?? {}) as Record<string, unknown>)
    if (typeof fields === 'string') return void res.status(400).json({ error: fields })
    if (req.body?.revision !== p.revision) return void res.status(409).json({ error: 'Product changed elsewhere. Reload before saving; your edits are kept locally.' })
    const next = { ...p, ...fields, updatedAt: now() }
    const saved = await sql.run(`UPDATE seller_product SET title = ?, description = ?, cover = ?, "priceMinor" = ?, currency = ?, listed = ?, "updatedAt" = ?, revision = revision + 1 WHERE id = ? AND revision = ?`, next.title, next.description, next.cover, next.priceMinor, next.currency, next.listed, next.updatedAt, next.id, p.revision)
    if (!saved.changes) return void res.status(409).json({ error: 'Product changed elsewhere. Your edits are kept locally.' })
    res.json({ product: productDraftView((await q.product(p.id, s.id))!), store: await storeView((await q.storeById(s.id))!) })
  })

  me.delete('/products/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    // Retain immutable files: delayed payments, disputes and refunds can resolve later.
    await sql.run(`DELETE FROM seller_product WHERE id = ?`, p.id)
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  /** Private product file. Raw body; the name comes from X-File-Name. */
  me.put('/products/:id/file', express.raw({ type: () => true, limit: seller.maxFileBytes }), async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    const body = req.body as Buffer
    if (!Buffer.isBuffer(body) || body.length === 0) return void res.status(400).json({ error: 'Empty file.' })
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'download')).replace(/[\\/\0\r\n"]/g, '_').slice(0, 120) || 'download'
    const type = String(req.headers['content-type'] ?? 'application/octet-stream').slice(0, 100)
    const fileId = `fil_${randomBytes(16).toString('hex')}`
    await blobs().put('files', fileId, body, 'application/octet-stream')
    const old = p.fileId
    await sql.run(`UPDATE seller_product SET "fileId" = ?, "fileName" = ?, "fileSize" = ?, "fileType" = ?, "updatedAt" = ? WHERE id = ?`, fileId, name, body.length, type, now(), p.id)
    // The old file stays if the live product or a paid order still points at it.
    void old // Immutable versions are retained, including in-flight checkout reservations.
    res.json({ product: productDraftView((await q.product(p.id, s.id))!) })
  })

  /** Public images (avatar, covers, image blocks). */
  me.post('/media', express.raw({ type: () => true, limit: 5 * 1024 * 1024 }), async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const type = String(req.headers['content-type'] ?? '')
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(type)) return void res.status(400).json({ error: 'Use a PNG, JPG, GIF or WebP image.' })
    const body = req.body as Buffer
    if (!Buffer.isBuffer(body) || !body.length) return void res.status(400).json({ error: 'Empty image.' })
    const id = `med_${randomBytes(12).toString('hex')}`
    await blobs().put('media', id, body, type)
    await sql.run(`INSERT INTO seller_media (id, "storeId", type, size, "createdAt") VALUES (?, ?, ?, ?, ?)`, id, s.id, type, body.length, now())
    res.status(201).json({ id, url: `${seller.apiUrl}/api/store-media/${id}` })
  })

  me.get('/orders', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const offset = Number(req.query.offset ?? 0)
    if (!Number.isSafeInteger(offset) || offset < 0) return void res.status(400).json({ error: 'Invalid order offset.' })
    const rows = await sql.all<OrderRow>(`SELECT * FROM seller_order WHERE "storeId" = ? ORDER BY "createdAt" DESC, id DESC LIMIT 101 OFFSET ?`, s.id, offset)
    const more = rows.length > 100
    if (more) rows.pop()
    res.json({ nextOffset: more ? offset + 100 : null, orders: rows.map((o) => ({ id: o.id, product: o.productTitle, amountMinor: o.amountMinor, currency: o.currency, status: o.status, buyer: o.buyerEmail, createdAt: o.createdAt, paidAt: o.paidAt, method: o.method, reference: o.reference, buyerClaimedAt: o.buyerClaimedAt })) })
  })

  /* payment methods: the seller's own PayPal and bank details */
  me.get('/payments', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    res.set('Cache-Control', 'no-store').json({ payments: readPayments(s.payments), methods: readyMethods(s), paypalAvailable: paypalConfigured() })
  })
  me.put('/payments', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const next = cleanPayments(req.body, readPayments(s.payments))
    if (typeof next === 'string') return void res.status(400).json({ error: next })
    await sql.run(`UPDATE seller_store SET payments = ?, "updatedAt" = ? WHERE id = ?`, JSON.stringify(next), now(), s.id)
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  /** Bank transfer: the seller checked their bank and the money is there. Only this unlocks the order. */
  me.post('/orders/:id/confirm', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const o = await q.order(String(req.params.id))
    if (!o || o.storeId !== s.id) return void res.status(404).json({ error: 'Order not found.' })
    if (o.method !== 'bank') return void res.status(400).json({ error: 'Only bank transfers are confirmed by hand.' })
    if (o.status === 'paid') return void res.json({ order: { id: o.id, status: o.status } })
    if (o.status !== 'pending') return void res.status(409).json({ error: `This order is ${o.status}.` })
    const done = await completeOrder(o, null, null)
    res.json({ order: { id: done.id, status: done.status } })
  })
  me.post('/orders/:id/cancel', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const o = await q.order(String(req.params.id))
    if (!o || o.storeId !== s.id) return void res.status(404).json({ error: 'Order not found.' })
    if (o.method !== 'bank' || o.status !== 'pending') return void res.status(409).json({ error: 'Only an unpaid bank transfer can be cancelled here.' })
    await sql.run(`UPDATE seller_order SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, o.id)
    res.json({ order: { id: o.id, status: 'cancelled' } })
  })

  /* payouts: Stripe-hosted Connect onboarding */
  me.post('/stripe/onboard', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const st = stripe()
    if (!st) return void res.status(503).json({ error: 'Payouts are not set up on this Desknoty server yet (STRIPE_SECRET_KEY).', setup: true })
    const returnTo = safeReturn((req.body as { returnTo?: unknown })?.returnTo)
    let accountId = s.stripeAccountId
    if (!accountId) {
      // Accounts v2: Stripe no longer lets new platforms create v1 accounts. A full-dashboard
      // account where Stripe collects its fees from the seller and manages losses keeps
      // Desknoty's platform fee at a true 0%. Onboarding links and status reads stay on v1.
      const a = (await st.rawRequest(
        'POST',
        '/v2/core/accounts',
        {
          contact_email: req.userEmail,
          identity: { country: seller.accountCountry },
          dashboard: 'full',
          defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          configuration: {
            merchant: { capabilities: { card_payments: { requested: true } } },
            recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
          },
          metadata: { desknotyStoreId: s.id },
        },
        { apiVersion: STRIPE_V2_VERSION, idempotencyKey: `onboard_${stripeMode}_${s.id}` },
      )) as unknown as { id: string }
      accountId = a.id
      await sql.run('INSERT INTO seller_connections ("storeId", mode, "accountId") VALUES (?, ?, ?) ON CONFLICT ("storeId", mode) DO NOTHING', s.id, stripeMode, accountId)
      await sql.run(`UPDATE seller_store SET "stripeAccountId" = ?, "stripeStatus" = 'incomplete', "updatedAt" = ?, "stripeMode" = ? WHERE id = ?`, accountId, now(), stripeMode, s.id)
    }
    const sep = returnTo.includes('?') ? '&' : '?'
    const link = await st.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${seller.siteUrl}${returnTo}${sep}stripe=refresh`,
      return_url: `${seller.siteUrl}${returnTo}${sep}stripe=return`,
    })
    res.json({ url: link.url })
  })

  me.post('/stripe/manage', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const st = stripe()
    if (!st || !s.stripeAccountId) return void res.status(400).json({ error: 'Connect a bank account first.' })
    // Full-dashboard sellers sign in to their own Stripe Dashboard to manage payouts.
    res.json({ url: seller.stripeApiBase ? `${seller.stripeApiBase}/dashboard/${s.stripeAccountId}` : 'https://dashboard.stripe.com/settings/payouts' })
  })

  /* TikTok Login Kit (web): optional */
  me.post('/tiktok/start', async (req: Authed, res) => {
    if (!sellerSetup().tiktok) return void res.status(503).json({ error: 'TikTok login is not switched on for this Desknoty server yet.', setup: true })
    const state = randomBytes(24).toString('base64url')
    await sql.run(`DELETE FROM oauth_state WHERE "expiresAt" < ?`, Date.now())
    await sql.run(`INSERT INTO oauth_state (state, "userId", provider, "returnTo", "expiresAt") VALUES (?, ?, ?, ?, ?)`, 
      state,
      req.userId!,
      'tiktok',
      safeReturn((req.body as { returnTo?: unknown })?.returnTo),
      Date.now() + 10 * 60 * 1000,
    )
    const u = new URLSearchParams({ client_key: seller.tiktokKey, scope: 'user.info.basic,user.info.profile', response_type: 'code', redirect_uri: tiktokRedirect(), state })
    res.json({ url: `https://www.tiktok.com/v2/auth/authorize/?${u}` })
  })

  me.post('/tiktok/disconnect', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    await sql.run(`UPDATE seller_store SET tiktok = NULL, "updatedAt" = ? WHERE id = ?`, now(), s.id)
    res.json({ store: await storeView((await q.storeById(s.id))!) })
  })

  r.use('/api/seller', me)

  /** TikTok sends the browser back here. The state must match one we issued, for this signed-in user. */
  r.get('/api/seller/tiktok/callback', async (req: Authed, res) => {
    const state = String(req.query.state ?? '')
    const row = await sql.get<{ userId: string; returnTo: string; expiresAt: number }>(`SELECT "userId", "returnTo", "expiresAt" FROM oauth_state WHERE state = ? AND provider = 'tiktok'`, state)
    if (row) await sql.run(`DELETE FROM oauth_state WHERE state = ?`, state)
    const back = (result: string) => {
      const to = row?.returnTo ?? '/app/pro'
      res.redirect(302, `${seller.siteUrl}${to}${to.includes('?') ? '&' : '?'}tiktok=${result}`)
    }
    if (!row || row.expiresAt < Date.now()) return back('expired')
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)
    if (!session || session.user.id !== row.userId) return back('wrong-account')
    if (req.query.error || !req.query.code) return back('cancelled')
    try {
      const tok = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: seller.tiktokKey, client_secret: seller.tiktokSecret, code: String(req.query.code), grant_type: 'authorization_code', redirect_uri: tiktokRedirect() }),
      }).then((r2) => r2.json() as Promise<{ access_token?: string; open_id?: string }>)
      if (!tok.access_token) return back('failed')
      const info = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      }).then((r2) => r2.json() as Promise<{ data?: { user?: { open_id?: string; avatar_url?: string; display_name?: string; username?: string } } }>)
      const u = info.data?.user
      if (!u?.open_id) return back('failed')
      const store = await q.storeByUser(row.userId)
      if (!store) return back('no-store')
      // Profile only; the access token is not kept.
      const profile = JSON.stringify({ openId: u.open_id, username: u.username ?? '', displayName: u.display_name ?? '', avatarUrl: u.avatar_url ?? '' })
      await sql.run(`UPDATE seller_store SET tiktok = ?, "updatedAt" = ? WHERE id = ?`, profile, now(), store.id)
      await applyTiktokProfile(store, { username: u.username ?? '', displayName: u.display_name ?? '', avatarUrl: u.avatar_url ?? '' }).catch((err) => console.error('[seller] TikTok profile copy failed', err))
      return back('connected')
    } catch (err) {
      console.error('[seller] TikTok login failed', err)
      return back('failed')
    }
  })

  /* ---------------------------------------------- public storefront --- */

  const pub = Router()
  pub.use((_req, res, next) => (res.set('Cache-Control', 'no-store'), next()))

  async function liveStore(req: Request, res: Response): Promise<StoreRow | null> {
    const s = await q.storeById(String(req.params.handle)) ?? await q.storeByHandle(String(req.params.handle).toLowerCase())
    if (!s || !s.published || !s.userId) {
      res.status(404).json({ error: 'This store doesn’t exist or isn’t published yet.' })
      return null
    }
    return s
  }
  const liveProducts = async (s: StoreRow) => (await q.products(s.id)).filter((p) => p.pubAt)

  /** Published stores and products, for pre-rendering their pages at deploy time. Public data only. */
  r.get('/api/store-directory', async (_req, res) => {
    const stores = await sql.all<{ id: string; handle: string }>(`SELECT id, handle FROM seller_store WHERE published IS NOT NULL ORDER BY handle LIMIT 5000`)
    const out = []
    for (const s of stores) out.push({ handle: s.handle, products: (await sql.all<{ id: string }>(`SELECT id FROM seller_product WHERE "storeId" = ? AND "pubAt" IS NOT NULL`, s.id)).map((p) => p.id) })
    res.set('Cache-Control', 'public, max-age=60').json({ stores: out })
  })

  pub.get('/:handle', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    res.json({ handle: s.handle, page: JSON.parse(s.published!), products: (await liveProducts(s)).map(productPublicView), checkoutReady: readyMethods(s).length > 0, methods: readyMethods(s), testMode: sellerSetup().stripeMode !== 'live' || paypalMode() !== 'live' })
  })

  pub.post('/:handle/checkout', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const productId = String((req.body as { productId?: unknown })?.productId ?? '')
    const p = await q.product(productId, s.id)
    if (!p || !p.pubAt || !p.pubFileId || p.pubPriceMinor == null || !p.pubCurrency) return void res.status(404).json({ error: 'This product isn’t for sale.' })
    const method = String(req.body?.method ?? 'stripe')
    if (method === 'paypal' || method === 'bank') return void (await altCheckout(req, res, s, p, method))
    if (method !== 'stripe') return void res.status(400).json({ error: 'Unknown payment method.' })
    if (!readPayments(s.payments).stripe.enabled) return void res.status(409).json({ error: 'This seller doesn’t take card payments.' })
    const st = stripe()
    if (!st) return void res.status(503).json({ error: 'Checkout isn’t switched on for this store yet.' })
    const fresh = await refreshAccount(s).catch(() => s)
    if (!fresh.stripeAccountId || !fresh.chargesReady) return void res.status(409).json({ error: 'This seller can’t take payments yet.' })
    const key = String(req.body?.checkoutKey ?? req.body?.requestId ?? randomUUID())
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return void res.status(400).json({ error: 'Invalid checkout key.' })
    const order = await sql.tx(async tx => {
      await tx.run(`INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", "checkoutKey", "stripeMode") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ("storeId", "checkoutKey") DO NOTHING`, `ord_${randomBytes(12).toString('hex')}`, s.id, p.id, p.pubTitle ?? '', p.pubFileId, p.pubFileName ?? 'download', fresh.stripeAccountId, p.pubPriceMinor, p.pubCurrency, randomBytes(24).toString('base64url'), now(), key, stripeMode)
      return (await tx.get<OrderRow>('SELECT * FROM seller_order WHERE "storeId" = ? AND "checkoutKey" = ?', s.id, key))!
    })
    if (order.productId !== p.id || order.stripeMode !== stripeMode || order.method !== 'stripe') return void res.status(409).json({ error: 'This checkout key belongs to a different purchase.' })
    if (order.checkoutUrl) return void res.json({ url: order.checkoutUrl })
    if (Date.now() - Date.parse(order.createdAt) > 23 * 60 * 60 * 1000) return void res.status(409).json({ error: 'This checkout attempt expired. Start a new purchase.' })
    const session = await st.checkout.sessions.create({
      mode: 'payment', adaptive_pricing: { enabled: false },
      line_items: [{ quantity: 1, price_data: { currency: order.currency, unit_amount: order.amountMinor, product_data: { name: order.productTitle } } }],
      success_url: `${seller.siteUrl}/store/${s.id}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${seller.siteUrl}/store/${s.id}?checkout=cancelled`,
      metadata: { desknotyOrderId: order.id, desknotyStoreId: s.id, desknotyProductId: p.id },
      payment_intent_data: { metadata: { desknotyOrderId: order.id } },
    }, { stripeAccount: order.accountId, idempotencyKey: `checkout_${order.id}` })
    await sql.run('UPDATE seller_order SET "sessionId" = ?, "checkoutUrl" = ? WHERE id = ?', session.id, session.url, order.id)
    res.json({ url: session.url })
  })

  /** PayPal and bank transfer checkout. Same order row, receipt and download flow as Stripe. */
  async function altCheckout(req: Request, res: Response, s: StoreRow, p: ProductRow, method: 'paypal' | 'bank') {
    const pay = readPayments(s.payments)
    if (!readyMethods(s, pay).includes(method)) return void res.status(409).json({ error: method === 'paypal' ? 'This seller doesn’t take PayPal.' : 'This seller doesn’t take bank transfers.' })
    const key = String(req.body?.checkoutKey ?? randomUUID())
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return void res.status(400).json({ error: 'Invalid checkout key.' })
    const buyerEmail = String(req.body?.email ?? '').trim().toLowerCase()
    if (method === 'bank' && !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(buyerEmail)) return void res.status(400).json({ error: 'Enter your email: the seller sends your download there once your transfer arrives.' })
    const id = `ord_${randomBytes(12).toString('hex')}`
    const order = await sql.tx(async (tx) => {
      await tx.run(
        `INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", "checkoutKey", "stripeMode", method, reference, "buyerEmail") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ("storeId", "checkoutKey") DO NOTHING`,
        id, s.id, p.id, p.pubTitle ?? '', p.pubFileId, p.pubFileName ?? 'download',
        method === 'paypal' ? `paypal:${pay.paypal.email}` : 'bank',
        p.pubPriceMinor, p.pubCurrency, randomBytes(24).toString('base64url'), now(), key, stripeMode, method,
        method === 'bank' ? bankReference(id) : null,
        method === 'bank' ? buyerEmail : null,
      )
      return (await tx.get<OrderRow>('SELECT * FROM seller_order WHERE "storeId" = ? AND "checkoutKey" = ?', s.id, key))!
    })
    // A retry with the same key returns the same order; a key from another purchase is refused.
    if (order.productId !== p.id || order.method !== method) return void res.status(409).json({ error: 'This checkout key belongs to a different purchase.' })
    if (method === 'bank') {
      return void res.json({ orderUrl: `/store/${s.handle}/order/${order.id}?k=${encodeURIComponent(order.accessKey)}`, order: await orderView(order, s) })
    }
    if (order.checkoutUrl) return void res.json({ url: order.checkoutUrl })
    const payee = order.accountId.replace(/^paypal:/, '')
    const back = `${seller.siteUrl}/store/${s.id}/thanks?paypal_order=${order.id}&k=${encodeURIComponent(order.accessKey)}`
    const { paypalOrderId, approveUrl } = await createPaypalOrder({ id: order.id, amountMinor: order.amountMinor, currency: order.currency, title: order.productTitle }, payee, back, `${seller.siteUrl}/store/${s.handle}?checkout=cancelled`)
    await sql.run('UPDATE seller_order SET "providerOrderId" = ?, "checkoutUrl" = ? WHERE id = ? AND "providerOrderId" IS NULL', paypalOrderId, approveUrl, order.id)
    const saved = (await q.order(order.id))!
    res.json({ url: saved.checkoutUrl })
  }

  /** Looks up an order from a buyer link (order id + private access key). */
  async function buyerOrder(orderId: string, k: string) {
    const o = await q.order(orderId)
    const st = o ? await q.storeById(o.storeId) : undefined
    const key = Buffer.from(k)
    if (!o || !st || key.length !== o.accessKey.length || !timingSafeEqual(key, Buffer.from(o.accessKey))) return null
    return { o, st }
  }

  /** PayPal: verify with PayPal itself (capture or re-read), then complete. Safe to repeat. */
  async function settlePaypal(o: OrderRow): Promise<OrderRow> {
    if (o.status === 'paid' || o.method !== 'paypal' || !o.providerOrderId) return o
    const po = await captureOrRead(o.providerOrderId, o.id)
    const v = verifyPaypalPayment(po, o, o.accountId.replace(/^paypal:/, ''))
    if (!v.ok) {
      if (po.status === 'VOIDED') await sql.run(`UPDATE seller_order SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, o.id)
      else if (po.status === 'COMPLETED') console.error(`[seller] PayPal order ${o.providerOrderId} for ${o.id} refused: ${v.reason}`)
      return (await q.order(o.id))!
    }
    return completeOrder(o, v.payerEmail)
  }

  async function orderView(o: OrderRow, s: StoreRow) {
    const downloadExpiresAt = Date.now() + DOWNLOAD_TTL
    const receipt = o.receiptId ? await sql.get<{status: string}>('SELECT status FROM email_outbox WHERE id = ?', o.receiptId) : null
    return {
      id: o.id,
      status: o.status,
      product: o.productTitle,
      amountMinor: o.amountMinor,
      currency: o.currency,
      email: o.buyerEmail,
      fileName: o.fileName,
      downloadUrl: o.status === 'paid' ? `${seller.apiUrl}/api/store-download/${signDownload(o.id, downloadExpiresAt)}` : null,
      retrievalUrl: o.status === 'paid' ? retrievalUrl(o, s.handle) : null,
      downloadExpiresAt,
      method: o.method,
      // Bank transfer: what to pay and where, until the seller confirms it arrived.
      bank: o.method === 'bank' && o.status === 'pending' ? { ...bankDetails(readPayments(s.payments)), reference: o.reference } : null,
      buyerClaimedAt: o.buyerClaimedAt,
      receiptSent: receipt?.status === 'sent',
      receiptStatus: receipt?.status === 'sent' ? 'accepted' : receipt?.status ?? 'not_queued',
    }
  }

  /** The Checkout success page asks here; if the webhook hasn't arrived yet, Stripe is asked directly. */
  pub.get('/:handle/session/:sessionId', async (req, res) => {
    const s = await q.storeById(String(req.params.handle)) ?? await q.storeByHandle(String(req.params.handle).toLowerCase())
    let o = await q.orderBySession(String(req.params.sessionId))
    const purchaseStore = o ? await q.storeById(o.storeId) : undefined
    if (!purchaseStore || !o || (s && o.storeId !== s.id)) return void res.status(404).json({ error: 'Order not found.' })
    const st = stripe()
    // SELLER_CONFIRM_FALLBACK=off: only the signed webhook may fulfil (used to prove webhook delivery).
    if (o.status === 'pending' && st && process.env.SELLER_CONFIRM_FALLBACK !== 'off') {
      const session = await st.checkout.sessions.retrieve(o.sessionId!, { stripeAccount: o.accountId }).catch(() => null)
      if (session) {
        o = await fulfil(o, session)
        if (session.status === 'expired') await markOrder(session.id, 'cancelled')
        o = (await q.order(o.id))!
      }
    }
    res.json({ order: await orderView(o, purchaseStore) })
  })

  /** The link in the receipt email: re-issues a fresh download link for a paid order. */
  pub.get('/:handle/order/:orderId', async (req, res) => {
    const o = await q.order(String(req.params.orderId))
    const ownerStore = o ? await q.storeById(o.storeId) : undefined
    const k = Buffer.from(String(req.query.k ?? ''))
    if (!ownerStore || !o || k.length !== o.accessKey.length || !timingSafeEqual(k, Buffer.from(o.accessKey))) {
      return void res.status(404).json({ error: 'Order not found.' })
    }
    res.json({ order: await orderView(o, ownerStore) })
  })

  /** Bank transfer: the buyer says they've sent it. Recorded for the seller; it never unlocks the download. */
  pub.post('/:handle/order/:orderId/claim', async (req, res) => {
    const found = await buyerOrder(String(req.params.orderId), String(req.body?.k ?? ''))
    if (!found) return void res.status(404).json({ error: 'Order not found.' })
    if (found.o.method === 'bank' && found.o.status === 'pending')
      await sql.run(`UPDATE seller_order SET "buyerClaimedAt" = COALESCE("buyerClaimedAt", ?) WHERE id = ?`, now(), found.o.id)
    res.json({ order: await orderView((await q.order(found.o.id))!, found.st) })
  })

  /** PayPal return page: the server verifies the payment with PayPal; the URL's token is not trusted. */
  pub.post('/:handle/paypal/confirm', async (req, res) => {
    const found = await buyerOrder(String(req.body?.orderId ?? ''), String(req.body?.k ?? ''))
    if (!found || found.o.method !== 'paypal') return void res.status(404).json({ error: 'Order not found.' })
    const o = await settlePaypal(found.o).catch((err) => {
      console.error('[seller] PayPal confirm failed', err)
      return found.o
    })
    res.json({ order: await orderView(o, found.st) })
  })

  r.use('/api/store', pub)

  /** PayPal webhooks (signature checked with PayPal): finish orders even if the buyer never came back. */
  r.post('/api/paypal/webhook', async (req, res) => {
    const event = req.body as { id?: string; event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } }
    if (!event?.id || !(await verifyPaypalWebhook(req.headers, event).catch(() => false))) return void res.status(400).json({ error: 'Invalid signature.' })
    const paypalOrderId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? event.resource?.id : event.resource?.supplementary_data?.related_ids?.order_id
    const o = paypalOrderId ? await sql.get<OrderRow>(`SELECT * FROM seller_order WHERE "providerOrderId" = ?`, paypalOrderId) : undefined
    if (!o) return void res.json({ received: true })
    try {
      // Completing is idempotent, so a repeated or concurrent notification changes nothing.
      if (event.event_type === 'CHECKOUT.ORDER.APPROVED') await settlePaypal(o)
      else if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && o.status !== 'paid') {
        const po = await readPaypalOrder(paypalOrderId!)
        const v = verifyPaypalPayment(po, o, o.accountId.replace(/^paypal:/, ''))
        if (v.ok) await completeOrder(o, v.payerEmail)
      }
      res.json({ received: true })
    } catch (err) {
      console.error('[seller] PayPal webhook failed', err)
      res.status(500).json({ error: 'Webhook handling failed.' })
    }
  })

  /** Private file, only through a valid, unexpired link for a paid order. */
  r.get('/api/store-download/:token', async (req, res) => {
    const orderId = verifyDownload(String(req.params.token))
    const o = orderId ? await q.order(orderId) : undefined
    if (!o || o.status !== 'paid') return void res.status(403).json({ error: 'This download link is invalid or has expired.' })
    if (!/^fil_[a-f0-9]{32}$/.test(o.fileId) || !(await blobs().exists('files', o.fileId))) return void res.status(410).json({ error: 'This file is no longer available.' })
    await blobs().send('files', o.fileId, res, { fileName: o.fileName.replace(/[^\w.\- ]/g, '_'), type: 'application/octet-stream', cache: 'private, no-store' })
  })

  r.get('/api/store-media/:id', async (req, res) => {
    const id = String(req.params.id)
    const m = /^med_[a-f0-9]{24}$/.test(id) ? await sql.get(`SELECT type FROM seller_media WHERE id = ?`, id) : undefined
    if (!m || !(await blobs().exists('media', id))) return void res.status(404).end()
    await blobs().send('media', id, res, { type: String(m.type), cache: 'public, max-age=31536000, immutable' })
  })

  return r
}



