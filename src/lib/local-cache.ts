/**
 * The browser-side copy of a signed-in user's workspace.
 *
 * OpenNote mirrors each account's events, calendars, notes and settings into
 * localStorage under keys scoped to that account (`opennote.<name>:<userId>`),
 * so the calendar opens instantly and survives a refresh. The server is the
 * source of truth; this is only a cache, so clearing it never loses data that
 * was saved.
 *
 * On sign-out the cache is wiped, so the next person at the same browser sees
 * nothing of the previous account.
 */

const PREFIX = 'opennote.'

/** Set during sign-out: every pending localStorage write is dropped. */
let writesBlocked = false

export function cacheWritesAllowed() {
  return !writesBlocked
}

export function blockCacheWrites() {
  writesBlocked = true
}

function scopedKeys(match: (userId: string) => boolean): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const sep = key.lastIndexOf(':')
      if (sep > PREFIX.length && match(key.slice(sep + 1))) keys.push(key)
    }
  } catch {
    /* storage unavailable */
  }
  return keys
}

function remove(keys: string[]) {
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/** Removes every account-scoped cache entry (all users). Shared, non-personal keys stay. */
export function clearAllUserCaches() {
  remove(scopedKeys(() => true))
}

/** Removes cached data of every account except `userId` (e.g. a session that expired without sign-out). */
export function clearOtherUserCaches(userId: string) {
  remove(scopedKeys((id) => id !== userId))
}

/** Lists cached account ids — for tests and diagnostics. */
export function cachedUserIds(): string[] {
  return [...new Set(scopedKeys(() => true).map((k) => k.slice(k.lastIndexOf(':') + 1)))]
}
