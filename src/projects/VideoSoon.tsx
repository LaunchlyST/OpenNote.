import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'

/** Launch target for Video Projects. */
const LAUNCH = Date.parse('2027-01-15T09:00:00Z')
const KEY = 'desknoty.video.notify.v1'
const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

/** `preview`: the page-peel preview of this screen; inert and hidden from assistive tech. */
export function VideoSoon({ preview = false }: { preview?: boolean }) {
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

  const chips = [
    { t: 'REC', c: 'lime', x: 9, y: 28, r: -14, d: 0 },
    { t: '▶', c: 'yellow', x: 17, y: 52, r: 10, d: 1.2 },
    { t: '4K', c: 'dark', x: 8, y: 72, r: -8, d: 2.1 },
    { t: '✂', c: 'pink', x: 20, y: 84, r: 12, d: 0.6 },
    { t: 'CUT', c: 'lime', x: 84, y: 26, r: 12, d: 0.9 },
    { t: '♪', c: 'yellow', x: 78, y: 48, r: -10, d: 1.8 },
    { t: 'HD', c: 'pink', x: 88, y: 66, r: 8, d: 0.3 },
    { t: '⏺', c: 'dark', x: 76, y: 84, r: -12, d: 1.5 },
  ]
  return (
    <div className="vcs vs3" role={preview ? undefined : 'dialog'} aria-modal={preview ? undefined : true} aria-labelledby={preview ? undefined : 'vs3-t'} aria-hidden={preview || undefined} inert={preview || undefined}>
      <div className="vs3-tiles" aria-hidden="true" />
      {chips.map((c) => (
        <span
          key={c.t}
          aria-hidden="true"
          className={`vs3-chip vs3-${c.c}`}
          style={{ left: `${c.x}%`, top: `${c.y}%`, '--r': `${c.r}deg`, animationDelay: `${-c.d}s` } as CSSProperties}
        >
          <b>{c.t}</b>
        </span>
      ))}
      <div className="vs3-inner">
        <span className="vs3-brand">Desknoty Video</span>
        <div className="vs3-count" role="timer" aria-live="off">
          {parts.map(([n, l]) => (
            <div key={l} className="vs3-unit">
              <b>{pad(n)}</b>
              <small>{l}</small>
            </div>
          ))}
        </div>
        <h2 id={preview ? undefined : 'vs3-t'} className="vs3-title">
          Coming Soon
        </h2>
        <p className="vs3-sub">Plan every YouTube edit on a thumbnail-shaped card, with notes, checklists and links inside.</p>
        {done ? (
          <p className="vs3-done">You're on the list ✓</p>
        ) : (
          <form className="vs3-form" onSubmit={submit}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" aria-label="Email address" />
            <button type="submit">Notify me</button>
          </form>
        )}
      </div>
      <span className="vs3-hint">↑ Lift the bottom edge for My Projects</span>
    </div>
  )
}
