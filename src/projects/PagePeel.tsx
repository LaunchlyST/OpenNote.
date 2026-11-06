import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * The page as a sheet of paper. Bring the mouse to the bottom edge and the
 * sheet lifts a little; drag it upwards (or click the lifted edge) and it
 * peels away bottom-to-top, showing the other side underneath, which then
 * becomes the page. Touch: swipe up from the bottom edge. Keyboard: the
 * lifted edge is focusable, Enter peels it.
 */
const ZONE = 72 // px from the bottom of the window that wakes the edge

export function PagePeel({ label, tone, onDone }: { label: string; tone: string; onDone: () => void }) {
  const [h, setH] = useState(0) // how far the sheet is lifted, in px
  const [mode, setMode] = useState<'idle' | 'hint' | 'drag' | 'finish' | 'reset'>('idle')
  const drag = useRef<{ y0: number } | null>(null)
  const moved = useRef(false)
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) {
        if (Math.abs(e.clientY - drag.current.y0) > 6) moved.current = true
        setH(Math.max(0, window.innerHeight - e.clientY))
        return
      }
      if (mode === 'finish' || mode === 'reset') return
      const near = e.clientY > window.innerHeight - ZONE
      setMode(near ? 'hint' : 'idle')
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      if (h > window.innerHeight * 0.3) finish()
      else {
        setMode('idle')
        setH(0)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })

  const finish = () => {
    if (still) return onDone()
    setMode('finish')
    setH(window.innerHeight)
    window.setTimeout(() => {
      onDone()
      window.scrollTo({ top: 0 })
      setMode('reset')
      window.setTimeout(() => {
        setH(0)
        setMode('idle')
      }, 420)
    }, 520)
  }

  const lifted = mode === 'drag' || mode === 'finish' ? h : mode === 'hint' ? 46 : mode === 'reset' ? h : 14

  return (
    <div
      className={cn2('pp', `pp-m-${mode}`)}
      style={{ '--lift': `${lifted}px`, '--tone': tone } as CSSProperties}
      aria-hidden={mode === 'finish' || mode === 'reset' ? true : undefined}
    >
      {/* the back of the page that rises from the bottom */}
      <div className="pp-back">
        <span className="pp-label">{label}</span>
      </div>
      <div
        className="pp-edge"
        role="button"
        tabIndex={0}
        aria-label={`Turn the page to ${label}`}
        onPointerDown={(e) => {
          e.preventDefault()
          drag.current = { y0: e.clientY }
          moved.current = false
          setMode('drag')
          setH(Math.max(46, window.innerHeight - e.clientY))
        }}
        onClick={() => {
          if (!moved.current && mode !== 'finish' && mode !== 'reset') finish()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            finish()
          }
        }}
      >
        <span className="pp-grip" />
        <span className="pp-hint">↑ {label}</span>
      </div>
    </div>
  )
}

const cn2 = (...c: Array<string | false>) => c.filter(Boolean).join(' ')
