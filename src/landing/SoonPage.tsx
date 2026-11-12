import { useCallback, useEffect, useRef, useState } from 'react'
import './soon.css'

/**
 * Coming soon: a little illustrated world under construction.
 * Shown at desknoty.com when Settings → Launch is "Under construction".
 * No sign-up and no way into the app from here.
 * Everything is hand-drawn inline SVG + CSS (no extra libraries).
 */

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SoonPage() {
  const world = useRef<HTMLDivElement>(null)
  const [letter, setLetter] = useState(false)
  useEffect(() => {
    const prev = document.title
    document.title = 'Desknoty is still being made ♡'
    const bg = document.body.style.background
    document.body.style.background = '#c8ff3d'
    return () => { document.title = prev; document.body.style.background = bg }
  }, [])
  // gentle layered parallax towards the pointer (mouse only)
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || reduced() || !world.current) return
    const r = world.current.getBoundingClientRect()
    world.current.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    world.current.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  return (
    <div className="lw">
      <Rough />
      <header className="lw-top">
        <a href="/" className="lw-logo" aria-label="Desknoty"><Mark /> <span>Desknoty</span></a>
      </header>

      <main>
        <section className="lw-hero" aria-labelledby="lw-h">
          <p className="lw-kicker"><span aria-hidden="true">✿</span> coming soon</p>
          <h1 id="lw-h" className="lw-h1">
            <span className="lw-psst">Psst…</span>
            <span className="lw-line">we’re still making</span>
            <span className="lw-line">something <span className="lw-special">special<Squiggle /></span>.</span>
          </h1>
          <p className="lw-sub">Desknoty is a little world in the making. We’re putting the finishing touches on a better place to think, plan, create and share.</p>
          <p className="lw-note">Good things take a little time ♡</p>
        </section>

        <div className="lw-world" ref={world} onPointerMove={move} onPointerLeave={() => { world.current?.style.setProperty('--px', '0'); world.current?.style.setProperty('--py', '0') }}>
          <Sky />
          <Hills />
          <Tree />
          <Workshop />
          <Flowers />
          <Walker />
          <Pencil />
          <Notebook />
          <Plane />
          <Butterfly />
          <Envelope onOpen={() => setLetter(true)} />
        </div>

      </main>

      <footer className="lw-foot">
        <span>© {new Date().getFullYear()} Desknoty · made slowly, with care</span>
      </footer>

      {letter && <Letter onClose={() => setLetter(false)} />}
    </div>
  )
}

/* ---------- drawing helpers ---------- */

/** A slightly wobbly line filter so every drawing looks hand-made. */
function Rough() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="lw-rough"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="2.2" /></filter>
      <filter id="lw-paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" /><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.25  0 0 0 0.08 0" /><feComposite in2="SourceGraphic" operator="in" /><feBlend in="SourceGraphic" mode="multiply" /></filter>
    </svg>
  )
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" className="lw-r">
      <rect x="4" y="6" width="24" height="22" rx="5" fill="#fffaf0" stroke="#2b2a22" strokeWidth="2.2" />
      <path d="M4 12h24" stroke="#2b2a22" strokeWidth="2.2" />
      <path d="M10 3v6M22 3v6" stroke="#2b2a22" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23" cy="23" r="4" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="1.6" />
    </svg>
  )
}

function Squiggle() {
  return (
    <svg className="lw-squig" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 13 C 30 4, 50 18, 78 10 S 130 4, 152 12 S 185 15, 197 7" fill="none" stroke="#c8ff3d" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

/* ---------- scenery ---------- */

function Sky() {
  return (
    <div className="lw-sky" aria-hidden="false">
      <svg className="lw-sun lw-r" viewBox="0 0 100 100" aria-hidden="true">
        <g stroke="#2b2a22" strokeWidth="2.5" strokeLinecap="round">{Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <path key={i} d={`M${50 + Math.cos(a) * 30} ${50 + Math.sin(a) * 30} L${50 + Math.cos(a) * 42} ${50 + Math.sin(a) * 42}`} /> })}</g>
        <circle cx="50" cy="50" r="22" fill="#ffd98a" stroke="#2b2a22" strokeWidth="2.5" />
        <path d="M42 50q2 3 4 0M54 50q2 3 4 0M45 58q5 4 10 0" fill="none" stroke="#2b2a22" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <Cloud className="lw-c1" />
      <Cloud className="lw-c2" small />
      <Cloud className="lw-c3" />
    </div>
  )
}

