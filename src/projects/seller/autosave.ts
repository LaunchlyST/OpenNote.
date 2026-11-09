/**
 * Debounced, serialised autosave for Seller Studio.
 *
 * - One save at a time per saver; edits made while a save is in flight are
 *   sent afterwards, so an older request can never overwrite a newer one.
 * - Only the newest value is marked saved (a stale response is ignored).
 * - Pending edits are flushed when the editor closes and before Publish, so
 *   switching tabs or publishing never drops the last keystrokes.
 */
const pending = new Set<() => Promise<void>>()

/** Saves every editor's pending changes now (Publish awaits this). */
export async function flushAllSaves(): Promise<void> {
  await Promise.all([...pending].map((f) => f()))
}

export function createSaver<T>(
  save: (value: T) => Promise<void>,
  { delay = 600, onState }: { delay?: number; onState?: (s: 'saving' | 'saved' | 'error', err?: Error) => void } = {},
) {
  let latest: { value: T; version: number } | null = null
  let version = 0
  let savedVersion = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let chain: Promise<void> = Promise.resolve()

  const run = (): Promise<void> => {
    if (timer) clearTimeout(timer)
    timer = null
    chain = chain.then(async () => {
      const job = latest
      if (!job || job.version <= savedVersion) return
      onState?.('saving')
      try {
        await save(job.value)
        savedVersion = Math.max(savedVersion, job.version)
        if (savedVersion === version) {
          pending.delete(flush)
          onState?.('saved')
        }
      } catch (e) {
        onState?.('error', e as Error)
        throw e
      }
    })
    return chain.catch(() => {
      chain = Promise.resolve()
    })
  }
  const flush = () => run()

  return {
    /** Queues `value` to be saved after `delay` ms without further edits. */
    schedule(value: T) {
      latest = { value, version: ++version }
      pending.add(flush)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void run(), delay)
    },
    flush,
    /** True while an edit has not been saved yet. */
    dirty: () => version > savedVersion,
  }
}
