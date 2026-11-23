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

export function isShortProductId(value: unknown): value is string {
  return typeof value === 'string' && SHORT_ID_RE.test(value)
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
