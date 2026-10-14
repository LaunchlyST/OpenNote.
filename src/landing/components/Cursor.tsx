import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../hooks'

/**
 * Custom landing-page cursor: a solid ink dot that tracks the pointer exactly,
 * and a soft ring that trails it on a spring.
 *
 *   default  → small dot + 28px ring
 *   link/btn → ring grows and fills faintly, dot hides
 *   letter   → ring becomes a pill reading "drag"
 *   dragging → ring shrinks tight around the dot and turns solid
 *
 * Only mounts for fine pointers without reduced motion; touch devices and
 * keyboard users keep the platform's native behaviour. It is pointer-events
 * none, so it can never intercept a click.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const fine = window.matchMedia?.('(pointer: fine)').matches
    if (!fine || prefersReducedMotion()) return
    const dot = dotRef.current
    const ring = ringRef.current
    const label = labelRef.current
    if (!dot || !ring || !label) return

    const html = document.documentElement
    html.classList.add('lp-cursor-on')
    // Injected last so no later stylesheet (or host frame) can bring back the
    // native arrow or text I-beam on top of the custom cursor.
    const hide = document.createElement('style')
    hide.textContent =
      'html.lp-cursor-on, html.lp-cursor-on *, html.lp-cursor-on *::before, html.lp-cursor-on *::after { cursor: none !important; }'
    document.head.appendChild(hide)

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' })

    let mode = ''
    const setMode = (next: string) => {
      if (next === mode) return
      mode = next
      const base = { duration: 0.35, ease: 'power3.out' }
      if (next === 'dragging') {
        gsap.to(ring, { ...base, width: 18, height: 18, backgroundColor: 'rgba(25,25,25,1)', borderColor: 'rgba(25,25,25,1)' })
        gsap.to(label, { ...base, opacity: 0 })
        gsap.to(dot, { ...base, scale: 0 })
      } else if (next === 'drag') {
        gsap.to(ring, { ...base, width: 58, height: 30, backgroundColor: 'rgba(25,25,25,1)', borderColor: 'rgba(25,25,25,1)' })
        gsap.to(label, { ...base, opacity: 1 })
        gsap.to(dot, { ...base, scale: 0 })
      } else if (next === 'link') {
        gsap.to(ring, { ...base, width: 52, height: 52, backgroundColor: 'rgba(25,25,25,0.06)', borderColor: 'rgba(25,25,25,0.35)' })
        gsap.to(label, { ...base, opacity: 0 })
        gsap.to(dot, { ...base, scale: 0.6 })
      } else {
        gsap.to(ring, { ...base, width: 28, height: 28, backgroundColor: 'rgba(25,25,25,0)', borderColor: 'rgba(25,25,25,0.3)' })
        gsap.to(label, { ...base, opacity: 0 })
        gsap.to(dot, { ...base, scale: 1 })
      }
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2, overwrite: 'auto' })
      dotX(e.clientX)
      dotY(e.clientY)
      ringX(e.clientX)
      ringY(e.clientY)
      if (html.dataset.lpDragging === 'true') return setMode('dragging')
      const target = e.target as Element | null
      if (target?.closest('[data-cursor="drag"]')) setMode('drag')
      else if (target?.closest('a, button, [role="button"], summary, label')) setMode('link')
      else setMode('')
    }
    const onDown = () => gsap.to(ring, { scale: 0.85, duration: 0.15 })
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
        className="invisible absolute top-0 left-0 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(25,25,25,0.3)] opacity-0"
      >
        <span ref={labelRef} className="text-[11px] font-semibold tracking-[0.04em] text-white opacity-0">
          drag
        </span>
      </div>
      <div
        ref={dotRef}
        className="invisible absolute top-0 left-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lp-ink opacity-0"
      />
    </div>
  )
}
