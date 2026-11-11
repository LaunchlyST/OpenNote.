import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * The page as a sheet of paper. At rest only a faint grip shows at the bottom
 * edge. Bring the mouse near it and the edge lifts a little; drag up and the
 * sheet peels away bottom-to-top, its centre rising ahead of the corners, with
 * a highlight on the bend and a shadow cast on the page underneath (children,
 * rendered fixed and full-screen so it never moves). Let go past THRESHOLD to
 * finish the turn (onDone), otherwise it settles back. Touch: swipe up from the
 * bottom edge. Keyboard: Tab to the edge, Enter turns the page.
 */
const ZONE = 72 // px from the bottom of the window that wakes the edge
const THRESHOLD = 0.3 // of the window height
const HINT = 30 // px the edge lifts on hover

type Mode = 'idle' | 'hint' | 'drag' | 'settle' | 'finish'

export function PagePeel({
  label,
  tone,
  onDone,
  keepOnDone = false,
  children,
}: {
  label: string
  tone: string
  onDone: () => void
  /** onDone navigates away: leave the sheet fully turned instead of resetting. */
  keepOnDone?: boolean
  children?: ReactNode
}) {
  const [h, setH] = useState(0)
  const [mode, setMode] = useState<Mode>('idle')
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  const drag = useRef<{ y0: number } | null>(null)
  const moved = useRef(false)
  const timers = useRef<number[]>([])
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  useEffect(() => {
    const size = () => (setVw(window.innerWidth), setVh(window.innerHeight))
    window.addEventListener('resize', size)
    return () => window.removeEventListener('resize', size)
  }, [])

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const settle = () => {
    setMode('settle')
    setH(0)
    later(() => setMode((m) => (m === 'settle' ? 'idle' : m)), 420)
  }

  const finish = () => {
    if (still) return onDone()
    setMode('finish')
    setH(window.innerHeight)
    later(() => {
      onDone()
      if (keepOnDone) return
      window.scrollTo({ top: 0 })
      setMode('idle')
      setH(0)
    }, 560)
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) {
        if (Math.abs(e.clientY - drag.current.y0) > 6) moved.current = true
        setH(Math.max(0, window.innerHeight - e.clientY))
        return
      }
      if (mode === 'finish' || mode === 'settle') return
      const near = e.clientY > window.innerHeight - ZONE && Math.abs(e.clientX - window.innerWidth / 2) < 200
      if (near && mode === 'idle') setMode('hint')
      if (!near && mode === 'hint') setMode('idle')
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      if (h > window.innerHeight * THRESHOLD) finish()
      else settle()
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

  // how far the edge is up, and how much its centre leads the corners
  const lift = mode === 'drag' || mode === 'finish' ? h : mode === 'hint' ? HINT : 0
  const bend = mode === 'finish' ? 0 : mode === 'hint' ? 16 : Math.min(90, 14 + lift * 0.16)
  // finishing: the edge clears the top, bend and all
  const top = mode === 'finish' ? vh + 120 : lift

  // edge curve, in px: y(x) measured from the bottom
  const N = 32
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push([t * vw, vh - (top + Math.sin(t * Math.PI) * bend)])
  }
  const poly = `polygon(0px ${vh}px, ${pts.map(([x, y]) => `${x}px ${y}px`).join(', ')}, ${vw}px ${vh}px)`
  const curve = `M ${pts.map(([x, y]) => `${x} ${y}`).join(' L ')}`
  const animate = mode !== 'drag'
  const visible = lift > 0 || mode === 'settle' || mode === 'finish'

  return (
    <div className={`pp pp-m-${mode}`} style={{ '--tone': tone } as CSSProperties}>
      {/* the page underneath, fixed in place; revealed below the curved edge */}
      <div
        className="pp-back"
        style={{ clipPath: poly, WebkitClipPath: poly, transition: animate ? undefined : 'none', visibility: visible ? 'visible' : 'hidden' }}
      >
        {children}
        {/* shadow the lifted sheet casts onto the page underneath */}
        <svg className="pp-shade" width={vw} height={vh} aria-hidden="true">
          <defs>
            <filter id="pp-blur" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <path d={curve} transform="translate(0 22)" fill="none" stroke="rgba(20,18,14,0.2)" strokeWidth={30} filter="url(#pp-blur)" />
        </svg>
      </div>
      {/* the bend of the sheet itself: a soft highlight riding the edge */}
      {visible && mode !== 'finish' && (
        <svg className="pp-fold" width={vw} height={vh} aria-hidden="true">
          <path d={curve} transform="translate(0 -6)" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={10} strokeLinecap="round" />
          <path d={curve} transform="translate(0 -14)" fill="none" stroke="rgba(20,18,14,0.07)" strokeWidth={8} strokeLinecap="round" />
        </svg>
      )}
      <div
        className="pp-edge"
        role="button"
        tabIndex={0}
        aria-label={`Turn the page to ${label}`}
        onPointerDown={(e) => {
          if (mode === 'finish') return
          e.preventDefault()
          drag.current = { y0: e.clientY }
          moved.current = false
          setMode('drag')
          setH(Math.max(HINT, window.innerHeight - e.clientY))
        }}
        onClick={() => {
          if (!moved.current && mode !== 'finish') finish()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            finish()
          }
        }}
      >
        <span className="pp-grip" />
      </div>
    </div>
  )
}
