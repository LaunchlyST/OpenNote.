import { useEffect, useLayoutEffect, useRef, useState } from 'react'

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
        if (!alive) return
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

  useEffect(() => {
    if (!userId || !ready) return
    const timer = window.setTimeout(() => {
      void save(workspace)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [userId, ready, workspace])
}

async function save(workspace: Workspace) {
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
