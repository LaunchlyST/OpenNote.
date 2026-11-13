import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { GlyphBackground } from '../components/ui/glyph-background'
import { DotMatrixText } from '../components/ui/dot-matrix-text'
import './aero.css'

/**
 * Under construction — "Good things take a little time."
 * An editorial collage on dotted notebook paper: a big serif
 * headline, hand drawn stickers you can pick up and move, and paper tabs.
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

const HEARTS = ['Thank you.', 'That one made our day.', 'Okay, we’re blushing.', 'You’re officially our favourite.', 'We’ll build faster. Promise.']

function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="4" y="6" width="24" height="22" rx="6" fill="#fff" stroke="#0b6fb8" strokeWidth="1.2" />
      <rect x="4" y="6" width="24" height="8" rx="4" fill="#0b6fb8" />
      <path d="M11 3.5v5M21 3.5v5" stroke="#0b6fb8" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22.5" cy="22.5" r="3.6" fill="#c8ff3d" />
    </svg>
  )
}

/* ---- hand drawn stickers ---- */
const Daisy = ({ c = '#f2c94c' }: { c?: string }) => (
  <svg viewBox="0 0 120 120"><path d="M60 46c-4-18-2-34 6-36s10 18 2 34c10-14 26-22 31-15s-8 19-25 24c17-2 32 4 31 12s-19 9-32 0c13 11 18 27 11 31s-17-11-19-28c-1 17-9 32-17 30s-6-19 6-31c-14 9-31 9-32 1s15-15 31-15c-16-6-27-18-21-24s20 1 28 17Z" fill="none" stroke={c} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" /></svg>
)
const Flower = ({ c, m = '#e2a93b' }: { c: string; m?: string }) => (
  <svg viewBox="0 0 100 100"><g fill={c}>{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="50" cy="27" rx="15" ry="22" transform={`rotate(${r} 50 50)`} />)}</g><circle cx="50" cy="50" r="8" fill={m} /></svg>
)
const Heart = () => (
  <svg viewBox="0 0 100 100"><path d="M50 86C22 66 10 50 12 34c2-14 18-22 30-14 4 3 6 6 8 10 2-4 4-7 8-10 12-8 28 0 30 14 2 16-10 32-38 52Z" fill="#f6d36b" stroke="#e86a6a" strokeWidth="5" strokeLinejoin="round" /><circle cx="38" cy="44" r="3.5" fill="#c4473f" /><circle cx="60" cy="44" r="3.5" fill="#c4473f" /><path d="M40 56c5 6 13 6 18 0" fill="none" stroke="#c4473f" strokeWidth="4" strokeLinecap="round" /></svg>
)
const Sticky = () => (
  <svg viewBox="0 0 150 130"><path d="M10 14 140 6l4 104-120 14Z" fill="#fff27a" /><path d="M24 124l120-14-14 20Z" fill="#e2d35c" opacity=".7" /><path d="M54 2h46v18H54Z" fill="rgba(200,230,255,.75)" transform="rotate(-4 77 11)" /><path d="M30 46c20-3 50-6 86-6M30 66c24-3 46-4 70-4M30 86c16-2 30-2 44-2" stroke="#7a6a1c" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none" /><path d="M96 82l8 8 18-22" fill="none" stroke="#3a7d2c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

/** A sticker you can pick up and drop anywhere. */
function Sticker({ className, label, children, shuffle }: { className: string; label: string; children: ReactNode; shuffle: number }) {
  const [pos, setPos] = useState({ x: 0, y: 0, r: 0 })
  const [held, setHeld] = useState(false)
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 })
  useEffect(() => {
    if (!shuffle) return
    setPos({ x: (Math.random() - 0.5) * 220, y: (Math.random() - 0.5) * 140, r: (Math.random() - 0.5) * 40 })
  }, [shuffle])
  return (
    <span
      className={`st ${className} ${held ? 'held' : ''}`}
      role="img"
      aria-label={label}
      style={{ ['--x' as string]: `${pos.x}px`, ['--y' as string]: `${pos.y}px`, ['--r' as string]: `${pos.r}deg` }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY }; setHeld(true) }}
      onPointerMove={(e) => { if (held) setPos((p) => ({ ...p, x: start.current.x + e.clientX - start.current.px, y: start.current.y + e.clientY - start.current.py })) }}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
    >
      <span className="st-in">{children}</span>
    </span>
  )
}

type Float = { id: number; x: number }

