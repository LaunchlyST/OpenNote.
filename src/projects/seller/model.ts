/** Seller Studio data, as the Desknoty server stores it. */
import { apiUrl } from '../../lib/api-base'

/** Desknoty's cut of each sale. Stripe's own processing fee is separate and charged by Stripe. */
export const PLATFORM_FEE_PERCENT = 0

export type BlockType = 'header' | 'hero' | 'text' | 'image' | 'links' | 'featured' | 'grid' | 'faq' | 'tiktok' | 'email' | 'divider' | 'footer'

export interface Block {
  id: string
  type: BlockType
  hidden: boolean
  data: Record<string, any>
  /** Per-element look set in the floating editor. */
  look?: Look
}

/**
 * A product slide inside one product block. A block can hold one slide or a
 * swipeable carousel of them; either way it counts as ONE product block when
 * the store's pages are balanced.
 *
 * Digital and affiliate settings are kept side by side, so switching a slide
 * between the two never deletes the other side's file, product or cover.
 */
export interface AffiliateLink {
  /** The destination. http(s) only; validated again by the server. */
  url: string
  title: string
  description: string
  /** Cover image id (media_…), never a private product file. */
  cover: string | null
  /** Optional "View product ↗"; empty hides the button (the image stays clickable). */
  cta: string
}

export interface ProductSlide {
  id: string
  kind: 'digital' | 'affiliate'
  /** Digital: the product this slide sells. Empty until one is picked. */
  productId: string | null
  /** Affiliate: the external destination and its presentation. */
  affiliate: AffiliateLink
}

/** Page 2 and Page 3. Home stays in `Page.blocks` so older stores keep working. */
export interface StorePageDoc {
  id: string
  name: string
  blocks: Block[]
}

export interface Look {
  align?: 'left' | 'center' | 'right'
  size?: 's' | 'm' | 'l' | 'xl'
  color?: string
  space?: 'tight' | 'normal' | 'roomy'
  font?: 'geist' | 'grotesque' | 'serif'
}

export interface Page {
  name: string
  bio: string
  avatar: string | null
  theme: { preset: string; accent: string; font: string; button: 'rounded' | 'pill' | 'sharp'; background: 'solid' | 'gradient' }
  socials: { instagram: string; youtube: string; x: string; website: string }
  blocks: Block[]
  /** Page 2 and Page 3 (Home is `blocks`, above). Absent on older stores. */
  pages?: StorePageDoc[]
  /** Banner behind the profile: an image or short video (plays when tapped). */
  banner?: { media: string; kind: 'image' | 'video' } | null
  /** A second design to try; `use` picks which one Publish puts live. */
  style2?: Page | null
  use?: 1 | 2
  /** Set on the published page when Style 2 went live. */
  layout?: 'style2'
}

/** What the storefront renderer needs to know about a product. */
export interface ShopProduct {
  id: string
  title: string
  description: string
  cover: string | null
  priceMinor: number
  currency: string
  /** A running discount, worked out by the server (null when none is live). */
  offer?: { priceMinor: number; percent: number; badge: string; badgeColor: string; ends: string | null; savedMinor?: number; endsAt?: string | null; countdown?: boolean } | null
  cta?: { text: string; color: string }
  hidden?: boolean
  /** Card presentation (V2); all optional so older data still renders. */
  layout?: CardLayout
  subtitle?: string
  crop?: { x: number; y: number; zoom: number }
  gallery?: string[]
  video?: string | null
  badges?: { new: boolean; featured: boolean }
  format?: string
  included?: string[]
  access?: string
  faq?: Array<{ q: string; a: string }>
  textPos?: { title: number; desc: number }
  /** File type label worked out by the server from the protected file's name. */
  fileType?: string | null
  /** Stage C: real review totals (null when there are none). */
  rating?: { average: number; count: number; breakdown: number[] } | null
  /** Stage C: a free public sample (never the paid file). */
  sample?: { name: string; url?: string; size?: number } | null
  related?: string[]
  /** Stage C: a bundle's items; available only when every item can be delivered. */
  bundle?: { items: Array<{ id: string; title: string }>; available: boolean } | null
  /** Affiliate / external mode: when set, shows an external link instead of Buy/Download. */
  affiliate?: { url: string; image?: string; title?: string; description?: string; disclosure?: string }
}

