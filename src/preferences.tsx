import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Account-wide preferences (General, Appearance, Notifications), saved to the
 * server per account (/api/preferences) so they follow the user to any
 * device. Calendar preferences stay per project in the project's settings.
 */
export interface Preferences {
  dateFormat: 'DMY' | 'MDY' | 'YMD'
  openTo: 'calendar' | 'today' | 'notes'
  rememberView: boolean
  accent: AccentId
  animations: boolean
  remindersEnabled: boolean
  reminderLead: 5 | 10 | 15 | 30 | 60
  quietHours: boolean
  quietStart: string
  quietEnd: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  dateFormat: 'DMY',
  openTo: 'calendar',
  rememberView: false,
  accent: 'lime',
  animations: true,
  remindersEnabled: false,
  reminderLead: 10,
  quietHours: false,
  quietStart: '22:00',
  quietEnd: '07:00',
}

export type AccentId = 'lime' | 'blue' | 'violet' | 'rose' | 'amber' | 'slate'

/** Accent palettes: they drive the shared accent tokens (toggles, highlights, focus rings). */
export const ACCENTS: Record<AccentId, { name: string; accent: string; hover: string; deep: string; soft: string; text: string }> = {
  lime: { name: 'Lime', accent: '#a3d922', hover: '#92c41e', deep: '#7fb312', soft: '#f0f9d9', text: '#4b6410' },
  blue: { name: 'Blue', accent: '#60a5fa', hover: '#4f94ea', deep: '#3b82f6', soft: '#e8f1fe', text: '#1e4e8c' },
  violet: { name: 'Violet', accent: '#a78bfa', hover: '#9677f2', deep: '#8b5cf6', soft: '#f1ecfe', text: '#4b2e8a' },
  rose: { name: 'Rose', accent: '#fb7185', hover: '#f25b72', deep: '#e11d48', soft: '#ffeef1', text: '#8c2f45' },
  amber: { name: 'Amber', accent: '#fbbf24', hover: '#f0ad0f', deep: '#d97706', soft: '#fef6e0', text: '#7a5410' },
  slate: { name: 'Graphite', accent: '#64748b', hover: '#566477', deep: '#334155', soft: '#eef1f5', text: '#1f2a37' },
}

type Status = 'loading' | 'ready' | 'error'

interface PreferencesValue {
  preferences: Preferences
  status: Status
  /** Saves a change to the account. Resolves false if the server refused it. */
  update: (patch: Partial<Preferences>) => Promise<boolean>
}

const PreferencesContext = createContext<PreferencesValue | null>(null)

/** Outside a provider (tests, public pages) the defaults apply and nothing is saved. */
const FALLBACK: PreferencesValue = {
  preferences: DEFAULT_PREFERENCES,
  status: 'ready',
  update: async () => false,
}

export function usePreferences(): PreferencesValue {
  return useContext(PreferencesContext) ?? FALLBACK
}

function applyToDocument(p: Preferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const a = ACCENTS[p.accent] ?? ACCENTS.lime
  root.style.setProperty('--color-accent', a.accent)
  root.style.setProperty('--color-accent-hover', a.hover)
  root.style.setProperty('--color-accent-deep', a.deep)
  root.style.setProperty('--color-accent-soft', a.soft)
  root.style.setProperty('--color-accent-text', a.text)
  root.style.setProperty('--color-lime-deep', a.deep)
  root.classList.toggle('no-anim', !p.animations)
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [status, setStatus] = useState<Status>('loading')
  const latest = useRef(preferences)
  latest.current = preferences

  useEffect(() => {
    let alive = true
    fetch('/api/preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { preferences: Preferences }) => {
        if (!alive) return
        setPreferences({ ...DEFAULT_PREFERENCES, ...body.preferences })
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => applyToDocument(preferences), [preferences])
  // Leaving the signed-in app restores the default look.
  useEffect(() => () => applyToDocument(DEFAULT_PREFERENCES), [])

  const update = useCallback(async (patch: Partial<Preferences>) => {
    const before = latest.current
    setPreferences({ ...before, ...patch })
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: patch }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { preferences: Preferences }
      setPreferences({ ...DEFAULT_PREFERENCES, ...body.preferences })
      return true
    } catch {
      setPreferences(before)
      return false
    }
  }, [])

  const value = useMemo(() => ({ preferences, status, update }), [preferences, status, update])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

/** Formats a yyyy-mm-dd key in the chosen date format, e.g. 17/10/2026. */
export function formatDateKey(key: string, fmt: Preferences['dateFormat']): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return key
  const [, y, mo, d] = m
  return fmt === 'MDY' ? `${mo}/${d}/${y}` : fmt === 'YMD' ? `${y}-${mo}-${d}` : `${d}/${mo}/${y}`
}

export function formatDate(date: Date, fmt: Preferences['dateFormat']): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return formatDateKey(`${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`, fmt)
}
