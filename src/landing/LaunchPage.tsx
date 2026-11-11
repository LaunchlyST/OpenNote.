import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import './launch.css'

/**
 * The Coming soon (Under construction) page for `/`, shown while the admin's
 * launch mode is "construction". Same look as the waitlist page: white sheet,
 * forest-green type. A line-art Desknoty town is built across the page —
 * a crane lifts a sticky note onto the calendar tower, a notebook house goes
 * up, a delivery truck rolls past — with a progress bar underneath.
 * Notify me joins the same waitlist (POST /api/waitlist); success is only
 * shown once the server confirms it.
 */
export type PreMode = 'construction'

export function LaunchPage(_: { mode: PreMode }) {
  useDocumentMeta(`${SITE.name} · Coming soon`, 'Desknoty is still under construction. We’re building a better space to organise your ideas, plan your days, and bring your creativity to life.')
  return (
    <div className="cs">
      <header className="cs-top">
        <Logo />
        <span className="cs-tag">🚧 Currently building</span>
      </header>

      <Town />

      <main className="cs-copy">
        <h1>
          <span>Something amazing</span>
          <span className="cs-green">is taking shape.</span>
        </h1>
        <p className="cs-lead">Desknoty is still under construction. We’re building a better space to organise your ideas, plan your days, and bring your creativity to life.</p>
        <Progress />
        <p className="cs-sub">We’re not quite ready. But we’re getting closer.</p>
        <Notify />
      </main>

      <section className="cs-features" aria-label="What’s coming">
        {[
          ['Digital Notebook', 'Pages for every idea, neatly organised.'],
          ['Smart Calendar & Tasks', 'Plan your days and never lose a to-do.'],
          ['Creator Storefronts', 'Sell your digital products from one link.'],
        ].map(([t, d], i) => (
          <article key={t} style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
            <b>{['Plan.', 'Create.', 'Organise.'][i]}</b>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </section>

      <footer className="cs-foot">
        <span>Made with care · desknoty.com</span>
        <InviteDoor />
      </footer>
    </div>
  )
}

/* ---------------------------------------------------------- progress --- */

function Progress() {
  const [pct, setPct] = useState(12)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setPct(72)
    const t = window.setInterval(() => setPct((p) => (p >= 72 ? 72 : p + 1)), 60)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="cs-progress" role="progressbar" aria-label="Building Desknoty" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div><i style={{ width: `${pct}%` }} /></div>
      <span>We are building Desknoty for you · {pct}%</span>
    </div>
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

  if (!open) return <button type="button" className="cs-btn" onClick={() => setOpen(true)}>Notify me <span aria-hidden="true">→</span></button>

  return (
    <form className="cs-form" onSubmit={submit} noValidate>
      <div className={err ? 'cs-field cs-field-err' : 'cs-field'}>
        <span aria-hidden="true">✉</span>
        <input ref={input} type="email" inputMode="email" autoComplete="email" placeholder="Enter your email" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} disabled={state === 'busy'} maxLength={254} />
        <button type="submit" className="cs-btn" disabled={state === 'busy'}>
          {state === 'busy' ? <span className="cs-dots"><i /><i /><i /></span> : <>Notify me <span aria-hidden="true">→</span></>}
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

/* -------------------------------------------------------------- town --- */

/** Line-art Desknoty town under construction. Pure SVG + CSS animation. */
function Town() {
  return (
    <div className="cs-town" aria-hidden="true">
      <svg viewBox="0 0 1200 230" preserveAspectRatio="xMidYMax meet">
        <g className="cs-ink">
          {/* clouds */}
          <g className="cs-cloud cs-cloud1"><path d="M90 52h70a14 14 0 0 0-14-16 18 18 0 0 0-32-6 14 14 0 0 0-24 22z" className="cs-fill" /></g>
          <g className="cs-cloud cs-cloud2"><path d="M820 40h56a11 11 0 0 0-11-13 15 15 0 0 0-26-5 11 11 0 0 0-19 18z" /></g>

          {/* trees */}
          <path d="M40 210l16-46 16 46z" className="cs-solid" /><path d="M56 210v8" />
          <path d="M70 210l12-34 12 34z" className="cs-solid" />

          {/* Calendar tower: finished */}
          <g className="cs-pop" style={{ animationDelay: '.1s' }}>
            <rect x="110" y="96" width="120" height="114" rx="6" className="cs-fill" />
            <rect x="110" y="96" width="120" height="26" rx="6" className="cs-solid" />
            <path d="M136 88v16M204 88v16" strokeWidth="5" />
            <text x="170" y="178" textAnchor="middle" className="cs-num">11</text>
            <path d="M126 196h88" />
            <rect x="198" y="186" width="22" height="24" className="cs-door" />
          </g>

          {/* Crane lifting a sticky note */}
          <g className="cs-crane">
            <path d="M268 210V58M256 210h24M268 58h150M268 76l20-18M268 96l20-20M268 116l20-20M268 136l20-20M268 156l20-20M268 176l20-20M268 196l20-20M288 210V76" />
            <path d="M268 58l-34 14h34" />
            <rect x="234" y="64" width="16" height="14" className="cs-solid" />
            <g className="cs-hook">
              <path d="M380 58v58" className="cs-rope" />
              <rect x="362" y="116" width="36" height="32" rx="3" className="cs-note" />
              <path d="M368 128h22M368 136h16" />
            </g>
          </g>

          {/* Notebook house: built line by line */}
          <g>
            <path className="cs-draw" style={{ animationDelay: '.6s' }} d="M440 210V128l70-44 70 44v82z" />
            <path className="cs-draw" style={{ animationDelay: '1.4s' }} d="M462 140h96M462 156h96M462 172h96M462 188h60" />
            <path className="cs-draw" style={{ animationDelay: '1s' }} d="M440 128h140" />
            <rect x="534" y="176" width="26" height="34" className="cs-door cs-pop" style={{ animationDelay: '2.2s' }} />
            <path d="M600 210V150M600 150h40M640 150v60M600 170h40M600 190h40M620 150v60" className="cs-scaffold" />
            <g className="cs-worker" style={{ animationDelay: '.3s' }}>
              <circle cx="620" cy="134" r="5" className="cs-solid" />
              <path d="M620 139v10M612 144l8-3 8 3M620 149l-4 1M620 149l4 1" />
              <path d="M614 129h12" strokeWidth="3" />
            </g>
          </g>

          {/* Storefront: a little shop with an awning */}
          <g className="cs-pop" style={{ animationDelay: '2.6s' }}>
            <rect x="690" y="140" width="104" height="70" rx="4" className="cs-fill" />
            <path d="M684 140h116l-8-24H692z" className="cs-solid" />
            <path d="M704 140v8M724 140v8M744 140v8M764 140v8M784 140v8" />
            <rect x="704" y="160" width="40" height="28" rx="2" />
            <rect x="756" y="168" width="24" height="42" className="cs-door" />
            <path d="M714 178l8-8 10 10 10-6" />
          </g>

          {/* Bricks waiting */}
          <path d="M840 210h40v-10h-40zM846 200h28v-10h-28z" className="cs-fill" />
          <g className="cs-worker" style={{ animationDelay: '1.1s' }}>
            <circle cx="900" cy="180" r="5" className="cs-solid" />
            <path d="M900 185v14M900 199l-5 11M900 199l5 11M892 190l8 2 9-6" />
            <path d="M894 175h12" strokeWidth="3" />
          </g>

          {/* Truck rolling past */}
          <g className="cs-truck">
            <path d="M0 0h70v-36H0zM70 0h28v-24l-10-12H70" className="cs-fill" transform="translate(0 200)" />
            <path d="M74 -24h16" transform="translate(0 200)" />
            <text x="35" y="187" textAnchor="middle" className="cs-truck-d">D</text>
            <circle cx="20" cy="203" r="8" className="cs-wheel" />
            <circle cx="82" cy="203" r="8" className="cs-wheel" />
          </g>

          {/* more trees + sun */}
          <path d="M1110 210l14-40 14 40z" className="cs-solid" /><path d="M1140 210l10-28 10 28z" className="cs-solid" />
          <circle cx="1010" cy="70" r="16" className="cs-sun" />

          {/* ground */}
          <path d="M0 210h1200" />
          <path d="M150 220h6M300 222h10M520 220h8M760 222h6M980 220h12" className="cs-dash" />
        </g>
      </svg>
    </div>
  )
}