function Cloud({ className, small }: { className: string; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'happy' | 'gone'>('idle')
  const poke = () => {
    if (state !== 'idle') return
    setState('happy')
    window.setTimeout(() => setState('gone'), 700)
    window.setTimeout(() => setState('idle'), 9000)
  }
  return (
    <button type="button" className={`lw-cloud ${className} ${small ? 'sm' : ''} ${state}`} onClick={poke} aria-label="A sleepy little cloud">
      <svg viewBox="0 0 160 90" className="lw-r" aria-hidden="true">
        <path d="M30 72c-16 0-24-18-10-28 2-16 22-22 32-10 6-18 34-22 44-4 16-6 32 6 28 22 14 4 12 22-4 22z" fill="#fffaf0" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" />
        {state === 'idle'
          ? <path d="M66 56q4-3 8 0M88 56q4-3 8 0" fill="none" stroke="#2b2a22" strokeWidth="2.6" strokeLinecap="round" />
          : <><circle cx="70" cy="55" r="3" fill="#2b2a22" /><circle cx="92" cy="55" r="3" fill="#2b2a22" /><path d="M74 63q7 7 14 0" fill="none" stroke="#2b2a22" strokeWidth="2.6" strokeLinecap="round" /><circle cx="62" cy="62" r="4" fill="#f6b8c8" /><circle cx="100" cy="62" r="4" fill="#f6b8c8" /></>}
      </svg>
    </button>
  )
}

function Hills() {
  return (
    <svg className="lw-hills lw-r" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
      <path className="lw-h3" d="M0 190 C 180 120, 330 150, 470 130 S 760 80, 930 140 S 1260 110, 1440 150 V420 H0z" fill="#cfe8b0" stroke="#2b2a22" strokeWidth="3" />
      <path className="lw-h2" d="M0 260 C 160 210, 300 230, 520 200 S 880 260, 1080 210 S 1340 200, 1440 230 V420 H0z" fill="#a9d98a" stroke="#2b2a22" strokeWidth="3" />
      <path className="lw-h1" d="M0 330 C 220 290, 420 330, 640 300 S 1020 270, 1200 310 S 1380 300, 1440 300 V420 H0z" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="3" />
      <g stroke="#2b2a22" strokeWidth="2" strokeLinecap="round" opacity=".5">
        <path d="M120 360l6-8M140 372l5-9M380 350l6-9M860 340l5-8M1100 352l6-9M1300 340l5-8" />
      </g>
      <path d="M560 420 C 600 380, 700 360, 760 330" fill="none" stroke="#2b2a22" strokeWidth="2.5" strokeDasharray="2 12" strokeLinecap="round" />
    </svg>
  )
}

function Tree() {
  const [flip, setFlip] = useState(false)
  return (
    <div className="lw-tree">
      <svg viewBox="0 0 200 260" className="lw-r" aria-hidden="true">
        <path d="M96 250c2-50-4-90 2-130M98 170c-16-10-24-18-30-30M100 150c14-8 22-18 26-32" fill="none" stroke="#2b2a22" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 120c-26-10-20-50 8-52 0-30 40-44 58-22 20-18 58-6 56 22 26 4 30 44 4 52-4 20-34 26-48 12-14 14-46 10-50-10-10 4-24 2-28-2z" fill="#9fd47e" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" />
        <g fill="#f6b8c8" stroke="#2b2a22" strokeWidth="1.6"><circle cx="70" cy="70" r="5" /><circle cx="130" cy="58" r="5" /><circle cx="150" cy="100" r="5" /><circle cx="60" cy="108" r="4" /></g>
        <path d="M128 118v22" stroke="#2b2a22" strokeWidth="1.5" />
      </svg>
      <button type="button" className={`lw-cal ${flip ? 'flip' : ''}`} onClick={() => setFlip(!flip)} aria-label="A little calendar hanging from the tree">
        <svg viewBox="0 0 60 62" className="lw-r" aria-hidden="true">
          <rect x="4" y="8" width="52" height="50" rx="6" fill="#fffaf0" stroke="#2b2a22" strokeWidth="2.4" />
          <rect x="4" y="8" width="52" height="14" rx="6" fill="#f6b8c8" stroke="#2b2a22" strokeWidth="2.4" />
          <circle cx="30" cy="5" r="3" fill="none" stroke="#2b2a22" strokeWidth="2" />
          <text x="30" y="48" textAnchor="middle" className="lw-cal-t">{flip ? 'soon' : '?'}</text>
        </svg>
      </button>
    </div>
  )
}

function Workshop() {
  return (
    <div className="lw-shop" aria-label="The tiny Desknoty workshop: still making magic inside" role="img">
      <svg viewBox="0 0 240 220" className="lw-r" aria-hidden="true">
        <path className="lw-smoke" d="M178 44c-6-10 6-14 2-24s6-14 4-20" fill="none" stroke="#2b2a22" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="166" y="44" width="22" height="38" fill="#e9a98b" stroke="#2b2a22" strokeWidth="3" />
        <path d="M20 112 L120 38 L222 112z" fill="#e97f6b" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" />
        <rect x="36" y="108" width="170" height="104" fill="#fff4dc" stroke="#2b2a22" strokeWidth="3" />
        <rect x="104" y="146" width="36" height="66" rx="16" fill="#8b6f5a" stroke="#2b2a22" strokeWidth="3" />
        <circle cx="132" cy="182" r="3" fill="#2b2a22" />
        <rect className="lw-win" x="54" y="128" width="34" height="30" rx="4" fill="#ffe28a" stroke="#2b2a22" strokeWidth="3" />
        <rect className="lw-win w2" x="156" y="128" width="34" height="30" rx="4" fill="#ffe28a" stroke="#2b2a22" strokeWidth="3" />
        <path d="M71 128v30M54 143h34M173 128v30M156 143h34" stroke="#2b2a22" strokeWidth="2" />
        <circle cx="120" cy="86" r="12" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="2.5" />
        <path d="M114 86l4 4 8-8" fill="none" stroke="#2b2a22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="lw-sign">Still making magic inside…</span>
      <span className="lw-spark s1">✦</span><span className="lw-spark s2">✧</span>
    </div>
  )
}

function Flowers() {
  const spots = ['f1', 'f2', 'f3', 'f4', 'f5']
  const colours = ['#f6b8c8', '#ffd98a', '#bfe3f0', '#f6b8c8', '#ffd98a']
  return (
    <>
      {spots.map((s, i) => (
        <span key={s} className={`lw-flower ${s}`} tabIndex={0} aria-label="A little flower">
          <svg viewBox="0 0 60 90" className="lw-r" aria-hidden="true">
            <path d="M30 88c0-20 2-36 0-50M30 70c-8-2-14-8-16-14M30 62c8-2 12-8 14-14" fill="none" stroke="#2b2a22" strokeWidth="2.6" strokeLinecap="round" />
            <g className="lw-petals" style={{ transformOrigin: '30px 28px' }}>
              {Array.from({ length: 6 }, (_, k) => <ellipse key={k} cx="30" cy="15" rx="7" ry="11" fill={colours[i]} stroke="#2b2a22" strokeWidth="2" transform={`rotate(${k * 60} 30 28)`} />)}
            </g>
            <circle cx="30" cy="28" r="6" fill="#ffd98a" stroke="#2b2a22" strokeWidth="2" />
          </svg>
        </span>
      ))}
    </>
  )
}

function Walker() {
  return (
    <div className="lw-walker" aria-hidden="true">
      <svg viewBox="0 0 70 90" className="lw-r">
        <g className="lw-legs" stroke="#2b2a22" strokeWidth="3" strokeLinecap="round"><path className="l1" d="M28 70v16" /><path className="l2" d="M42 70v16" /></g>
        <path d="M14 46c0-20 12-32 22-32s22 12 22 32-10 26-22 26-22-6-22-26z" fill="#bfe3f0" stroke="#2b2a22" strokeWidth="3" />
        <circle cx="30" cy="38" r="2.6" fill="#2b2a22" /><circle cx="44" cy="38" r="2.6" fill="#2b2a22" />
        <path d="M33 46q4 4 8 0" fill="none" stroke="#2b2a22" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="26" cy="45" r="3" fill="#f6b8c8" /><circle cx="48" cy="45" r="3" fill="#f6b8c8" />
        <rect x="40" y="48" width="22" height="18" rx="3" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="2.6" transform="rotate(-10 51 57)" />
        <path d="M44 52h12M44 57h10" stroke="#2b2a22" strokeWidth="1.6" transform="rotate(-10 51 57)" />
      </svg>
    </div>
  )
}

function Pencil() {
  return (
    <div className="lw-pencil" aria-hidden="true">
      <svg viewBox="0 0 160 90" className="lw-r">
        <path className="lw-doodle" d="M20 60 C 30 20, 60 20, 64 48 C 68 20, 98 20, 104 56 C 110 76, 130 70, 140 52" fill="none" stroke="#2b2a22" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 24 70" className="lw-pen lw-r">
        <path d="M6 4h12v48l-6 14-6-14z" fill="#ffd98a" stroke="#2b2a22" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M6 4h12v8H6z" fill="#f6b8c8" stroke="#2b2a22" strokeWidth="2.4" />
        <path d="M8 56l4 10 4-10" fill="#e9c9a6" stroke="#2b2a22" strokeWidth="2" />
      </svg>
    </div>
  )
}

function Notebook() {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return; const t = window.setTimeout(() => setOpen(false), 4200); return () => window.clearTimeout(t) }, [open])
  return (
    <div className="lw-book">
      <button type="button" className={open ? 'on' : ''} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="A little notebook">
        <svg viewBox="0 0 80 60" className="lw-r" aria-hidden="true">
          <path d="M6 14c12-6 22-6 34 2 12-8 22-8 34-2v40c-12-6-22-6-34 2-12-8-22-8-34-2z" fill="#fffaf0" stroke="#2b2a22" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M40 16v40" stroke="#2b2a22" strokeWidth="2" />
          <path d="M14 26h18M14 33h16M48 26h18M48 33h14" stroke="#cbbfa6" strokeWidth="2" strokeLinecap="round" />
          <path d="M70 6v14l-4-3-4 3V6" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
      <p className={`lw-bubble ${open ? 'on' : ''}`} role="status">{open ? 'Every big idea starts somewhere.' : ''}</p>
    </div>
  )
}

