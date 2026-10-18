import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiUrl } from './lib/api-base'

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

/** Everything that belongs to one project's calendar. */
export interface Workspace<E = unknown, C = unknown, N = unknown, S = unknown> {
  events: E[]
  calendars: C[]
  notes: N[]
  settings: S
  /** Calendar time-slot notes, kept apart from Notes-section documents. */
  slotNotes?: unknown[]
}

export type SaveStatus = 'saved' | 'saving' | 'error'

/**
 * Saves a project's calendar to the server on every change (debounced).
 *
 * The project's data is loaded before the calendar mounts, so the first
 * render is never saved back — only real edits are. A failed save is retried
 * on the next change and when the tab is hidden.
 */
export function useProjectSync(projectId: string | undefined, workspace: Workspace): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const latest = useRef(workspace)
  const first = useRef(true)
  const dirty = useRef(false)
  useLayoutEffect(() => {
    latest.current = workspace
  })

  async function push(data: Workspace) {
    if (!projectId || stopped) return
    setStatus('saving')
    try {
      const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/data`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        keepalive: true,
      })
      if (!res.ok) throw new Error(String(res.status))
      if (!dirty.current) setStatus('saved')
    } catch {
      dirty.current = true
      setStatus('error')
    }
  }
  const pushRef = useRef(push)
  useLayoutEffect(() => {
    pushRef.current = push
  })

  useEffect(() => {
    if (!projectId) return
    if (first.current) {
      first.current = false
      return
    }
    dirty.current = true
    setStatus('saving')
    const timer = window.setTimeout(() => {
      dirty.current = false
      void pushRef.current(workspace)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [projectId, workspace])

  // Leaving the page (or the project) within the debounce must not drop the
  // last edit: flush it with a keepalive request.
  useEffect(() => {
    if (!projectId) return
    const flush = () => {
      if (!dirty.current) return
      dirty.current = false
      void pushRef.current(latest.current)
    }
    pendingFlush = async () => {
      if (!dirty.current) return
      dirty.current = false
      await pushRef.current(latest.current)
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
      flush()
    }
  }, [projectId])

  return status
}
