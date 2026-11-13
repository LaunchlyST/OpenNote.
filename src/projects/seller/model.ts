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
  offer?: { priceMinor: number; percent: number; badge: string; badgeColor: string; ends: string | null } | null
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
}

export type CardLayout = 'compact' | 'showcase' | 'featured'

export type ProductExtras = {
  offer: { on: boolean; kind: 'percent' | 'amount'; value: number; starts: string | null; ends: string | null; badge: string; badgeColor: string }
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
}

/** Fill any missing V2 fields so older products keep working. */
export function withExtras(x: Partial<ProductExtras> | undefined): ProductExtras {
  return {
    ...DEFAULT_EXTRAS,
    ...x,
    offer: { ...DEFAULT_EXTRAS.offer, ...x?.offer },
    cta: { ...DEFAULT_EXTRAS.cta, ...x?.cta },
    crop: { ...DEFAULT_EXTRAS.crop, ...x?.crop },
    badges: { ...DEFAULT_EXTRAS.badges, ...x?.badges },
    textPos: { ...DEFAULT_EXTRAS.textPos, ...x?.textPos },
    gallery: x?.gallery ?? [],
    included: x?.included ?? [],
    faq: x?.faq ?? [],
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
    featured: { productId: null, note: '' },
    grid: { heading: 'Shop', productIds: [] },
    faq: { heading: 'FAQ', items: [{ q: 'How do I get my download?', a: 'Right after paying, and by email.' }] },
    tiktok: { heading: 'Latest on TikTok', videos: [] },
    email: { heading: 'Questions?', note: 'Email me and I’ll get back to you.', email: '', button: 'Email support' },
    divider: { style: 'line' },
    footer: { text: '' },
  }
  return { id, type, hidden: false, data: data[type] }
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
