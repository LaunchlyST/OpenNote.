import { useState } from 'react'
import type { FormEvent } from 'react'

const KEY = 'desknoty.video.notify.v1'

/**
 * Pro → Video: Coming Soon. The same component is the live route and the
 * page-peel preview (`preview`: inert, not announced). Content sits in the
 * lower half so it shows early as the sheet lifts from the bottom edge, and
 * the preview and the route share one fixed layout so nothing jumps.
 */
export function VideoSoon({ preview = false }: { preview?: boolean }) {
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
    <section
      className="vso"
      aria-labelledby={preview ? undefined : 'vso-t'}
      aria-hidden={preview || undefined}
      inert={preview || undefined}
    >
      <div className="vso-glow" aria-hidden="true" />
      <div className="vso-inner">
        <h1 id={preview ? undefined : 'vso-t'} className="vso-title">
          Video Projects
          <em>coming soon</em>
        </h1>
        <p className="vso-sub">Plan every YouTube edit on a thumbnail-shaped card, with notes, checklists and links inside.</p>
        {done ? (
          <p className="vso-done">You’re on the list. We’ll email you when it opens.</p>
        ) : (
          <form className="vso-form" onSubmit={submit}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Email address" tabIndex={preview ? -1 : undefined} />
            <button type="submit" tabIndex={preview ? -1 : undefined}>
              Notify me
            </button>
          </form>
        )}
      </div>
      <div className="vso-foot">
        <span className="vso-badge">
          <i /> Video · Coming soon
        </span>
        <span className="vso-hint">Lift the bottom edge to go back</span>
      </div>
    </section>
  )
}
