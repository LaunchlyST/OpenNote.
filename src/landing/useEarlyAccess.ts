import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'

/**
 * Shared early-access logic for the Coming Soon design exploration.
 *
 * The handle rests on the **left** of a track and is dragged to the **right**
 * with mouse or touch to unlock. It springs back to the left when released
 * before the threshold, unlocks past ~82% of the travel, and supports keyboard
 * activation (Enter/→ slides it across). On unlock it reveals an invite-code
 * field that is validated by the real backend (`POST /api/early-access`), then
 * wipes to the existing landing page.
 *
 * The drag listens on `window` for the whole gesture (not just the track) so the
 * handle keeps tracking even when the pointer leaves the track or capture is
 * unavailable — it can never freeze mid-drag.
 *
 * Each design concept renders its own control skin from this hook, so the
 * visuals can differ wildly while the functionality stays identical.
 */

export type Phase = 'swipe' | 'code' | 'checking' | 'wrong' | 'leaving'

/**
 * A colour wipe that rises over the scene, holds while the landing page is
 * swapped in underneath, then fades. Kept outside React on purpose — it must
 * outlive this component's unmount at navigation time.
 */
export function playExitWipe(done: () => void, gradient: string) {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;pointer-events:none;transform:translateY(100%);' +
    'transition:transform .7s cubic-bezier(.22,1,.36,1);' +
    `background:${gradient}`
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)'
  })
  window.setTimeout(() => {
    done()
    requestAnimationFrame(() => {
      el.style.transition = 'opacity .55s ease'
      el.style.opacity = '0'
      window.setTimeout(() => el.remove(), 600)
    })
  }, 720)
}

interface Options {
  /** The gradient used by the exit wipe, matched to the concept's palette. */
  wipe: string
}

export function useEarlyAccess({ wipe }: Options) {
  const { navigate } = useRouter()
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const [phase, setPhase] = useState<Phase>('swipe')
  const [code, setCode] = useState('')
  const [shake, setShake] = useState(false)
  const [knobX, setKnobX] = useState(0)
  const [dragging, setDragging] = useState(false)
  // Measured drag range of the track (px), kept in state so renders never read
  // the DOM.
  const [maxX, setMaxX] = useState(0)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const knobXRef = useRef(0)
  const maxXRef = useRef(0)
  const startX = useRef(0)
  const knobStart = useRef(0)
  const draggingRef = useRef(false)
  const dragHandlers = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null)

  const applyKnob = useCallback((x: number) => {
    knobXRef.current = x
    setKnobX(x)
  }, [])

  const removeDragListeners = useCallback(() => {
    const h = dragHandlers.current
    if (!h) return
    window.removeEventListener('pointermove', h.move)
    window.removeEventListener('pointerup', h.up)
    window.removeEventListener('pointercancel', h.up)
    dragHandlers.current = null
  }, [])

  // End a drag: return the handle to rest (left), then unlock if it made it
  // far enough right.
  const endDrag = useCallback(
    (unlock: boolean) => {
      draggingRef.current = false
      setDragging(false)
      removeDragListeners()
      applyKnob(0)
      if (unlock) setPhase('code')
    },
    [applyKnob, removeDragListeners],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== 'swipe') return
      draggingRef.current = true
      setDragging(true)
      startX.current = e.clientX
      knobStart.current = knobXRef.current
      const max = maxXRef.current
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* window listeners below cover it */
      }
      removeDragListeners()
      const move = (ev: PointerEvent) => {
        if (!draggingRef.current || !max) return
        const next = Math.min(max, Math.max(0, knobStart.current + (ev.clientX - startX.current)))
        applyKnob(next)
        if (next >= max * 0.82) endDrag(true)
      }
      const up = () => {
        if (!draggingRef.current) return
        endDrag(false)
      }
      dragHandlers.current = { move, up }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [phase, applyKnob, endDrag, removeDragListeners],
  )

  // Measure the travel range (and re-measure on resize). The track only exists
  // during the swipe phase. Layout effect so the handle is parked on the left
  // before first paint.
  useLayoutEffect(() => {
    if (phase !== 'swipe') return
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const v = Math.max(0, track.clientWidth - 12 - 48)
      maxXRef.current = v
      setMaxX(v)
      if (!draggingRef.current) applyKnob(Math.min(knobXRef.current, v))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [phase, applyKnob])

  // Don't leave window listeners dangling if the screen unmounts mid-drag.
  useEffect(() => removeDragListeners, [removeDragListeners])

  /* Keyboard path: slide the handle to the right, then reveal the field. */
  const swipeByKeyboard = useCallback(() => {
    if (phase !== 'swipe') return
    draggingRef.current = false
    setDragging(false)
    applyKnob(maxXRef.current)
    window.setTimeout(
      () => {
        setPhase('code')
        applyKnob(0)
      },
      reduced ? 0 : 340,
    )
  }, [phase, applyKnob, reduced])

  const leave = useCallback(() => {
    setPhase('leaving')
    if (reduced) {
      navigate('/landing')
      return
    }
    window.setTimeout(() => playExitWipe(() => navigate('/landing'), wipe), 260)
  }, [navigate, reduced, wipe])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (phase === 'checking' || phase === 'leaving') return
    const attempt = code.trim()
    if (!attempt) return
    setPhase('checking')
    try {
      const res = await fetch(apiUrl('/api/early-access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: attempt }),
      })
      if (!res.ok) throw new Error('invalid')
      leave()
    } catch {
      setPhase('wrong')
      setShake(true)
      window.setTimeout(() => setShake(false), 400)
    }
  }

  return {
    phase,
    code,
    setCode,
    shake,
    knobX,
    dragging,
    maxX,
    reduced,
    trackRef,
    onPointerDown,
    swipeByKeyboard,
    submit,
    leave,
    setPhase,
    isWrong: phase === 'wrong',
    isChecking: phase === 'checking',
    leaving: phase === 'leaving',
    /** 0 → at rest (left), 1 → fully swiped right (unlocked). */
    progress: maxX ? knobX / maxX : 0,
  }
}

export type EarlyAccess = ReturnType<typeof useEarlyAccess>
