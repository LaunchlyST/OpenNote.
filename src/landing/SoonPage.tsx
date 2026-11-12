import { useEffect, useRef, useState } from 'react'
import { Logo } from './components/primitives'
import { apiUrl } from '../lib/api-base'
import './soon.css'

/**
 * Coming soon / Under construction page. Shown at desknoty.com when
 * Settings → Launch is "Coming soon". Separate from the full homepage
 * (NewHome), which stays hidden until Public launch. Uses the same waitlist
 * endpoint and list as the original waitlist page. Sign-ups stay closed.
 */
export function SoonPage() {
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.title
    document.title = 'Desknoty is coming soon'
    return () => void (document.title = prev)
  }, [])
  // the build scene leans gently towards the pointer (mouse only, not with reduced motion)
  const lean = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !stage.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = stage.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    stage.current.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`)
    stage.current.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`)
  }
  return (
    <div className="sn">
      <header className="sn-top">
        <Logo size="sm" tone="paper" />
        <a href="/app/signin" className="sn-signin">Sign in</a>
      </header>

      <main className="sn-main">
        <section className="sn-copy">
          <p className="sn-pill"><i aria-hidden="true" /> Coming soon</p>
          <h1 className="sn-h1">
            <span className="sn-l"><span>Something amazing</span></span>
            <span className="sn-l"><span>is taking shape.</span></span>
          </h1>
          <p className="sn-sub">We’re building a better way to organise your ideas, plan your days and create something extraordinary.</p>
          <JoinForm />
          <ul className="sn-tags" aria-label="What Desknoty brings together">
            <li>Notes</li><li>Calendar</li><li>Tasks</li><li>Creator store</li>
          </ul>
        </section>

        <div className="sn-stage" ref={stage} onPointerMove={lean} onPointerLeave={() => { stage.current?.style.setProperty('--rx', '0deg'); stage.current?.style.setProperty('--ry', '0deg') }} aria-hidden="true">
          <BuildScene />
        </div>
      </main>

      <footer className="sn-foot">
        <span>© {new Date().getFullYear()} Desknoty</span>
        <span>Already have an account? <a href="/app/signin">Sign in</a></span>
      </footer>
    </div>
  )
}

/** A desk being assembled: blueprint grid, a crane lowering panels into place, a scanning line. No numbers, no fake progress. */
function BuildScene() {
  return (
    <div className="sn-scene">
      <div className="sn-plate">
        <div className="sn-grid" />
        <div className="sn-scan" />
        {/* panels that drop into place one after another, then reset */}
        <div className="sn-panel sn-p1"><b>Notes</b><span /><span /><span className="short" /></div>
        <div className="sn-panel sn-p2"><b>Week</b><div className="sn-cal">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i === 4 || i === 9 ? 'on' : ''} />)}</div></div>
        <div className="sn-panel sn-p3"><b>Today</b><em className="done" /><em className="done" /><em /></div>
        <div className="sn-panel sn-p4"><b>Store</b><div className="sn-shop"><i /><i /></div></div>
        <div className="sn-cursor"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 3l14 8-6 2-2 6z" /></svg></div>
      </div>
      <div className="sn-crane"><span className="sn-rope" /><span className="sn-hook" /></div>
      <p className="sn-caption"><span className="sn-dot" /> Under construction</p>
    </div>
  )
}

function JoinForm() {
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'again'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'busy') return
    setErr(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Enter a valid email address, like jane@example.com.')
    setState('busy')
    try {
      const res = await fetch(apiUrl('/api/waitlist'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), website: trap }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'We couldn’t save your email. Try again in a minute.')
      setState(data.alreadyJoined ? 'again' : 'done')
    } catch (e2) {
      setErr(e2 instanceof TypeError ? 'We can’t reach the server right now. Try again in a moment.' : (e2 as Error).message)
      setState('idle')
    }
  }
  if (state === 'done' || state === 'again')
    return (
      <div className="sn-done" role="status">
        <span className="sn-tick"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <div>
          <b>{state === 'done' ? 'You’re on the list.' : 'You’re already on the list.'}</b>
          <p>We’ll email {email.trim()} as soon as Desknoty opens.</p>
        </div>
      </div>
    )
  return (
    <form className="sn-form" onSubmit={submit} noValidate>
      <label className="sn-sr" htmlFor="sn-email">Email address</label>
      <input id="sn-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(err)} aria-describedby={err ? 'sn-err' : undefined} required />
      <input className="sn-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} />
      <button type="submit" disabled={state === 'busy'}>{state === 'busy' ? 'Joining…' : 'Join the waitlist'}</button>
      {err && <p id="sn-err" className="sn-err" role="alert">{err}</p>}
    </form>
  )
}

export default SoonPage
