import { randomBytes } from 'node:crypto'
import { SHORT_ID_ALPHABET, SHORT_ID_LENGTH } from '../shared/short-link.ts'

/**
 * Unpredictable, non-repeating-looking short IDs. Rejection sampling keeps the
 * distribution even; the DB's unique index is the final authority on reuse.
 */
export function newShortProductId(): string {
  const size = SHORT_ID_ALPHABET.length
  const limit = Math.floor(256 / size) * size
  let out = ''
  while (out.length < SHORT_ID_LENGTH) {
    for (const byte of randomBytes(16)) {
      if (byte >= limit) continue
      out += SHORT_ID_ALPHABET[byte % size]
      if (out.length === SHORT_ID_LENGTH) return out
    }
  }
  return out
}
