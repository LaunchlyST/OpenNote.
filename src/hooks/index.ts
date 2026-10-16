import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function useLocalStorage<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      /* ignore corrupt / unavailable storage */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  // Persist on change (debounced to a microtask to avoid hammering storage).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage might be full or blocked */
    }
  }, [key, value])

  return [value, setValue]
}

/** Re-renders on an interval so "now" indicators stay fresh. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Tracks a CSS media query so JS-driven controls agree with the breakpoints
 * the layout uses. The Notes rail is a docked panel at `xl` and above and a
 * drawer below it, so anything that toggles it needs to know which is live.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Fires a callback on Escape. */
export function useEscape(enabled: boolean, onEscape: () => void) {
  const cb = useRef(onEscape)
  cb.current = onEscape
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}

/** How long the Settings page takes to leave, matching `settings-out` in CSS. */
const SETTINGS_EXIT_MS = 180

/**
 * Keeps the Settings page mounted for the length of its exit animation.
 *
 * Unmounting it the instant the route changes would drop the fade-out, so the
 * panel stays in the tree until the animation finishes. `exiting` is what the
 * caller animates on; `mounted` is what the caller renders on.
 */
export function useExitTransition(open: boolean, durationMs: number) {
  const [mounted, setMounted] = useState(open)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
      return
    }
    if (!mounted) return
    setExiting(true)
    const timer = window.setTimeout(() => {
      setMounted(false)
      setExiting(false)
    }, durationMs)
    return () => window.clearTimeout(timer)
  }, [open, mounted, durationMs])

  return { mounted, exiting }
}

/** The Settings page's open/close transition timing. */
export const SETTINGS_TRANSITION_MS = SETTINGS_EXIT_MS

/** Closes a popover when clicking outside of it. */
export function useClickOutside<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = useRef<T | null>(null)
  const close = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [active, close])
  return ref
}