export function AeroPage() {
  const [open, setOpen] = useState<HTMLElement | null>(null)
  const [shuffle, setShuffle] = useState(0)
  const [hearts, setHearts] = useState(0)
  const [floats, setFloats] = useState<Float[]>([])
  const [now, setNow] = useState(() => new Date())
  const [rm] = useState(reduced)

  useEffect(() => {
    const prev = document.title, bg = document.body.style.background
    document.title = 'Desknoty — under construction'
    document.body.style.background = '#fffef8'
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => { document.title = prev; document.body.style.background = bg; clearInterval(t) }
  }, [])

  const love = () => {
    const id = Date.now() + Math.random()
    setHearts((h) => h + 1)
    if (!rm) {
      setFloats((f) => [...f, { id, x: (Math.random() - 0.5) * 60 }])
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600)
    }
  }

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const heartLine = hearts ? HEARTS[Math.min(hearts, HEARTS.length) - 1] : null

  return (
    <div className="ae">
      <GlyphBackground className="ae-glyphs" />
      <div className={`ae-scene ${open ? 'away' : ''}`}>
        <header className="ae-top">
          <span className="ae-brand"><Mark /> Desknoty</span>
          <span className="ae-status"><i aria-hidden="true" /> Under construction<span className="ae-time"> · {time}</span></span>
        </header>

        <main className="ae-main">
          <div className="ae-hero">
            <Sticker className="s-daisy" label="A hand drawn daisy" shuffle={shuffle}><Daisy /></Sticker>
            <Sticker className="s-f1" label="A red flower" shuffle={shuffle}><Flower c="#e36b62" /></Sticker>
            <Sticker className="s-f2" label="A yellow flower" shuffle={shuffle}><Flower c="#f2c94c" m="#b8862b" /></Sticker>
            <Sticker className="s-f3" label="A green flower" shuffle={shuffle}><Flower c="#7aa35a" m="#f2c94c" /></Sticker>

            <h1 className="ae-h1">
              <span className="l1"><b>Good things</b></span>
              <span className="l2"><i className="ae-dot" aria-hidden="true" /><b>take a little time.</b></span>
            </h1>

            <Sticker className="s-sticky" label="A sticky note with a tick" shuffle={shuffle}><Sticky /></Sticker>
            <span className="ae-script" aria-hidden="true">
              <svg viewBox="0 0 420 150"><path className="ae-swash" d="M8 118c40 10 90-6 130-30 30-18 40-44 22-46-26-3-40 40-18 52 24 13 70-18 96-36 10-7 20-10 22-2 2 9-14 22-4 26 14 6 40-16 60-24 18-8 36-6 40 4" fill="none" stroke="#3f6fe0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg>
              <em>worth the wait</em>
            </span>
            <Sticker className="s-heart" label="A smiling heart" shuffle={shuffle}><Heart /></Sticker>
            <Sticker className="s-mark" label="The Desknoty logo" shuffle={shuffle}><Mark size={64} /></Sticker>
            <i className="ae-blip" aria-hidden="true" />
          </div>

          <p className="ae-sub">Desknoty is still under construction. We’re fixing, improving and polishing the little details before welcoming everyone in.</p>
          <p className="ae-hint" aria-hidden="true">Psst. The stickers move.</p>
        </main>

        <footer className="ae-foot">
          <span className="ae-copy">© {now.getFullYear()} Desknoty</span>
          <nav className="ae-tabs" aria-label="While you wait">
            <button type="button" className="ae-tab t-note" onClick={(e) => { const el = e.currentTarget; setOpen((c) => c ?? el) }} aria-haspopup="dialog">Read our note</button>
            <button type="button" className="ae-tab" onClick={() => setShuffle((s) => s + 1)}>Shuffle stickers</button>
            <button type="button" className="ae-tab t-love" onClick={love}>
              Send some love{hearts > 0 && <b>{hearts}</b>}
              {floats.map((f) => <span key={f.id} className="ae-float" style={{ ['--fx' as string]: `${f.x}px` }} aria-hidden="true">♥</span>)}
            </button>
          </nav>
          <span className="ae-motto" aria-live="polite">{heartLine ?? 'Between yesterday & tomorrow'}</span>
        </footer>
        <div className="ae-word"><span className="ae-sr">Desknoty</span><DotMatrixText className="ae-dots" aria-hidden="true" text={['Desknoty', 'Soon', 'Worth the wait']} dotSize={typeof window !== 'undefined' && window.innerWidth < 700 ? 3 : 5} gap={typeof window !== 'undefined' && window.innerWidth < 700 ? 1 : 2} /></div>
      </div>

      {open && <Note from={open} onClosed={() => setOpen(null)} />}
    </div>
  )
}

/** The note: the trigger grows into the full window (same object, one motion), then the writing settles in. */
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
      { transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height}) rotate(-4deg)`, opacity: 0.6 },
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
      win.current!.animate(frames(), { duration: 760, easing: EASE, fill: 'both' }).finished.then(ready)
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
