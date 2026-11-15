import { useEffect, useRef, useState } from 'react'
import { SaveQueue } from './save-queue'

const pending = new Set<Promise<unknown>>()
export function trackSellerWork<T>(work: Promise<T>): Promise<T> {
  pending.add(work)
  void work.finally(() => pending.delete(work)).catch(() => {})
  return work
}
const active = new Set<SaveQueue<unknown>>()
export async function flushSellerEdits() {
  await Promise.all(pending)
  for (const queue of active) await queue.flush()
}

/**
 * A short opaque id for this editor. The server remembers who wrote last, so a
 * save whose reply was lost (a refresh, a dropped connection) is recognised as
 * our own request instead of being refused as "changed elsewhere".
 */
const newToken = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
const isToken = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)
/** A 409 means the server holds a newer edit that is not ours. */
const isConflict = (e: unknown) => (e as { status?: number } | null)?.status === 409

export function useSellerSave<T>(
  key: string,
  initial: T,
  revision: number,
  write: (value: T, revision: number, token: string) => Promise<number>,
  /** Reads the server's current value, so a clash can be resolved. */
  current?: () => Promise<{ value: T; revision: number }>,
) {
  const writer = useRef(write)
  writer.current = write
  const [state, setState] = useState('Saved')
  const [conflict, setConflict] = useState(false)
  const [queue] = useState(() => {
    let recovered: { value: T; revision: number; token?: string } | null = null
    try { recovered = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* leave corrupt recovery data untouched */ }
    const token = isToken(recovered?.token) ? recovered.token : newToken()
    // The revision our pending value was written against. When the server has
    // moved on, the writer token tells it whether that move was our own.
    const base = recovered ? recovered.revision : revision
    const q = new SaveQueue<T>(recovered?.value ?? initial, base, token,
      async (value, rev, tok) => { setState('Saving…'); setConflict(false); return writer.current(value, rev, tok) },
      (value, rev, tok) => localStorage.setItem(key, JSON.stringify({ value, revision: rev, token: tok })),
      () => localStorage.removeItem(key))
    if (recovered) q.edit(recovered.value)
    return q
  })
  const [value, setValue] = useState(queue.value)
  const flush = async () => {
    try { await queue.flush(); setState('Saved'); setConflict(false) }
    catch (e) { setState((e as Error).message); setConflict(isConflict(e)); throw e }
  }
  useEffect(() => {
    const q = queue as SaveQueue<unknown>
    active.add(q)
    const leave = (e: BeforeUnloadEvent) => { if (queue.dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', leave)
    return () => {
      window.removeEventListener('beforeunload', leave)
      // Keep failed queues registered so publishing cannot silently bypass them.
      void queue.flush().then(() => active.delete(q)).catch(() => {})
    }
  }, [queue])
  useEffect(() => {
    if (!queue.dirty) return
    const timer = window.setTimeout(() => void flush().catch(() => {}), 600)
    return () => window.clearTimeout(timer)
  }, [value, queue])
  // Nothing pending: a newer revision from the server is simply the new base.
  useEffect(() => {
    if (!queue.dirty && revision > queue.revision) queue.revision = revision
  }, [revision, queue])
  return {
    value,
    state,
    dirty: queue.dirty,
    /** True when the server refused the save because it holds a newer edit. */
    conflict,
    flush,
    /** The revision and writer token to use for a save made outside this queue. */
    base: () => ({ revision: queue.revision, token: queue.token }),
    /** Throw the pending edits away and take the server's version instead. */
    discard: async () => {
      if (!current) return
      const c = await current()
      queue.reset(c.value, c.revision)
      setValue(c.value)
      setState('Saved')
      setConflict(false)
    },
    edit: (next: T) => {
      try { queue.edit(next); setState('Unsaved changes') }
      catch { setState('Browser recovery storage is full. Keep this page open until saved.') }
      setValue(next)
    },
  }
}
