import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './aero.css'

/**
 * Under construction — "Somewhere between yesterday & tomorrow".
 * Frutiger Aero reimagined: sky, water, glass, one interactive note.
 * Informational only: no sign-in, no sign-up, no forms, no links.
 */

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const NOTE = [
  'Hey there,',
  'We wanted to leave you a little update.',
  'Desknoty is taking a bit longer than we originally planned, and we’re sorry to keep you waiting.',
  'We’ve been working behind the scenes: building, fixing bugs, improving the experience and making sure everything feels right.',
  'There are still a few things we want to get right before opening the doors.',
  'Rather than rush it, we’re taking a little more time to make Desknoty something we’re genuinely proud to share.',
  'Thank you for your patience and for being here.',
  'We’re getting closer, and we can’t wait to show you what we’ve been making.',
]

function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="4" y="6" width="24" height="22" rx="6" fill="rgba(255,255,255,.92)" />
      <rect x="4" y="6" width="24" height="8" rx="4" fill="#0b6fb8" />
      <path d="M11 3.5v5M21 3.5v5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22.5" cy="22.5" r="3.6" fill="#c8ff3d" />
    </svg>
  )
}

export function AeroPage() {
  const [open, setOpen] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const prev = document.title, bg = document.body.style.background
    document.title = 'Desknoty — under construction'
    document.body.style.background = '#0a84c9'
    return () => { document.title = prev; document.body.style.background = bg }
  }, [])
  return (
    <div className="ae">
      <div className={`ae-scene ${open ? 'away' : ''}`}>
        <div className="ae-sky" aria-hidden="true">
          <div className="ae-sun" />
          <div className="ae-cloud c1" /><div className="ae-cloud c2" /><div className="ae-cloud c3" />
          <div className="ae-water"><i /></div>
          <div className="ae-bubble b1" /><div className="ae-bubble b2" /><div className="ae-bubble b3" />
        </div>

        <header className="ae-top">
          <span className="ae-brand"><Mark /> Desknoty</span>
          <span className="ae-status"><i aria-hidden="true" /> Under construction</span>
        </header>

        <main className="ae-main">
          <div className="ae-copy">
            <h1 className="ae-h1">
              <span><b>Good things</b></span>
              <span><b>take a little</b></span>
              <span><b>time.</b></span>
            </h1>
            <p className="ae-sub">Desknoty is still under construction. We’re fixing, improving and polishing the little details before welcoming everyone in.</p>
          </div>

          <div className="ae-stage">
            <div className="ae-orb" aria-hidden="true"><Mark size={84} /></div>
            <button type="button" className="ae-tile" onClick={(e) => { const el = e.currentTarget; setOpen((cur) => cur ?? el) }} aria-haspopup="dialog">
              <span className="ae-tile-bar" aria-hidden="true"><i /><i /><i /></span>
              <span className="ae-tile-body">
                <span className="ae-tile-k">For you</span>
                <span className="ae-tile-t">A little note from us</span>
                <span className="ae-tile-o">Open <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </span>
            </button>
          </div>
        </main>

        <p className="ae-foot">Somewhere between yesterday &amp; tomorrow</p>
      </div>

      {open && <Note from={open} onClosed={() => setOpen(null)} />}
    </div>
  )
}

/** The note: the small glass window grows into the full one (same object, one motion), then the writing settles in. */
function Note({ from, onClosed }: { from: HTMLElement; onClosed: () => void }) {
  const win = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const x = useRef<HTMLButtonElement>(null)
  const busy = useRef(true)
  const wantClose = useRef(false)
  const [shown, setShown] = useState(false)

  const frames = () => {
    const a = from.getBoundingClientRect(), b = win.current!.getBoundingClientRect()
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2)
    return [
      { transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height}) rotate(-4deg)`, opacity: 0.9 },
      { transform: 'translate(0, 0) scale(1, 1) rotate(0deg)', opacity: 1 },
    ]
  }

  useLayoutEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    from.style.visibility = 'hidden'
    let alive = true
    const ready = () => { if (!alive) return; setShown(true); busy.current = false; if (wantClose.current) void close() }
    if (reduced()) ready()
    else {
      dim.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: EASE, fill: 'both' })
      win.current!.animate(frames(), { duration: 720, easing: EASE, fill: 'both' }).finished.then(ready)
    }
    return () => { alive = false; document.body.style.overflow = prev; from.style.visibility = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (shown) x.current?.focus({ preventScroll: true }) }, [shown])

  const close = async () => {
    if (busy.current) { wantClose.current = true; return }
    busy.current = true
    const done = () => { from.style.visibility = ''; onClosed(); from.focus({ preventScroll: true }) }
    if (reduced()) return done()
    setShown(false)
    await new Promise((r) => setTimeout(r, 180))
    dim.current!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: EASE, fill: 'both' })
    await win.current!.animate(frames().reverse(), { duration: 560, easing: EASE, fill: 'both' }).finished
    done()
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') void close() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  })

  return (
    <div className={`an ${shown ? 'shown' : ''}`} role="dialog" aria-modal="true" aria-labelledby="an-title">
      <div ref={dim} className="an-dim" onClick={() => void close()} />
      <div ref={win} className="an-win">
        <div className="an-bar">
          <span className="an-bar-t"><Mark size={18} /> note.txt</span>
          <button ref={x} type="button" className="an-x" onClick={() => void close()} aria-label="Close the note">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="an-paper">
          <h2 id="an-title" className="an-title">A little note from Desknoty</h2>
          {NOTE.map((p, i) => <p key={i} className="an-p" style={{ ['--d' as string]: `${80 + i * 70}ms` }}>{p}</p>)}
          <p className="an-p an-sign" style={{ ['--d' as string]: `${80 + NOTE.length * 70}ms` }}>With love,<br />The Desknoty Team</p>
          <p className="an-p an-ps" style={{ ['--d' as string]: `${150 + NOTE.length * 70}ms` }}>P.S. We’re worth the wait.</p>
        </div>
      </div>
    </div>
  )
}

export default AeroPage
