import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { SITE, useDocumentMeta } from './seo'
import './launch.css'

/**
 * The pre-launch page for `/`, in two moods picked by the admin's launch mode:
 *
 * - construction: "Something amazing is taking shape", with a Notify me button
 * - waitlist:     "Your next favourite workspace is almost here", email form open
 *
 * Both join the same waitlist (POST /api/waitlist). Success is only shown once
 * the server confirms the email was saved.
 *
 * The scene: a glowing pixel field behind (inspired by the reference clip's
 * green pixel mosaic) and an original pixel-art character building Desknoty
 * on a retro computer. Its eyes follow the pointer.
 */
export type PreMode = 'construction' | 'waitlist'

const COPY: Record<PreMode, { tag: string; title: string; sub: string; lead: string }> = {
  construction: {
    tag: '🚧 Currently building',
    title: 'Something amazing is taking shape.',
    sub: 'We’re not quite ready. But we’re getting closer.',
    lead: 'Desknoty is still under construction. We’re building a better space to organise your ideas, plan your days, and bring your creativity to life.',
  },
  waitlist: {
    tag: '✦ Waitlist open',
    title: 'Your next favourite workspace is almost here.',
    sub: 'Early access is coming soon.',
    lead: 'Join the Desknoty waitlist and be among the first to experience a new way to plan, create, and organise.',
  },
}

const FEATURES = [
  { icon: '📓', title: 'Digital Notebook', text: 'Pages for every idea, neatly organised.' },
  { icon: '🗓️', title: 'Smart Calendar & Tasks', text: 'Plan your days and never lose a to-do.' },
  { icon: '🛍️', title: 'Creator Storefronts', text: 'Sell your digital products from one link.' },
]

