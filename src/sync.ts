import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Sign-out hooks into the active sync: first push any edit still waiting in
 * the debounce, then stop syncing so no late save can write the old
 * account's data anywhere.
 */
let pendingFlush: (() => Promise<void>) | null = null
let stopped = false

export async function flushPendingSave() {
  await pendingFlush?.()
}

export function stopSync() {
  stopped = true
  pendingFlush = null
}

/** Everything that belongs to one user's calendar. */
export interface Workspace<E = unknown, C = unknown, N = unknown, S = unknown> {
  events: E[]
  calendars: C[]
  notes: N[]
  settings: S
}

/**
 * Keeps a signed-in user's workspace in step with the server.
 *
 * - On mount it loads the user's saved workspace. If the server has one, it
 *   replaces the local copy; if the account is brand new, the local copy is
 *   uploaded as its starting point.
 * - After that every change is saved (debounced).
 * - If the first load fails (offline, server down) nothing is uploaded, so a
 *   failed load can never overwrite data already saved on the server.
 */
export function useWorkspaceSync<E, C, N, S>(
  userId: string | undefined,
  workspace: Workspace<E, C, N, S>,
  apply: (saved: Workspace<E, C, N, S>) => void,
) {
  const [ready, setReady] = useState(false)
  const applyRef = useRef(apply)
  const latest = useRef(workspace)
  useLayoutEffect(() => {
    applyRef.current = apply
    latest.current = workspace
  })

  useEffect(() => {
    if (!userId) return
    let alive = true
    fetch('/api/workspace', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(async (body: { data: Workspace<E, C, N, S> | null }) => {
        if (!alive || stopped) return
        if (body.data) applyRef.current(body.data)
        else await save(latest.current)
        setReady(true)
      })
      .catch(() => {
        /* stay local-only until the next visit */
      })
    return () => {
      alive = false
    }
  }, [userId])

  // Changes not yet saved when the debounce is cut short (refresh, tab close).
  const dirty = useRef(false)

  useEffect(() => {
    if (!userId || !ready) return
    dirty.current = true
    const timer = window.setTimeout(() => {
      dirty.current = false
      void save(workspace)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [userId, ready, workspace])

  // Leaving the page within the debounce window must not drop the last edit:
  // flush it with a keepalive request, which the browser completes after unload.
  useEffect(() => {
    if (!userId || !ready) return
    const flush = () => {
      if (!dirty.current) return
      dirty.current = false
      void save(latest.current)
    }
    pendingFlush = async () => {
      if (!dirty.current) return
      dirty.current = false
      await save(latest.current)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      pendingFlush = null
    }
  }, [userId, ready])
}

async function save(workspace: Workspace) {
  if (stopped) return
  try {
    await fetch('/api/workspace', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: workspace }),
      keepalive: true,
    })
  } catch {
    /* next change retries */
  }
}
