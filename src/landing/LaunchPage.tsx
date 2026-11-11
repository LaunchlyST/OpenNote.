import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import './launch.css'

/**
 * The Coming soon (Under construction) page for `/`, shown while the admin's
 * launch mode is "construction". A full-screen, three-act intro:
 *   1. the room: a blocky builder in a hard hat fixes a retro computer
 *   2. the camera zooms into the computer screen
 *   3. inside the screen: "Fixing Desknoty…" with a loading bar, then the
 *      message and Notify me (which joins the real waitlist)
 * Reduced motion skips straight to act 3. Replay runs it again.
 */
export type PreMode = 'construction'

type Act = 'room' | 'zoom' | 'screen'

const FIX_LINES = ['Connecting to desknoty.com', 'Tightening the calendar', 'Oiling the notebook hinges', 'Fitting the creator storefronts', 'Running final checks']

export function LaunchPage(_: { mode: PreMode }) {
  useDocumentMeta(`${SITE.name} · Coming soon`, 'Desknoty is still under construction. We’re building a better space to organise your ideas, plan your days, and bring your creativity to life.')
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [act, setAct] = useState<Act>(still ? 'screen' : 'room')
  const [run, setRun] = useState(0)
  // Tall screens (phones) show the whole room; the camera aims at the monitor either way.
  const [fit] = useState(() => {
    if (typeof window === 'undefined' || window.innerWidth >= window.innerHeight) return { mode: 'slice' as const, origin: '' }
    const sceneH = (window.innerWidth * 900) / 1600
    return { mode: 'meet' as const, origin: `50.6% ${50 + ((395 / 900 - 0.5) * 100 * sceneH) / window.innerHeight}%` }
  })
  useEffect(() => {
    if (still) return
    setAct('room')
    const t1 = window.setTimeout(() => setAct('zoom'), 3200)
    const t2 = window.setTimeout(() => setAct('screen'), 5000)
    return () => (window.clearTimeout(t1), window.clearTimeout(t2))
  }, [run, still])

  return (
    <div className={`cz cz-act-${act}`}>
      <div className="cz-stage" aria-hidden={act === 'screen'} style={fit.origin ? { transformOrigin: fit.origin } : undefined}>
        <Room fit={fit.mode} />
      </div>
      {act === 'screen' && <Screen key={run} still={still} onReplay={still ? undefined : () => setRun((n) => n + 1)} />}
      {act !== 'screen' && (
        <button type="button" className="cz-skip" onClick={() => setAct('screen')}>Skip intro</button>
      )}
    </div>
  )
}

/** Act 3: inside the computer. Fixing log + loading bar, then the message. */
function Screen({ still, onReplay }: { still: boolean; onReplay?: () => void }) {
  const [lines, setLines] = useState(still ? FIX_LINES.length : 0)
  const [pct, setPct] = useState(still ? 72 : 0)
  const ready = lines >= FIX_LINES.length
  useEffect(() => {
    if (still) return
    const t = window.setInterval(() => setLines((n) => (n >= FIX_LINES.length ? n : n + 1)), 420)
    const p = window.setInterval(() => setPct((v) => (v >= 72 ? 72 : v + 2)), 60)
    return () => (window.clearInterval(t), window.clearInterval(p))
  }, [still])
  return (
    <div className="cz-screen">
      <header className="cz-bar">
        <span className="cz-brand"><Logo /></span>
        <span className="cz-tag">Currently building</span>
      </header>
      <main className="cz-main">
        <section className="cz-plan" aria-label="Fixing Desknoty">
          <Blueprint step={lines} />
          <ul className="cz-log">
            {FIX_LINES.map((l, i) => (
              <li key={l} className={i < lines ? 'done' : i === lines ? 'now' : undefined}>
                <span className="cz-tick" aria-hidden="true">{i < lines ? '✓' : ''}</span>{l}
              </li>
            ))}
          </ul>
          <div className="cz-tape" role="progressbar" aria-label="Desknoty built so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="cz-tape-track"><i style={{ width: `${pct}%` }} /></div>
            <span>{pct}% built</span>
          </div>
        </section>

        <section className={ready ? 'cz-msg on' : 'cz-msg'} aria-live="polite">
          <h1>Desknoty is getting fixed up.</h1>
          <p className="cz-lead">We’re rebuilding the place where you plan your days, keep your notes and sell what you make. Leave your email and we’ll tell you the moment it opens.</p>
          <Notify />
        </section>
      </main>
      <footer className="cz-foot">
        <span>Made with care at desknoty.com</span>
        {onReplay && <button type="button" className="cs-invite" onClick={onReplay}>Replay the intro</button>}
        <InviteDoor />
      </footer>
    </div>
  )
}