function Plane() {
  const [fly, setFly] = useState(false)
  const go = () => {
    if (fly) return
    setFly(true)
    window.setTimeout(() => setFly(false), reduced() ? 300 : 3400)
  }
  return (
    <button type="button" className={`lw-plane ${fly ? 'fly' : ''}`} onClick={go} aria-label="A paper aeroplane. Tap to send it flying">
      <svg viewBox="0 0 80 50" className="lw-r" aria-hidden="true">
        <path d="M4 26 L76 6 L44 44 L36 30z" fill="#fffaf0" stroke="#2b2a22" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M36 30 L76 6" stroke="#2b2a22" strokeWidth="2" />
        <path d="M36 30 L38 42 L44 44" fill="#e8e0cc" stroke="#2b2a22" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Butterfly() {
  return (
    <div className="lw-fly" aria-hidden="true">
      <svg viewBox="0 0 40 30" className="lw-r">
        <g className="lw-wing l"><path d="M20 15 C 8 0, 0 6, 4 14 C 0 22, 10 28, 20 15z" fill="#f6b8c8" stroke="#2b2a22" strokeWidth="1.8" /></g>
        <g className="lw-wing r"><path d="M20 15 C 32 0, 40 6, 36 14 C 40 22, 30 28, 20 15z" fill="#ffd98a" stroke="#2b2a22" strokeWidth="1.8" /></g>
        <path d="M20 9v14" stroke="#2b2a22" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/* ---------- the envelope in the scene ---------- */

function EnvelopeArt({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 240 160" className="lw-env-svg lw-r" aria-hidden="true">
      <path d="M8 22 Q 6 14 14 12 L226 10 Q 234 12 232 20 L234 146 Q 232 152 224 152 L16 154 Q 8 152 8 144z" fill="#fbf3e2" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 150 L104 86 Q 120 76 136 86 L232 150" fill="none" stroke="#2b2a22" strokeWidth="2.6" strokeLinejoin="round" />
      {!open && <path d="M10 14 L106 92 Q 120 102 134 92 L230 12" fill="#f3e8d2" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" />}
      <g transform="translate(184 22)">
        <rect width="36" height="42" rx="3" fill="#c8ff3d" stroke="#2b2a22" strokeWidth="2.2" strokeDasharray="3 2" />
        <rect x="9" y="9" width="18" height="16" rx="3" fill="#fffaf0" stroke="#2b2a22" strokeWidth="1.8" />
        <path d="M9 14h18" stroke="#2b2a22" strokeWidth="1.6" />
        <text x="18" y="37" textAnchor="middle" className="lw-stamp-t">DN</text>
      </g>
      <path d="M120 112 c -8 -10 -22 -2 -14 8 l 14 12 l 14 -12 c 8 -10 -6 -18 -14 -8z" fill="#f28ca5" stroke="#2b2a22" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  )
}

function Envelope({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="lw-env-spot">
      <button type="button" className="lw-env" onClick={onOpen} aria-haspopup="dialog" aria-label="A little letter for you. Open it">
        <EnvelopeArt />
      </button>
      <span className="lw-env-label" aria-hidden="true">A little letter for you ♡</span>
      <svg className="lw-arrow lw-r" viewBox="0 0 80 60" aria-hidden="true"><path d="M70 6 C 50 10, 30 22, 20 46 M20 46 l-2 -14 M20 46 l 12 -6" fill="none" stroke="#2b2a22" strokeWidth="2.6" strokeLinecap="round" /></svg>
    </div>
  )
}

/* ---------- the letter ---------- */

const LETTER = [
  'Hey there!',
  'We owe you a little update.',
  'Desknoty is taking a bit longer than we originally hoped, and we’re sorry to keep you waiting.',
  'We’ve been working behind the scenes, building, testing, fixing little things and making sure everything feels just right.',
  'We don’t want to rush something that deserves to be special.',
  'Our dream is to create a little space where your ideas can grow, your days feel more organised, and your creativity has somewhere to belong.',
  'We’re getting closer, one little improvement at a time.',
  'Thank you for being patient with us. It really means a lot.',
  'We can’t wait to show you what we’ve been making.',
]

type Phase = 'arrive' | 'flap' | 'slide' | 'unfold' | 'read' | 'closing'

function Letter({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(reduced() ? 'read' : 'arrive')
  const closeBtn = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const at = (ms: number, p: Phase) => timers.current.push(window.setTimeout(() => setPhase(p), ms))
  useEffect(() => {
    if (!reduced()) { at(450, 'flap'); at(1000, 'slide'); at(1750, 'unfold'); at(2500, 'read') }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { timers.current.forEach(clearTimeout); document.body.style.overflow = prev }
  }, [])
  useEffect(() => { if (phase === 'read') closeBtn.current?.focus() }, [phase])
  const close = useCallback(() => {
    if (reduced()) return onClose()
    timers.current.forEach(clearTimeout)
    setPhase('closing')
    window.setTimeout(onClose, 900)
  }, [onClose])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [close])

  return (
    <div className={`lt ph-${phase}`} role="dialog" aria-modal="true" aria-label="A little note from Desknoty">
      <div className="lt-dim" onClick={close} />
      <div className="lt-stage">
        <div className="lt-env lt-e-back"><div className="lt-back"><EnvelopeArt open /></div></div>
        <div className="lt-env lt-e-front" aria-hidden="true">
          <div className="lt-front">
            <svg viewBox="0 0 240 160" className="lw-r"><path d="M8 24 L104 92 Q 120 102 136 92 L232 22 L234 146 Q 232 152 224 152 L16 154 Q 8 152 8 144z" fill="#fbf3e2" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" /><path d="M120 128 c -8 -10 -22 -2 -14 8 l 14 12 l 14 -12 c 8 -10 -6 -18 -14 -8z" fill="#f28ca5" stroke="#2b2a22" strokeWidth="2.4" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <div className="lt-env lt-e-flap" aria-hidden="true">
          <div className="lt-flap">
            <svg viewBox="0 0 240 100" className="lw-r" aria-hidden="true"><path d="M10 6 L106 84 Q 120 94 134 84 L230 4" fill="#f3e8d2" stroke="#2b2a22" strokeWidth="3" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <article className="lt-paper">
          <div className="lt-fold lt-fold-top" aria-hidden="true" />
          <div className="lt-fold lt-fold-bot" aria-hidden="true" />
          <div className="lt-body">
            <button ref={closeBtn} type="button" className="lt-x" onClick={close} aria-label="Fold the letter away">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
            <h2 className="lt-title">A little note from Desknoty ♡</h2>
            {LETTER.map((p, i) => <p key={i} className="lt-p" style={{ ['--d' as string]: `${i * 120}ms` }}>{p}</p>)}
            <p className="lt-sign" style={{ ['--d' as string]: `${LETTER.length * 120}ms` }}>With love,<br />The Desknoty Team ♡</p>
            <p className="lt-ps" style={{ ['--d' as string]: `${(LETTER.length + 1) * 120}ms` }}>P.S. The best things are worth waiting for.</p>
          </div>
        </article>
        <div className="lt-hearts" aria-hidden="true">{['♡', '✦', '♡', '✧', '♡', '✦'].map((h, i) => <span key={i} className={`h${i}`}>{h}</span>)}</div>
      </div>
    </div>
  )
}

export default SoonPage
