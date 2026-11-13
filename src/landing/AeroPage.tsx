import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './aero.css'

/**
 * Under construction — "Somewhere between yesterday & tomorrow".
 * Frutiger Aero, directed: a living sky that follows the visitor's own clock,
 * a glass orb, the headline mirrored in the water, a message in a bottle,
 * and bubbles to pop while you wait.
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

type Sky = 'dawn' | 'day' | 'dusk' | 'night'
const SKIES: Sky[] = ['dawn', 'day', 'dusk', 'night']
const skyFor = (h: number): Sky => (h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night')

const POPS: [number, string][] = [
  [1, 'Pop. That’s one.'],
  [5, 'You’re good at this.'],
  [12, 'Very patient. We like you.'],
  [25, 'We’re building as fast as you’re popping.'],
  [50, 'Okay, now you’re just showing off.'],
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

function Bottle() {
  return (
    <svg viewBox="0 0 160 72" aria-hidden="true">
      <defs>
        <linearGradient id="ae-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9fbff" stopOpacity=".85" />
          <stop offset=".45" stopColor="#9fe3f2" stopOpacity=".45" />
          <stop offset="1" stopColor="#2fa9cf" stopOpacity=".7" />
        </linearGradient>
        <linearGradient id="ae-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="1" stopColor="#efe6cf" />
        </linearGradient>
      </defs>
      {/* body + neck */}
      <path d="M14 36c0-14 9-22 26-22h52c8 0 13 3 18 8l8 6h14v16h-14l-8 6c-5 5-10 8-18 8H40C23 58 14 50 14 36Z" fill="url(#ae-glass)" stroke="rgba(255,255,255,.9)" strokeWidth="1.5" />
      {/* rolled note */}
      <rect x="34" y="27" width="62" height="18" rx="9" fill="url(#ae-paper)" />
      <path d="M44 27v18M86 27v18" stroke="rgba(120,96,40,.18)" strokeWidth="1" />
      <rect x="61" y="26" width="7" height="20" rx="2" fill="#c8ff3d" />
      {/* cork */}
      <rect x="132" y="26" width="16" height="20" rx="4" fill="#c99a62" />
      <path d="M136 30v12M141 30v12" stroke="rgba(90,55,20,.35)" strokeWidth="1.2" strokeLinecap="round" />
      {/* glints */}
      <path d="M26 30c2-7 8-11 16-11h44" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <path d="M100 19c4 0 8 2 11 5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      {/* waterline inside */}
      <path d="M18 46c10 3 20-2 30 1s20 3 30 0 20-2 30 1" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />
    </svg>
  )
}

type Bubble = { id: number; x: number; size: number; dur: number; sway: number; popped?: boolean }

