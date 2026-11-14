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
import { checkEmail, normalizeEmail } from './email-check.ts'
import { CARD_MINIMUM, isTimeZone, normaliseCode, offerPrice, offerWindow, quote as priceQuote, zonedToUtc } from './seller-pricing.ts'
import type { CouponRow } from './seller-pricing.ts'
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
import { enqueueEmail, sendNow, transportName } from './mail/index.ts'
import { migrateSeller } from './seller-migrations.ts'
import { bankComplete, bankDetails, bankReference, captureOrRead, cleanPayments, createPaypalOrder, paypalConfigured, paypalMode, readPaypalOrder, readPayments, verifyPaypalPayment, verifyPaypalWebhook, bankDetailsOf, bankChoices } from './payments.ts'
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

/**
 * Withdrawals move money, so they are on in Stripe Sandbox (test keys) only,
 * unless the owner explicitly sets SELLER_LIVE_PAYOUTS=true for live keys.
 */
const payoutsAllowed = () => Boolean(seller.stripeSecret) && (stripeMode === 'test' || process.env.SELLER_LIVE_PAYOUTS === 'true')

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

    -- Stage B: discount codes. used counts live reservations (pending + paid orders).
    CREATE TABLE IF NOT EXISTS seller_coupon (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      kind TEXT NOT NULL,
      value INTEGER NOT NULL,
      currency TEXT,
      "productIds" TEXT,
      "startsAt" TEXT,
      "endsAt" TEXT,
      "maxRedemptions" INTEGER,
      "perCustomer" INTEGER,
      used INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS seller_coupon_code ON seller_coupon ("storeId", code);
    CREATE TABLE IF NOT EXISTS seller_coupon_customer (
      "couponId" TEXT NOT NULL REFERENCES seller_coupon(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY ("couponId", email)
    );
    -- One row per order that used a code: reserved at checkout, confirmed when paid, released if it fails.
    CREATE TABLE IF NOT EXISTS seller_coupon_use (
      "orderId" TEXT PRIMARY KEY,
      "couponId" TEXT NOT NULL REFERENCES seller_coupon(id) ON DELETE CASCADE,
      email TEXT,
      status TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    -- Stage C: verified reviews. One per buyer per product; only Desknoty admins can remove one.
    CREATE TABLE IF NOT EXISTS seller_review (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      "productId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "reviewerKey" TEXT NOT NULL,
      rating INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'visible',
      "removedReason" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS seller_review_one ON seller_review ("productId", "reviewerKey");
    CREATE INDEX IF NOT EXISTS seller_review_product ON seller_review ("productId", status);
    CREATE TABLE IF NOT EXISTS seller_review_report (
      "reviewId" TEXT NOT NULL REFERENCES seller_review(id) ON DELETE CASCADE,
      reporter TEXT NOT NULL,
      reason TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      PRIMARY KEY ("reviewId", reporter)
    );
    -- Stage C: favourites of signed-in customers (private to them).
    CREATE TABLE IF NOT EXISTS customer_favourite (
      "userId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      PRIMARY KEY ("userId", "productId")
    );

    -- V3: free products are claimed through an emailed link. One claim per browser per product;
    -- only the latest link works; the order is created when the link is opened.
    CREATE TABLE IF NOT EXISTS seller_claim (
      id TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL REFERENCES seller_store(id) ON DELETE CASCADE,
      "productId" TEXT NOT NULL,
      "clientRef" TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      "couponCode" TEXT,
      "tokenHash" TEXT NOT NULL,
      "tokenExpiresAt" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "sendCount" INTEGER NOT NULL DEFAULT 0,
      "sendDay" TEXT NOT NULL DEFAULT '',
      "lastSentAt" TEXT,
      "outboxId" INTEGER,
      delivery TEXT,
      "orderId" TEXT,
      "ipHash" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS seller_claim_ref ON seller_claim ("storeId", "productId", "clientRef");
    CREATE INDEX IF NOT EXISTS seller_claim_ip ON seller_claim ("ipHash", "createdAt");
    -- Addresses that hard-bounced: never mailed again, and the buyer is told plainly.
    CREATE TABLE IF NOT EXISTS email_suppression (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
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
  sampleFileId?: string | null
  sampleName?: string | null
  sampleSize?: number | null
  pubSampleFileId?: string | null
  pubSampleName?: string | null
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
  extras?: string | null
  pubExtras?: string | null
  archived?: number
  pubCurrency: string | null
  pubFileId: string | null
  pubFileName: string | null
  pubAt: string | null
  sort: number
  createdAt: string
  updatedAt: string
}
interface OrderRow {
  receiptError?: string | null
  listMinor?: number | null
  discountMinor?: number
  couponCode?: string | null
  couponId?: string | null
  /** stripe | paypal | bank */
  method: string
  /** Bank transfer reference the buyer quotes. */
  reference: string | null
  /** PayPal order id. */
  providerOrderId: string | null
  /** When the buyer said they had paid (bank transfer): informational only, never unlocks. */
  buyerClaimedAt: string | null
  payerName?: string | null
  payerBank?: string | null
  payTo?: string | null
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
/** Affiliate destinations: http(s) only, no credentials, query strings and tracking params intact. */
const affiliateUrl = (v: unknown) => {
  const s = str(v, 1000).trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (!u.hostname || u.username || u.password) return ''
    return u.toString()
  } catch {
    return ''
  }
}
const mediaRef = (v: unknown) => (typeof v === 'string' && /^med_[a-f0-9]{24}$/.test(v) ? v : null)

/* ------------------------------------------------------- page schema --- */

export const BLOCK_TYPES = ['header', 'hero', 'text', 'image', 'links', 'featured', 'grid', 'faq', 'tiktok', 'email', 'divider', 'footer'] as const
type BlockType = (typeof BLOCK_TYPES)[number]
interface Block {
  id: string
  type: BlockType
  hidden: boolean
  data: Record<string, unknown>
  look?: Record<string, string>
}
interface Page {
  name: string
  bio: string
  avatar: string | null
  theme: { preset: string; accent: string; font: string; button: string; background: string }
  socials: { instagram: string; youtube: string; x: string; website: string }
  blocks: Block[]
  /** Page 2 and Page 3. Home is `blocks`, so older stores keep working unchanged. */
  pages?: Array<{ id: string; name: string; blocks: Block[] }>
  /** Banner behind the profile (image or short video). */
  banner?: { media: string; kind: 'image' | 'video' }
  /** Editor only: a second design the seller can try, and which one Publish puts live. */
  style2?: Page | null
  use?: 1 | 2
  /** Set on the published page when Style 2 went live. */
  layout?: 'style2'
}

/** The page that goes live: the style the seller picked, without the editor-only fields. */
export function liveOf(draftJson: string): string {
  const d = JSON.parse(draftJson) as Page
  const { style2, use, layout, ...one } = d
  void style2
  void layout
  // Style 2 shows the same content (name, products, sections) in its own layout
  // (src/projects/seller/Style2.tsx). The page remembers which layout went live.
  return JSON.stringify(use === 2 ? { ...one, layout: 'style2' } : one)
}

/** Accepts a page from the editor, keeping only known fields and products this store owns. */
function cleanPage(input: unknown, productIds: Set<string>, nested = false): Page | string {
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
      case 'hero':
        data = { eyebrow: str(d.eyebrow, 80), title: str(d.title, 120), body: str(d.body, 600), media: mediaRef(d.media), button: str(d.button, 40) }
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
      case 'featured': {
        const rawSlides = Array.isArray(d.slides) ? d.slides.slice(0, 8) : []
        const slides: Array<Record<string, unknown>> = []
        for (const raw of rawSlides) {
          if (!raw || typeof raw !== 'object') continue
          const s = raw as Record<string, unknown>
          const a = (s.affiliate ?? {}) as Record<string, unknown>
          const kind = s.kind === 'affiliate' ? 'affiliate' : 'digital'
          const slideId = /^sld_[a-z0-9_-]{4,40}$/i.test(String(s.id)) ? String(s.id) : `sld_${randomBytes(6).toString('hex')}`
          // Both sides are kept, so switching a slide's type never loses the other one.
          slides.push({
            id: slideId,
            kind,
            productId: typeof s.productId === 'string' && productIds.has(s.productId) ? s.productId : null,
            affiliate: {
              // Only http(s) destinations are stored; anything else is dropped.
              url: affiliateUrl(a.url),
              title: str(a.title, 80),
              description: str(a.description, 500),
              cover: mediaRef(a.cover),
              cta: str(a.cta, 40),
            },
          })
        }
        const firstDigital = slides.find((s) => s.kind === 'digital' && s.productId)?.productId
        data = {
          // Older renderers read productId; keep it pointing at the first digital slide.
          productId: typeof firstDigital === 'string' ? firstDigital : typeof d.productId === 'string' && productIds.has(d.productId) ? d.productId : null,
          note: str(d.note, 200),
          ...(rawSlides.length ? { slides } : {}),
        }
        break
      }
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
      case 'tiktok':
        // TikTok video links only (shown as tap-to-play embeds)
        data = {
          heading: str(d.heading, 120),
          videos: (Array.isArray(d.videos) ? d.videos : []).slice(0, 6).map((v) => safeUrl(v)).filter((u) => /^https:\/\/(www\.|vm\.|m\.)?tiktok\.com\//.test(u)),
        }
        break
      case 'email': {
        const email = str(d.email, 254).trim()
        data = { heading: str(d.heading, 120), note: str(d.note, 300), email: /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email) ? email : '', button: str(d.button, 40) }
        break
      }
      case 'divider':
        data = { style: ['line', 'dots', 'space'].includes(String(d.style)) ? String(d.style) : 'line' }
        break
      case 'footer':
        data = { text: str(d.text, 200) }
        break
    }
    const look = cleanLook(b.look)
    blocks.push({ id, type, hidden: b.hidden === true, data, ...(look ? { look } : {}) })
  }
  // Pinned: exactly one profile header, always first, and one footer, always last; both shown.
  const head = blocks.find((b) => b.type === 'header') ?? { id: `blk_${randomBytes(6).toString('hex')}`, type: 'header' as BlockType, hidden: false, data: { showSocials: true } }
  const foot = blocks.find((b) => b.type === 'footer') ?? { id: `blk_${randomBytes(6).toString('hex')}`, type: 'footer' as BlockType, hidden: false, data: { text: '' } }
  const ordered = [{ ...head, hidden: false }, ...blocks.filter((b) => b.type !== 'footer' && b.type !== 'header'), { ...foot, hidden: false }]
  blocks.length = 0
  blocks.push(...ordered)
  // Page 2 and Page 3: content only (the profile header, page tabs and footer are
  // shared and rendered once around the selected page). Home is `blocks` above,
  // so stores saved before pages existed load unchanged.
  const pages: Array<{ id: string; name: string; blocks: Block[] }> = []
  if (!nested) {
    const pagesIn = Array.isArray(p.pages) ? p.pages.slice(0, 2) : []
    const seenPages = new Set<string>()
    for (const raw of pagesIn) {
      if (!raw || typeof raw !== 'object') continue
      const pg = raw as Record<string, unknown>
      let pageId = str(pg.id, 40)
      if (!/^pg_[a-z0-9_-]{4,40}$/i.test(pageId) || seenPages.has(pageId)) pageId = `pg_${randomBytes(6).toString('hex')}`
      seenPages.add(pageId)
      const one = cleanPage({ ...pg, pages: [], style2: null, use: 1 }, productIds, true)
      if (typeof one === 'string') continue
      pages.push({
        id: pageId,
        name: str(pg.name, 40),
        blocks: one.blocks.filter((b) => b.type !== 'header' && b.type !== 'footer'),
      })
    }
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
    // banner behind the profile: an image or a short video the seller uploaded
    ...(() => {
      const b = (p.banner ?? null) as Record<string, unknown> | null
      const media = b ? mediaRef(b.media) : null
      return media ? { banner: { media, kind: b!.kind === 'video' ? 'video' : 'image' } } : {}
    })(),
    blocks,
    ...(pages.length ? { pages } : {}),
    ...(nested ? {} : cleanStyle2(p, productIds)),
  }
}

/** Per-element look from the floating editor: alignment, size, colour, spacing and font. */
function cleanLook(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== 'object') return null
  const l = input as Record<string, unknown>
  const out: Record<string, string> = {}
  if (['left', 'center', 'right'].includes(String(l.align))) out.align = String(l.align)
  if (['s', 'm', 'l', 'xl'].includes(String(l.size))) out.size = String(l.size)
  if (/^#[0-9a-f]{6}$/i.test(String(l.color))) out.color = String(l.color)
  if (['tight', 'normal', 'roomy'].includes(String(l.space))) out.space = String(l.space)
  if (['geist', 'grotesque', 'serif'].includes(String(l.font))) out.font = String(l.font)
  return Object.keys(out).length ? out : null
}

function cleanStyle2(p: Record<string, unknown>, productIds: Set<string>): { style2?: Page; use?: 1 | 2 } {
  const use = p.use === 2 ? 2 : 1
  if (!p.style2 || typeof p.style2 !== 'object') return use === 2 ? { use } : {}
  const two = cleanPage(p.style2, productIds, true)
  if (typeof two === 'string') return use === 2 ? { use } : {}
  return { style2: two, use }
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
    sample: p.sampleFileId ? { name: p.sampleName, size: p.sampleSize } : null,
    listed: Boolean(p.listed),
    published: Boolean(p.pubAt),
    extras: readExtras(p.extras),
    archived: Boolean(p.archived),
    offer: offerView(p.priceMinor, readExtras(p.extras)),
    changed: Boolean(p.pubAt) && ((p.extras ?? null) !== (p.pubExtras ?? null) || p.title !== p.pubTitle || p.description !== p.pubDescription || p.cover !== p.pubCover || p.priceMinor !== p.pubPriceMinor || p.currency !== p.pubCurrency || p.fileId !== p.pubFileId || (p.sampleFileId ?? null) !== (p.pubSampleFileId ?? null)),
    problem: productProblem(p),
  }
}
/* ---- product extras: discount, buy button, visibility (stored as JSON beside the product) ---- */
export type ProductOffer = { on: boolean; kind: 'percent' | 'amount'; value: number; starts: string | null; ends: string | null; badge: string; badgeColor: string
  /** Stage B: exact window entered as local time in an explicit timezone, stored as UTC instants. */
  tz: string; startsLocal: string | null; endsLocal: string | null; startsAt: string | null; endsAt: string | null; countdown: boolean }
export type CardLayout = 'compact' | 'showcase' | 'featured'
export type ProductExtras = {
  offer: ProductOffer
  cta: { text: string; color: string }
  hidden: boolean
  /** Card presentation (V2). Every field has a default so older products keep working. */
  layout: CardLayout
  subtitle: string
  /** Cover crop: focal point in percent and zoom (1 = fit). */
  crop: { x: number; y: number; zoom: number }
  gallery: string[]
  video: string | null
  badges: { new: boolean; featured: boolean }
  format: string
  included: string[]
  access: string
  faq: Array<{ q: string; a: string }>
  /** Horizontal text position inside the card, 0 = left edge, 0.5 = centre, 1 = right edge. */
  textPos: { title: number; desc: number }
  /** Stage C: products shown under 'You might also like' (own products only). */
  related: string[]
  /** Stage C: a bundle lists 2 or more of the seller's own products; buying it grants all of them. */
  bundle: string[]
  /** Affiliate / external mode: when set, shows an external link instead of Buy/Download. */
  affiliate?: { url: string; image?: string; title?: string; description?: string; disclosure?: string }
}
const BADGES = ['SALE', 'PERCENT', 'Limited Offer', 'Launch Special']
const HEX = /^#[0-9a-f]{6}$/i
const isoDay = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null)
export function cleanExtras(v: unknown): ProductExtras {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>
  const f = (o.offer ?? {}) as Record<string, unknown>
  const kind = f.kind === 'amount' ? 'amount' : 'percent'
  let value = Math.round(Number(f.value) || 0)
  value = kind === 'percent' ? Math.min(95, Math.max(0, value)) : Math.max(0, Math.min(99_999_99, value))
  const cta = (o.cta ?? {}) as Record<string, unknown>
  const affiliate = (o.affiliate ?? {}) as Record<string, unknown>
  const affiliateUrl = String(affiliate.url ?? '').trim()
  let safeUrl: string | null = null
  if (affiliateUrl) {
    try {
      new URL(affiliateUrl)
      safeUrl = affiliateUrl
    } catch {
      /* invalid URL */
    }
  }
  return {
    offer: { on: Boolean(f.on), kind, value, starts: isoDay(f.starts), ends: isoDay(f.ends), badge: BADGES.includes(String(f.badge)) ? String(f.badge) : 'PERCENT', badgeColor: HEX.test(String(f.badgeColor)) ? String(f.badgeColor) : '#e11d48', ...offerSchedule(f) },
    cta: { text: String(cta.text ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 30), color: HEX.test(String(cta.color)) ? String(cta.color) : '' },
    hidden: Boolean(o.hidden),
    ...cleanCard(o),
    affiliate: safeUrl ? { url: safeUrl, image: String(affiliate.image ?? '').trim() || undefined, title: String(affiliate.title ?? '').trim() || undefined, description: String(affiliate.description ?? '').trim() || undefined, disclosure: String(affiliate.disclosure ?? '').trim() || undefined } : undefined,
  }
}
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
/** Offer window: local wall-clock times in an explicit IANA timezone, converted to UTC instants here. */
function offerSchedule(f: Record<string, unknown>) {
  const tz = isTimeZone(f.tz) ? String(f.tz) : 'UTC'
  const startsLocal = typeof f.startsLocal === 'string' && LOCAL.test(f.startsLocal) ? f.startsLocal : null
  const endsLocal = typeof f.endsLocal === 'string' && LOCAL.test(f.endsLocal) ? f.endsLocal : null
  const startsAt = startsLocal ? zonedToUtc(startsLocal, tz) : null
  let endsAt = endsLocal ? zonedToUtc(endsLocal, tz) : null
  // an end before the start would make an offer that never runs: drop the end instead
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = null
  return { tz, startsLocal, endsLocal: endsAt ? endsLocal : null, startsAt, endsAt, countdown: Boolean(f.countdown) && Boolean(endsAt) }
}
const line = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
const unit = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 1000) / 1000)) : d }
const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 50 }
/** Card presentation fields: trimmed, bounded and defaulted, never trusted from the browser. */
function cleanCard(o: Record<string, any>) {
  const crop = (o.crop ?? {}) as Record<string, unknown>
  const zoom = Number(crop.zoom)
  const badges = (o.badges ?? {}) as Record<string, unknown>
  const tp = (o.textPos ?? {}) as Record<string, unknown>
  const media = (Array.isArray(o.gallery) ? o.gallery : []).map(mediaRef).filter((m): m is string => Boolean(m))
  return {
    layout: (['compact', 'showcase', 'featured'] as const).includes(o.layout) ? (o.layout as CardLayout) : 'compact',
    subtitle: line(o.subtitle, 100),
    crop: { x: pct(crop.x), y: pct(crop.y), zoom: Number.isFinite(zoom) ? Math.min(2.5, Math.max(1, Math.round(zoom * 100) / 100)) : 1 },
    gallery: [...new Set(media)].slice(0, 8),
    video: mediaRef(o.video),
    badges: { new: Boolean(badges.new), featured: Boolean(badges.featured) },
    format: line(o.format, 40),
    included: (Array.isArray(o.included) ? o.included : []).map((v: unknown) => line(v, 80)).filter(Boolean).slice(0, 12),
    access: line(o.access, 100),
    faq: (Array.isArray(o.faq) ? o.faq : [])
      .map((x: any) => ({ q: line(x?.q, 140), a: String(x?.a ?? '').trim().slice(0, 600) }))
      .filter((x: { q: string; a: string }) => x.q && x.a)
      .slice(0, 8),
    textPos: { title: unit(tp.title, 0), desc: unit(tp.desc, 0) },
    related: ids(o.related, 6),
    bundle: ids(o.bundle, 20),
  }
}
const ids = (v: unknown, max: number) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => /^prd_[a-f0-9]{20}$/.test(x)))].slice(0, max)
/** Gallery images and the preview video must be the seller's own uploads, of the right kind. */
async function ownMediaOnly(storeId: string, extrasJson: string): Promise<string> {
  const x = JSON.parse(extrasJson) as ProductExtras
  const ids = [...x.gallery, ...(x.video ? [x.video] : [])]
  if (!ids.length) return extrasJson
  const rows = await sql.all<{ id: string; type: string }>(`SELECT id, type FROM seller_media WHERE "storeId" = ? AND id IN (${ids.map(() => '?').join(', ')})`, storeId, ...ids)
  const kind = new Map(rows.map((r) => [r.id, r.type]))
  x.gallery = x.gallery.filter((id) => kind.get(id)?.startsWith('image/'))
  x.video = x.video && kind.get(x.video)?.startsWith('video/') ? x.video : null
  return JSON.stringify(x)
}
/** Related products and bundle items: the seller's own products only; bundles hold plain products, never themselves. */
async function ownProductsOnly(storeId: string, selfId: string, extrasJson: string): Promise<string> {
  const x = JSON.parse(extrasJson) as ProductExtras
  if (!x.related.length && !x.bundle.length) return extrasJson
  const own = await sql.all<{ id: string; extras: string | null }>(`SELECT id, extras FROM seller_product WHERE "storeId" = ?`, storeId)
  const mine = new Set(own.map((r) => r.id))
  const isBundle = new Set(own.filter((r) => { try { return (JSON.parse(r.extras ?? '{}').bundle ?? []).length >= 2 } catch { return false } }).map((r) => r.id))
  x.related = x.related.filter((id) => mine.has(id) && id !== selfId)
  x.bundle = x.bundle.filter((id) => mine.has(id) && id !== selfId && !isBundle.has(id))
  return JSON.stringify(x)
}
const readExtras = (raw: string | null | undefined) => { try { return cleanExtras(raw ? JSON.parse(raw) : {}) } catch { return cleanExtras({}) } }
/** The automatic offer price right now (null when none is running). Shared with checkout via seller-pricing. */
export function salePrice(priceMinor: number, x: ProductExtras, at = new Date()): number | null {
  return offerPrice(priceMinor, x.offer, at.getTime())
}
function offerView(priceMinor: number, x: ProductExtras) {
  const sale = salePrice(priceMinor, x)
  if (sale == null) return null
  const pct = Math.round((1 - sale / priceMinor) * 100)
  const end = offerWindow(x.offer).end
  return {
    priceMinor: sale,
    percent: pct,
    savedMinor: priceMinor - sale,
    badge: x.offer.badge === 'PERCENT' ? `${pct}% OFF` : x.offer.badge,
    badgeColor: x.offer.badgeColor,
    ends: x.offer.ends,
    endsAt: end != null ? new Date(end).toISOString() : null,
    countdown: Boolean(x.offer.countdown && end != null),
  }
}