/** The Desknoty "machine" drawn as a blueprint: calendar, notebook and shop, assembled step by step. */
function Blueprint({ step }: { step: number }) {
  const on = (n: number) => (step >= n ? 'cz-bp-on' : undefined)
  return (
    <svg className="cz-bp" viewBox="0 0 420 220" aria-hidden="true">
      {/* dimension lines */}
      <g className="cz-bp-dim"><path d="M20 206h380M20 200v12M400 200v12" /><text x="210" y="200">420 mm</text></g>
      {/* calendar */}
      <g className={on(1)}>
        <rect x="24" y="40" width="120" height="120" rx="8" />
        <path d="M24 70h120M52 30v20M116 30v20" />
        <path d="M44 92h20M76 92h20M108 92h20M44 116h20M76 116h20M108 116h20M44 140h20" className="cz-bp-thin" />
      </g>
      {/* notebook */}
      <g className={on(2)}>
        <rect x="162" y="56" width="104" height="132" rx="6" />
        <path d="M180 56v132" />
        <path d="M194 84h56M194 104h56M194 124h40" className="cz-bp-thin" />
        {[70, 100, 130, 160].map((y) => <circle key={y} cx="171" cy={y} r="3" />)}
      </g>
      {/* shop */}
      <g className={on(3)}>
        <path d="M284 92h112l-10-30H294z" />
        <rect x="290" y="92" width="100" height="96" rx="4" />
        <rect x="350" y="132" width="26" height="56" />
        <rect x="302" y="110" width="36" height="28" className="cz-bp-thin" />
      </g>
      {/* construction lines connect the parts */}
      <path className={on(4)} d="M144 100h18M266 120h18" strokeDasharray="4 4" />
      <g className={on(5)}><circle cx="394" cy="36" r="14" /><path d="M387 36l5 5 9-10" /></g>
    </svg>
  )
}

/**
 * Acts 1–2: the room. An original blocky builder (square head, hard hat,
 * overalls) taps a retro computer with a wrench; sparks fly. The whole scene
 * is one SVG so the camera can zoom into the screen.
 */