export type CardLayout = 'compact' | 'showcase' | 'featured'

export type ProductExtras = {
  offer: { on: boolean; kind: 'percent' | 'amount'; value: number; starts: string | null; ends: string | null; badge: string; badgeColor: string; tz?: string; startsLocal?: string | null; endsLocal?: string | null; startsAt?: string | null; endsAt?: string | null; countdown?: boolean }
  cta: { text: string; color: string }
  hidden: boolean
  layout: CardLayout
  subtitle: string
  crop: { x: number; y: number; zoom: number }
  gallery: string[]
  video: string | null
  badges: { new: boolean; featured: boolean }
  format: string
  included: string[]
  access: string
  faq: Array<{ q: string; a: string }>
  textPos: { title: number; desc: number }
  related: string[]
  bundle: string[]
  affiliate: { url: string; image?: string; title?: string; description?: string; disclosure?: string }
}
export const DEFAULT_EXTRAS: ProductExtras = {
  offer: { on: false, kind: 'percent', value: 20, starts: null, ends: null, badge: 'PERCENT', badgeColor: '#e11d48' },
  cta: { text: '', color: '' },
  hidden: false,
  layout: 'compact',
  subtitle: '',
  crop: { x: 50, y: 50, zoom: 1 },
  gallery: [],
  video: null,
  badges: { new: false, featured: false },
  format: '',
  included: [],
  access: '',
  faq: [],
  textPos: { title: 0, desc: 0 },
  related: [],
  bundle: [],
  affiliate: { url: '', image: '', title: '', description: '', disclosure: '' },
}

/** Fill any missing V2 fields so older products keep working. */
export function withExtras(x: Partial<ProductExtras> | undefined): ProductExtras {
  return {
    ...DEFAULT_EXTRAS,
    ...x,
    offer: { ...DEFAULT_EXTRAS.offer, ...x?.offer },
    cta: { ...DEFAULT_EXTRAS.cta, ...x?.cta },
    hidden: x?.hidden ?? false,
    layout: x?.layout ?? 'compact',
    subtitle: x?.subtitle ?? '',
    crop: { ...DEFAULT_EXTRAS.crop, ...x?.crop },
    badges: { ...DEFAULT_EXTRAS.badges, ...x?.badges },
    textPos: { ...DEFAULT_EXTRAS.textPos, ...x?.textPos },
    gallery: x?.gallery ?? [],
    included: x?.included ?? [],
    faq: x?.faq ?? [],
    related: x?.related ?? [],
    bundle: x?.bundle ?? [],
    affiliate: x?.affiliate ?? DEFAULT_EXTRAS.affiliate,
  }
}

/** The seller's own (draft) view of a product. */
export interface DraftProduct extends ShopProduct {
  extras?: ProductExtras
  archived?: boolean
  revision: number
  file: { name: string; size: number; type: string } | null
  listed: boolean
  published: boolean
  changed: boolean
  problem: string | null
}

export type PayoutStatus = 'not_connected' | 'incomplete' | 'pending' | 'ready'

export interface StoreView {
  revision: number
  id: string
  handle: string
  url: string
  draft: Page
  published: Page | null
  publishedAt: string | null
  unpublishedChanges: boolean
  tiktok: { username: string; displayName: string; avatarUrl: string } | null
  payouts: {
    status: PayoutStatus
    accountId: string | null
    /** Any payment method is ready (Stripe, PayPal or bank transfer). */
    checkoutReady: boolean
    stripeReady?: boolean
    methods?: PayMethod[]
    payments?: PaymentSettings
  }
  products: DraftProduct[]
}

export type PayMethod = 'stripe' | 'paypal' | 'bank'
export interface PaymentSettings {
  stripe: { enabled: boolean }
  paypal: { enabled: boolean; email: string }
  bank: { enabled: boolean; bankName: string; accountName: string; sortCode: string; accountNumber: string; iban: string; bic: string; instructions: string }
  /** Every saved bank account; `bank` is the one buyers pay into. */
  savedBanks?: SavedBank[]
}
export type SavedBank = Omit<PaymentSettings['bank'], 'enabled'>

