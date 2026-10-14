import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../hooks'

/**
 * Custom landing-page cursor: a solid ink dot that tracks the pointer exactly,
 * and a soft ring that trails it on a spring. It looks the same everywhere —
 * over text, letters, links and while dragging — and only gives a small press
 * feedback on click.
 *
 * Only mounts for fine pointers without reduced motion; touch devices and
 * keyboard users keep the platform's native behaviour. It is pointer-events
 * none, so it can never intercept a click.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fine = window.matchMedia?.('(pointer: fine)').matches
    if (!fine || prefersReducedMotion()) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const html = document.documentElement
    html.classList.add('lp-cursor-on')
    // Injected last so no later stylesheet (or host frame) can bring back the
    // native arrow, hand or text I-beam on top of the custom cursor.
    const hide = document.createElement('style')
    hide.textContent =
      'html.lp-cursor-on, html.lp-cursor-on *, html.lp-cursor-on *::before, html.lp-cursor-on *::after { cursor: none !important; }'
    document.head.appendChild(hide)

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' })

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2, overwrite: 'auto' })
      dotX(e.clientX)
      dotY(e.clientY)
      ringX(e.clientX)
      ringY(e.clientY)
    }
    const onDown = () => gsap.to(ring, { scale: 0.8, duration: 0.15 })
    const onUp = () => gsap.to(ring, { scale: 1, duration: 0.4, ease: 'back.out(3)' })
    const onLeave = () => gsap.to([dot, ring], { autoAlpha: 0, duration: 0.2 })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      html.classList.remove('lp-cursor-on')
      hide.remove()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div aria-hidden="true" className="lp-cursor pointer-events-none fixed inset-0 z-[200]">
      <div
        ref={ringRef}
        className="invisible absolute top-0 left-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(25,25,25,0.3)] opacity-0"
      />
      <div
        ref={dotRef}
        className="invisible absolute top-0 left-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lp-ink opacity-0"
      />
    </div>
  )
}
