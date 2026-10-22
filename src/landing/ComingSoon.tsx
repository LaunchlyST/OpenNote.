import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ArrowRight, Bell, Check } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { cn } from '../lib/id'
import { Logo, ButtonArrow } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'
import type { EarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — a page from the notebook.
 *
 * The screen is a ruled sheet: warm paper with a fine grain, pale blue rules,
 * a double red margin and a "Date" field in the corner. Every line of type
 * sits on a rule. The headline is set in Geist with an Instrument Serif
 * italic second line, and rolls up through a mask on every load, followed by
 * the description, the checklist and the invite slider.
 *
 * The checklist is for the visitor: two items tick themselves off on load;
 * "Join the waitlist" stays open and points at the slider. Nobody is ever
 * marked as signed up.
 *
 * Early access: the handle rests on the left of the ink track and is dragged
 * RIGHT (or Enter / →); the invite code is verified by the backend before the
 * page leaves for /landing.
 */

const WIPE = '#191919'

const TODO = [
  { text: 'Think of your ideas', done: true },
  { text: 'Plan what you want to achieve', done: true },
]

/** When each finished item gets its tick and its line, in ms after load. */
const TICK_AT = [1250, 1600]
const STRIKE_DELAY = 220

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const [date, setDate] = useState('')
  // A short loader plays on every load; the page's entrance waits for it.
  const [ready, setReady] = useState(ea.reduced)
  // Every load replays the finished items being ticked off.
  const [ticked, setTicked] = useState(false)
  const signup = useRef<HTMLDivElement | null>(null)
  const [joined, setJoined] = useState(false)
  const [invite, setInvite] = useState(false)

  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
    document.body.classList.add('lp-body')
    return () => document.body.classList.remove('lp-body')
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setTicked(true), ea.reduced ? 0 : 60)
    return () => window.clearTimeout(id)
  }, [ready, ea.reduced])

  /** "Join the waitlist" takes the visitor to the slider. */
  const goToSignup = () => {
    const box = signup.current
    if (!box) return
    box.scrollIntoView({ behavior: ea.reduced ? 'auto' : 'smooth', block: 'center' })
    box.querySelector<HTMLElement>('[role="button"], input')?.focus({ preventScroll: true })
    box.classList.remove('nb-nudge')
    void box.offsetWidth
    box.classList.add('nb-nudge')
  }

  return (
    <div className={cn('nb-page relative min-h-svh overflow-hidden text-lp-ink', ea.reduced && 'nb-still', !ready && 'nb-hold')}>
      {!ea.reduced && <Loader onReveal={() => setReady(true)} />}
      <div aria-hidden="true" className="nb-paper pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="nb-rules pointer-events-none absolute inset-x-0 bottom-0" />
      <div aria-hidden="true" className="nb-margin pointer-events-none absolute inset-y-0" />

      <div className="nb-sheet relative">
        <header className="nb-head nb-in flex items-end justify-between" style={{ '--t': '80ms' } as CSSProperties}>
          <Logo />
          <p className="nb-date flex items-baseline gap-2.5">
            <span className="text-[12px] font-medium tracking-[0.02em] text-lp-muted">Date</span>
            <span className="nb-date-field font-editorial text-[19px] italic">{date || ' '}</span>
          </p>
        </header>

        <main className="nb-grid">
          <section aria-labelledby="nb-title" className="nb-main">
            <p className="nb-in nb-badge" style={{ '--t': '150ms' } as CSSProperties}>
              <span className="nb-badge-dot" aria-hidden="true" />
              Coming soon · Waitlist open
            </p>
            <h1 id="nb-title" className="nb-title">
              <span className="nb-mask">
                <span className="nb-roll nb-line-a" style={{ '--t': '250ms' } as CSSProperties}>
                  Your day
                </span>
              </span>
              <span className="nb-mask">
                <span className="nb-roll nb-line-b" style={{ '--t': '420ms' } as CSSProperties}>
                  starts here.
                </span>
              </span>
            </h1>

            <p className="nb-in nb-body nb-on-rule" style={{ '--t': '700ms' } as CSSProperties}>
              The easier way to{' '}
              <span className="nb-scribble">
                work with your clients
                <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M2 8 C 50 2, 110 2, 198 7" />
                </svg>
              </span>{' '}
              and plan your week.
            </p>

            <div ref={signup} className="nb-in nb-signup" style={{ '--t': '1000ms' } as CSSProperties}>
              <Waitlist joined={joined} onJoined={() => setJoined(true)} />
            </div>

            <div className="nb-in nb-invite" style={{ '--t': '1150ms' } as CSSProperties}>
              {invite ? (
                <Control ea={ea} />
              ) : (
                <button type="button" onClick={() => setInvite(true)} className="nb-or underline underline-offset-4 hover:text-lp-ink">
                  Already have an invite code?
                </button>
              )}
            </div>
          </section>

          <section aria-labelledby="nb-todo" className="nb-side">
            <h2
              id="nb-todo"
              className="nb-row nb-on-rule nb-in text-[13px] font-semibold tracking-[0.01em] text-lp-body"
              style={{ '--t': '850ms' } as CSSProperties}
            >
              Before launch
            </h2>
            <ol>
              {TODO.map((item, i) => {
                const done = item.done && ticked
                const at = ea.reduced ? 0 : TICK_AT[i]
                return (
                  <li
                    key={item.text}
                    className="nb-row nb-in flex items-center gap-3"
                    style={{ '--t': `${930 + i * 80}ms` } as CSSProperties}
                  >
                    <Box done={done} delay={at} />
                    <span className="nb-on-rule relative" style={{ '--d': `${at + STRIKE_DELAY}ms` } as CSSProperties}>
                      <span className={cn('nb-fade', done && 'text-lp-muted')}>{item.text}</span>
                      <span
                        aria-hidden="true"
                        className="nb-strike absolute top-[54%] left-[-3px] h-[1.6px] w-[calc(100%+6px)] rounded-full bg-lp-ink"
                        style={{ transform: done ? 'rotate(-0.7deg) scaleX(1)' : 'rotate(-0.7deg) scaleX(0)' }}
                      />
                      <span className="sr-only">{done ? ' (done)' : ' (to do)'}</span>
                    </span>
                  </li>
                )
              })}
              <li className="nb-row nb-in flex items-center gap-3" style={{ '--t': '1090ms' } as CSSProperties}>
                <Box done={joined} delay={0} />
                <button
                  type="button"
                  onClick={goToSignup}
                  className="nb-on-rule nb-waitlist group relative font-medium text-lp-ink"
                >
                  <span aria-hidden="true" className="nb-highlight" />
                  <span className="relative">Join the waitlist</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="relative ml-1.5 inline h-[0.9em] w-[0.9em] -translate-y-px transition-transform duration-300 group-hover:translate-x-1"
                  />
                  <span className="sr-only">{joined ? ' (done)' : ' (to do — go to the email form)'}</span>
                </button>
              </li>
            </ol>
          </section>
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ loader --- */

const COUNT_MS = 1500
const HOLD_MS = 260
const SEAM_MS = 420

function dayPart(minutes: number) {
  const h = minutes / 60
  if (h < 5) return 'Night'
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  if (h < 21) return 'Evening'
  return 'Night'
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The loading screen — "open your day". An ink cover with a huge clock that
 * counts from 00:00 to the visitor's own time while their day fills a
 * timeline. On arrival a pen line is drawn across the middle, and the cover
 * splits open along it like a notebook, cutting the clock in two and
 * revealing the page, where the headline rolls in.
 */
function Loader({ onReveal }: { onReveal: () => void }) {
  const [target] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  const [mins, setMins] = useState(0)
  const [stage, setStage] = useState<'count' | 'seam' | 'open' | 'gone'>('count')
  const revealRef = useRef(onReveal)

  useEffect(() => {
    revealRef.current = onReveal
  }, [onReveal])

  useEffect(() => {
    let raf = 0
    const timers: number[] = []
    const start = performance.now()
    const frame = (now: number) => {
      const x = Math.min(1, (now - start) / COUNT_MS)
      // fast through the night and morning, braking hard onto "now"
      const e = 1 - Math.pow(1 - x, 4)
      setMins(Math.round(e * target))
      if (x < 1) {
        raf = requestAnimationFrame(frame)
        return
      }
      timers.push(
        window.setTimeout(() => {
          setStage('seam')
          timers.push(
            window.setTimeout(() => {
              setStage('open')
              revealRef.current()
              timers.push(window.setTimeout(() => setStage('gone'), 1000))
            }, SEAM_MS),
          )
        }, HOLD_MS),
      )
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [target])

  if (stage === 'gone') return null
  const at = (mins / 1440) * 100
  const done = mins === target

  // The same face is painted in both halves; each half shows its own side
  // of the seam, so splitting the cover splits the clock.
  const face = (
    <div className="nb-cover-face">
      <p className="nb-cover-label">
        <span>{done ? 'Now' : 'Loading your day'}</span>
        <span>{dayPart(mins)}</span>
      </p>
      <p className="nb-cover-clock">
        {pad(Math.floor(mins / 60))}
        <span className="nb-cover-colon">:</span>
        {pad(mins % 60)}
      </p>
      <div className="nb-cover-day">
        <span className="nb-cover-ink" style={{ width: `${at}%` }} />
        {[0, 6, 12, 18, 24].map((h) => (
          <em key={h} className={cn(h * 60 <= mins && 'nb-cover-on')} style={{ left: `${(h / 24) * 100}%` }}>
            {pad(h)}
          </em>
        ))}
      </div>
    </div>
  )

  return (
    <div role="status" aria-label="Loading your day" className={cn('nb-cover', `nb-stage-${stage}`)}>
      <div aria-hidden="true" className="nb-cover-half nb-cover-top">
        <div className="nb-cover-inner">{face}</div>
      </div>
      <div aria-hidden="true" className="nb-cover-half nb-cover-bottom">
        <div className="nb-cover-inner">{face}</div>
      </div>
      <span aria-hidden="true" className="nb-cover-seam" />
    </div>
  )
}

/** A notebook checkbox whose tick draws itself. */
function Box({ done, delay }: { done: boolean; delay: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      data-done={done}
      className="nb-box h-[17px] w-[17px] shrink-0"
      style={{ '--d': `${delay}ms` } as CSSProperties}
    >
      <rect x="1" y="1" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 10.6l3.1 3.1L15 6.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="nb-tick"
        style={{ strokeDashoffset: done ? 0 : 20 }}
      />
    </svg>
  )
}

/* ----------------------------------------------------------- waitlist --- */

function Waitlist({ joined, onJoined }: { joined: boolean; onJoined: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(false), 6000)
    return () => window.clearTimeout(id)
  }, [toast])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setState('error')
      setError('Please enter a valid email address.')
      return
    }
    setState('sending')
    try {
      const res = await fetch(apiUrl('/api/waitlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Something went wrong.')
      setState('idle')
      onJoined()
      setToast(true)
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <div>
      <div className="nb-slot">
        {joined ? (
          <div className="nb-joined cs-pop flex h-[60px] w-full items-center gap-3 px-4" role="status">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#d9f99d] text-lp-ink">
              <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
            </span>
            <span className="text-[15px] font-medium text-lp-ink">You’re on the list! We’ll be in touch soon.</span>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className={cn('nb-form flex h-[60px] w-full items-center gap-1.5 p-[6px]', state === 'error' && 'nb-form-wrong')}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (state === 'error') setState('idle')
              }}
              disabled={state === 'sending'}
              placeholder="you@email.com"
              aria-label="Email address"
              aria-invalid={state === 'error'}
              autoComplete="email"
              className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[16px] text-lp-ink placeholder:text-lp-muted"
              style={{ outline: 'none' }}
            />
            <button
              type="submit"
              disabled={state === 'sending'}
              className="nb-submit inline-flex h-[48px] shrink-0 items-center gap-2 rounded-[10px] px-4.5 text-[15px] font-medium text-white disabled:opacity-70"
            >
              {state === 'sending' ? 'Joining…' : 'Join waitlist'}
              <ButtonArrow />
            </button>
          </form>
        )}
      </div>
      <p className="nb-row nb-hint nb-on-rule text-[14px] text-lp-body" role={state === 'error' ? 'alert' : undefined}>
        {state === 'error' ? (
          <span className="text-[#b42318]">{error}</span>
        ) : joined ? (
          'Keep an eye on your inbox.'
        ) : (
          'No spam. One email when we launch.'
        )}
      </p>

      <div className={cn('nb-toast', toast && 'nb-toast-on')} role="status" aria-live="polite">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d9f99d] text-lp-ink">
          <Bell className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </span>
        <span>
          <strong className="block text-[14px] font-semibold">You’re on the waitlist 🎉</strong>
          <span className="text-[13px] text-white/70">We’ll send you a notification as soon as possible.</span>
        </span>
        <button type="button" aria-label="Dismiss" onClick={() => setToast(false)} className="nb-toast-x">
          ×
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ control --- */

function Control({ ea }: { ea: EarlyAccess }) {
  const errorId = 'nb-invite-error'
  const passed = ea.progress
  return (
    <div>
      <div className="nb-slot">
        {ea.phase === 'swipe' ? (
          <div
            ref={ea.trackRef}
            role="button"
            tabIndex={0}
            aria-label="Enter with an invite — drag the handle right, or press Enter"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault()
                ea.swipeByKeyboard()
              }
            }}
            onPointerDown={ea.onPointerDown}
            className={cn('nb-track group relative flex h-[60px] w-full touch-none items-center select-none', ea.shake && 'cs-shake')}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-[6px] left-[6px] h-[48px] rounded-[10px] bg-white/[0.12]"
              style={{
                width: ea.knobX + 48,
                transition: ea.dragging ? 'none' : 'width .5s cubic-bezier(.22,1,.36,1)',
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 pl-12 text-center text-[15px] font-medium tracking-[-0.005em] text-white"
              style={{ opacity: Math.max(0, 1 - passed * 1.8) }}
            >
              Slide to enter with an invite
            </span>
            <div
              aria-hidden="true"
              className="absolute top-[6px] left-[6px]"
              style={{
                transform: `translateX(${ea.knobX}px)`,
                transition: ea.dragging ? 'none' : 'transform .5s cubic-bezier(.22,1,.36,1)',
              }}
            >
              <span className="nb-knob grid h-[48px] w-[48px] place-items-center rounded-[10px] bg-white text-lp-ink">
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
            </div>
          </div>
        ) : (
          <form
            onSubmit={ea.submit}
            className={cn('nb-form cs-pop flex h-[60px] w-full items-center gap-1.5 p-[6px]', ea.isWrong && 'nb-form-wrong', ea.shake && 'cs-shake')}
          >
            <input
              value={ea.code}
              onChange={(e) => {
                ea.setCode(e.target.value)
                if (ea.isWrong) ea.setPhase('code')
              }}
              disabled={ea.isChecking || ea.leaving}
              placeholder="Your invite code"
              aria-label="Invite code"
              aria-invalid={ea.isWrong}
              aria-describedby={ea.isWrong ? errorId : undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[16px] text-lp-ink placeholder:text-lp-muted"
              style={{ outline: 'none' }}
            />
            <button
              type="submit"
              disabled={ea.isChecking || ea.leaving}
              className="nb-submit group/btn inline-flex h-[48px] shrink-0 items-center gap-2 rounded-[10px] px-4.5 text-[15px] font-medium text-white disabled:opacity-70"
            >
              {ea.isChecking ? 'Checking…' : ea.leaving ? 'Opening…' : 'Enter'}
              <ButtonArrow />
            </button>
          </form>
        )}
      </div>

      <p className="nb-row nb-hint nb-on-rule text-[14px] text-lp-body" role={ea.isWrong ? 'alert' : undefined} id={ea.isWrong ? errorId : undefined}>
        {ea.isWrong ? (
          <span className="text-[#b42318]">That code didn’t work. Check it and try again.</span>
        ) : ea.phase === 'swipe' ? (
          'Slide to enter with your invite code.'
        ) : (
          'Type the code from your invite.'
        )}
      </p>
    </div>
  )
}