export interface SellerSetup {
  /** The platform has PayPal set up, so sellers can turn it on. */
  paypal?: boolean
  paypalMode?: string
  stripe: boolean
  webhook: boolean
  tiktok: boolean
  platformFeePercent: number
}

export const BLOCKS: Array<{ type: BlockType; label: string; hint: string }> = [
  { type: 'header', label: 'Profile header', hint: 'Photo, name, bio and socials' },
  { type: 'hero', label: 'Welcome intro', hint: 'Welcome text left, square image right' },
  { type: 'text', label: 'Text', hint: 'A heading and a paragraph' },
  { type: 'image', label: 'Image', hint: 'A picture with a caption' },
  { type: 'links', label: 'Links', hint: 'Buttons to anywhere' },
  { type: 'featured', label: 'Digital product', hint: 'One product, big' },
  { type: 'grid', label: 'Product collection', hint: 'The products you pick' },
  { type: 'faq', label: 'FAQ', hint: 'Questions and answers' },
  { type: 'tiktok', label: 'TikTok videos', hint: 'Your TikTok videos, tap to play' },
  { type: 'email', label: 'Email support', hint: 'An email button for questions' },
  { type: 'divider', label: 'Divider', hint: 'A line or space between sections' },
  { type: 'footer', label: 'Footer', hint: 'A closing line' },
]
export const blockLabel = (t: BlockType) => BLOCKS.find((b) => b.type === t)?.label ?? t