function Room({ fit }: { fit: 'slice' | 'meet' }) {
  return (
    <svg className="cz-room" viewBox="0 0 1600 900" preserveAspectRatio={`xMidYMid ${fit}`}>
      <defs>
        <radialGradient id="czGlow" cx="50%" cy="45%" r="55%"><stop offset="0" stopColor="#1d4ed8" stopOpacity=".55" /><stop offset="1" stopColor="#05070f" stopOpacity="0" /></radialGradient>
        <linearGradient id="czScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d5096" /><stop offset="1" stopColor="#123766" /></linearGradient>
        <linearGradient id="czDesk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b2a1e" /><stop offset="1" stopColor="#21160f" /></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#070a14" />
      <rect width="1600" height="900" fill="url(#czGlow)" />
      {/* window + stars */}
      <g opacity=".5"><rect x="1180" y="90" width="300" height="220" rx="8" fill="#0b1226" stroke="#1e293b" strokeWidth="8" /><path d="M1330 90v220M1180 200h300" stroke="#1e293b" strokeWidth="6" /><circle cx="1240" cy="140" r="3" fill="#fff" /><circle cx="1420" cy="250" r="2" fill="#fff" /><circle cx="1380" cy="130" r="2.5" fill="#fff" className="cz-twinkle" /></g>
      {/* desk */}
      <rect x="180" y="640" width="1240" height="40" rx="6" fill="url(#czDesk)" />
      <rect x="220" y="680" width="30" height="220" fill="#21160f" /><rect x="1350" y="680" width="30" height="220" fill="#21160f" />
      {/* tower */}
      <g><rect x="1040" y="330" width="170" height="310" rx="10" fill="#2b2f3a" /><rect x="1060" y="360" width="130" height="18" rx="3" fill="#1b1e26" /><rect x="1060" y="390" width="130" height="18" rx="3" fill="#1b1e26" /><circle cx="1080" cy="600" r="6" fill="#22c55e" className="cz-blink" /><circle cx="1100" cy="600" r="6" fill="#f97316" /></g>
      {/* monitor */}
      <g>
        <rect x="560" y="250" width="500" height="360" rx="26" fill="#c9c2ad" />
        <rect x="575" y="262" width="470" height="18" rx="9" fill="#ded8c4" />
        <rect x="610" y="290" width="400" height="270" rx="14" fill="#0b1020" />
        <rect x="622" y="300" width="376" height="250" rx="10" fill="url(#czScreen)" />
        {/* the screen shows a mini fixing animation already */}
        <g className="cz-mini">
          <rect x="650" y="330" width="320" height="26" rx="4" fill="#0f172a" opacity=".55" />
          <text x="666" y="349" fill="#eaf2fc" fontFamily="Geist, sans-serif" fontSize="17" fontWeight="650">Fixing Desknoty…</text>
          <rect x="650" y="372" width="230" height="10" rx="5" fill="#93c5fd" opacity=".6" />
          <rect x="650" y="392" width="180" height="10" rx="5" fill="#93c5fd" opacity=".45" />
          <rect x="650" y="412" width="250" height="10" rx="5" fill="#93c5fd" opacity=".35" />
          <rect x="650" y="500" width="320" height="16" rx="8" fill="#0f172a" opacity=".6" />
          <rect x="650" y="500" width="320" height="16" rx="4" fill="#ff7a1a" className="cz-minibar" />
        </g>
        <rect x="622" y="300" width="376" height="250" rx="10" fill="url(#czGlow)" opacity=".25" />
        <rect x="770" y="610" width="80" height="30" fill="#b3ac97" />
        <rect x="700" y="634" width="220" height="12" rx="6" fill="#a39c87" />
        {/* sticky note */}
        <rect x="1012" y="300" width="40" height="40" rx="3" fill="#fde047" transform="rotate(8 1032 320)" />
      </g>
      {/* keyboard + mug */}
      <rect x="600" y="650" width="380" height="26" rx="8" fill="#3a3d47" />
      <g><rect x="1250" y="580" width="56" height="62" rx="8" fill="#e7e5e4" /><path d="M1306 596c22 0 22 30 0 30" fill="none" stroke="#e7e5e4" strokeWidth="9" /><path className="cz-steam" d="M1268 568c-8-14 8-20 0-34M1288 568c-8-14 8-20 0-34" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" opacity=".6" /></g>

      {/* the builder: blocky toy-style figure, hard hat, wrench */}
      <g className="cz-builder">
        {/* legs + body */}
        <rect x="300" y="590" width="44" height="80" rx="6" fill="#1e3a8a" />
        <rect x="350" y="590" width="44" height="80" rx="6" fill="#1e3a8a" />
        <rect x="290" y="470" width="114" height="130" rx="12" fill="#f97316" />
        <rect x="310" y="470" width="20" height="130" fill="#fde68a" opacity=".85" />
        <rect x="364" y="470" width="20" height="130" fill="#fde68a" opacity=".85" />
        {/* head */}
        <rect x="312" y="392" width="72" height="72" rx="14" fill="#fcd9b6" />
        <rect x="334" y="420" width="9" height="12" rx="4" fill="#111827" className="cz-eye" />
        <rect x="356" y="420" width="9" height="12" rx="4" fill="#111827" className="cz-eye" />
        <path d="M336 444q14 10 28 0" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
        {/* hard hat */}
        <path d="M304 398q44-52 88 0z" fill="#facc15" />
        <rect x="296" y="392" width="104" height="12" rx="6" fill="#eab308" />
        <rect x="343" y="356" width="10" height="20" rx="4" fill="#eab308" />
        {/* back arm */}
        <rect x="280" y="480" width="26" height="90" rx="12" fill="#f97316" />
        {/* working arm with wrench, taps the monitor */}
        <g className="cz-arm">
          <rect x="390" y="482" width="130" height="26" rx="12" fill="#f97316" />
          <circle cx="526" cy="495" r="15" fill="#fcd9b6" />
          <g transform="translate(530 495) rotate(-35)">
            <rect x="0" y="-6" width="90" height="12" rx="6" fill="#9ca3af" />
            <path d="M88 -16a16 16 0 1 1 0 32l-8-8v-16z" fill="#9ca3af" />
          </g>
        </g>
      </g>
      {/* sparks where the wrench meets the monitor */}
      <g className="cz-sparks">
        <circle cx="600" cy="420" r="4" fill="#fde047" /><circle cx="612" cy="404" r="3" fill="#fb923c" /><circle cx="594" cy="440" r="3" fill="#fde047" /><path d="M604 412l14-10M600 428l18 2" stroke="#fde047" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------ notify --- */

function Notify() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('') // honeypot: people never see or fill it
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'again'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) input.current?.focus() }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'busy') return
    setErr(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Please enter a valid email address.')
    setState('busy')
    try {
      const res = await fetch(apiUrl('/api/waitlist'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), website: trap }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'We couldn’t save your email just now. Please try again.')
      setState(data.alreadyJoined ? 'again' : 'done')
    } catch (e2) {
      setErr(e2 instanceof TypeError ? 'We can’t reach the server right now. Please try again in a moment.' : (e2 as Error).message)
      setState('idle')
    }
  }

  if (state === 'done' || state === 'again')
    return (
      <div className="cs-done" role="status">
        <span className="cs-done-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="cs-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div>
          <b>{state === 'done' ? 'You’re on the list!' : 'You’re already on the list!'}</b>
          <p>We’ll let you know when Desknoty is ready.</p>
        </div>
      </div>
    )

  if (!open) return <button type="button" className="cs-btn" onClick={() => setOpen(true)}>Notify me</button>

  return (
    <form className="cs-form" onSubmit={submit} noValidate>
      <div className={err ? 'cs-field cs-field-err' : 'cs-field'}>
        <span aria-hidden="true">✉</span>
        <input ref={input} type="email" inputMode="email" autoComplete="email" placeholder="Enter your email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={state === 'busy'} maxLength={254} />
        <button type="submit" className="cs-btn" disabled={state === 'busy'}>
          {state === 'busy' ? <span className="cs-dots"><i /><i /><i /></span> : 'Notify me'}
        </button>
      </div>
      <input className="cs-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} />
      {err ? <p className="cs-err" role="alert">{err}</p> : <p className="cs-note">One email when we open. No spam.</p>}
    </form>
  )
}

/** "Have an invite code?": the code is checked by the server (POST /api/early-access). */
function InviteDoor() {
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open) return <button type="button" className="cs-invite" onClick={() => setOpen(true)}>Have an invite code?</button>
  return (
    <form
      className="cs-inviteform"
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