export function LaunchPage({ mode }: { mode: PreMode }) {
  const c = COPY[mode]
  useDocumentMeta(`${SITE.name} · ${mode === 'construction' ? 'Under construction' : 'Join the waitlist'}`, c.lead)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('desknoty.launch.theme') !== 'light' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('desknoty.launch.theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])

  return (
    <div className={`lp ${dark ? 'lp-dark' : 'lp-light'}`}>
      <PixelField dark={dark} />
      <header className="lp-top">
        <span className="lp-logo"><span className="lp-logo-mark">D</span> Desknoty</span>
        <button type="button" className="lp-theme" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
          {dark ? '☀︎' : '☾'}
        </button>
      </header>

      <main className="lp-main" key={mode}>
        <section className="lp-copy">
          <span className="lp-tag">{c.tag}</span>
          <h1>{c.title}</h1>
          <p className="lp-lead">{c.lead}</p>
          <p className="lp-sub">{c.sub}</p>
          <Signup mode={mode} />
        </section>
        <section className="lp-art" aria-hidden="true">
          <Scene />
        </section>
      </main>

      <section className="lp-features" aria-label="What’s coming">
        <h2>Plan. Create. Organise.</h2>
        <div className="lp-cards">
          {FEATURES.map((f, i) => (
            <article key={f.title} style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
              <span>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="lp-foot">
        <span>Made with care ♥ · desknoty.com</span>
        <InviteDoor />
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------ signup --- */

function Signup({ mode }: { mode: PreMode }) {
  const [open, setOpen] = useState(mode === 'waitlist')
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('') // honeypot: people never see or fill it
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'again'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(apiUrl('/api/waitlist/count')).then((r) => (r.ok ? r.json() : null)).then((d) => typeof d?.count === 'number' && setCount(d.count)).catch(() => {})
  }, [])
  useEffect(() => { if (open && mode === 'construction') input.current?.focus() }, [open, mode])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'busy') return
    setErr(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Please enter a valid email address.')
    setState('busy')
    try {
      const res = await fetch(apiUrl('/api/waitlist'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), website: trap }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'We couldn’t save your email just now. Please try again.')
      setState(data.alreadyJoined ? 'again' : 'done')
      if (!data.alreadyJoined) setCount((n) => (n == null ? n : n + 1))
    } catch (e2) {
      setErr(e2 instanceof TypeError ? 'We can’t reach the server right now. Please try again in a moment.' : (e2 as Error).message)
      setState('idle')
    }
  }

  if (state === 'done' || state === 'again')
    return (
      <div className="lp-done" role="status">
        <span className="lp-done-icon"><Check /></span>
        <div>
          <b>{state === 'done' ? 'You’re on the list!' : 'You’re already on the list!'}</b>
          <p>We’ll let you know when Desknoty is ready.</p>
        </div>
      </div>
    )

  if (!open)
    return (
      <div className="lp-cta">
        <button type="button" className="lp-btn" onClick={() => setOpen(true)}>🔔 Notify me</button>
      </div>
    )

  return (
    <form className="lp-form" onSubmit={submit} noValidate>
      <div className={`lp-field ${err ? 'lp-field-err' : ''}`}>
        <span aria-hidden="true">✉</span>
        <input ref={input} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={state === 'busy'} maxLength={254} />
        <button type="submit" className="lp-btn" disabled={state === 'busy'}>
          {state === 'busy' ? <span className="lp-dots"><i /><i /><i /></span> : mode === 'waitlist' ? 'Join waitlist' : 'Notify me'}
        </button>
      </div>
      <input className="lp-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />
      {err ? <p className="lp-err" role="alert">{err}</p> : <p className="lp-note">{count && count > 0 ? `${count.toLocaleString()} ${count === 1 ? 'person has' : 'people have'} joined already. ` : ''}No spam, just one email when we open.</p>}
    </form>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path className="lp-check-path" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** A small "Have an invite?" link: the code is checked by the server (POST /api/early-access). */
function InviteDoor() {
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open) return <button type="button" className="lp-invite" onClick={() => setOpen(true)}>Have an invite code?</button>
  return (
    <form
      className="lp-inviteform"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        try {
          const res = await fetch(apiUrl('/api/early-access'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.ok) throw new Error(data.error ?? 'That invite code is not valid.')
          navigate('/landing')
        } catch (e2) {
          setErr((e2 as Error).message)
        }
        setBusy(false)
      }}
    >
      <input aria-label="Invite code" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      <button type="submit" disabled={busy || !code.trim()}>{busy ? '…' : 'Enter'}</button>
      {err && <span role="alert">{err}</span>}
    </form>
  )
}

/* ------------------------------------------------------------- scene --- */

/** Glowing pixel mosaic: soft green blobs drift under a grid of squares. */
function PixelField({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cell = window.innerWidth < 640 ? 22 : 30
    let w = 0, h = 0, raf = 0
    const size = () => { w = cv.width = Math.ceil(window.innerWidth / cell); h = cv.height = Math.ceil(window.innerHeight / cell) }
    size()
    window.addEventListener('resize', size)
    const blobs = [
      { x: 0.25, y: 0.3, r: 0.22, sx: 0.00021, sy: 0.00017, c: [210, 255, 225] },
      { x: 0.7, y: 0.25, r: 0.18, sx: -0.00016, sy: 0.00023, c: [40, 200, 120] },
      { x: 0.5, y: 0.75, r: 0.2, sx: 0.00018, sy: -0.0002, c: [110, 235, 160] },
      { x: 0.1, y: 0.8, r: 0.14, sx: 0.00025, sy: 0.00012, c: [60, 220, 140] },
    ]
    const draw = (t: number) => {
      const data = ctx.createImageData(w, h)
      const base = dark ? [3, 10, 6] : [236, 246, 239]
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let r = base[0], g = base[1], b = base[2]
          for (const bl of blobs) {
            const bx = (Math.sin(t * bl.sx * 6.28 + bl.x * 9) * 0.35 + 0.5) * w
            const by = (Math.cos(t * bl.sy * 6.28 + bl.y * 9) * 0.35 + 0.5) * h
            const d = Math.hypot(x - bx, (y - by) * 1.1) / (bl.r * Math.max(w, h))
            const k = Math.max(0, 1 - d) ** 2 * (dark ? 0.9 : 0.45)
            r += (bl.c[0] - r) * k; g += (bl.c[1] - g) * k; b += (bl.c[2] - b) * k
          }
          const i = (y * w + x) * 4
          data.data[i] = r; data.data[i + 1] = g; data.data[i + 2] = b; data.data[i + 3] = 255
        }
      ctx.putImageData(data, 0, 0)
    }
    let last = 0
    const loop = (t: number) => {
      if (t - last > 60) { draw(t); last = t } // ~16fps is plenty for a slow glow
      raf = requestAnimationFrame(loop)
    }
    if (still) draw(4000)
    else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [dark])
  return (
    <div className="lp-field-bg" aria-hidden="true">
      <canvas ref={ref} />
      <div className="lp-grid" />
    </div>
  )
}

/** The pixel character at a retro computer. Eyes follow the pointer; it types, blinks and bobs. */
function Scene() {
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [react, setReact] = useState(false)
  const box = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width * 0.3), dy = e.clientY - (r.top + r.height * 0.42)
      const d = Math.hypot(dx, dy) || 1
      setLook({ x: Math.round((dx / d) * 1.4), y: Math.round((dy / d) * 1.2) })
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => (s + 1) % 4), 2600)
    return () => window.clearInterval(t)
  }, [])
  const P = 4 // one "pixel"
  const px = (x: number, y: number, w: number, h: number, fill: string, cls?: string) => <rect className={cls} x={x * P} y={y * P} width={w * P} height={h * P} fill={fill} />
  return (
    <div className="lp-scene">
      <div className="lp-float lp-note1">✎ ideas</div>
      <div className="lp-float lp-note2">✓ plan</div>
      <div className="lp-float lp-star1">✦</div>
      <div className="lp-float lp-star2">★</div>
      <div className="lp-float lp-star3">✧</div>
      <svg ref={box} viewBox="0 0 320 240" className="lp-svg" shapeRendering="crispEdges" onPointerEnter={() => setReact(true)} onPointerLeave={() => setReact(false)}>
        {/* desk */}
        {px(4, 50, 72, 3, '#7b5236')}
        {px(4, 53, 72, 2, '#5c3b25')}
        {px(8, 55, 3, 5, '#5c3b25')}
        {px(69, 55, 3, 5, '#5c3b25')}
        {/* mug */}
        <g className="lp-steam">{px(66, 39, 1, 2, '#ffffffaa')}{px(68, 37, 1, 3, '#ffffff88')}</g>
        {px(64, 43, 7, 7, '#e8f5ee')}
        {px(71, 45, 2, 3, '#e8f5ee')}
        {px(65, 44, 5, 2, '#2fd27e')}
        {/* computer */}
        {px(36, 20, 28, 24, '#e9dfc9')}
        {px(37, 21, 26, 2, '#f6efdf')}
        {px(39, 23, 22, 16, '#0b1f14')}
        <g className="lp-screen">
          {step === 0 && <>{px(42, 26, 3, 3, '#3cf08f')}{px(46, 27, 11, 1, '#3cf08f')}{px(42, 31, 16, 1, '#1f8a52')}{px(42, 33, 12, 1, '#1f8a52')}</>}
          {step === 1 && <>{px(41, 25, 8, 1, '#3cf08f')}<g className="lp-type">{px(41, 27, 14, 1, '#1f8a52')}{px(41, 29, 10, 1, '#1f8a52')}{px(41, 31, 16, 1, '#1f8a52')}{px(41, 33, 6, 1, '#3cf08f')}</g>{px(48, 33, 1, 1, '#3cf08f', 'lp-caret')}</>}
          {step === 2 && <>{px(41, 25, 8, 6, '#ffd166')}{px(50, 25, 9, 6, '#3cf08f')}{px(41, 32, 18, 3, '#7aa2ff')}</>}
          {step === 3 && <>{px(42, 27, 16, 1, '#3cf08f')}{px(42, 30, 16, 3, '#16402a')}<rect className="lp-bar" x={42 * P} y={30 * P} width={16 * P} height={3 * P} fill="#3cf08f" /></>}
        </g>
        {px(39, 23, 22, 16, 'url(#glow)')}
        {px(46, 44, 8, 3, '#d6ccb5')}
        {px(42, 47, 16, 2, '#c9bea6')}
        {/* keyboard */}
        {px(38, 48, 22, 2, '#bfb39a')}
        {/* character */}
        <g className={react ? 'lp-buddy lp-buddy-hi' : 'lp-buddy'}>
          {px(12, 28, 16, 14, '#ffb48a')}
          {px(11, 30, 1, 10, '#ffb48a')}
          {px(28, 30, 1, 10, '#ffb48a')}
          {px(12, 26, 16, 3, '#2b2b3a')}
          {px(10, 28, 2, 6, '#2b2b3a')}
          {px(28, 28, 2, 6, '#2b2b3a')}
          {px(10, 27, 20, 1, '#3cf08f')}
          {/* eyes */}
          <g className="lp-eyes">
            {px(15, 32, 3, 3, '#fff')}
            {px(22, 32, 3, 3, '#fff')}
            <g transform={`translate(${look.x * 2} ${look.y * 2})`}>{px(16, 33, 1, 1, '#1b1b25')}{px(23, 33, 1, 1, '#1b1b25')}</g>
          </g>
          {px(14, 37, 2, 1, '#ff8a80')}
          {px(25, 37, 2, 1, '#ff8a80')}
          {react ? px(18, 38, 4, 2, '#7a2e2e') : px(18, 38, 4, 1, '#7a2e2e')}
          {/* body + arms */}
          {px(13, 42, 14, 8, '#3cf08f')}
          {px(15, 43, 10, 1, '#2fd27e')}
          <g className="lp-arm-l">{px(26, 44, 10, 2, '#3cf08f')}{px(36, 45, 2, 2, '#ffb48a')}</g>
          <g className="lp-arm-r">{px(26, 46, 12, 2, '#2fd27e')}{px(38, 47, 2, 1, '#ffb48a')}</g>
        </g>
        {/* chair */}
        {px(10, 50, 18, 2, '#1d2b24')}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#3cf08f" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <div className="lp-progress" aria-hidden="true">
        <span>Building desknoty.com</span>
        <div><i /></div>
      </div>
    </div>
  )
}
