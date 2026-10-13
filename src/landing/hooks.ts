import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '../router'

/**
 * Behavioural hooks for the landing page.
 *
 * Kept out of the component files so those stay purely presentational and
 * stay eligible for React Fast Refresh.
 */

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * One shared IntersectionObserver for the whole page. Creating one per card
 * would mean dozens of observers and a lot of duplicated bookkeeping.
 */
let revealObserver: IntersectionObserver | null = null

export function getRevealObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (revealObserver) return revealObserver
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).dataset.revealed = 'true'
        revealObserver?.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0 },
  )
  return revealObserver
}

/** Height of the sticky landing header, used to offset anchor scrolling. */
const HEADER_FALLBACK_OFFSET = 88

function headerOffset(): number {
  if (typeof document === 'undefined') return HEADER_FALLBACK_OFFSET
  const header = document.querySelector<HTMLElement>('[data-landing-header]')
  return header ? header.offsetHeight + 20 : HEADER_FALLBACK_OFFSET
}

export function scrollToSection(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset()
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

/**
 * Wires up every landing-page link. Route changes go through the router,
 * in-page links scroll smoothly and update the hash without a jump.
 */
export function useLandingNav() {
  const { navigate } = useRouter()

  const go = useCallback(
    (href: string) => {
      navigate(href)
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [navigate],
  )

  const goSection = useCallback((id: string) => {
    scrollToSection(id)
    const url = `${window.location.pathname}#${id}`
    window.history.replaceState(null, '', url)
  }, [])

  return { go, goSection }
}

/** Scrolls to a `#hash` found in the URL on first paint, for deep links. */
export function useHashOnMount() {
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    // Wait for layout so the offset is measured against the real header.
    const timer = window.setTimeout(() => scrollToSection(id), 120)
    return () => window.clearTimeout(timer)
  }, [])
}

/** True when reduced-motion is on, for callers that choose not to measure. */
export { prefersReducedMotion }

/**
 * Tracks which section is currently in view so the navigation can highlight
 * it. Uses a band across the upper third of the viewport.
 */
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState('')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id
          if (entry.isIntersecting) visible.set(id, entry.intersectionRatio)
          else visible.delete(id)
        }
        const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]
        setActive(top ? top[0] : '')
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.25, 0.6, 1] },
    )

    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])

  return active
}

/** Keeps a `data-revealed` attribute in sync with scroll position. */
export function useRevealEffect(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Reduced motion, or no IntersectionObserver: show the content immediately.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.dataset.revealed = 'true'
      return
    }

    const observer = getRevealObserver()
    if (!observer) {
      el.dataset.revealed = 'true'
      return
    }

    observer.observe(el)
    // Safety net — never leave copy permanently invisible.
    const timer = window.setTimeout(() => {
      if (el.dataset.revealed !== 'true') {
        el.dataset.revealed = 'true'
        observer.unobserve(el)
      }
    }, 1600)

    return () => {
      window.clearTimeout(timer)
      observer.unobserve(el)
    }
  }, [ref])
}
