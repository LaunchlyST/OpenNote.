import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A deliberately tiny History API router.
 *
 * OpenNote shipped without any router — screens were swapped in memory by
 * `ScreenProvider`. Adding a dependency for three routes would be heavier than
 * the ~60 lines below, so this only implements what the app actually needs:
 * read the current path, push or replace it, and re-render on popstate.
 *
 * `App.tsx` is still the single calendar application; this only decides which
 * subtree is mounted. Route → screen mapping is handled in `Root.tsx`.
 */

/** Deploy-time base path, so the app keeps working when served from a subdirectory. */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')

interface RouterValue {
  /** Normalised, base-stripped path — always starts with `/`. */
  path: string
  navigate: (to: string, options?: { replace?: boolean }) => void
  /** True when `path` is `prefix` or lives underneath it. */
  matches: (prefix: string) => boolean
}

const RouterContext = createContext<RouterValue | null>(null)

/** Strips the base path and any trailing slash: `/app/` → `/app`. */
function normalizePath(pathname: string): string {
  let p = pathname
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/+$/, '')
  return p || '/'
}

function readPath(): string {
  if (typeof window === 'undefined') return '/'
  return normalizePath(window.location.pathname)
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(readPath)

  useEffect(() => {
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const next = normalizePath(to)
    const url = `${BASE}${next}` || '/'
    if (options?.replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    setPath(next)
  }, [])

  const matches = useCallback(
    (prefix: string) => path === prefix || path.startsWith(`${prefix}/`),
    [path],
  )

  const value = useMemo<RouterValue>(
    () => ({ path, navigate, matches }),
    [path, navigate, matches],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}