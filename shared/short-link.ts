/**
 * Public Desknoty product link format: /p/<shortId>.
 *
 * The alphabet leaves out look-alike characters (0/O and I/l) so a link read
 * out loud or copied from a chat message stays unambiguous. The same check is
 * used by the browser bootstrap route and by the API before it touches the DB.
 */
export const SHORT_ID_LENGTH = 6
export const SHORT_ID_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export const SHORT_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{6}$/

/**
 * Affiliate bio links use the product's name instead of a random code:
 * desknoty.com/Desk-Lamp. Words are capitalised, so a name link always holds a
 * capital letter and can never be a (lowercase) store handle or app route.
 */
export const BIO_SLUG_MAX = 48
export const BIO_SLUG_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

export function isBioSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 2 && value.length <= BIO_SLUG_MAX && BIO_SLUG_RE.test(value) && /[A-Z]/.test(value)
}

export function isShortProductId(value: unknown): value is string {
  return typeof value === 'string' && (SHORT_ID_RE.test(value) || isBioSlug(value))
}

/** "LED desk lamp – white!" → "LED-Desk-Lamp-White". '' when the title has no letters or digits. */
export function bioSlugFromTitle(title: string): string {
  const words = title
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  let out = ''
  for (const w of words) {
    const next = out ? `${out}-${w}` : w
    if (next.length > BIO_SLUG_MAX - 4) break // room for a "-12" suffix
    out = next
  }
  if (!out && words[0]) out = words[0].slice(0, BIO_SLUG_MAX - 4)
  if (out && !/[A-Z]/.test(out)) out = `Link-${out}`.slice(0, BIO_SLUG_MAX - 4)
  return out
}

/**
 * Store addresses are desknoty.com/<handle>, and handles are lowercase only.
 * A short ID with at least one capital letter can therefore never be a store
 * handle, so it is also served at the root: desknoty.com/<shortId>.
 * (Every new short ID has a capital; older all-lowercase ones keep /p/.)
 */
export function isRootShortId(value: unknown): value is string {
  return isShortProductId(value) && /[A-HJ-NP-Z]/.test(value)
}

export function shortProductPath(shortId: string): string {
  return isRootShortId(shortId) ? `/${shortId}` : `/p/${shortId}`
}
