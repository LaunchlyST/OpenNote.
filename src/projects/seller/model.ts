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

/**
 * How a product is sold. This is a deliberate choice of the seller, not a
 * consequence of the price field: a paid product whose price is still being
 * typed (empty, "0", "0.") stays paid until the seller flips this selector.
 * Older rows without the field fall back to the saved price (see
 * `isFreeProduct`), which is the last valid price, never a half-typed one.
 */
export type PaymentType = 'paid' | 'free'

/** What the storefront renderer needs to know about a product. */
export interface ShopProduct {
  id: string
  title: string
  description: string
  cover: string | null
  priceMinor: number
  currency: string
  /** Explicit free/paid mode. Absent on older data; use `isFreeProduct`. */
  paymentType?: PaymentType
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
  /** Per-product typography for the card title and description. */
  titleStyle?: TextStyle
  descStyle?: TextStyle
  /** Card background tone and corner radius (empty/null = the store theme). */
  cardBg?: CardBg
  cardRadius?: number | null
}

export type CardLayout = 'compact' | 'showcase' | 'featured'

/** The parts of a product card that can be edited by clicking them in the preview. */
export type CardPart = 'cover' | 'title' | 'desc' | 'button' | 'card'

/**
 * Typography for one piece of card text. Every field is optional: an empty
 * value means "use the store theme", so older products look exactly as before.
 */
export type TextStyle = {
  /** A font id from FONT_CATALOG; '' keeps the store font. */
  font: string
  /** 0 keeps the theme weight. */
  weight: number
  /** Pixels; 0 keeps the theme size. */
  size: number
  /** Multiplier; 0 keeps the theme line height. */
  lineHeight: number
  /** Pixels, may be negative; 0 keeps the theme spacing. */
  letterSpacing: number
  align: '' | 'left' | 'center' | 'right'
  /** #rrggbb; '' keeps the theme colour. */
  color: string
}

export const DEFAULT_TEXT_STYLE: TextStyle = { font: '', weight: 0, size: 0, lineHeight: 0, letterSpacing: 0, align: '', color: '' }

/** What the editor lets a seller pick, and what the server accepts. */
export const TEXT_STYLE_LIMITS = {
  titleSize: [12, 34] as [number, number],
  descSize: [10, 22] as [number, number],
  lineHeight: [0.9, 2] as [number, number],
  letterSpacing: [-2, 6] as [number, number],
}

export const CARD_BACKGROUNDS = [
  { id: '', label: 'Theme' },
  { id: 'plain', label: 'Plain' },
  { id: 'soft', label: 'Soft' },
  { id: 'tint', label: 'Tinted' },
  { id: 'outline', label: 'Outline' },
] as const
export type CardBg = '' | 'plain' | 'soft' | 'tint' | 'outline'

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
  titleStyle: TextStyle
  descStyle: TextStyle
  cardBg: CardBg
  cardRadius: number | null
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
  titleStyle: { ...DEFAULT_TEXT_STYLE },
  descStyle: { ...DEFAULT_TEXT_STYLE },
  cardBg: '',
  cardRadius: null,
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
    titleStyle: { ...DEFAULT_TEXT_STYLE, ...x?.titleStyle },
    descStyle: { ...DEFAULT_TEXT_STYLE, ...x?.descStyle },
    cardBg: x?.cardBg ?? '',
    cardRadius: x?.cardRadius ?? null,
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

/* ------------------------------------------------ product card typography --- */

export type FontCategory = 'Sans' | 'Serif' | 'Display' | 'Handwriting' | 'Mono'
export type FontEntry = {
  id: string
  label: string
  css: string
  category: FontCategory
  /** Weights this family really ships. */
  weights: number[]
  /** Google Fonts CSS2 family spec, loaded only when the font is used or shown. */
  google: string
}

/**
 * Curated, freely licensed (SIL OFL / Apache) Google Fonts. The list is data
 * only: a family's stylesheet is fetched the first time it is used or shown in
 * the picker, never all at once. The three store-theme fonts come first so a
 * product can always match the store.
 */
