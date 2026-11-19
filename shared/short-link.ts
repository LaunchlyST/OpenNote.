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

export function shortProductPath(shortId: string): string {
  return `/p/${shortId}`
}
