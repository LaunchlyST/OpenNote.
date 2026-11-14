import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AppIcon } from './components/primitives'
import { useDocumentMeta } from './seo'
import { LakeScene } from './maintenance/LakeScene'
import './maintenance.css'

/**
 * The maintenance page at `/` while Desknoty is being rebuilt.
 *
 * One painted lake, one sentence, one paper invitation. Opening the invitation
 * pushes the camera across the water and unfolds the developer's note over it.
 * The page owns no data and calls no API: every control here is local, so the
 * app behind it (routes, auth, calendars, notes) is untouched.
 *
 * The lake is pure SVG with CSS motion, so the first painted frame is already
 * the finished scene. There is nothing to download and nothing to fail.
 */

export function MaintenancePage() {
  useDocumentMeta(
    'Desknoty — Under construction',
    'Desknoty is not ready yet. We are fixing issues, improving the experience, and giving the details the care they deserve.',
  )

  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [hidden, setHidden] = useState(false)

  const dialog = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pushed = useRef(false)
  const wasOpen = useRef(false)

  /* Let the first frame paint before the water starts moving. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  /* Reduced motion is read live, so changing it mid-visit is respected. */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  /* Stop the water and the canoe while the tab is in the background. */
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  /* Browser Back returns to the lake instead of leaving the reader trapped. */
  useEffect(() => {
    const onPop = () => {
      pushed.current = false
      setOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openNote = useCallback(() => {
    if (open) return
    pushed.current = true
    window.history.pushState({ mntNote: true }, '')
    setOpen(true)
  }, [open])

  const closeNote = useCallback(() => {
    if (!open) return
    if (pushed.current) window.history.back()
    else setOpen(false)
  }, [open])

  /* Lock the page behind the note, then move focus into it once it is open. */
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const settle = window.setTimeout(
      () => {
        dialog.current?.focus()
        dialog.current?.querySelector('.mnt-letter')?.scrollTo({ top: 0 })
      },
      reduced ? 90 : 2300,
    )
    return () => {
      window.clearTimeout(settle)
      document.body.style.overflow = previous
    }
  }, [open, reduced])

  /* Closing returns focus to the invitation, unless focus was never inside. */
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus()
    wasOpen.current = open
  }, [open])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      closeNote()
    }
  }

  return (
    <div
      className={[
        'mnt',
        open ? 'is-open' : '',
        reduced ? 'is-reduced' : '',
        ready ? 'is-ready' : '',
        hidden ? 'is-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onKeyDown={onKeyDown}
    >
      <a className="mnt-skip" href="#mnt-main">
        Skip to the message
      </a>

      <LakeScene />
      <div className="mnt-vignette" aria-hidden="true" />
      <div className="mnt-grain" aria-hidden="true" />

      <div className="mnt-ui" inert={open || undefined}>
        <header className="mnt-head">
          <span className="mnt-brand">
            {/* The Pro dashboard rail's mark and wordmark, unchanged. */}
            <AppIcon className="mnt-mark" />
            <span className="mnt-word">Desknoty</span>
          </span>
          <span className="mnt-status">
            <span className="mnt-status-dot" aria-hidden="true" />
            Under construction
          </span>
        </header>

        <main className="mnt-main" id="mnt-main">
          <div className="mnt-copy">
            <h1 className="mnt-h1">Good things take a little time.</h1>
            <p className="mnt-lead">
              Desknoty isn’t ready just yet. We’re fixing issues, improving the experience, and
              giving the details the care they deserve.
            </p>
          </div>

          <button
            ref={trigger}
            type="button"
            className="mnt-invite"
            onClick={openNote}
            aria-haspopup="dialog"
          >
            <span className="mnt-invite-kicker">For you</span>
            <span className="mnt-invite-title">A little note from the developer</span>
            <span className="mnt-invite-cta">
              Open the note
              <span className="mnt-invite-arrow" aria-hidden="true">
                ↗
              </span>
            </span>
          </button>
        </main>

        <footer className="mnt-foot">
          <span>Desknoty is under construction.</span>
          <span>Thanks for stopping by.</span>
        </footer>
      </div>

      <div
        ref={dialog}
        className="mnt-note"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mnt-note-title"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
      >
        <div className="mnt-paper">
          <div className="mnt-cover" aria-hidden="true">
            <span className="mnt-cover-fold" />
            <span className="mnt-cover-top">
              <AppIcon className="mnt-cover-icon" />
              <span className="mnt-cover-kicker">For you</span>
            </span>
            <span className="mnt-cover-title">A little note from the developer</span>
            <span className="mnt-cover-seal" aria-hidden="true">
              <span className="mnt-cover-seal-inner" />
            </span>
            <span className="mnt-cover-hint">Open the note ↗</span>
          </div>

          <article className="mnt-letter">
            <p className="mnt-letter-kicker">A little note from the developer</p>
            <h2 id="mnt-note-title" className="mnt-letter-title">
              Desknoty is still a work in progress.
            </h2>

            <div className="mnt-letter-body">
              <p>
                I’m taking some time to fix the rough edges, improve how everything works, and make
                the experience feel more thoughtful from start to finish.
              </p>
              <p>
                The full website isn’t ready yet. Rather than rush it, I want to give it the
                attention it needs.
              </p>
              <p>
                Thanks for stopping by — and for your patience while I put the pieces together.
              </p>
            </div>

            <div className="mnt-sign">
              <p className="mnt-sign-line">See you soon,</p>
              <p className="mnt-sign-name">The Desknoty developer</p>
              <svg
                className="mnt-sign-mark"
                viewBox="0 0 168 18"
                fill="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M2 12.4C18 6.6 30 3.8 41 5.4c8.4 1.2 10.6 5.6 4.6 7.4-5.4 1.6-9-2-3.4-5 7.4-4 22-1.2 33 3.6 6.6 2.8 12.8 2 15.6-1.6 2.4-3.2-.6-6.4-5-6-4 .4-5.4 4-2 6.8 4.8 4 17.4 4.6 28.4 1.2 9-2.8 18.6-3.2 27.4-1.4 8 1.6 15.6 1.2 23.2-1.2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <section className="mnt-notes" aria-labelledby="mnt-notes-title">
              <h3 id="mnt-notes-title" className="mnt-notes-title">
                Development notes
              </h3>
              <p className="mnt-notes-body">
                <span className="mnt-notes-dot" aria-hidden="true" />
                Fixes and improvements are in progress.
              </p>
            </section>

            <button type="button" className="mnt-back" onClick={closeNote}>
              <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" focusable="false">
                <path
                  d="M13 8H3m4-4L3 8l4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to the lake
            </button>
          </article>
        </div>
      </div>
    </div>
  )
}

export default MaintenancePage
