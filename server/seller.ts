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
import { enqueueEmail } from './mail/index.ts'

/* ------------------------------------------------------------- config --- */

export const PLATFORM_FEE_PERCENT = 0

const seller = {
  stripeSecret: (process.env.STRIPE_SECRET_KEY ?? '').trim(),
  webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim(),
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
  email: true,
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

    -- Stores that existed before Seller Studio required Pro + a verified email.
    -- Their owners keep access (grandfathered); see MERGE_PLAN.md for rollback.
    CREATE TABLE IF NOT EXISTS seller_grandfathered (
      "storeId" TEXT PRIMARY KEY REFERENCES seller_store(id) ON DELETE CASCADE,
      "grantedAt" TEXT NOT NULL
    );
  `)
  await grandfatherExistingStores()
}

/**
 * One-time, additive migration: every store present the first time this runs
 * is grandfathered. Marked done in site_settings so later stores never are.
 */
export async function grandfatherExistingStores() {
  await sql.tx(async (tx) => {
    const done = await tx.get(`SELECT 1 AS one FROM site_settings WHERE key = 'seller-enforcement-v1'`)
    if (done) return
    const at = now()
    await tx.run(`INSERT INTO seller_grandfathered ("storeId", "grantedAt") SELECT id, ? FROM seller_store WHERE true ON CONFLICT ("storeId") DO NOTHING`, at)
    await tx.run(`INSERT INTO site_settings (key, value, "updatedAt") VALUES ('seller-enforcement-v1', ?, ?) ON CONFLICT (key) DO NOTHING`, at, at)
  })
}

/* -------------------------------------------------------------- types --- */

interface StoreRow {
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
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  buyerEmail: string | null
  accessKey: string
  createdAt: string
  paidAt: string | null
  emailedAt: string | null
}

export type PayoutStatus = 'not_connected' | 'incomplete' | 'pending' | 'ready'

/* ------------------------------------------------------------ helpers --- */

const now = () => new Date().toISOString()
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'dashboard', 'help', 'blog', 'store', 'desknoty', 'support'])
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

function payoutView(s: StoreRow) {
  return { status: s.stripeStatus, accountId: s.stripeAccountId ? `…${s.stripeAccountId.slice(-6)}` : null, checkoutReady: Boolean(s.chargesReady) }
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
    // Seller Studio is a Pro tool, and payouts need an address we know is real.
    const u = session.user as { plan?: string | null; emailVerified?: boolean | number }
    // Stores from before this rule keep working (grandfathered); SELLER_ENFORCE=off is the emergency rollback.
    const exempt =
      process.env.SELLER_ENFORCE === 'off' ||
      Boolean(await sql.get(`SELECT 1 AS one FROM seller_grandfathered g JOIN seller_store s ON s.id = g."storeId" WHERE s."userId" = ?`, session.user.id))
    if (!exempt && u.plan !== 'pro') return void res.status(403).json({ error: 'Seller Studio is part of Desknoty Pro.', needs: 'pro' })
    if (!exempt && !u.emailVerified) return void res.status(403).json({ error: 'Verify your email address to use Seller Studio.', needs: 'verify-email' })
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

async function refreshAccount(s: StoreRow): Promise<StoreRow> {
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
const downloadUrl = (orderId: string) => `${seller.apiUrl}/api/store-download/${signDownload(orderId)}`
const retrievalUrl = (o: OrderRow, handle: string) => `${seller.siteUrl}/store/${handle}/order/${o.id}?k=${o.accessKey}`

/* ------------------------------------------------------- fulfilment --- */

/**
 * Marks an order paid once Stripe confirms it, and sends the receipt exactly
 * once. Safe to call any number of times, from the webhook or the return page.
 */
export async function fulfil(order: OrderRow, session: Pick<Stripe.Checkout.Session, 'payment_status' | 'amount_total' | 'currency' | 'customer_details' | 'id'>): Promise<OrderRow> {
  if (session.id !== order.sessionId) return order
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return order
  if (session.amount_total !== order.amountMinor || (session.currency ?? '').toLowerCase() !== order.currency) {
    console.error(`[seller] order ${order.id}: paid amount does not match, not fulfilling`)
    return order
  }
  await sql.tx(async (tx) => {
    const email = session.customer_details?.email ?? null
    await tx.run(
      `UPDATE seller_order SET status = 'paid', "paidAt" = ?, "buyerEmail" = COALESCE(?, "buyerEmail") WHERE id = ? AND status != 'paid'`,
      now(),
      email,
      order.id,
    )
    // Claim the receipt atomically: only the call that sets emailedAt sends it.
    const claim = await tx.run(`UPDATE seller_order SET "emailedAt" = ? WHERE id = ? AND status = 'paid' AND "emailedAt" IS NULL AND "buyerEmail" IS NOT NULL`, now(), order.id)
    if (!claim.changes) return
    const row = (await q.order(order.id, tx))!
    const store = await q.storeById(row.storeId, tx)
    if (store)
      await enqueueEmail(
        'order-receipt',
        row.buyerEmail!,
        {
          url: retrievalUrl(row, store.handle),
          name: row.productTitle,
          email: (JSON.parse(store.published ?? store.draft) as Page).name || store.handle,
          amount: new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency.toUpperCase() }).format(row.amountMinor / 100),
        },
        tx,
      )
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
      const order = s.id ? await q.orderBySession(s.id) : undefined
      if (!order) return
      if (event.account && event.account !== order.accountId) return
      await fulfil(order, s)
      return
    }
    case 'checkout.session.async_payment_failed': {
      const s = event.data.object as Stripe.Checkout.Session
      await markOrder(s.id, 'failed')
      return
    }
    case 'checkout.session.expired': {
      const s = event.data.object as Stripe.Checkout.Session
      await markOrder(s.id, 'cancelled')
      return
    }
    case 'charge.refunded': {
      // A full refund revokes the purchase: no more download links, receipt link shows it refunded.
      // Partial refunds keep access (the buyer still paid for the product).
      const ch = event.data.object as Stripe.Charge
      if (!ch.refunded || !event.account) return
      const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id
      const st = stripe()
      if (!piId || !st) return
      const pi = await st.paymentIntents.retrieve(piId, { stripeAccount: event.account })
      const orderId = pi.metadata?.desknotyOrderId
      if (orderId) await sql.run(`UPDATE seller_order SET status = 'refunded' WHERE id = ? AND "accountId" = ? AND status = 'paid'`, orderId, event.account)
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
    handle: s.handle,
    url: `${seller.siteUrl}/store/${s.handle}`,
    draft: JSON.parse(s.draft) as Page,
    published: s.published ? (JSON.parse(s.published) as Page) : null,
    publishedAt: s.publishedAt,
    unpublishedChanges: s.published !== s.draft || products.some((p) => productDraftView(p).changed || (Boolean(p.listed) !== Boolean(p.pubAt) && !productProblem(p))),
    tiktok: s.tiktok ? (JSON.parse(s.tiktok) as { username: string; displayName: string; avatarUrl: string }) : null,
    payouts: payoutView(s),
    products: products.map(productDraftView),
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
    return s
  }

  me.get('/store', async (req: Authed, res) => {
    let s = await q.storeByUser(req.userId!)
    if (!s) return void res.json({ store: null })
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
    const ids = new Set((await q.products(s.id)).map((p) => p.id))
    const page = cleanPage((req.body as { page?: unknown })?.page, ids)
    if (typeof page === 'string') return void res.status(400).json({ error: page })
    await sql.run(`UPDATE seller_store SET draft = ?, "updatedAt" = ? WHERE id = ?`, JSON.stringify(page), now(), s.id)
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
    const next = { ...p, ...fields, updatedAt: now() }
    await sql.run(`UPDATE seller_product SET title = ?, description = ?, cover = ?, "priceMinor" = ?, currency = ?, listed = ?, "updatedAt" = ? WHERE id = ?`, next.title, next.description, next.cover, next.priceMinor, next.currency, next.listed, next.updatedAt, next.id)
    res.json({ product: productDraftView((await q.product(p.id, s.id))!), store: await storeView((await q.storeById(s.id))!) })
  })

  me.delete('/products/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    await sql.run(`DELETE FROM seller_product WHERE id = ?`, p.id)
    // A file stays while any order (paid, or pending and still payable) points at it.
    for (const f of new Set([p.fileId, p.pubFileId])) {
      if (!f) continue
      const used = await sql.get(`SELECT 1 AS one FROM seller_order WHERE "fileId" = ? AND status IN ('paid', 'pending') LIMIT 1`, f)
      if (!used) removeFile(f)
    }
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
    if (old && old !== p.pubFileId && !(await sql.get(`SELECT 1 AS one FROM seller_order WHERE "fileId" = ? LIMIT 1`, old))) removeFile(old)
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
    const rows = await sql.all(`SELECT * FROM seller_order WHERE "storeId" = ? ORDER BY "createdAt" DESC LIMIT 100`, s.id)
    res.json({ orders: rows.map((o) => ({ id: o.id, product: o.productTitle, amountMinor: o.amountMinor, currency: o.currency, status: o.status, buyer: o.buyerEmail, createdAt: o.createdAt, paidAt: o.paidAt })) })
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
        // Same key for concurrent clicks: Stripe returns the same account instead of a second one.
        { apiVersion: STRIPE_V2_VERSION, idempotencyKey: `desknoty_account_${s.id}` } as never,
      )) as unknown as { id: string }
      // Only the first writer stores its account; everyone then uses whatever is stored.
      await sql.run(`UPDATE seller_store SET "stripeAccountId" = ?, "stripeStatus" = 'incomplete', "updatedAt" = ? WHERE id = ? AND "stripeAccountId" IS NULL`, a.id, now(), s.id)
      accountId = (await q.storeById(s.id))!.stripeAccountId ?? a.id
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
    const s = await q.storeByHandle(String(req.params.handle).toLowerCase())
    if (!s || !s.published) {
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
    res.json({ handle: s.handle, page: JSON.parse(s.published!), products: (await liveProducts(s)).map(productPublicView), checkoutReady: Boolean(s.chargesReady) && Boolean(stripe()), testMode: sellerSetup().stripeMode !== 'live' })
  })

  pub.post('/:handle/checkout', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const productId = String((req.body as { productId?: unknown })?.productId ?? '')
    const p = await q.product(productId, s.id)
    if (!p || !p.pubAt || !p.pubFileId || p.pubPriceMinor == null || !p.pubCurrency) return void res.status(404).json({ error: 'This product isn’t for sale.' })
    const st = stripe()
    if (!st) return void res.status(503).json({ error: 'Checkout isn’t switched on for this store yet.' })
    const fresh = await refreshAccount(s).catch(() => s)
    if (!fresh.stripeAccountId || !fresh.chargesReady) return void res.status(409).json({ error: 'This seller can’t take payments yet.' })
    // A retried request (same requestId from the buyer's page) maps to the same order and the same
    // Stripe session, so double clicks or network retries never create duplicate orders.
    const requestId = String((req.body as { requestId?: unknown })?.requestId ?? '')
    const orderId = /^[A-Za-z0-9-]{8,64}$/.test(requestId)
      ? `ord_${createHmac('sha256', env.secret).update(`checkout:${s.id}:${p.id}:${requestId}`).digest('hex').slice(0, 24)}`
      : `ord_${randomBytes(12).toString('hex')}`
    const existing = await q.order(orderId)
    if (existing?.sessionId) {
      const prev = await st.checkout.sessions.retrieve(existing.sessionId, { stripeAccount: existing.accountId }).catch(() => null)
      if (prev?.status === 'open' && prev.url) return void res.json({ url: prev.url })
      if (existing.status === 'paid') return void res.status(409).json({ error: 'This purchase is already complete.' })
    }
    const session = await st.checkout.sessions.create(
      {
        mode: 'payment',
        // Charge exactly the seller's published price and currency (Adaptive Pricing would show the
        // buyer a converted amount, which then wouldn't match the order).
        adaptive_pricing: { enabled: false },
        line_items: [{ quantity: 1, price_data: { currency: p.pubCurrency, unit_amount: p.pubPriceMinor, product_data: { name: p.pubTitle ?? 'Digital product' } } }],
        success_url: `${seller.siteUrl}/store/${s.handle}/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${seller.siteUrl}/store/${s.handle}/p/${p.id}?checkout=cancelled`,
        metadata: { desknotyOrderId: orderId, desknotyStoreId: s.id, desknotyProductId: p.id },
        payment_intent_data: { metadata: { desknotyOrderId: orderId } },
      },
      { stripeAccount: fresh.stripeAccountId, idempotencyKey: `checkout_${orderId}` },
    )
    await sql.run(`INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "sessionId", "accountId", "amountMinor", currency, "accessKey", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`, orderId, s.id, p.id, p.pubTitle ?? '', p.pubFileId, p.pubFileName ?? 'download', session.id, fresh.stripeAccountId, p.pubPriceMinor, p.pubCurrency, randomBytes(24).toString('base64url'), now())
    res.json({ url: session.url })
  })

  /**
   * The order's store for a link carrying `handle`. The store's current handle
   * matches; so does a handle no store uses any more (the seller renamed it
   * after the receipt was sent). Another store's handle never does.
   */
  async function orderStore(o: OrderRow, handle: string): Promise<StoreRow | undefined> {
    const s = await q.storeById(o.storeId)
    if (!s) return undefined
    const named = await q.storeByHandle(handle.toLowerCase())
    return !named || named.id === s.id ? s : undefined
  }

  /** The receipt's real state, from the outbox: only 'sent' means the mail server accepted it. */
  async function receiptState(o: OrderRow): Promise<'sent' | 'queued' | 'failed' | null> {
    if (o.status !== 'paid' || !o.buyerEmail || !o.emailedAt) return null
    const m = await sql.get<{ status: string }>(
      `SELECT status FROM email_outbox WHERE kind = 'order-receipt' AND recipient = ? AND "createdAt" >= ? ORDER BY id LIMIT 1`,
      o.buyerEmail.toLowerCase(),
      Date.parse(String(o.emailedAt)) - 60_000,
    )
    return m?.status === 'sent' ? 'sent' : m?.status === 'failed' ? 'failed' : 'queued'
  }

  async function orderView(o: OrderRow, s: StoreRow) {
    return {
      receipt: await receiptState(o),
      id: o.id,
      status: o.status,
      product: o.productTitle,
      amountMinor: o.amountMinor,
      currency: o.currency,
      email: o.buyerEmail,
      fileName: o.fileName,
      downloadUrl: o.status === 'paid' ? downloadUrl(o.id) : null,
      retrievalUrl: o.status === 'paid' ? retrievalUrl(o, s.handle) : null,
    }
  }

  /** The Checkout success page asks here; if the webhook hasn't arrived yet, Stripe is asked directly. */
  pub.get('/:handle/session/:sessionId', async (req, res) => {
    // The order's own store, not the handle in the URL: links keep working after a handle change.
    let o = await q.orderBySession(String(req.params.sessionId))
    const s = o ? await orderStore(o, String(req.params.handle)) : undefined
    if (!s || !o) return void res.status(404).json({ error: 'Order not found.' })
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
    res.json({ order: await orderView(o, s) })
  })

  /** The link in the receipt email: re-issues a fresh download link for a paid order. */
  pub.get('/:handle/order/:orderId', async (req, res) => {
    const o = await q.order(String(req.params.orderId))
    const s = o ? await orderStore(o, String(req.params.handle)) : undefined
    const k = Buffer.from(String(req.query.k ?? ''))
    if (!s || !o || k.length !== o.accessKey.length || !timingSafeEqual(k, Buffer.from(o.accessKey))) {
      return void res.status(404).json({ error: 'Order not found.' })
    }
    res.json({ order: await orderView(o, s) })
  })

  r.use('/api/store', pub)

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

function removeFile(id: string) {
  if (!/^fil_[a-f0-9]{32}$/.test(id)) return
  void blobs().remove('files', id)
}

