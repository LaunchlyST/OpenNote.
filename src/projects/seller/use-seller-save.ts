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

export function useSellerSave<T>(key: string, initial: T, revision: number, write: (value: T, revision: number) => Promise<number>) {
  const writer = useRef(write)
  writer.current = write
  const [state, setState] = useState('Saved')
  const [queue] = useState(() => {
    let recovered: { value: T; revision: number } | null = null
    try { recovered = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* leave corrupt recovery data untouched */ }
    const q = new SaveQueue<T>(recovered?.value ?? initial, recovered?.revision ?? revision,
      async (value, rev) => { setState('Saving…'); return writer.current(value, rev) },
      (value, rev) => localStorage.setItem(key, JSON.stringify({ value, revision: rev })),
      () => localStorage.removeItem(key))
    if (recovered) q.edit(recovered.value)
    return q
  })
  const [value, setValue] = useState(queue.value)
  const flush = async () => {
    try { await queue.flush(); setState('Saved') }
    catch (e) { setState((e as Error).message); throw e }
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
  return { value, state, dirty: queue.dirty, flush, edit: (next: T) => {
    try { queue.edit(next); setState('Unsaved changes') }
    catch { setState('Browser recovery storage is full. Keep this page open until saved.') }
    setValue(next)
  } }
}