export function AeroPage() {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<HTMLElement | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [sky, setSky] = useState<Sky>(() => skyFor(new Date().getHours()))
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [pops, setPops] = useState(0)
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    const prev = document.title, bg = document.body.style.background
    document.title = 'Desknoty — under construction'
    document.body.style.background = '#0a84c9'
    const q = new URLSearchParams(window.location.search).get('sky') as Sky | null
    if (q && SKIES.includes(q)) setSky(q)
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => { document.title = prev; document.body.style.background = bg; clearInterval(t) }
  }, [])

  // Gentle parallax on fine pointers, one write per frame.
  useEffect(() => {
    const el = root.current
    if (!el || reduced() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0, px = 0, py = 0
    const move = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5
      py = e.clientY / window.innerHeight - 0.5
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--px', px.toFixed(3)); el.style.setProperty('--py', py.toFixed(3)) })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [])

  // Bubbles drift up from the water, a few at a time.
  useEffect(() => {
    if (reduced()) return
    let id = 0
    const spawn = () => {
      if (document.hidden) return
      setBubbles((b) => (b.length >= 7 ? b : [...b, { id: ++id, x: 6 + Math.random() * 88, size: 18 + Math.random() * 44, dur: 13 + Math.random() * 9, sway: (Math.random() - 0.5) * 80 }]))
    }
    spawn(); setTimeout(spawn, 900)
    const t = setInterval(spawn, 2300)
    return () => clearInterval(t)
  }, [])

  const plip = useCallback((size: number) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = (audio.current ??= new Ctx())
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime
      const f = 1400 - size * 12
      o.type = 'sine'
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      o.connect(g).connect(ctx.destination)
      o.start(t); o.stop(t + 0.14)
    } catch { /* sound is a bonus */ }
  }, [])

  const pop = (b: Bubble) => {
    if (b.popped) return
    plip(b.size)
    setPops((p) => p + 1)
    setBubbles((all) => all.map((x) => (x.id === b.id ? { ...x, popped: true } : x)))
    setTimeout(() => setBubbles((all) => all.filter((x) => x.id !== b.id)), 420)
  }

  const popLine = [...POPS].reverse().find(([n]) => pops >= n)?.[1] ?? 'Pop a bubble while you wait'
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const openNote = (el: HTMLElement) => setOpen((cur) => cur ?? el)
  const H1 = () => (<><span><b>Good things</b></span> <span><b>take a little time.</b></span></>)

  return (
    <div ref={root} className="ae" data-sky={sky}>
      <div className={`ae-scene ${open ? 'away' : ''}`}>
        <div className="ae-sky" aria-hidden="true">
          {SKIES.map((s) => <div key={s} className={`ae-layer ${s} ${s === sky ? 'on' : ''}`} />)}
          <div className="ae-stars" />
          <div className="ae-sun" /><div className="ae-moon" />
          <div className="ae-par p1"><div className="ae-cloud c1" /><div className="ae-cloud c2" /></div>
          <div className="ae-par p2"><div className="ae-cloud c3" /></div>
          <div className="ae-horizon" />
          <div className="ae-shimmer"><i /><i /><i /></div>
          <h2 className="ae-h1 ae-reflect"><H1 /></h2>
        </div>

        <div className="ae-bubbles">
          {bubbles.map((b) => (
            <span key={b.id} className="ae-rise" style={{ left: `${b.x}%`, ['--dur' as string]: `${b.dur}s`, ['--sway' as string]: `${b.sway}px` }}
              onAnimationEnd={(e) => { if (e.animationName === 'ae-float') setBubbles((all) => all.filter((x) => x.id !== b.id)) }}>
              <span className={`ae-bub ${b.popped ? 'pop' : ''}`} style={{ width: b.size, height: b.size }} onPointerDown={() => pop(b)} aria-hidden="true" />
            </span>
          ))}
        </div>

        <header className="ae-top">
          <span className="ae-brand"><Mark /> Desknoty</span>
          <div className="ae-pills">
            <button type="button" className="ae-pill ae-clock" onClick={() => setSky((s) => SKIES[(SKIES.indexOf(s) + 1) % SKIES.length])} aria-label={`Change the sky. Showing ${sky}.`}>
              <span className="ae-dial" aria-hidden="true"><i /></span>
              <span className="ae-pill-t"><span className="ae-hide-sm">Your sky · </span>{time}</span>
            </button>
            <span className="ae-pill ae-status"><i aria-hidden="true" /> <span className="ae-hide-sm">Under</span> construction</span>
          </div>
        </header>

        <main className="ae-main">
          <div className="ae-hero">
            <div className="ae-orbit" aria-hidden="true">
              <svg className="ae-ring" viewBox="0 0 200 200">
                <defs><path id="ae-circle" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" /></defs>
                <text><textPath href="#ae-circle" textLength="548">Building · Fixing the little things · Polishing · Worth the wait ·</textPath></text>
              </svg>
              <div className="ae-orb"><div className="ae-orb-in"><Mark size={92} /></div></div>
            </div>
            <h1 className="ae-h1"><H1 /></h1>
          </div>

          <div className="ae-below">
            <p className="ae-sub">Desknoty is still under construction. We’re fixing, improving and polishing the little details before welcoming everyone in.</p>
            <button type="button" className="ae-cta" onClick={(e) => openNote(e.currentTarget)} aria-haspopup="dialog">
              Read our little note
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <button type="button" className="ae-bottle" onClick={(e) => openNote(e.currentTarget)} aria-label="Open the message in a bottle" aria-haspopup="dialog">
            <span className="ae-bottle-tag" aria-hidden="true">A note for you</span>
            <span className="ae-bottle-bob"><Bottle /></span>
            <span className="ae-ripples" aria-hidden="true"><i /><i /></span>
          </button>
        </main>

        <footer className="ae-foot">
          <span className="ae-pops" aria-live="polite">{pops > 0 && <b>{pops}</b>}{popLine}</span>
          <span className="ae-motto">Somewhere between yesterday &amp; tomorrow</span>
        </footer>
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