/** A plain file-type label from the file name (PDF, ZIP, Notion …); never the protected file itself. */
function fileKind(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,6}$/.test(ext) && ext !== name.toLowerCase() ? ext.toUpperCase() : null
}

function productPublicView(p: ProductRow) {
  return {
    id: p.id,
    title: p.pubTitle ?? '',
    description: p.pubDescription ?? '',
    cover: p.pubCover,
    priceMinor: p.pubPriceMinor ?? 0,
    currency: p.pubCurrency ?? 'gbp',
    ...(() => {
      const x = readExtras(p.pubExtras)
      return { offer: offerView(p.pubPriceMinor ?? 0, x), cta: x.cta, hidden: x.hidden, layout: x.layout, subtitle: x.subtitle, crop: x.crop, gallery: x.gallery, video: x.video, badges: x.badges, format: x.format, included: x.included, access: x.access, faq: x.faq, textPos: x.textPos, fileType: p.pubFileName ? fileKind(p.pubFileName) : null, sample: p.pubSampleFileId ? { name: p.pubSampleName ?? 'sample', url: `${seller.apiUrl}/api/store-sample/${p.id}` } : null, related: x.related, bundle: x.bundle, affiliate: x.affiliate }
    })(),
  }
}
function productProblem(p: ProductRow): string | null {
  if (!p.title.trim()) return 'Add a title.'
  if (!CURRENCIES.has(p.currency)) return 'Choose a currency.'
  if (p.priceMinor < 0) return 'The price can’t be negative.'
  const bundle = readExtras(p.extras).bundle
  if (bundle.length === 1) return 'A bundle needs at least 2 products.'
  if (bundle.length >= 2) return null
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
  coupon: (storeId: string, code: string, via: Sql = sql) => via.get<CouponRow>(`SELECT * FROM seller_coupon WHERE "storeId" = ? AND code = ?`, storeId, code),
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
/** j***@example.com, for showing which address a receipt went to. */
const maskAddress = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 1)}***@${d ?? ''}` }
const formatMoneyMinor = (m: number, c: string) => formatMoney(m, c)

/** Money for emails; never throws on an odd currency code. */
function formatMoney(minor: number, currency: string): string {
  const value = (Number(minor) || 0) / 100
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(currency || 'gbp').toUpperCase() }).format(value) }
  catch { return `${value.toFixed(2)} ${String(currency || '').toUpperCase()}`.trim() }
}

function storeName(store: { published?: string | null; draft: string; handle: string }): string {
  try { return (JSON.parse(store.published ?? store.draft) as Page).name || store.handle } catch { return store.handle }
}

export async function completeOrder(order: OrderRow, email: string | null, paymentRef: string | null = null): Promise<OrderRow> {
  // 1. The order itself: paid, payment reference, code use. Committed on its own, so a mail problem can't undo it.
  await sql.tx(async (tx) => {
    await tx.run(
      `UPDATE seller_order SET status = 'paid', "paidAt" = ?, "buyerEmail" = COALESCE(?, "buyerEmail") WHERE id = ? AND status IN ('pending','failed','cancelled')`,
      now(),
      email,
      order.id,
    )
    if (paymentRef && order.method === 'stripe') await tx.run('UPDATE seller_order SET "paymentIntent" = ? WHERE id = ?', paymentRef, order.id)
    await confirmCoupon(tx, order.id)
  })
  // 2. The receipt. Claimed atomically (only the call that sets emailedAt queues it); any failure is recorded
  //    on the order and the claim released, so it can be retried and the cause is visible.
  const claim = await sql.run(`UPDATE seller_order SET "emailedAt" = ? WHERE id = ? AND status = 'paid' AND "emailedAt" IS NULL AND "buyerEmail" IS NOT NULL`, now(), order.id)
  if (claim.changes) {
    try {
      const row = (await q.order(order.id))!
      const store = await q.storeById(row.storeId)
      if (!store) throw new Error('store not found')
      const queued = await enqueueEmail('order-receipt', row.buyerEmail!, { url: retrievalUrl(row, store.handle), name: row.productTitle, amount: formatMoney(row.amountMinor, row.currency), email: storeName(store) })
      if (!queued.queued) throw new Error(`receipt not queued: ${queued.reason}`)
      await sql.run('UPDATE seller_order SET "receiptId" = ?, "receiptError" = NULL WHERE id = ?', queued.id, row.id)
    } catch (err) {
      const reason = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 300)
      console.error('[seller] receipt failed', order.id, reason)
      await sql.run('UPDATE seller_order SET "emailedAt" = NULL, "receiptError" = ? WHERE id = ?', reason, order.id).catch(() => {})
    }
  }
  return (await q.order(order.id))!
}

/* ---------------------------------------------------------- reviews --- */

/** Average, count and 1-5 breakdown of visible reviews, per product. Real numbers only. */
async function ratingSummaries(storeId: string) {
  const rows = await sql.all<{ productId: string; rating: number; n: number }>(`SELECT "productId", rating, CAST(COUNT(*) AS INTEGER) AS n FROM seller_review WHERE "storeId" = ? AND status = 'visible' GROUP BY "productId", rating`, storeId)
  const out = new Map<string, { average: number; count: number; breakdown: number[] }>()
  for (const r of rows) {
    const cur = out.get(r.productId) ?? { average: 0, count: 0, breakdown: [0, 0, 0, 0, 0] }
    cur.breakdown[r.rating - 1] += Number(r.n)
    cur.count += Number(r.n)
    out.set(r.productId, cur)
  }
  for (const v of out.values()) v.average = Math.round((v.breakdown.reduce((n, c, i) => n + c * (i + 1), 0) / v.count) * 10) / 10
  return out
}
/** Products an order entitles its buyer to: the product itself, plus bundle items (Stage C, part 4). */
async function orderProducts(o: OrderRow): Promise<string[]> {
  const items = await sql.all<{ productId: string }>(`SELECT "productId" FROM seller_entitlement WHERE "orderId" = ?`, o.id).catch(() => [] as Array<{ productId: string }>)
  return [o.productId, ...items.map((i) => i.productId)]
}
const reviewerKey = (o: OrderRow) => (o.buyerEmail ? `email:${o.buyerEmail.trim().toLowerCase()}` : `order:${o.id}`)

async function markOrder(sessionId: string, status: 'failed' | 'cancelled') {
  const o = await q.orderBySession(sessionId)
  await sql.run(`UPDATE seller_order SET status = ? WHERE "sessionId" = ? AND status = 'pending'`, status, sessionId)
  if (o) await releaseCoupon(o.id)
}

/* ---------------------------------------------------------- coupons --- */

class CouponRefused extends Error {}

/**
 * Take one use of a code for a new order, atomically. The guarded UPDATEs only
 * succeed while a slot is free, so concurrent checkouts can't exceed the limits.
 * Runs inside the transaction that creates the order: a refusal rolls both back.
 */
async function reserveCoupon(tx: Sql, c: CouponRow, orderId: string, email: string | null) {
  const took = await tx.run(`UPDATE seller_coupon SET used = used + 1 WHERE id = ? AND active = 1 AND ("maxRedemptions" IS NULL OR used < "maxRedemptions")`, c.id)
  if (!took.changes) throw new CouponRefused('This code has been fully redeemed.')
  if (c.perCustomer != null) {
    if (!email) throw new CouponRefused('Enter your email to use this code.')
    await tx.run(`INSERT INTO seller_coupon_customer ("couponId", email, used) VALUES (?, ?, 0) ON CONFLICT DO NOTHING`, c.id, email)
    const mine = await tx.run(`UPDATE seller_coupon_customer SET used = used + 1 WHERE "couponId" = ? AND email = ? AND used < ?`, c.id, email, c.perCustomer)
    if (!mine.changes) throw new CouponRefused('You’ve already used this code.')
  }
  await tx.run(`INSERT INTO seller_coupon_use ("orderId", "couponId", email, status, "createdAt") VALUES (?, ?, ?, 'reserved', ?)`, orderId, c.id, email, now())
}

/** Give the use back when an order is cancelled or fails before payment. */
async function releaseCoupon(orderId: string) {
  await sql.tx(async (tx) => {
    const u = await tx.get<{ couponId: string; email: string | null }>(`SELECT "couponId", email FROM seller_coupon_use WHERE "orderId" = ? AND status = 'reserved'`, orderId)
    if (!u) return
    const done = await tx.run(`UPDATE seller_coupon_use SET status = 'released' WHERE "orderId" = ? AND status = 'reserved'`, orderId)
    if (!done.changes) return
    await tx.run(`UPDATE seller_coupon SET used = used - 1 WHERE id = ? AND used > 0`, u.couponId)
    if (u.email) await tx.run(`UPDATE seller_coupon_customer SET used = used - 1 WHERE "couponId" = ? AND email = ? AND used > 0`, u.couponId, u.email)
  })
}

/** Payment arrived: the use is final. A late payment for a released use takes it back (the buyer did pay that price). */
async function confirmCoupon(tx: Sql, orderId: string) {
  const u = await tx.get<{ couponId: string; email: string | null; status: string }>(`SELECT "couponId", email, status FROM seller_coupon_use WHERE "orderId" = ?`, orderId)
  if (!u || u.status === 'confirmed') return
  await tx.run(`UPDATE seller_coupon_use SET status = 'confirmed' WHERE "orderId" = ?`, orderId)
  if (u.status === 'released') {
    await tx.run(`UPDATE seller_coupon SET used = used + 1 WHERE id = ?`, u.couponId)
    if (u.email) await tx.run(`UPDATE seller_coupon_customer SET used = used + 1 WHERE "couponId" = ? AND email = ?`, u.couponId, u.email)
  }
}

/** Card and PayPal checkouts nobody finished within a day free their code again (bank transfers can take days, so they keep it). */
async function releaseStaleCoupons(couponId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const stale = await sql.all<{ orderId: string }>(`SELECT u."orderId" FROM seller_coupon_use u JOIN seller_order o ON o.id = u."orderId" WHERE u."couponId" = ? AND u.status = 'reserved' AND o.status = 'pending' AND o.method IN ('stripe','paypal') AND o."createdAt" < ?`, couponId, cutoff)
  for (const r of stale) {
    await sql.run(`UPDATE seller_order SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, r.orderId)
    await releaseCoupon(r.orderId)
  }
}