export function newBlock(type: BlockType): Block {
  const id = `blk_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const data: Record<BlockType, Record<string, unknown>> = {
    header: { showSocials: true },
    hero: { eyebrow: 'Welcome to my store 👋', title: '', body: '', media: null, button: 'Shop now' },
    text: { heading: 'About', body: '' },
    image: { media: null, alt: '', caption: '' },
    links: { links: [{ label: 'My YouTube', url: '' }] },
    featured: { productId: null, note: '', slides: [] },
    grid: { heading: 'Shop', productIds: [] },
    faq: { heading: 'FAQ', items: [{ q: 'How do I get my download?', a: 'Right after paying, and by email.' }] },
    tiktok: { heading: 'Latest on TikTok', videos: [] },
    email: { heading: 'Questions?', note: 'Email me and I’ll get back to you.', email: '', button: 'Email support' },
    divider: { style: 'line' },
    footer: { text: '' },
  }
  return { id, type, hidden: false, data: data[type] }
}

/* ------------------------------------------------ store pages + slides --- */

/** Three store pages at most: Home, Page 2 and Page 3. */
export const MAX_STORE_PAGES = 3
/** A product block (one product, a carousel, or a collection) per page. */
export const MAX_PRODUCT_BLOCKS_PER_PAGE = 3

/** A block that presents products. A carousel is still one block, whatever its slide count. */
export const isProductBlock = (b: Block) => b.type === 'featured' || b.type === 'grid'

export const productBlockCount = (blocks: Block[]) => blocks.filter(isProductBlock).length

export const pageLabel = (index: number) => (index === 0 ? 'Home' : `Page ${index + 1}`)

export const newPageId = () => `pg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

export function newStorePage(): StorePageDoc {
  return { id: newPageId(), name: '', blocks: [] }
}

/** Home first, then Page 2 and Page 3 exactly as saved (never more than three). */
export function storePages(page: Page): Array<{ id: string; name: string; blocks: Block[]; index: number }> {
  const extra = (page.pages ?? []).slice(0, MAX_STORE_PAGES - 1)
  return [
    { id: 'home', name: pageLabel(0), blocks: page.blocks, index: 0 },
    ...extra.map((p, i) => ({ id: p.id, name: pageLabel(i + 1), blocks: p.blocks, index: i + 1 })),
  ]
}

/** Replace one page's blocks without touching the other pages. */
export function withPageBlocks(page: Page, index: number, blocks: Block[]): Page {
  if (index <= 0) return { ...page, blocks }
  const extra = [...(page.pages ?? [])]
  while (extra.length < index) extra.push(newStorePage())
  extra[index - 1] = { ...extra[index - 1], blocks }
  return { ...page, pages: extra }
}

/** A page visitors can see: it has at least one visible section. Home is always shown. */
export function pageHasContent(blocks: Block[]): boolean {
  return blocks.some((b) => !b.hidden && b.type !== 'header' && b.type !== 'footer')
}

/** Add blank page docs up to `index` (Page 2 and Page 3 are created on demand). */
export function ensurePage(page: Page, index: number): Page {
  if (index <= 0) return page
  const extra = [...(page.pages ?? [])]
  while (extra.length < Math.min(index, MAX_STORE_PAGES - 1)) extra.push(newStorePage())
  return { ...page, pages: extra }
}

/**
 * Where a new product block goes. The current page takes it when it still has
 * room; otherwise the next page is used, creating Page 2/Page 3 as needed.
 * Returns null when all three pages are full.
 */
export function findProductBlockPage(page: Page, from: number): { page: Page; pageIndex: number } | null {
  let next = page
  for (let i = Math.max(0, from); i < MAX_STORE_PAGES; i++) {
    if (!storePages(next)[i]) next = ensurePage(next, i)
    if (productBlockCount(storePages(next)[i].blocks) < MAX_PRODUCT_BLOCKS_PER_PAGE) return { page: next, pageIndex: i }
  }
  return null
}

/** Insert a block at a structured position: after the header, before the footer. */
export function insertAt(blocks: Block[], block: Block, at: number): Block[] {
  const next = [...blocks]
  const max = next.length
  next.splice(Math.min(Math.max(0, at), max), 0, block)
  return next
}

/** New slide defaults. Both sides are kept so switching type loses nothing. */
export function newSlide(kind: ProductSlide['kind'] = 'digital', productId: string | null = null): ProductSlide {
  return {
    id: `sld_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    kind,
    productId,
    affiliate: { url: '', title: '', description: '', cover: null, cta: 'View product ↗' },
  }
}

/** Normalise a slide from older or partial data. */
export function cleanSlide(raw: Partial<ProductSlide> | null | undefined): ProductSlide | null {
  if (!raw || typeof raw !== 'object') return null
  const a = (raw.affiliate ?? {}) as Partial<AffiliateLink>
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newSlide().id,
    kind: raw.kind === 'affiliate' ? 'affiliate' : 'digital',
    productId: typeof raw.productId === 'string' && raw.productId ? raw.productId : null,
    affiliate: {
      url: typeof a.url === 'string' ? a.url : '',
      title: typeof a.title === 'string' ? a.title : '',
      description: typeof a.description === 'string' ? a.description : '',
      cover: typeof a.cover === 'string' ? a.cover : null,
      cta: typeof a.cta === 'string' ? a.cta : 'View product ↗',
    },
  }
}

/**
 * The slides of a product block. Older stores only have `productId`, so that
 * becomes a single digital slide; a block with neither is an empty slot.
 */
export function slidesOf(block: Block): ProductSlide[] {
  const raw = Array.isArray(block.data?.slides) ? block.data.slides : []
  const slides = raw.map((s: Partial<ProductSlide>) => cleanSlide(s)).filter((s: ProductSlide | null): s is ProductSlide => Boolean(s))
  if (slides.length) return slides
  return block.data?.productId ? [{ ...newSlide('digital', String(block.data.productId)), id: `sld_${block.id}` }] : []
}

/** What the server (and older renderers) use as "the product" of a block. */
export function primaryProductId(slides: ProductSlide[]): string | null {
  return slides.find((s) => s.kind === 'digital' && s.productId)?.productId ?? null
}

/** http(s) only: no javascript:, data:, credentials or empty hosts. Query strings survive. */
export function safeExternalUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname || u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}

/** An empty affiliate URL is allowed while drafting; a filled one must be safe. */
export const affiliateUrlProblem = (url: string): string | null => {
  if (!url.trim()) return null
  return safeExternalUrl(url) ? null : 'Enter a full http:// or https:// link. Other link types aren’t allowed.'
}

export const PRESETS = [
  { id: 'clean', label: 'Clean White', bg: '#ffffff', ink: '#111114', accent: '#111114' },
  { id: 'midnight', label: 'Midnight', bg: '#0f1220', ink: '#f4f4f5', accent: '#c8ff3d' },
  { id: 'sand', label: 'Sand', bg: '#f4ede2', ink: '#2b2419', accent: '#b8743a' },
  { id: 'lime', label: 'Neon Lime', bg: '#c8ff3d', ink: '#0b0b0f', accent: '#0b0b0f' },
  { id: 'pink', label: 'Soft Pink', bg: '#ffe4ee', ink: '#3b1424', accent: '#e8487a' },
  { id: 'mono', label: 'Mono', bg: '#18181b', ink: '#fafafa', accent: '#fafafa' },
]

export const FONTS = [
  { id: 'geist', label: 'Geist', css: "'Geist', system-ui, sans-serif" },
  { id: 'grotesque', label: 'Bricolage', css: "'Bricolage Grotesque', system-ui, sans-serif" },
  { id: 'serif', label: 'Instrument Serif', css: "'Instrument Serif', Georgia, serif" },
]

export const BUTTON_STYLES = ['rounded', 'pill', 'sharp'] as const

export const CURRENCIES = [
  { code: 'gbp', label: 'GBP', symbol: '£' },
  { code: 'usd', label: 'USD', symbol: '$' },
  { code: 'eur', label: 'EUR', symbol: '€' },
]

export function formatPrice(minor: number, currency: string) {
  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? ''
  const v = minor / 100
  return `${sym}${v.toFixed(v % 1 ? 2 : 0)}`
}

const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'dashboard', 'help', 'blog', 'store', 'desknoty', 'support', 'signin', 'signup', 'login', 'logout', 'account', 'landing', 'design', 'video', 'pro', 'free', 'assets', 'fonts', 'icons', 'settings', 'projects', 'privacy', 'terms', 'pricing', 'legal', 'about', 'contact', 'static', 'favicon'])

/** Why a store handle can't be used, or null if it's fine (the server checks again, and for uniqueness). */
export function handleProblem(h: string): string | null {
  if (h.length < 3) return 'At least 3 characters.'
  if (h.length > 30) return 'At most 30 characters.'
  if (!/^[a-z0-9-]+$/.test(h)) return 'Only lowercase letters, numbers and hyphens.'
  if (h.startsWith('-') || h.endsWith('-')) return 'Can’t start or end with a hyphen.'
  if (RESERVED.has(h)) return 'That name is reserved.'
  return null
}

/** A username as a store handle: lowercase, hyphens for anything else. */
export function toHandle(u: string): string {
  return u.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

export const mediaUrl = (id: string | null | undefined) => (id ? apiUrl(`/api/store-media/${id}`) : null)

/* ------------------------------------------------ old browser drafts --- */

/** The pre-server draft that Seller Studio used to keep in this browser. */
export interface LegacyDraft {
  name: string
  handle: string
  bio: string
  avatar: string | null
  theme: { preset: string; accent: string; font: string; button: string; background: string }
  socials: { instagram: string; youtube: string; x: string; website: string }
  products: Array<{ title: string; short: string; price: string; currency: string; cover: string | null }>
}
const LEGACY_KEYS = ['desknoty.seller.store.v2', 'desknoty.seller.store.v1']

export function readLegacyDraft(): LegacyDraft | null {
  for (const k of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const d = JSON.parse(raw) as Partial<LegacyDraft>
      const products = (d.products ?? []).filter((p) => p && p.title?.trim())
      if (!d.name?.trim() && !products.length) continue
      return {
        name: d.name ?? '',
        handle: d.handle ?? '',
        bio: d.bio ?? '',
        avatar: d.avatar ?? null,
        theme: { preset: 'clean', accent: '#111114', font: 'geist', button: 'rounded', background: 'solid', ...(d.theme ?? {}) },
        socials: { instagram: '', youtube: '', x: '', website: '', ...(d.socials ?? {}) },
        products,
      }
    } catch {
      /* unreadable: skip */
    }
  }
  return null
}
export function forgetLegacyDraft() {
  for (const k of LEGACY_KEYS) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* blocked */
    }
  }
}
