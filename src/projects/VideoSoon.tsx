import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

/** Launch target for Video Projects. */
const LAUNCH = Date.parse('2027-01-15T09:00:00Z')
const KEY = 'desknoty.video.notify.v1'
const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

export function VideoSoon() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, LAUNCH - now)
  const parts = [
    [Math.floor(left / 86400000), 'Days'],
    [Math.floor(left / 3600000) % 24, 'Hours'],
    [Math.floor(left / 60000) % 60, 'Minutes'],
    [Math.floor(left / 1000) % 60, 'Seconds'],
  ] as const

  const [email, setEmail] = useState('')
  const [done, setDone] = useState(() => {
    try {
      return !!localStorage.getItem(KEY)
    } catch {
      return false
    }
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return
    try {
      localStorage.setItem(KEY, email.trim())
    } catch {
      /* blocked */
    }
    setDone(true)
  }

  return (
    <div className="vcs vs2" role="dialog" aria-modal="true" aria-labelledby="vs2-t">
      <div className="vs2-noise" aria-hidden="true" />
      <div className="vs2-inner">
        <div className="vs2-stage" aria-hidden="true">
          <div className="vs2-screen">
            <span className="vs2-play" />
            <span className="vs2-bar">
              <i />
            </span>
          </div>
          <span className="vs2-beam" />
        </div>
        <h2 id="vs2-t" className="vs2-title">
          Coming Soon
        </h2>
        <p className="vs2-tag">Video Projects is on the way.</p>

        <p className="vs2-launch">Launching in</p>
        <div className="vs2-count" role="timer" aria-live="off">
          {parts.map(([n, l], i) => (
            <div key={l} className="vs2-unit">
              <b>{pad(n)}</b>
              <small>{l}</small>
              {i < 3 && <span className="vs2-colon" aria-hidden="true">:</span>}
            </div>
          ))}
        </div>

        {done ? (
          <p className="vs2-done">You're on the list ✓</p>
        ) : (
          <form className="vs2-form" onSubmit={submit}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Email address" />
            <button type="submit">Notify me</button>
          </form>
        )}
      </div>
      <span className="vs2-hint">↑ Lift the bottom edge for My Projects</span>
    </div>
  )
}