export const FONT_CATALOG: FontEntry[] = [
  { id: 'geist', label: 'Geist', css: "'Geist', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Geist:wght@400;500;600;700' },
  { id: 'grotesque', label: 'Bricolage Grotesque', css: "'Bricolage Grotesque', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700, 800], google: 'Bricolage+Grotesque:opsz,wght@12..96,400..800' },
  { id: 'serif', label: 'Instrument Serif', css: "'Instrument Serif', Georgia, serif", category: 'Serif', weights: [400], google: 'Instrument+Serif:ital@0;1' },
  { id: 'inter', label: 'Inter', css: "'Inter', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Inter:wght@400;500;600;700' },
  { id: 'nunito', label: 'Nunito', css: "'Nunito', system-ui, sans-serif", category: 'Sans', weights: [400, 600, 700, 800, 900], google: 'Nunito:wght@400;600;700;800;900' },
  { id: 'space-grotesk', label: 'Space Grotesk', css: "'Space Grotesk', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'manrope', label: 'Manrope', css: "'Manrope', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700, 800], google: 'Manrope:wght@400;500;600;700;800' },
  { id: 'work-sans', label: 'Work Sans', css: "'Work Sans', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Work+Sans:wght@400;500;600;700' },
  { id: 'dm-sans', label: 'DM Sans', css: "'DM Sans', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'DM+Sans:wght@400;500;600;700' },
  { id: 'poppins', label: 'Poppins', css: "'Poppins', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Poppins:wght@400;500;600;700' },
  { id: 'outfit', label: 'Outfit', css: "'Outfit', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700, 800], google: 'Outfit:wght@400;500;600;700;800' },
  { id: 'sora', label: 'Sora', css: "'Sora', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Sora:wght@400;500;600;700' },
  { id: 'rubik', label: 'Rubik', css: "'Rubik', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Rubik:wght@400;500;600;700' },
  { id: 'archivo', label: 'Archivo', css: "'Archivo', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Archivo:wght@400;500;600;700' },
  { id: 'figtree', label: 'Figtree', css: "'Figtree', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700, 800], google: 'Figtree:wght@400;500;600;700;800' },
  { id: 'karla', label: 'Karla', css: "'Karla', system-ui, sans-serif", category: 'Sans', weights: [400, 500, 600, 700], google: 'Karla:wght@400;500;600;700' },
  { id: 'playfair', label: 'Playfair Display', css: "'Playfair Display', Georgia, serif", category: 'Serif', weights: [400, 500, 600, 700], google: 'Playfair+Display:wght@400;500;600;700' },
  { id: 'dm-serif', label: 'DM Serif Display', css: "'DM Serif Display', Georgia, serif", category: 'Serif', weights: [400], google: 'DM+Serif+Display:ital@0;1' },
  { id: 'lora', label: 'Lora', css: "'Lora', Georgia, serif", category: 'Serif', weights: [400, 500, 600, 700], google: 'Lora:wght@400;500;600;700' },
  { id: 'merriweather', label: 'Merriweather', css: "'Merriweather', Georgia, serif", category: 'Serif', weights: [400, 700, 900], google: 'Merriweather:wght@400;700;900' },
  { id: 'libre-baskerville', label: 'Libre Baskerville', css: "'Libre Baskerville', Georgia, serif", category: 'Serif', weights: [400, 700], google: 'Libre+Baskerville:wght@400;700' },
  { id: 'fraunces', label: 'Fraunces', css: "'Fraunces', Georgia, serif", category: 'Serif', weights: [400, 500, 600, 700], google: 'Fraunces:opsz,wght@9..144,400..700' },
  { id: 'cormorant', label: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif", category: 'Serif', weights: [400, 500, 600, 700], google: 'Cormorant+Garamond:wght@400;500;600;700' },
  { id: 'bebas', label: 'Bebas Neue', css: "'Bebas Neue', Impact, sans-serif", category: 'Display', weights: [400], google: 'Bebas+Neue' },
  { id: 'anton', label: 'Anton', css: "'Anton', Impact, sans-serif", category: 'Display', weights: [400], google: 'Anton' },
  { id: 'oswald', label: 'Oswald', css: "'Oswald', Impact, sans-serif", category: 'Display', weights: [400, 500, 600, 700], google: 'Oswald:wght@400;500;600;700' },
  { id: 'righteous', label: 'Righteous', css: "'Righteous', system-ui, sans-serif", category: 'Display', weights: [400], google: 'Righteous' },
  { id: 'comfortaa', label: 'Comfortaa', css: "'Comfortaa', system-ui, sans-serif", category: 'Display', weights: [400, 500, 600, 700], google: 'Comfortaa:wght@400;500;600;700' },
  { id: 'lobster', label: 'Lobster', css: "'Lobster', cursive", category: 'Display', weights: [400], google: 'Lobster' },
  { id: 'unbounded', label: 'Unbounded', css: "'Unbounded', system-ui, sans-serif", category: 'Display', weights: [400, 500, 600, 700], google: 'Unbounded:wght@400;500;600;700' },
  { id: 'syne', label: 'Syne', css: "'Syne', system-ui, sans-serif", category: 'Display', weights: [400, 500, 600, 700, 800], google: 'Syne:wght@400;500;600;700;800' },
  { id: 'archivo-black', label: 'Archivo Black', css: "'Archivo Black', Impact, sans-serif", category: 'Display', weights: [400], google: 'Archivo+Black' },
  { id: 'caveat', label: 'Caveat', css: "'Caveat', cursive", category: 'Handwriting', weights: [400, 500, 600, 700], google: 'Caveat:wght@400;500;600;700' },
  { id: 'pacifico', label: 'Pacifico', css: "'Pacifico', cursive", category: 'Handwriting', weights: [400], google: 'Pacifico' },
  { id: 'dancing-script', label: 'Dancing Script', css: "'Dancing Script', cursive", category: 'Handwriting', weights: [400, 500, 600, 700], google: 'Dancing+Script:wght@400;500;600;700' },
  { id: 'great-vibes', label: 'Great Vibes', css: "'Great Vibes', cursive", category: 'Handwriting', weights: [400], google: 'Great+Vibes' },
  { id: 'kalam', label: 'Kalam', css: "'Kalam', cursive", category: 'Handwriting', weights: [400, 700], google: 'Kalam:wght@400;700' },
  { id: 'patrick-hand', label: 'Patrick Hand', css: "'Patrick Hand', cursive", category: 'Handwriting', weights: [400], google: 'Patrick+Hand' },
  { id: 'satisfy', label: 'Satisfy', css: "'Satisfy', cursive", category: 'Handwriting', weights: [400], google: 'Satisfy' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, monospace", category: 'Mono', weights: [400, 500, 600, 700], google: 'JetBrains+Mono:wght@400;500;600;700' },
  { id: 'space-mono', label: 'Space Mono', css: "'Space Mono', ui-monospace, monospace", category: 'Mono', weights: [400, 700], google: 'Space+Mono:wght@400;700' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', css: "'IBM Plex Mono', ui-monospace, monospace", category: 'Mono', weights: [400, 500, 600, 700], google: 'IBM+Plex+Mono:wght@400;500;600;700' },
]

export const FONT_CATEGORIES: FontCategory[] = ['Sans', 'Serif', 'Display', 'Handwriting', 'Mono']

export const fontById = (id: string) => FONT_CATALOG.find((f) => f.id === id) ?? null

/** Every family whose stylesheet has been requested in this page. Not downloaded all at once. */
const fontLinks = new Set<string>()
/**
 * Load one Google Fonts family the first time it is needed (the picker showing
 * it, or a card using it). Repeat calls are free and synchronous.
 */
export function ensureFont(id: string): void {
  const f = fontById(id)
  if (!f || fontLinks.has(f.id) || typeof document === 'undefined') return
  fontLinks.add(f.id)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`
  link.dataset.desknotyFont = f.id
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}
export function ensureFonts(ids: Array<string | null | undefined>): void {
  for (const id of ids) if (id) ensureFont(id)
}

/** The inline CSS for a card's title or description, or {} while it follows the theme. */
export function textStyleCss(s: TextStyle | undefined): Record<string, string | number> {
  if (!s) return {}
  const out: Record<string, string | number> = {}
  const f = s.font ? fontById(s.font) : null
  if (f) out.fontFamily = f.css
  if (s.weight) out.fontWeight = s.weight
  if (s.size) out.fontSize = `${s.size}px`
  if (s.lineHeight) out.lineHeight = s.lineHeight
  if (s.letterSpacing) out.letterSpacing = `${s.letterSpacing}px`
  if (s.align) out.textAlign = s.align
  if (s.color) out.color = s.color
  return out
}

/** True when a style sets nothing, i.e. it follows the store theme. */
export const isThemeStyle = (s: TextStyle | undefined) => !s || Object.values(s).every((v) => v === '' || v === 0)

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

/**
 * Whether a product is free. The explicit payment mode always wins; only data
 * saved before the field existed falls back to the stored price. The stored
 * price is the last *valid* price, so a half-typed "0" never reaches this.
 */
export function isFreeProduct(p: { paymentType?: PaymentType | null; priceMinor: number }): boolean {
  if (p.paymentType === 'free') return true
  if (p.paymentType === 'paid') return false
  return p.priceMinor === 0
}

/**
 * The price field exactly as the seller typed it, in minor units, or null while
 * it is not a price yet. The string is never rewritten while typing: "" , "0",
 * "0.", "0.1" and "10" are all left alone, and only a complete number is saved.
 */
export function parsePriceInput(input: string): number | null {
  const raw = input.trim()
  if (!raw || !/^\d*(?:\.\d{0,2})?$/.test(raw)) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const minor = Math.round(n * 100)
  return minor >= 0 && minor <= 99_999_99 ? minor : null
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