type Priced = { totalMinor: number; listMinor: number; discountMinor: number; coupon: CouponRow | null }

/** The one place a purchase is priced: list price, live offer, then the coupon. */
async function pricePurchase(s: StoreRow, p: ProductRow, rawCode: unknown): Promise<Priced | { error: string }> {
  const list = p.pubPriceMinor ?? 0
  const offer = readExtras(p.pubExtras).offer
  const given = String(rawCode ?? '').trim()
  if (!given) {
    const qt = priceQuote({ productId: p.id, listMinor: list, currency: p.pubCurrency ?? 'gbp', offer })
    return { totalMinor: qt.totalMinor, listMinor: list, discountMinor: list - qt.totalMinor, coupon: null }
  }
  const code = normaliseCode(given)
  const c = code ? await q.coupon(s.id, code) : undefined
  if (c) await releaseStaleCoupons(c.id)
  const fresh = c ? await q.coupon(s.id, c.code) : undefined
  const qt = priceQuote({ productId: p.id, listMinor: list, currency: p.pubCurrency ?? 'gbp', offer, coupon: fresh ?? null, code: code ?? given })
  if (qt.couponError) return { error: qt.couponError }
  return { totalMinor: qt.totalMinor, listMinor: list, discountMinor: list - qt.totalMinor, coupon: fresh ?? null }
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
    unpublishedChanges: s.published !== liveOf(s.draft) || products.some((p) => productDraftView(p).changed || (Boolean(p.listed) !== Boolean(p.pubAt) && !productProblem(p))),
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

/** A public TikTok profile (no login): username, display name, bio and photo. */
async function readTiktokProfile(username: string): Promise<{ username: string; displayName: string; bio: string; avatarUrl: string } | null> {
  const base = (process.env.TIKTOK_WEB_BASE || 'https://www.tiktok.com').replace(/\/+$/, '')
  const r = await fetch(`${base}/@${encodeURIComponent(username)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-GB,en;q=0.9' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok) return null
  const html = await r.text()
  const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  const data = JSON.parse(m[1]) as { __DEFAULT_SCOPE__?: Record<string, { userInfo?: { user?: { uniqueId?: string; nickname?: string; signature?: string; avatarLarger?: string; avatarMedium?: string } } }> }
  const u = data.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user
  if (!u?.uniqueId || u.uniqueId.toLowerCase() !== username.toLowerCase()) return null
  return { username: u.uniqueId, displayName: u.nickname ?? '', bio: u.signature ?? '', avatarUrl: u.avatarLarger || u.avatarMedium || '' }
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
        if (p.listed && !p.archived && !productProblem(p)) {
          await tx.run(`UPDATE seller_product SET "pubExtras" = extras, "pubTitle" = title, "pubDescription" = description, "pubCover" = cover, "pubPriceMinor" = "priceMinor", "pubCurrency" = currency, "pubFileId" = "fileId", "pubFileName" = "fileName", "pubSampleFileId" = "sampleFileId", "pubSampleName" = "sampleName", "pubAt" = ? WHERE id = ?`, t, p.id)
        } else {
          await tx.run(`UPDATE seller_product SET "pubAt" = NULL WHERE id = ?`, p.id)
        }
      }
      await tx.run(`UPDATE seller_store SET published = ?, "publishedAt" = ?, "updatedAt" = ? WHERE id = ?`, liveOf((await q.storeById(s.id, tx))?.draft ?? s.draft), t, t, s.id)
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
    if ('extras' in b) out.extras = JSON.stringify(cleanExtras(b.extras))
    if ('archived' in b) out.archived = b.archived ? 1 : 0
    if ('affiliate' in b) {
      const affiliateBody = b as Record<string, unknown>
      const a = affiliateBody.affiliate
      if (!a || typeof a !== 'object') return
      const url = String((a as { url?: string }).url ?? '').trim()
      if (!url) return
      // safe URL validation - only allow http/https and preserve query params
      try {
        new URL(url)
        ;(out as Record<string, unknown>).affiliate = { url, image: String((a as { image?: string }).image ?? '').trim() || undefined, title: String((a as { title?: string }).title ?? '').trim() || undefined, description: String((a as { description?: string }).description ?? '').trim() || undefined, disclosure: String((a as { disclosure?: string }).disclosure ?? '').trim() || undefined }
      } catch {
        /* invalid URL — drop affiliate data */
      }
    }
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
    await sql.run(`INSERT INTO seller_product (id, "storeId", title, description, cover, "priceMinor", currency, listed, sort, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, s.id, fields.title!.toString(), fields.description!.toString(), fields.cover ?? null, fields.priceMinor ?? 900, fields.currency!.toString(), fields.listed ?? 1, count, t, t)
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
    if (fields.extras) fields.extras = await ownProductsOnly(s.id, p.id, await ownMediaOnly(s.id, fields.extras))
    const next = { ...p, ...fields, updatedAt: now() }
    const saved = await sql.run(`UPDATE seller_product SET title = ?, description = ?, cover = ?, "priceMinor" = ?, currency = ?, listed = ?, extras = ?, archived = ?, "updatedAt" = ?, revision = revision + 1 WHERE id = ? AND revision = ?`, next.title, next.description, next.cover, next.priceMinor, next.currency, next.listed, next.extras ?? null, next.archived ?? 0, next.updatedAt, next.id, p.revision)
    if (!saved.changes) return void res.status(409).json({ error: 'Product changed elsewhere. Your edits are kept locally.' })
    res.json({ product: productDraftView((await q.product(p.id, s.id))!), store: await storeView((await q.storeById(s.id))!) })
  })

  /* ---- discount codes (Stage B) ---- */
  const couponView = (c: CouponRow) => ({ id: c.id, code: c.code, kind: c.kind, value: c.value, currency: c.currency, productIds: c.productIds ? (JSON.parse(c.productIds) as string[]) : [], startsAt: c.startsAt, endsAt: c.endsAt, maxRedemptions: c.maxRedemptions, perCustomer: c.perCustomer, used: c.used, active: Boolean(c.active), createdAt: c.createdAt })
  /** Validates a coupon body. Codes, kinds and values are locked once a code has been used. */
  async function cleanCoupon(storeId: string, b: Record<string, unknown>, existing?: CouponRow): Promise<Partial<CouponRow> | string> {
    const out: Partial<CouponRow> = {}
    const locked = Boolean(existing && existing.used > 0)
    if (!existing || 'code' in b) {
      const code = normaliseCode(b.code)
      if (!code) return 'Codes use 3 to 24 letters, numbers, dashes or underscores.'
      if (locked && code !== existing!.code) return 'A code that has been used can’t be renamed.'
      const clash = await q.coupon(storeId, code)
      if (clash && clash.id !== existing?.id) return 'You already have a code with that name.'
      out.code = code
    }
    if (!existing || 'kind' in b || 'value' in b) {
      const kind = (b.kind ?? existing?.kind) === 'amount' ? 'amount' : 'percent'
      const value = Number(b.value ?? existing?.value)
      if (!Number.isInteger(value)) return 'Enter a whole number for the discount.'
      if (kind === 'percent' && (value < 1 || value > 100)) return 'Percent off must be between 1 and 100.'
      if (kind === 'amount' && (value < 1 || value > 99_999_99)) return 'Amount off must be more than 0.'
      if (locked && (kind !== existing!.kind || value !== existing!.value)) return 'A code that has been used keeps its discount. Make a new code instead.'
      out.kind = kind
      out.value = value
    }
    if (!existing || 'currency' in b) {
      const cur = b.currency == null || b.currency === '' ? null : String(b.currency).toLowerCase()
      if (cur && !CURRENCIES.has(cur)) return 'Unsupported currency.'
      out.currency = cur
    }
    if ((out.kind ?? existing?.kind) === 'amount' && !(out.currency ?? existing?.currency)) return 'Choose the currency for an amount off.'
    if ('productIds' in b || !existing) {
      const ids = Array.isArray(b.productIds) ? b.productIds.map(String) : []
      const own = ids.length ? (await q.products(storeId)).map((p) => p.id) : []
      out.productIds = ids.length ? JSON.stringify([...new Set(ids.filter((i) => own.includes(i)))]) : null
    }
    for (const k of ['startsAt', 'endsAt'] as const) {
      if (!(k in b) && existing) continue
      const v = b[k]
      if (v == null || v === '') { out[k] = null; continue }
      // local time + timezone from the editor, or an exact ISO instant
      const tz = isTimeZone(b.tz) ? String(b.tz) : 'UTC'
      const iso = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? zonedToUtc(v, tz) : typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null
      if (!iso) return 'Enter a valid date and time.'
      out[k] = iso
    }
    const st = out.startsAt !== undefined ? out.startsAt : existing?.startsAt ?? null
    const en = out.endsAt !== undefined ? out.endsAt : existing?.endsAt ?? null
    if (st && en && Date.parse(en) <= Date.parse(st)) return 'The expiry must be after the start.'
    for (const k of ['maxRedemptions', 'perCustomer'] as const) {
      if (!(k in b) && existing) continue
      const v = b[k]
      if (v == null || v === '') { out[k] = null; continue }
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 1_000_000) return 'Limits must be whole numbers above 0.'
      if (k === 'maxRedemptions' && existing && n < existing.used) return `This code has already been used ${existing.used} times.`
      out[k] = n
    }
    if ('active' in b) out.active = b.active ? 1 : 0
    return out
  }

  me.get('/coupons', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const rows = await sql.all<CouponRow>(`SELECT * FROM seller_coupon WHERE "storeId" = ? ORDER BY "createdAt" DESC`, s.id)
    res.json({ coupons: rows.map(couponView) })
  })
  me.post('/coupons', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const fields = await cleanCoupon(s.id, (req.body ?? {}) as Record<string, unknown>)
    if (typeof fields === 'string') return void res.status(400).json({ error: fields })
    if (((await sql.get<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM seller_coupon WHERE "storeId" = ?`, s.id))?.n ?? 0) >= 200) return void res.status(400).json({ error: 'Code limit reached.' })
    const id = `cpn_${randomBytes(10).toString('hex')}`
    const f = fields as CouponRow
    try {
      await sql.run(`INSERT INTO seller_coupon (id, "storeId", code, kind, value, currency, "productIds", "startsAt", "endsAt", "maxRedemptions", "perCustomer", used, active, "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, id, s.id, f.code, f.kind, f.value, f.currency ?? null, f.productIds ?? null, f.startsAt ?? null, f.endsAt ?? null, f.maxRedemptions ?? null, f.perCustomer ?? null, f.active ?? 1, now())
    } catch {
      return void res.status(409).json({ error: 'You already have a code with that name.' })
    }
    res.status(201).json({ coupon: couponView((await q.coupon(s.id, f.code))!) })
  })
  me.patch('/coupons/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const c = await sql.get<CouponRow>(`SELECT * FROM seller_coupon WHERE id = ? AND "storeId" = ?`, String(req.params.id), s.id)
    if (!c) return void res.status(404).json({ error: 'Code not found.' })
    const fields = await cleanCoupon(s.id, (req.body ?? {}) as Record<string, unknown>, c)
    if (typeof fields === 'string') return void res.status(400).json({ error: fields })
    const keys = Object.keys(fields) as Array<keyof CouponRow>
    if (keys.length) await sql.run(`UPDATE seller_coupon SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => fields[k] as string | number | null), c.id)
    res.json({ coupon: couponView((await sql.get<CouponRow>(`SELECT * FROM seller_coupon WHERE id = ?`, c.id))!) })
  })
  /** Unused codes are deleted; used ones are switched off so order history keeps its code. */
  me.delete('/coupons/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const c = await sql.get<CouponRow>(`SELECT * FROM seller_coupon WHERE id = ? AND "storeId" = ?`, String(req.params.id), s.id)
    if (!c) return void res.status(404).json({ error: 'Code not found.' })
    const ever = await sql.get(`SELECT 1 FROM seller_coupon_use WHERE "couponId" = ?`, c.id)
    if (ever) await sql.run(`UPDATE seller_coupon SET active = 0 WHERE id = ?`, c.id)
    else await sql.run(`DELETE FROM seller_coupon WHERE id = ?`, c.id)
    res.json({ deleted: !ever, deactivated: Boolean(ever) })
  })

  /** Copy a product (details, price, offer and file); the copy starts as a draft. */
  me.post('/products/:id/duplicate', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    const count = (await q.products(s.id)).length
    if (count >= 200) return void res.status(400).json({ error: 'Product limit reached.' })
    const t = now()
    const id = `prd_${randomBytes(10).toString('hex')}`
    await sql.run(`INSERT INTO seller_product (id, "storeId", title, description, cover, "priceMinor", currency, listed, sort, extras, "fileId", "fileName", "fileSize", "fileType", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`, id, s.id, `${p.title} (copy)`.slice(0, 80), p.description, p.cover, p.priceMinor, p.currency, count, p.extras ?? null, p.fileId, p.fileName, p.fileSize, p.fileType, t, t)
    res.status(201).json({ product: productDraftView((await q.product(id, s.id))!), store: await storeView((await q.storeById(s.id))!) })
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

  /** A free sample buyers can download before paying. Stored apart from the paid file; never the paid file. */
  me.put('/products/:id/sample', express.raw({ type: () => true, limit: 25 * 1024 * 1024 }), async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    const body = req.body as Buffer
    if (!Buffer.isBuffer(body) || body.length === 0) return void res.status(400).json({ error: 'Empty file.' })
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'sample')).replace(/[\\/\0\r\n"]/g, '_').slice(0, 120) || 'sample'
    const id = `smp_${randomBytes(16).toString('hex')}`
    await blobs().put('media', id, body, 'application/octet-stream')
    await sql.run(`UPDATE seller_product SET "sampleFileId" = ?, "sampleName" = ?, "sampleSize" = ?, "updatedAt" = ? WHERE id = ?`, id, name, body.length, now(), p.id)
    res.json({ product: productDraftView((await q.product(p.id, s.id))!) })
  })
  me.delete('/products/:id/sample', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const p = await q.product(String(req.params.id), s.id)
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    await sql.run(`UPDATE seller_product SET "sampleFileId" = NULL, "sampleName" = NULL, "sampleSize" = NULL, "updatedAt" = ? WHERE id = ?`, now(), p.id)
    res.json({ product: productDraftView((await q.product(p.id, s.id))!) })
  })

  /** Public images (avatar, covers, image blocks). */
  me.post('/media', express.raw({ type: () => true, limit: 15 * 1024 * 1024 }), async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const type = String(req.headers['content-type'] ?? '')
    const video = /^video\/(mp4|webm|quicktime)$/.test(type)
    if (!video && !/^image\/(png|jpe?g|gif|webp)$/.test(type)) return void res.status(400).json({ error: 'Use a PNG, JPG, GIF or WebP image, or an MP4/WebM/MOV video.' })
    const body = req.body as Buffer
    if (!Buffer.isBuffer(body) || !body.length) return void res.status(400).json({ error: 'Empty file.' })
    if (!video && body.length > 5 * 1024 * 1024) return void res.status(413).json({ error: 'Images can be up to 5 MB.' })
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
    res.json({ nextOffset: more ? offset + 100 : null, orders: rows.map((o) => ({ id: o.id, product: o.productTitle, amountMinor: o.amountMinor, currency: o.currency, status: o.status, buyer: o.buyerEmail, createdAt: o.createdAt, paidAt: o.paidAt, method: o.method, reference: o.reference, buyerClaimedAt: o.buyerClaimedAt, payerName: o.payerName ?? null, payerBank: o.payerBank ?? null, hidden: !!(o as { sellerHidden?: number }).sellerHidden, listMinor: o.listMinor ?? o.amountMinor, discountMinor: o.discountMinor ?? 0, couponCode: o.couponCode ?? null })) })
  })

  // Remove a row from the seller's Transaction History. The order itself is kept (buyers keep their downloads, totals stay right).
  me.delete('/orders/:id', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const r = await sql.run(`UPDATE seller_order SET "sellerHidden" = 1 WHERE id = ? AND "storeId" = ?`, String(req.params.id), s.id)
    if (!r.changes) return void res.status(404).json({ error: 'Order not found.' })
    res.json({ ok: true })
  })

  /**
   * Start over: the seller deletes their own store to set it up again. Only
   * while it has no orders, so no buyer ever loses a purchase.
   */
  me.delete('/store', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    if (String((req.body as { confirm?: unknown })?.confirm ?? '') !== s.handle) return void res.status(400).json({ error: 'Type your handle to confirm.' })
    const orders = (await sql.get<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM seller_order WHERE "storeId" = ?`, s.id))?.n ?? 0
    if (orders) return void res.status(409).json({ error: 'This store has orders, so it can’t be deleted: buyers keep their purchases.' })
    const files = await sql.all<{ fileId: string | null; pubFileId: string | null }>(`SELECT "fileId", "pubFileId" FROM seller_product WHERE "storeId" = ?`, s.id)
    const media = await sql.all<{ id: string }>(`SELECT id FROM seller_media WHERE "storeId" = ?`, s.id)
    await sql.tx(async (tx) => {
      await tx.run(`DELETE FROM seller_connections WHERE "storeId" = ?`, s.id)
      await tx.run(`DELETE FROM seller_product WHERE "storeId" = ?`, s.id)
      await tx.run(`DELETE FROM seller_media WHERE "storeId" = ?`, s.id)
      await tx.run(`DELETE FROM seller_store WHERE id = ?`, s.id)
    })
    for (const f of files) for (const id of [f.fileId, f.pubFileId]) if (id && /^fil_[a-f0-9]{32}$/.test(id)) void blobs().remove('files', id)
    for (const m of media) void blobs().remove('media', m.id)
    res.json({ store: null })
  })

  /* earnings: what the seller has made, and their Stripe balance */
  me.get('/earnings', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const rows = await sql.all<{ amountMinor: number; currency: string; method: string; paidAt: string | null; createdAt: string }>(
      `SELECT "amountMinor", currency, method, "paidAt", "createdAt" FROM seller_order WHERE "storeId" = ? AND status = 'paid' AND refunded = 0`,
      s.id,
    )
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    const lastMonthStart = new Date(monthStart); lastMonthStart.setUTCMonth(lastMonthStart.getUTCMonth() - 1)
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const totals = new Map<string, { currency: string; totalMinor: number; monthMinor: number; lastMonthMinor: number; sales: number; byMethod: Record<string, number>; daily: Record<string, number> }>()
    for (const o of rows) {
      const t = totals.get(o.currency) ?? { currency: o.currency, totalMinor: 0, monthMinor: 0, lastMonthMinor: 0, sales: 0, byMethod: {}, daily: {} }
      // Desknoty's fee comes off first (0% today); payment providers' own fees are not included.
      const net = Math.round(o.amountMinor * (1 - PLATFORM_FEE_PERCENT / 100))
      t.totalMinor += net
      t.sales += 1
      const when = new Date(o.paidAt ?? o.createdAt)
      if (when >= monthStart) t.monthMinor += net
      // the same stretch of last month (1st up to today's date), so the comparison is fair mid-month
      else if (when >= lastMonthStart && when.getUTCDate() <= new Date().getUTCDate()) t.lastMonthMinor += net
      if (Date.now() - when.getTime() < 30 * 86400000) t.daily[dayKey(when)] = (t.daily[dayKey(when)] ?? 0) + net
      t.byMethod[o.method] = (t.byMethod[o.method] ?? 0) + net
      totals.set(o.currency, t)
    }
    let balance: { available: Array<{ amountMinor: number; currency: string }>; pending: Array<{ amountMinor: number; currency: string }>; payouts: Array<{ id: string; amountMinor: number; currency: string; status: string; arrival: string; bank: string | null }> } | null = null
    let banks: Array<{ id: string; bankName: string; holder: string; last4: string; sortCode: string; currency: string; isDefault: boolean }> = []
    const st = stripe()
    if (st && s.stripeAccountId && s.chargesReady) {
      try {
        const b = await st.balance.retrieve({}, { stripeAccount: s.stripeAccountId })
        const list = await st.payouts.list({ limit: 5 }, { stripeAccount: s.stripeAccountId }).catch(() => ({ data: [] as Stripe.Payout[] }))
        balance = {
          available: b.available.map((x) => ({ amountMinor: x.amount, currency: x.currency })),
          pending: b.pending.map((x) => ({ amountMinor: x.amount, currency: x.currency })),
          payouts: list.data.map((p) => ({ id: p.id, amountMinor: p.amount, currency: p.currency, status: p.status, arrival: new Date(p.arrival_date * 1000).toISOString(), bank: typeof p.destination === 'string' ? p.destination : null })),
        }
        // the bank accounts the seller added in Stripe: where withdrawals can go (never full numbers)
        const ext = await st.accounts.listExternalAccounts(s.stripeAccountId, { object: 'bank_account', limit: 10 }).catch(() => ({ data: [] as Stripe.BankAccount[] }))
        banks = (ext.data as Stripe.BankAccount[]).map((b) => ({
          id: b.id,
          bankName: b.bank_name ?? 'Bank account',
          holder: b.account_holder_name ?? '',
          last4: b.last4,
          sortCode: b.routing_number ? b.routing_number.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3') : '',
          currency: b.currency,
          isDefault: Boolean(b.default_for_currency),
        }))
      } catch (err) {
        console.error('[seller] could not read the Stripe balance:', (err as Error).message)
      }
    }
    // last 30 days, oldest first, one entry per day (zeros included) for the chart
    const days: string[] = []
    for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000)))
    const out = [...totals.values()].map(({ daily, ...t }) => ({ ...t, days: days.map((date) => ({ date, amountMinor: daily[date] ?? 0 })) }))
    res.set('Cache-Control', 'no-store').json({ totals: out, balance, banks, withdrawals: payoutsAllowed() })
  })

  /** Send the available Stripe balance to the seller's bank. Sandbox only unless SELLER_LIVE_PAYOUTS=true. */
  me.post('/payouts', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    if (!payoutsAllowed()) return void res.status(403).json({ error: 'Withdrawals are switched off on this Desknoty server. Stripe still pays you out automatically on its schedule.' })
    const st = stripe()
    if (!st || !s.stripeAccountId || !s.chargesReady) return void res.status(409).json({ error: 'Finish setting up Stripe first.' })
    const currency = String((req.body as { currency?: unknown })?.currency ?? '').toLowerCase()
    if (!/^[a-z]{3}$/.test(currency)) return void res.status(400).json({ error: 'Choose a currency.' })
    // optional: which of the seller's own Stripe bank accounts to send to
    const destination = String((req.body as { bankId?: unknown })?.bankId ?? '')
    if (destination) {
      if (!/^ba_\w+$/.test(destination)) return void res.status(400).json({ error: 'Choose one of your bank accounts.' })
      const mineBank = await st.accounts.retrieveExternalAccount(s.stripeAccountId, destination).catch(() => null)
      if (!mineBank) return void res.status(400).json({ error: 'That bank account isn’t on your Stripe account.' })
    }
    try {
      const b = await st.balance.retrieve({}, { stripeAccount: s.stripeAccountId })
      const amount = b.available.find((x) => x.currency === currency)?.amount ?? 0
      if (amount <= 0) return void res.status(409).json({ error: 'There is nothing available to withdraw yet. New sales become available after a few days.' })
      // one withdrawal of the same amount per minute, even if the button is pressed twice
      const payout = await st.payouts.create(
        { amount, currency, description: 'Desknoty withdrawal', ...(destination ? { destination } : {}) },
        { stripeAccount: s.stripeAccountId, idempotencyKey: `payout_${s.id}_${currency}_${amount}_${destination || 'default'}_${Math.floor(Date.now() / 60000)}` },
      )
      res.json({ payout: { id: payout.id, amountMinor: payout.amount, currency: payout.currency, status: payout.status, arrival: new Date(payout.arrival_date * 1000).toISOString() } })
    } catch (err) {
      const msg = (err as Error).message
      res.status(502).json({ error: /external account|bank account/i.test(msg) ? 'Add a bank account in Stripe first (Resume setup).' : `Stripe couldn’t send the payout: ${msg}` })
    }
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
    await releaseCoupon(o.id)
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

  /*
   * TikTok by bio code (works without TikTok developer keys): the seller gets a
   * short code, puts it in their TikTok bio, and Desknoty reads their public
   * profile. The code proves they control the account; then the profile
   * (name, photo, username) is copied onto the store.
   */
  me.post('/tiktok/code', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const username = String((req.body as { username?: unknown })?.username ?? '').trim().replace(/^@/, '')
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) return void res.status(400).json({ error: 'Enter your TikTok username, e.g. @yourname.' })
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = 'DESK-' + Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('')
    await sql.run(`DELETE FROM oauth_state WHERE "userId" = ? AND provider = 'tiktok-bio'`, req.userId!)
    await sql.run(`INSERT INTO oauth_state (state, "userId", provider, "returnTo", verifier, "expiresAt") VALUES (?, ?, 'tiktok-bio', ?, ?, ?)`, randomBytes(16).toString('hex'), req.userId!, username, code, Date.now() + 30 * 60 * 1000)
    res.json({ username, code, expiresInMinutes: 30 })
  })
  me.post('/tiktok/verify', async (req: Authed, res) => {
    const s = await mine(req, res)
    if (!s) return
    const row = await sql.get<{ returnTo: string; verifier: string; expiresAt: number }>(`SELECT "returnTo", verifier, "expiresAt" FROM oauth_state WHERE "userId" = ? AND provider = 'tiktok-bio'`, req.userId!)
    if (!row || Number(row.expiresAt) < Date.now()) return void res.status(410).json({ error: 'That code expired. Generate a new one.' })
    const profile = await readTiktokProfile(row.returnTo).catch(() => null)
    if (!profile) return void res.status(502).json({ error: 'TikTok didn’t show that profile right now. Check the username is right and public, then try again in a minute.' })
    if (!profile.bio.toUpperCase().includes(row.verifier)) return void res.status(409).json({ error: `We couldn’t find ${row.verifier} in @${row.returnTo}’s bio yet. Save your bio on TikTok, wait a few seconds, then verify again.` })
    const saved = JSON.stringify({ openId: '', username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl })
    await sql.run(`UPDATE seller_store SET tiktok = ?, "updatedAt" = ? WHERE id = ?`, saved, now(), s.id)
    await sql.run(`DELETE FROM oauth_state WHERE "userId" = ? AND provider = 'tiktok-bio'`, req.userId!)
    await applyTiktokProfile(s, profile).catch((err) => console.error('[seller] TikTok profile copy failed', err))
    res.json({ store: await storeView((await q.storeById(s.id))!) })
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
    const ratings = await ratingSummaries(s.id)
    const live = await liveProducts(s)
    const liveIds = new Set(live.filter((p) => p.pubFileId).map((p) => p.id))
    const titles = new Map(live.map((p) => [p.id, p.pubTitle ?? '']))
    const products = live.map((p) => {
      const v = productPublicView(p) as ReturnType<typeof productPublicView> & { related: string[]; bundle: string[] }
      const items = v.bundle.filter((id) => liveIds.has(id))
      return { ...v, rating: ratings.get(p.id) ?? null, related: v.related.filter((id) => liveIds.has(id) || titles.has(id)), bundle: v.bundle.length ? { items: items.map((id) => ({ id, title: titles.get(id) ?? '' })), available: items.length === v.bundle.length && items.length >= 2 } : null }
    })
    res.json({ handle: s.handle, page: JSON.parse(s.published!), products, checkoutReady: readyMethods(s).length > 0, methods: readyMethods(s), banks: readyMethods(s).includes('bank') ? bankChoices(readPayments(s.payments)) : [], testMode: sellerSetup().stripeMode !== 'live' || paypalMode() !== 'live' })
  })

  /* ---- V3: free products by email ---- */
  const CLAIM_INVALID = 'Please check your email address and try again.'
  const CLAIM_BOUNCED = 'We couldn’t deliver to this address. Please check your email.'
  const CLAIM_TEMPORARY = 'We couldn’t check your email right now. Please try again.'
  const CLAIM_SEND_FAILED = 'We couldn’t send your email right now. Please try again.'
  const sha = (v: string) => createHmac('sha256', env.secret).update(v).digest('base64url')
  const dayOf = (iso: string) => iso.slice(0, 10)
  const claimView = (c: { id: string; email: string; delivery: string | null; lastSentAt: string | null; sendCount: number; sendDay: string }) => {
    const wait = c.lastSentAt ? Math.max(0, 60 - Math.floor((Date.now() - Date.parse(c.lastSentAt)) / 1000)) : 0
    return { claimId: c.id, email: c.email, delivery: c.delivery, cooldownSeconds: wait, sendsLeftToday: c.sendDay === dayOf(now()) ? Math.max(0, 5 - c.sendCount) : 5 }
  }

  /**
   * Ask for a free product. Validates the address, then emails a private link; the file is only
   * reachable by opening that link. Returns no download URL and no order key.
   */
  pub.post('/:handle/claim', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const b = (req.body ?? {}) as Record<string, unknown>
    // bots fill every field; people never see this one
    if (String(b.website ?? '').trim()) return void res.status(400).json({ error: 'Please try again.' })
    const clientRef = String(b.clientRef ?? '')
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(clientRef)) return void res.status(400).json({ error: 'Please reload the page and try again.' })
    const found = await q.product(String(b.productId ?? ''), s.id)
    if (!found || !found.pubAt || found.pubPriceMinor == null || !found.pubCurrency) return void res.status(404).json({ error: 'This product isn’t available.' })
    const bundle = readExtras(found.pubExtras).bundle
    if (!found.pubFileId && bundle.length < 2) return void res.status(404).json({ error: 'This product isn’t available.' })
    const priced = await pricePurchase(s, found, b.coupon)
    if ('error' in priced) return void res.status(409).json({ error: priced.error, couponError: true })
    if (priced.totalMinor !== 0) return void res.status(409).json({ error: 'This product isn’t free right now.' })
    const email = normalizeEmail(String(b.email ?? ''))
    const name = String(b.name ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80)
    const ipHash = sha(`ip:${req.ip}`).slice(0, 24)
    const t = now()
    // abuse limits: per network per hour, per address per day
    const hourAgo = new Date(Date.now() - 3600e3).toISOString()
    const fromIp = await sql.get<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM seller_claim WHERE "ipHash" = ? AND "updatedAt" > ?`, ipHash, hourAgo)
    if ((fromIp?.n ?? 0) >= 20) return void res.status(429).json({ error: 'Too many requests from this network. Please try again later.' })
    // validation before anything is sent
    if (await sql.get(`SELECT 1 FROM email_suppression WHERE email = ?`, email)) return void res.status(422).json({ code: 'undeliverable', error: CLAIM_BOUNCED })
    const verdict = await checkEmail(email, { acceptSuggestion: Boolean(b.acceptSuggestion) })
    if (verdict.status === 'suggest') return void res.status(409).json({ code: 'suggest', suggestion: verdict.suggestion })
    // Built-in checks before anything is sent: syntax, and whether the domain can receive mail
    // (MX, or A/AAAA as the implicit mail host, RFC 7505 null MX). A pass means the domain
    // accepts mail, so the private link goes out — the emailed link proves ownership, and the
    // signed Resend bounce events settle addresses that turn out not to exist. A DNS timeout is
    // a temporary failure, never a proof that the address is fake.
    if (verdict.status === 'invalid') return void res.status(422).json({ code: 'invalid', error: CLAIM_INVALID, reason: verdict.reason })
    if (verdict.status === 'temporary') return void res.status(503).json({ code: 'temporary', error: CLAIM_TEMPORARY })
    // 'deliverable': the mailbox exists and accepts mail → continue with the claim + email.
    const perEmail = await sql.get<{ n: number }>(`SELECT CAST(COALESCE(SUM("sendCount"), 0) AS INTEGER) AS n FROM seller_claim WHERE email = ? AND "sendDay" = ?`, email, dayOf(t))
    if ((perEmail?.n ?? 0) >= 10) return void res.status(429).json({ error: 'We’ve sent a lot of links to this address today. Please check your inbox or try tomorrow.' })

    // one claim per browser per product: reuse it; a new address replaces the old link
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + 24 * 3600e3).toISOString()
    const existing = await sql.get<{ id: string; email: string; lastSentAt: string | null; sendCount: number; sendDay: string; status: string }>(`SELECT id, email, "lastSentAt", "sendCount", "sendDay", status FROM seller_claim WHERE "storeId" = ? AND "productId" = ? AND "clientRef" = ?`, s.id, found.id, clientRef)
    let id = existing?.id ?? `clm_${randomBytes(12).toString('hex')}`
    if (existing) {
      // server-side cooldown and daily cap, with one guarded UPDATE so parallel clicks can't get around them
      const minuteAgo = new Date(Date.now() - 60e3).toISOString()
      const ok = await sql.run(
        `UPDATE seller_claim SET email = ?, name = ?, "couponCode" = ?, "tokenHash" = ?, "tokenExpiresAt" = ?, status = CASE WHEN status = 'verified' AND email = ? THEN 'verified' ELSE 'pending' END, delivery = NULL, "sendCount" = CASE WHEN "sendDay" = ? THEN "sendCount" + 1 ELSE 1 END, "sendDay" = ?, "lastSentAt" = ?, "ipHash" = ?, "updatedAt" = ? WHERE id = ? AND ("lastSentAt" IS NULL OR "lastSentAt" < ?) AND ("sendDay" <> ? OR "sendCount" < 5)`,
        email, name, priced.coupon?.code ?? null, sha(token), expires, email, dayOf(t), dayOf(t), t, ipHash, t, id, minuteAgo, dayOf(t),
      )
      if (!ok.changes) {
        const c = (await sql.get<any>(`SELECT * FROM seller_claim WHERE id = ?`, id))!
        const v = claimView(c)
        return void res.status(429).json({ error: v.sendsLeftToday === 0 ? 'You’ve reached today’s limit for this product. Please check your inbox or try tomorrow.' : `Please wait ${v.cooldownSeconds} seconds before sending again.`, ...v })
      }
    } else {
      try {
        await sql.run(`INSERT INTO seller_claim (id, "storeId", "productId", "clientRef", email, name, "couponCode", "tokenHash", "tokenExpiresAt", status, "sendCount", "sendDay", "lastSentAt", "ipHash", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, ?, ?, ?)`, id, s.id, found.id, clientRef, email, name, priced.coupon?.code ?? null, sha(token), expires, dayOf(t), t, ipHash, t, t)
      } catch {
        // a parallel first submission won: treat this one as a too-fast repeat
        const c = await sql.get<any>(`SELECT * FROM seller_claim WHERE "storeId" = ? AND "productId" = ? AND "clientRef" = ?`, s.id, found.id, clientRef)
        return void res.status(429).json({ error: 'Please wait a moment before sending again.', ...(c ? claimView(c) : {}) })
      }
    }
    const link = `${seller.siteUrl}/store/${s.id}/claim/${id}?t=${token}`
    const queued = await enqueueEmail('claim-link', email, { url: link, name: found.pubTitle ?? 'your free product', email: storeName(s) })
    if (!queued.queued) return void res.status(503).json({ code: 'unavailable', error: CLAIM_SEND_FAILED })
    await sql.run(`UPDATE seller_claim SET "outboxId" = ? WHERE id = ?`, queued.id, id)
    const sent = await sendNow(queued.id)
    const c = (await sql.get<any>(`SELECT * FROM seller_claim WHERE id = ?`, id))!
    if (sent.status === 'sent') {
      await sql.run(`UPDATE seller_claim SET delivery = 'accepted' WHERE id = ? AND delivery IS NULL`, id)
      return void res.json({ status: 'sent', ...claimView({ ...c, delivery: 'accepted' }) })
    }
    if (sent.status === 'queued') return void res.json({ status: 'queued', ...claimView(c) })
    await sql.run(`UPDATE seller_claim SET delivery = 'provider_rejected' WHERE id = ?`, id)
    res.status(502).json({ code: 'provider_rejected', error: 'We couldn’t send the email right now. Please try again in a moment.', ...claimView({ ...c, delivery: 'provider_rejected' }) })
  })

  /** Delivery status for the page that asked (same browser reference). Never reveals links or keys. */
  pub.get('/:handle/claim/:claimId', async (req, res) => {
    const c = await sql.get<any>(`SELECT * FROM seller_claim WHERE id = ? AND "clientRef" = ?`, String(req.params.claimId), String(req.query.ref ?? ''))
    if (!c) return void res.status(404).json({ error: 'Not found.' })
    res.set('Cache-Control', 'no-store').json({ ...claimView(c), message: c.delivery === 'bounced' ? CLAIM_BOUNCED : null })
  })

  /** Opening the emailed link: proves the address, then creates (or reuses) the free order. */
  pub.post('/:handle/claim/:claimId/open', async (req, res) => {
    const c = await sql.get<any>(`SELECT * FROM seller_claim WHERE id = ?`, String(req.params.claimId))
    const token = String(req.body?.t ?? '')
    const a = Buffer.from(sha(token)), want = Buffer.from(c?.tokenHash ?? '')
    if (!c || !token || a.length !== want.length || !timingSafeEqual(a, want)) return void res.status(404).json({ code: 'invalid_link', error: 'This link isn’t valid. It may have been replaced by a newer email: use the latest one.' })
    if (Date.parse(c.tokenExpiresAt) < Date.now()) return void res.status(410).json({ code: 'expired', error: 'This link has expired. Ask for a new one from the store.' })
    const s = await q.storeById(c.storeId)
    const found = s ? await q.product(c.productId, s.id) : undefined
    if (!s || !found || !found.pubAt) return void res.status(404).json({ error: 'This product isn’t available any more.' })
    // the same address already has this product: hand back that order instead of a duplicate
    let order = c.orderId ? await q.order(c.orderId) : await sql.get<OrderRow>(`SELECT * FROM seller_order WHERE "storeId" = ? AND "productId" = ? AND method = 'free' AND status = 'paid' AND "buyerEmail" = ? ORDER BY "createdAt" LIMIT 1`, s.id, found.id, c.email)
    if (!order) {
      const priced = await pricePurchase(s, found, c.couponCode ?? '')
      if ('error' in priced || priced.totalMinor !== 0) return void res.status(409).json({ error: 'This product isn’t free any more.' })
      const bundle = readExtras(found.pubExtras).bundle
      let items: Array<{ productId: string; title: string; fileId: string; fileName: string }> = []
      if (bundle.length >= 2) {
        const list = await Promise.all(bundle.map((pid) => q.product(pid, s.id)))
        if (list.some((i) => !i || !i.pubAt || !i.pubFileId)) return void res.status(409).json({ error: 'This bundle isn’t available right now.' })
        items = list.map((i) => ({ productId: i!.id, title: i!.pubTitle ?? '', fileId: i!.pubFileId!, fileName: i!.pubFileName ?? 'download' }))
      }
      const oid = `ord_${randomBytes(12).toString('hex')}`
      try {
        await sql.tx(async (tx) => {
          // the claim row is the lock: only one opening of this claim creates the order
          const took = await tx.run(`UPDATE seller_claim SET "orderId" = ?, status = 'verified', "updatedAt" = ? WHERE id = ? AND "orderId" IS NULL`, oid, now(), c.id)
          if (!took.changes) throw new Error('already-claimed')
          await tx.run(
            `INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", "checkoutKey", "stripeMode", method, status, "paidAt", "buyerEmail", "emailedAt", "listMinor", "discountMinor", "couponCode", "couponId") VALUES (?, ?, ?, ?, ?, ?, 'free', 0, ?, ?, ?, ?, ?, 'free', 'paid', ?, ?, ?, ?, ?, ?, ?)`,
            oid, s.id, found.id, found.pubTitle ?? '', items.length ? 'bundle' : found.pubFileId, items.length ? 'bundle' : found.pubFileName ?? 'download', found.pubCurrency ?? 'gbp', randomBytes(24).toString('base64url'), now(), `claim-${c.id}`, stripeMode, now(), c.email, now(),
            priced.listMinor, priced.discountMinor, priced.coupon?.code ?? null, priced.coupon?.id ?? null,
          )
          if (priced.coupon) await reserveCoupon(tx, priced.coupon, oid, c.email)
          await confirmCoupon(tx, oid)
          for (const e of items) await tx.run(`INSERT INTO seller_entitlement ("orderId", "productId", title, "fileId", "fileName") VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`, oid, e.productId, e.title, e.fileId, e.fileName)
        })
      } catch (e) {
        if (e instanceof CouponRefused) return void res.status(409).json({ error: e.message })
        if ((e as Error).message !== 'already-claimed') throw e
      }
      const fresh = await sql.get<any>(`SELECT "orderId" FROM seller_claim WHERE id = ?`, c.id)
      order = fresh?.orderId ? await q.order(fresh.orderId) : undefined
    } else if (!c.orderId) {
      await sql.run(`UPDATE seller_claim SET "orderId" = ?, status = 'verified', "updatedAt" = ? WHERE id = ?`, order.id, now(), c.id)
    }
    if (!order) return void res.status(500).json({ error: 'Something went wrong. Please open the link again.' })
    res.json({ orderUrl: `/store/${s.handle}/order/${order.id}?k=${encodeURIComponent(order.accessKey)}`, order: await orderView(order, s) })
  })

  /** What the buyer would pay right now, with an optional code. Read only: nothing is reserved. */
  pub.post('/:handle/quote', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const found = await q.product(String(req.body?.productId ?? ''), s.id)
    if (!found || !found.pubAt || found.pubPriceMinor == null || !found.pubCurrency) return void res.status(404).json({ error: 'This product isn’t for sale.' })
    const given = String(req.body?.coupon ?? '').trim()
    const code = given ? normaliseCode(given) : null
    const c = code ? await q.coupon(s.id, code) : undefined
    const qt = priceQuote({ productId: found.id, listMinor: found.pubPriceMinor, currency: found.pubCurrency, offer: readExtras(found.pubExtras).offer, coupon: c ?? null, code: given ? code ?? given : null })
    res.json({ quote: { ...qt, needsEmail: Boolean(qt.coupon && c?.perCustomer != null), cardMinimum: CARD_MINIMUM } })
  })

  pub.post('/:handle/checkout', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const productId = String((req.body as { productId?: unknown })?.productId ?? '')
    const found = await q.product(productId, s.id)
    const bundleIds = found ? readExtras(found.pubExtras).bundle : []
    if (!found || !found.pubAt || (!found.pubFileId && bundleIds.length < 2) || found.pubPriceMinor == null || !found.pubCurrency) return void res.status(404).json({ error: 'This product isn’t for sale.' })
    // A bundle can only be bought when the order will grant every item: each must be live with a file.
    let entitlements: Array<{ productId: string; title: string; fileId: string; fileName: string }> = []
    if (bundleIds.length >= 2) {
      const items = await Promise.all(bundleIds.map((id) => q.product(id, s.id)))
      if (items.some((i) => !i || !i.pubAt || !i.pubFileId)) return void res.status(409).json({ error: 'This bundle isn’t available right now: one of its products is missing.' })
      entitlements = items.map((i) => ({ productId: i!.id, title: i!.pubTitle ?? '', fileId: i!.pubFileId!, fileName: i!.pubFileName ?? 'download' }))
      found.pubFileId = 'bundle'
      found.pubFileName = 'bundle'
    }
    // The buyer pays the price worked out here: list price, live offer, then at most one code. Never sent by the browser.
    const priced = await pricePurchase(s, found, req.body?.coupon)
    if ('error' in priced) return void res.status(409).json({ error: priced.error, couponError: true })
    const p = { ...found, pubPriceMinor: priced.totalMinor }
    const couponCode = priced.coupon?.code ?? null
    const buyerEmailRaw = String(req.body?.email ?? '').trim().toLowerCase()
    const validEmail = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(buyerEmailRaw) && buyerEmailRaw.length <= 254 ? buyerEmailRaw : null
    if (priced.coupon?.perCustomer != null && !validEmail) return void res.status(400).json({ error: 'Enter your email to use this code.', couponError: true })
    /** Pricing columns stored on the order, so its total never changes later. */
    const ledger = { listMinor: priced.listMinor, discountMinor: priced.discountMinor, couponCode, couponId: priced.coupon?.id ?? null }
    /** Create the order (or return the one for this checkout key) and take the code's use in the same transaction. */
    const placeOrder = async (insert: (tx: Sql) => Promise<{ changes: number }>, key: string) => {
      try {
        return await sql.tx(async (tx) => {
          const made = await insert(tx)
          const row = (await tx.get<OrderRow>('SELECT * FROM seller_order WHERE "storeId" = ? AND "checkoutKey" = ?', s.id, key))!
          if (made.changes) {
            await tx.run('UPDATE seller_order SET "listMinor" = ?, "discountMinor" = ?, "couponCode" = ?, "couponId" = ? WHERE id = ?', ledger.listMinor, ledger.discountMinor, ledger.couponCode, ledger.couponId, row.id)
            if (priced.coupon) await reserveCoupon(tx, priced.coupon, row.id, validEmail)
            // the bundle's contents as bought: later edits to the bundle never change this order
            for (const e of entitlements) await tx.run(`INSERT INTO seller_entitlement ("orderId", "productId", title, "fileId", "fileName") VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`, row.id, e.productId, e.title, e.fileId, e.fileName)
          }
          return (await tx.get<OrderRow>('SELECT * FROM seller_order WHERE id = ?', row.id))!
        })
      } catch (e) {
        if (e instanceof CouponRefused) return { refused: e.message }
        throw e
      }
    }
    /** A retry must be the same purchase: same product, method and code. */
    const samePurchase = (o: OrderRow, method: string) => o.productId === p.id && o.method === method && (o.couponCode ?? null) === couponCode
    // Free products (also a code that makes it free) are delivered by email only: see /claim.
    if (p.pubPriceMinor === 0) return void res.status(409).json({ code: 'use_claim', error: 'Free products are sent by email. Enter your email to get the link.' })
    const method = String(req.body?.method ?? 'stripe')
    if (method === 'paypal' || method === 'bank') return void (await altCheckout(req, res, s, p, method, placeOrder, samePurchase))
    if (method !== 'stripe') return void res.status(400).json({ error: 'Unknown payment method.' })
    if (!readPayments(s.payments).stripe.enabled) return void res.status(409).json({ error: 'This seller doesn’t take card payments.' })
    if (p.pubPriceMinor < CARD_MINIMUM) return void res.status(409).json({ error: couponCode ? 'With this code the price is below the 0.50 card minimum. Remove the code or choose another way to pay.' : 'Card payments need a price of at least 0.50. Choose bank transfer instead.', couponError: Boolean(couponCode) })
    const st = stripe()
    if (!st) return void res.status(503).json({ error: 'Checkout isn’t switched on for this store yet.' })
    const fresh = await refreshAccount(s).catch(() => s)
    if (!fresh.stripeAccountId || !fresh.chargesReady) return void res.status(409).json({ error: 'This seller can’t take payments yet.' })
    const key = String(req.body?.checkoutKey ?? req.body?.requestId ?? randomUUID())
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return void res.status(400).json({ error: 'Invalid checkout key.' })
    const order = await placeOrder((tx) => tx.run(`INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", "checkoutKey", "stripeMode", "buyerEmail") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ("storeId", "checkoutKey") DO NOTHING`, `ord_${randomBytes(12).toString('hex')}`, s.id, p.id, p.pubTitle ?? '', p.pubFileId, p.pubFileName ?? 'download', fresh.stripeAccountId, p.pubPriceMinor, p.pubCurrency, randomBytes(24).toString('base64url'), now(), key, stripeMode, priced.coupon ? validEmail : null), key)
    if ('refused' in order) return void res.status(409).json({ error: order.refused, couponError: true })
    if (!samePurchase(order, 'stripe') || order.stripeMode !== stripeMode) return void res.status(409).json({ error: 'This checkout key belongs to a different purchase.' })
    if (order.checkoutUrl) return void res.json({ url: order.checkoutUrl })
    if (Date.now() - Date.parse(order.createdAt) > 23 * 60 * 60 * 1000) return void res.status(409).json({ error: 'This checkout attempt expired. Start a new purchase.' })
    const session = await st.checkout.sessions.create({
      mode: 'payment', adaptive_pricing: { enabled: false },
      line_items: [{ quantity: 1, price_data: { currency: order.currency, unit_amount: order.amountMinor, product_data: { name: order.productTitle } } }],
      success_url: `${seller.siteUrl}/store/${s.id}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      // back to the product being bought, at the store's public address (not its internal id)
      cancel_url: `${seller.siteUrl}/${s.handle}/p/${p.id}?checkout=cancelled`,
      metadata: { desknotyOrderId: order.id, desknotyStoreId: s.id, desknotyProductId: p.id },
      // Direct charge on the seller's connected account; Desknoty's fee (if any) comes off through Stripe.
      payment_intent_data: {
        metadata: { desknotyOrderId: order.id },
        ...(PLATFORM_FEE_PERCENT > 0 ? { application_fee_amount: Math.round((order.amountMinor * PLATFORM_FEE_PERCENT) / 100) } : {}),
      },
    }, { stripeAccount: order.accountId, idempotencyKey: `checkout_${order.id}` })
    await sql.run('UPDATE seller_order SET "sessionId" = ?, "checkoutUrl" = ? WHERE id = ?', session.id, session.url, order.id)
    res.json({ url: session.url })
  })

  /** PayPal and bank transfer checkout. Same order row, receipt and download flow as Stripe. */
  async function altCheckout(req: Request, res: Response, s: StoreRow, p: ProductRow, method: 'paypal' | 'bank', placeOrder: (insert: (tx: Sql) => Promise<{ changes: number }>, key: string) => Promise<OrderRow | { refused: string }>, samePurchase: (o: OrderRow, method: string) => boolean) {
    const pay = readPayments(s.payments)
    if (!readyMethods(s, pay).includes(method)) return void res.status(409).json({ error: method === 'paypal' ? 'This seller doesn’t take PayPal.' : 'This seller doesn’t take bank transfers.' })
    const key = String(req.body?.checkoutKey ?? randomUUID())
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return void res.status(400).json({ error: 'Invalid checkout key.' })
    const buyerEmail = String(req.body?.email ?? '').trim().toLowerCase()
    if (method === 'bank' && !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(buyerEmail)) return void res.status(400).json({ error: 'Enter your email: the seller sends your download there once your transfer arrives.' })
    // Bank transfer: which bank the buyer pays from and the name on their account, so the seller can match it
    const payerName = method === 'bank' ? str(req.body?.payerName, 80).trim() : ''
    const payerBank = method === 'bank' ? str(req.body?.payerBank, 60).trim() : ''
    // which of the seller's saved accounts the buyer pays into (default: the one in use)
    let payTo: string | null = null
    if (method === 'bank') {
      const i = Number(req.body?.bankIndex)
      const chosen = Number.isInteger(i) && i >= 0 ? pay.savedBanks[i] : undefined
      if (req.body?.bankIndex !== undefined && !chosen) return void res.status(400).json({ error: 'Choose one of the seller’s bank accounts.' })
      payTo = JSON.stringify(chosen ?? { ...pay.bank, enabled: undefined })
    }
    const id = `ord_${randomBytes(12).toString('hex')}`
    const order = await placeOrder((tx) => tx.run(
        `INSERT INTO seller_order (id, "storeId", "productId", "productTitle", "fileId", "fileName", "accountId", "amountMinor", currency, "accessKey", "createdAt", "checkoutKey", "stripeMode", method, reference, "buyerEmail", "payerName", "payerBank", "payTo") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ("storeId", "checkoutKey") DO NOTHING`,
        id, s.id, p.id, p.pubTitle ?? '', p.pubFileId, p.pubFileName ?? 'download',
        method === 'paypal' ? `paypal:${pay.paypal.email}` : 'bank',
        p.pubPriceMinor, p.pubCurrency, randomBytes(24).toString('base64url'), now(), key, stripeMode, method,
        method === 'bank' ? bankReference(id) : null,
        method === 'bank' ? buyerEmail : null,
        payerName || null,
        payerBank || null,
        payTo,
      ), key)
    if ('refused' in order) return void res.status(409).json({ error: order.refused, couponError: true })
    // A retry with the same key returns the same order; a key from another purchase is refused.
    if (!samePurchase(order, method)) return void res.status(409).json({ error: 'This checkout key belongs to a different purchase.' })
    if (method === 'bank') {
      return void res.json({ orderUrl: `/store/${s.handle}/order/${order.id}?k=${encodeURIComponent(order.accessKey)}`, order: await orderView(order, s) })
    }
    if (order.checkoutUrl) return void res.json({ url: order.checkoutUrl })
    const payee = order.accountId.replace(/^paypal:/, '')
    const back = `${seller.siteUrl}/store/${s.id}/thanks?paypal_order=${order.id}&k=${encodeURIComponent(order.accessKey)}`
    const { paypalOrderId, approveUrl } = await createPaypalOrder({ id: order.id, amountMinor: order.amountMinor, currency: order.currency, title: order.productTitle }, payee, back, `${seller.siteUrl}/${s.handle}/p/${p.id}?checkout=cancelled`)
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
      if (po.status === 'VOIDED') { await sql.run(`UPDATE seller_order SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, o.id); await releaseCoupon(o.id) }
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
      storeHandle: s.handle,
      status: o.status,
      product: o.productTitle,
      productId: o.productId,
      amountMinor: o.amountMinor,
      currency: o.currency,
      email: o.buyerEmail,
      fileName: o.fileName,
      // a bundle has no file of its own: its items each have a download below
      downloadUrl: o.status === 'paid' && o.fileId !== 'bundle' ? `${seller.apiUrl}/api/store-download/${signDownload(o.id, downloadExpiresAt)}` : null,
      retrievalUrl: o.status === 'paid' ? retrievalUrl(o, s.handle) : null,
      downloadExpiresAt,
      method: o.method,
      // Bank transfer: what to pay and where, until the seller confirms it arrived.
      bank: o.method === 'bank' && o.status === 'pending' ? { ...(o.payTo ? bankDetailsOf(JSON.parse(o.payTo), readPayments(s.payments).bank.instructions) : bankDetails(readPayments(s.payments))), reference: o.reference } : null,
      buyerClaimedAt: o.buyerClaimedAt,
      payerBank: o.method === 'bank' ? o.payerBank ?? null : null,
      receiptSent: receipt?.status === 'sent',
      receiptStatus: receipt?.status === 'sent' ? 'accepted' : receipt?.status ?? 'not_queued',
      items: o.status === 'paid'
        ? (await sql.all<{ productId: string; title: string; fileName: string }>(`SELECT "productId", title, "fileName" FROM seller_entitlement WHERE "orderId" = ? ORDER BY title`, o.id)).map((e) => ({ productId: e.productId, title: e.title, fileName: e.fileName, downloadUrl: `${seller.apiUrl}/api/store-download/${signDownload(`${o.id}~${e.productId}`, downloadExpiresAt)}` }))
        : [],
    }
  }

  /** The Checkout success page asks here; if the webhook hasn't arrived yet, Stripe is asked directly. */
  pub.get('/:handle/session/:sessionId', async (req, res) => {
    const s = await q.storeById(String(req.params.handle)) ?? await q.storeByHandle(String(req.params.handle).toLowerCase())
    let o = await q.orderBySession(String(req.params.sessionId))
    const purchaseStore = o ? await q.storeById(o.storeId) : undefined
    if (!purchaseStore || !o || (s && o.storeId !== s.id)) return void res.status(404).json({ error: 'Order not found.' })
    const st = stripe()
    // When the Stripe webhook is set up, only the signed webhook unlocks a purchase. Without one
    // (or with SELLER_CONFIRM_FALLBACK=on) the server asks Stripe directly, never trusting the browser.
    const fallback = process.env.SELLER_CONFIRM_FALLBACK === 'on' || (process.env.SELLER_CONFIRM_FALLBACK !== 'off' && !seller.webhookSecret)
    if (o.status === 'pending' && st && fallback) {
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

  /**
   * "Resend download email": the same order, the same secure link, a fresh receipt. Needs the order's
   * private key (no seller account). At least a minute apart and at most 5 in 24 hours, enforced with one
   * guarded UPDATE so parallel clicks can't get around it.
   */
  pub.post('/:handle/order/:orderId/resend', async (req, res) => {
    const found = await buyerOrder(String(req.params.orderId), String(req.body?.k ?? ''))
    if (!found) return void res.status(404).json({ error: 'Order not found.' })
    const o = found.o
    if (o.status !== 'paid') return void res.status(409).json({ error: 'The download email is sent once the order is complete.' })
    if (!o.buyerEmail) return void res.status(409).json({ error: 'This order has no email address to send to.' })
    const t = Date.now()
    const nowIso = new Date(t).toISOString(), minuteAgo = new Date(t - 60_000).toISOString(), dayAgo = new Date(t - 86_400_000).toISOString()
    const ok = await sql.run(
      `UPDATE seller_order SET "resendCount" = CASE WHEN "resendAt" IS NULL OR "resendAt" < ? THEN 1 ELSE "resendCount" + 1 END, "resendAt" = ? WHERE id = ? AND ("resendAt" IS NULL OR "resendAt" < ?) AND ("resendAt" IS NULL OR "resendAt" < ? OR "resendCount" < 5)`,
      dayAgo, nowIso, o.id, minuteAgo, dayAgo,
    )
    if (!ok.changes) return void res.status(429).json({ error: 'Please wait a minute before sending it again. You can resend up to 5 times a day.' })
    const store = found.st
    const queued = await enqueueEmail('order-receipt', o.buyerEmail, { url: retrievalUrl(o, store.handle), name: o.productTitle, amount: formatMoneyMinor(o.amountMinor, o.currency), email: storeName(store) })
    if (!queued.queued) return void res.status(400).json({ error: 'We couldn’t send to that email address.' })
    await sql.run('UPDATE seller_order SET "receiptId" = ?, "emailedAt" = COALESCE("emailedAt", ?) WHERE id = ?', queued.id, nowIso, o.id)
    const r = await sendNow(queued.id)
    const masked = maskAddress(o.buyerEmail)
    if (r.status === 'sent') return void res.json({ emailStatus: 'sent', to: masked })
    if (r.status === 'queued') return void res.json({ emailStatus: 'queued', to: masked, emailError: 'The email is on its way but hasn’t been confirmed yet.' })
    res.status(502).json({ emailStatus: 'failed', to: masked, error: 'We couldn’t send the email right now. Your download link on this page still works.' })
  })

  /** Public reviews for a product: visible ones only, newest first, with real totals. */
  pub.get('/:handle/products/:productId/reviews', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const p = await q.product(String(req.params.productId), s.id)
    if (!p || !p.pubAt) return void res.status(404).json({ error: 'Product not found.' })
    const rows = await sql.all<{ id: string; rating: number; body: string; name: string; createdAt: string; updatedAt: string }>(`SELECT id, rating, body, name, "createdAt", "updatedAt" FROM seller_review WHERE "productId" = ? AND status = 'visible' ORDER BY "createdAt" DESC LIMIT 100`, p.id)
    res.json({ summary: (await ratingSummaries(s.id)).get(p.id) ?? { average: 0, count: 0, breakdown: [0, 0, 0, 0, 0] }, reviews: rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, name: r.name || 'Verified buyer', verified: true, createdAt: r.createdAt, edited: r.updatedAt !== r.createdAt })) })
  })

  /** The buyer's own review for a product they bought (order link key required). */
  pub.post('/:handle/order/:orderId/review', async (req, res) => {
    const found = await buyerOrder(String(req.params.orderId), String(req.body?.k ?? ''))
    if (!found) return void res.status(404).json({ error: 'Order not found.' })
    const { o, st } = found
    if (o.status !== 'paid') return void res.status(403).json({ error: 'You can review a product once your order is complete.' })
    const productId = String(req.body?.productId ?? o.productId)
    if (!(await orderProducts(o)).includes(productId)) return void res.status(403).json({ error: 'This order doesn’t include that product.' })
    const rating = Number(req.body?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return void res.status(400).json({ error: 'Choose 1 to 5 stars.' })
    const body = String(req.body?.body ?? '').replace(/\r/g, '').trim().slice(0, 2000)
    const name = String(req.body?.name ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 40)
    const key = reviewerKey(o)
    const t = now()
    const existing = await sql.get<{ id: string; status: string }>(`SELECT id, status FROM seller_review WHERE "productId" = ? AND "reviewerKey" = ?`, productId, key)
    if (existing?.status === 'removed') return void res.status(403).json({ error: 'This review was removed by Desknoty for breaking the review rules.' })
    if (existing) await sql.run(`UPDATE seller_review SET rating = ?, body = ?, name = ?, "updatedAt" = ? WHERE id = ?`, rating, body, name, t, existing.id)
    else await sql.run(`INSERT INTO seller_review (id, "storeId", "productId", "orderId", "reviewerKey", rating, body, name, status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?, ?) ON CONFLICT DO NOTHING`, `rev_${randomBytes(10).toString('hex')}`, st.id, productId, o.id, key, rating, body, name, t, t)
    const mineNow = (await sql.get<{ id: string; rating: number; body: string; name: string }>(`SELECT id, rating, body, name FROM seller_review WHERE "productId" = ? AND "reviewerKey" = ?`, productId, key))!
    res.status(existing ? 200 : 201).json({ review: mineNow })
  })
  pub.get('/:handle/order/:orderId/review', async (req, res) => {
    const found = await buyerOrder(String(req.params.orderId), String(req.query.k ?? ''))
    if (!found) return void res.status(404).json({ error: 'Order not found.' })
    const productId = String(req.query.productId ?? found.o.productId)
    const r = await sql.get<{ id: string; rating: number; body: string; name: string; status: string }>(`SELECT id, rating, body, name, status FROM seller_review WHERE "productId" = ? AND "reviewerKey" = ?`, productId, reviewerKey(found.o))
    res.json({ review: r ?? null, eligible: found.o.status === 'paid' })
  })

  /** Anyone can report a review. It stays up until a Desknoty admin decides; sellers can't remove reviews. */
  pub.post('/:handle/reviews/:reviewId/report', async (req, res) => {
    const s = await liveStore(req, res)
    if (!s) return
    const r = await sql.get<{ id: string }>(`SELECT id FROM seller_review WHERE id = ? AND "storeId" = ?`, String(req.params.reviewId), s.id)
    if (!r) return void res.status(404).json({ error: 'Review not found.' })
    const reason = String(req.body?.reason ?? '').trim().slice(0, 300)
    if (!reason) return void res.status(400).json({ error: 'Tell us what’s wrong with this review.' })
    const reporter = createHmac('sha256', env.secret).update(`report:${req.ip}:${req.headers['user-agent'] ?? ''}`).digest('base64url').slice(0, 32)
    await sql.run(`INSERT INTO seller_review_report ("reviewId", reporter, reason, "createdAt") VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, r.id, reporter, reason, now())
    res.json({ reported: true })
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
    const signed = verifyDownload(String(req.params.token))
    const [orderId, itemId] = signed ? signed.split('~') : [null, null]
    const o = orderId ? await q.order(orderId) : undefined
    if (!o || o.status !== 'paid') return void res.status(403).json({ error: 'This download link is invalid or has expired.' })
    if (itemId) {
      const e = await sql.get<{ fileId: string; fileName: string }>(`SELECT "fileId", "fileName" FROM seller_entitlement WHERE "orderId" = ? AND "productId" = ?`, o.id, itemId)
      if (!e || !/^fil_[a-f0-9]{32}$/.test(e.fileId) || !(await blobs().exists('files', e.fileId))) return void res.status(410).json({ error: 'This file is no longer available.' })
      return void (await blobs().send('files', e.fileId, res, { fileName: e.fileName.replace(/[^\w.\- ]/g, '_'), type: 'application/octet-stream', cache: 'private, no-store' }))
    }
    if (!/^fil_[a-f0-9]{32}$/.test(o.fileId) || !(await blobs().exists('files', o.fileId))) return void res.status(410).json({ error: 'This file is no longer available.' })
    await blobs().send('files', o.fileId, res, { fileName: o.fileName.replace(/[^\w.\- ]/g, '_'), type: 'application/octet-stream', cache: 'private, no-store' })
  })

  /** The product's published free sample. Separate storage from the paid file, so it can never leak it. */
  r.get('/api/store-sample/:productId', async (req, res) => {
    const p = await sql.get<ProductRow>(`SELECT * FROM seller_product WHERE id = ?`, String(req.params.productId))
    const st = p ? await q.storeById(p.storeId) : undefined
    if (!p || !st || !st.published || !p.pubAt || !p.pubSampleFileId || !/^smp_[a-f0-9]{32}$/.test(p.pubSampleFileId) || !(await blobs().exists('media', p.pubSampleFileId))) return void res.status(404).json({ error: 'No sample for this product.' })
    await blobs().send('media', p.pubSampleFileId, res, { fileName: (p.pubSampleName ?? 'sample').replace(/[^\w.\- ]/g, '_'), type: 'application/octet-stream', cache: 'public, max-age=300' })
  })

  /** Signed-in customers' saved products. Private: only the owner can read them, and no counts are published. */
  r.get('/api/favourites', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) return void res.status(401).json({ error: 'Not signed in.' })
    const rows = await sql.all<{ productId: string }>(`SELECT "productId" FROM customer_favourite WHERE "userId" = ? ORDER BY "createdAt" DESC`, session.user.id)
    res.set('Cache-Control', 'no-store').json({ productIds: rows.map((x) => x.productId) })
  })
  r.put('/api/favourites/:productId', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) return void res.status(401).json({ error: 'Not signed in.' })
    const p = await sql.get<{ id: string }>(`SELECT id FROM seller_product WHERE id = ? AND "pubAt" IS NOT NULL`, String(req.params.productId))
    if (!p) return void res.status(404).json({ error: 'Product not found.' })
    const n = await sql.get<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM customer_favourite WHERE "userId" = ?`, session.user.id)
    if ((n?.n ?? 0) >= 500) return void res.status(400).json({ error: 'You’ve saved the maximum number of products.' })
    await sql.run(`INSERT INTO customer_favourite ("userId", "productId", "createdAt") VALUES (?, ?, ?) ON CONFLICT DO NOTHING`, session.user.id, p.id, now())
    res.json({ saved: true })
  })
  r.delete('/api/favourites/:productId', async (req, res) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) return void res.status(401).json({ error: 'Not signed in.' })
    await sql.run(`DELETE FROM customer_favourite WHERE "userId" = ? AND "productId" = ?`, session.user.id, String(req.params.productId))
    res.json({ saved: false })
  })

  /** Review moderation: Desknoty administrators only. Sellers have no way to edit, hide or delete reviews. */
  const requireAdminSession = async (req: Request, res: Response) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) { res.status(401).json({ error: 'Not signed in.' }); return null }
    if ((session.user as { role?: string | null }).role !== 'admin') { res.status(403).json({ error: 'Administrators only.' }); return null }
    return session
  }
  r.get('/api/admin/reviews/reported', async (req, res) => {
    if (!(await requireAdminSession(req, res))) return
    const rows = await sql.all<Record<string, unknown>>(`SELECT r.id, r."productId", r.rating, r.body, r.name, r.status, r."removedReason", CAST(COUNT(x.reporter) AS INTEGER) AS reports, MAX(x.reason) AS "lastReason" FROM seller_review r JOIN seller_review_report x ON x."reviewId" = r.id GROUP BY r.id, r."productId", r.rating, r.body, r.name, r.status, r."removedReason" ORDER BY reports DESC LIMIT 200`)
    res.json({ reviews: rows })
  })
  r.post('/api/admin/reviews/:id/moderate', express.json(), async (req, res) => {
    if (!(await requireAdminSession(req, res))) return
    const action = req.body?.action === 'remove' ? 'removed' : req.body?.action === 'restore' ? 'visible' : null
    if (!action) return void res.status(400).json({ error: 'Use action remove or restore.' })
    const reason = String(req.body?.reason ?? '').trim().slice(0, 300)
    if (action === 'removed' && !reason) return void res.status(400).json({ error: 'Give the rule the review broke.' })
    const done = await sql.run(`UPDATE seller_review SET status = ?, "removedReason" = ? WHERE id = ?`, action, action === 'removed' ? reason : null, String(req.params.id))
    if (!done.changes) return void res.status(404).json({ error: 'Review not found.' })
    res.json({ status: action })
  })

  r.get('/api/store-media/:id', async (req, res) => {
    const id = String(req.params.id)
    const m = /^med_[a-f0-9]{24}$/.test(id) ? await sql.get(`SELECT type FROM seller_media WHERE id = ?`, id) : undefined
    if (!m || !(await blobs().exists('media', id))) return void res.status(404).end()
    await blobs().send('media', id, res, { type: String(m.type), cache: 'public, max-age=31536000, immutable' })
  })

  return r
}



