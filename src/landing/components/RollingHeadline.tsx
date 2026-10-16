import { Fragment, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { cn } from '../../lib/id'
import { prefersReducedMotion } from '../hooks'

/**
 * Hero headline with two moments of motion:
 *
 * 1. On every load each letter rolls into place around a horizontal axis, like
 *    the drum of a mechanical departures board.
 * 2. Once settled, any letter can be picked up and dragged around. It leans
 *    into the direction of travel and springs back to its exact slot on release.
 *
 * Letters are `inline-block` spans inside nowrap word spans, so wrapping is
 * identical to plain text and only transforms ever move — no layout shift.
 * Screen readers get the sentence once, from a visually hidden copy.
 */
export function RollingHeadline({ lines, className }: { lines: string[]; className?: string }) {
  const rootRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const letters = Array.from(root.querySelectorAll<HTMLElement>('[data-letter]'))
    const reduced = prefersReducedMotion()

    /* ---------- 1. Rolling entrance ---------- */
    const ctx = gsap.context(() => {
      if (reduced) return
      gsap.fromTo(
        letters,
        { rotationX: -100, yPercent: 55, opacity: 0, filter: 'blur(3px)' },
        {
          rotationX: 0,
          yPercent: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1.1,
          ease: 'expo.out',
          stagger: { each: 0.035, from: 'start' },
          delay: 0.25,
          clearProps: 'filter',
        },
      )
    }, root)

    /* ---------- 2. Drag any letter ---------- */
    const cleanups: Array<() => void> = []
    for (const el of letters) {
      let startX = 0
      let startY = 0
      let lastX = 0
      let dragging = false
      const moveX = gsap.quickTo(el, 'x', { duration: 0.18, ease: 'power3.out' })
      const moveY = gsap.quickTo(el, 'y', { duration: 0.18, ease: 'power3.out' })
      const tilt = gsap.quickTo(el, 'rotation', { duration: 0.35, ease: 'power3.out' })

      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return
        e.preventDefault()
        dragging = true
        el.setPointerCapture(e.pointerId)
        startX = e.clientX - (Number(gsap.getProperty(el, 'x')) || 0)
        startY = e.clientY - (Number(gsap.getProperty(el, 'y')) || 0)
        lastX = e.clientX
        gsap.killTweensOf(el, 'scale')
        gsap.to(el, { scale: 1.18, duration: 0.25, ease: 'back.out(3)' })
        el.dataset.dragging = 'true'
        document.documentElement.dataset.lpDragging = 'true'
      }
      const onMove = (e: PointerEvent) => {
        if (!dragging) return
        moveX(e.clientX - startX)
        moveY(e.clientY - startY)
        // Lean into the motion, clamped so it stays elegant.
        const v = e.clientX - lastX
        lastX = e.clientX
        tilt(gsap.utils.clamp(-28, 28, v * 2.2))
      }
      const onUp = (e: PointerEvent) => {
        if (!dragging) return
        dragging = false
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        delete el.dataset.dragging
        delete document.documentElement.dataset.lpDragging
        gsap.killTweensOf(el)
        gsap.to(el, {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: 1.25,
          ease: 'elastic.out(1, 0.38)',
        })
      }

      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
      cleanups.push(() => {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
      })
    }

    return () => {
      ctx.revert()
      cleanups.forEach((fn) => fn())
      gsap.set(letters, { clearProps: 'all' })
    }
  }, [])

  let index = 0
  return (
    <h1 ref={rootRef} className={cn('relative select-none', className)} style={{ perspective: '900px' }}>
      <span className="sr-only">{lines.join(' ')}</span>
      {lines.map((line, li) => (
        <span key={li} aria-hidden="true" className="block">
          {line.split(' ').map((word, wi, words) => (
            <Fragment key={wi}>
            <span className="inline-block whitespace-nowrap">
              {Array.from(word).map((ch) => {
                const i = index++
                return (
                  <span
                    key={i}
                    data-letter=""
                    data-cursor="drag"
                    className="lp-letter relative inline-block cursor-grab touch-pan-y will-change-transform active:cursor-grabbing data-[dragging=true]:z-20"
                    style={{ transformOrigin: '50% 50% -0.4em', backfaceVisibility: 'hidden' }}
                  >
                    {ch}
                  </span>
                )
              })}
            </span>
            {wi < words.length - 1 && ' '}
            </Fragment>
          ))}
        </span>
      ))}
    </h1>
  )
}
