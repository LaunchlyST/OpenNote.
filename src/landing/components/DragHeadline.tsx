import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react'

/**
 * “Make time. / Leave a note.” as a playful lockup.
 *
 * Every letter is its own inline-block that keeps its space, so pulling one
 * never reflows the line. Hover nudges a letter; press and drag pulls it out
 * and tilts it; release springs it back with one small overshoot (CSS
 * transition on a back-out curve). Touch: letters use `touch-action: pan-y`,
 * so a vertical swipe still scrolls and only a deliberate sideways pull
 * grabs. The <h1> carries the whole sentence for assistive technology; the
 * letters are presentational. Reduced motion: a still headline.
 *
 * A small paper cursor cue rides just above the headline (never over the
 * letters, never near the buttons): “Pull a letter” on first hover, then a
 * grab state while dragging.
 */
const LINES = ['Make time.', 'Leave a note.']
const MAX = 90 // px a letter can be pulled

type Pull = { i: number; x: number; y: number } | null

export function DragHeadline() {
  const [pull, setPull] = useState<Pull>(null)
  const [cue, setCue] = useState<{ x: number; on: boolean; grab: boolean; used: boolean }>({ x: 0, on: false, grab: false, used: false })
  const start = useRef<{ i: number; x0: number; y0: number; id: number; live: boolean } | null>(null)
  const boxRef = useRef<HTMLHeadingElement | null>(null)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const set = () => setStill(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  const release = () => {
    start.current = null
    setPull(null)
    setCue((c) => ({ ...c, grab: false }))
  }

  const down = (i: number) => (e: RPointerEvent<HTMLSpanElement>) => {
    if (still || e.button > 0) return
    start.current = { i, x0: e.clientX, y0: e.clientY, id: e.pointerId, live: e.pointerType === 'mouse' }
    if (e.pointerType === 'mouse') {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setPull({ i, x: 0, y: 0 })
      setCue((c) => ({ ...c, grab: true, used: true }))
    }
  }
  const move = (e: RPointerEvent<HTMLSpanElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0
    if (!s.live) {
      // touch / pen: only a deliberate sideways pull grabs; vertical is scroll
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      if (Math.abs(dy) > Math.abs(dx)) return release()
      s.live = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setCue((c) => ({ ...c, grab: true, used: true }))
    }
    const k = (v: number) => Math.sign(v) * MAX * (1 - Math.exp(-Math.abs(v) / MAX)) // soft limit
    setPull({ i: s.i, x: k(dx), y: k(dy) })
  }

  const trackCue = (e: RPointerEvent<HTMLHeadingElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    setCue((c) => ({ ...c, on: true, x: Math.max(40, Math.min(r.width - 40, e.clientX - r.left)) }))
  }

  let n = 0
  return (
    <div className="lp-dh-wrap">
      <h1
        ref={boxRef}
        className={'lp-dh' + (still ? ' lp-dh-still' : '')}
        aria-label={LINES.join(' ')}
        onPointerMove={trackCue}
        onPointerLeave={() => setCue((c) => ({ ...c, on: false }))}
      >
        {LINES.map((line, li) => (
          <span key={line} className={`lp-dh-line lp-dh-l${li + 1}`} aria-hidden="true">
            {line.split(' ').map((word, wi, words) => (
              <span key={wi} className="lp-dh-word">
                {[...word].map((ch) => {
                  const i = n++
                  const p = pull && pull.i === i ? pull : null
                  const style: CSSProperties | undefined = p
                    ? { transform: `translate(${p.x}px, ${p.y}px) rotate(${p.x / 9}deg)`, transition: 'none', zIndex: 2 }
                    : undefined
                  const isPeriod = ch === '.' && li === 1
                  return (
                    <span
                      key={i}
                      className={'lp-dh-ch' + (isPeriod ? ' lp-dh-dot' : '') + (p ? ' lp-dh-held' : '')}
                      style={style}
                      onPointerDown={down(i)}
                      onPointerMove={move}
                      onPointerUp={release}
                      onPointerCancel={release}
                      onLostPointerCapture={release}
                    >
                      {ch}
                    </span>
                  )
                })}
                {wi < words.length - 1 && <span className="lp-dh-sp"> </span>}
                {/* the Desknoty detail: a hand-drawn underline under “note” that tucks into the period */}
                {li === 1 && wi === words.length - 1 && (
                  <svg className="lp-dh-swash" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M6 22 C 70 34, 150 30, 222 20 S 286 10, 292 24" />
                  </svg>
                )}
              </span>
            ))}
          </span>
        ))}
      </h1>
      {!still && (
        <span
          className={'lp-dh-cue' + (cue.on ? ' on' : '') + (cue.grab ? ' grab' : '')}
          style={{ transform: `translateX(${cue.x}px) translateX(-50%)` }}
          aria-hidden="true"
        >
          <i />
          {cue.grab ? 'Pulling…' : cue.used ? 'Grab' : 'Pull a letter'}
        </span>
      )}
    </div>
  )
}
