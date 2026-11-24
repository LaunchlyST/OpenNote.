/**
 * One Amazon link policy for the browser and the API.
 *
 * Affiliate products only accept real Amazon marketplace product pages (or
 * Amazon short links, whose destination is checked on the server). A hostname
 * allowlist — not a substring check — keeps lookalike and "contains amazon"
 * domains out. Associates tags and other query parameters are preserved.
 */

export const AMAZON_LINK_ERROR = 'Please enter a valid Amazon product link.'
export const DEFAULT_AMAZON_CTA = 'View on Amazon'
export const AMAZON_CTA_PRESETS = [DEFAULT_AMAZON_CTA, 'Check on Amazon', 'Shop on Amazon', 'See Product on Amazon'] as const
export const DEFAULT_AFFILIATE_DISCLOSURE = 'As an Amazon Associate, I earn from qualifying purchases. I may receive a commission if you buy through these links.'

export type ProductType = 'normal' | 'affiliate'

/** Exact hostnames, after stripping a leading www./smile. and a trailing dot. */
const MARKETPLACES = new Set([
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
  'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in', 'amazon.com.br',
  'amazon.com.mx', 'amazon.nl', 'amazon.pl', 'amazon.se', 'amazon.com.sg',
  'amazon.sg', 'amazon.com.tr', 'amazon.ae', 'amazon.sa', 'amazon.co.za',
  'amazon.cn', 'amazon.be', 'amazon.com.be', 'amazon.dk', 'amazon.no',
  'amazon.fi', 'amazon.ie', 'amazon.pt', 'amazon.gr', 'amazon.cz',
  'amazon.com.tw', 'amazon.com.hk', 'amazon.co.th', 'amazon.com.vn',
  'amazon.com.ph', 'amazon.com.my', 'amazon.com.pk', 'amazon.co.il',
])

/** Amazon's own shorteners need a server-side redirect check before publishing.
 *  link.amazon is the Amazon Creator/Associates deep link from the Amazon app
 *  and share sheet (cert: creators-deeplinking.amazon.com); it redirects on to
 *  a marketplace product page. */
const SHORT_HOSTS = new Set(['amzn.to', 'a.co', 'amzn.eu', 'link.amazon'])

const ASIN = /^[A-Z0-9]{10}$/
const PRODUCT_PATH = /(?:^|\/)(?:dp|e|product|gp\/product|gp\/aw\/d|gp\/aw\/dp)\/([A-Z0-9]{10})(?:\/|$)/i

export function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^(?:www|smile)\./, '')
}

export function isAmazonShortHost(hostname: string): boolean {
  return SHORT_HOSTS.has(canonicalHost(hostname))
}

export type AmazonUrlCheck =
  | { ok: true; url: string; short: boolean; host: string }
  | { ok: false; reason: string }

/** Parse and validate an Amazon product URL without making a network request. */
export function checkAmazonUrl(raw: string): AmazonUrlCheck {
  const value = String(raw ?? '').trim()
  if (!value || value.length > 2000) return { ok: false, reason: AMAZON_LINK_ERROR }
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return { ok: false, reason: AMAZON_LINK_ERROR }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: AMAZON_LINK_ERROR }
  if (u.username || u.password) return { ok: false, reason: AMAZON_LINK_ERROR }
  const host = canonicalHost(u.hostname)
  const short = SHORT_HOSTS.has(host)
  if (!short && !MARKETPLACES.has(host)) return { ok: false, reason: AMAZON_LINK_ERROR }
  // Short links have no product path until they are resolved on the server;
  // every full marketplace link must actually identify a product page.
  if (!short) {
    const asin = PRODUCT_PATH.test(u.pathname) || ASIN.test(u.pathname.replace(/^\//, '').split('/')[0] ?? '')
    if (!asin) return { ok: false, reason: AMAZON_LINK_ERROR }
  } else if (u.pathname.replace(/\//g, '').length < 3) {
    return { ok: false, reason: AMAZON_LINK_ERROR }
  }
  return { ok: true, url: u.toString(), short, host }
}

/** Legacy URL guard kept for old, non-Amazon affiliate data. */
export function safeHttpUrl(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value || value.length > 1000) return ''
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (!u.hostname || u.username || u.password) return ''
    return u.toString()
  } catch {
    return ''
  }
}

/** The effective type of an old or new product record. */
export function productTypeOf(extras: { productType?: ProductType; affiliate?: { url?: string } } | undefined | null): ProductType {
  if (extras?.productType === 'affiliate' || extras?.productType === 'normal') return extras.productType
  // Data saved before the explicit type existed used a valid external URL.
  return extras?.affiliate?.url ? 'affiliate' : 'normal'
}

/**
 * A readable title from the seller's own link, used when they give none.
 * Amazon product URLs usually carry the listing name as a slug before /dp/
 * (e.g. /Sony-WH-1000XM5-Headphones/dp/B09…). No page is fetched or scraped.
 */
export function amazonTitleFromUrl(raw: string): string {
  let path = ''
  try { path = new URL(raw).pathname } catch { return 'Amazon product' }
  const parts = path.split('/').filter(Boolean)
  const at = parts.findIndex((p) => /^(?:dp|gp|product|e)$/i.test(p))
  const slug = at > 0 ? parts[at - 1] : ''
  let words = ''
  try { words = decodeURIComponent(slug) } catch { words = slug }
  words = words.replace(/[-_+]+/g, ' ').replace(/[^\p{L}\p{N} &'.,()]/gu, '').replace(/\s+/g, ' ').trim()
  if (words.length >= 3 && !/^ref\b/i.test(words)) return words.slice(0, 80).trim()
  const asin = path.match(/\/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i)?.[1]
  return asin ? `Amazon product ${asin.toUpperCase()}` : 'Amazon product'
}
