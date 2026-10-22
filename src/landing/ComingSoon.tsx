import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Bell, Check, Mail } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — a page from the notebook.
 *
 * A ruled sheet of warm paper: punched holes, a red margin, a "Date" field.
 * The headline is typeset, then "starts here." is written in by pen and
 * circled. Pen notes in the margin lead the eye: a scribbled line runs
 * from "be the first to know" down into the email bar. A sticky note
 * carries the live waitlist count.
 *
 * Joining: type an email, swipe the ink pill LEFT across the bar (or press
 * Enter / click). The checklist's last item ticks itself off, balloons
 * rise, and a notification confirms we will be in touch.
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
  const [ready, setReady] = useState(ea.reduced)
  const [ticked, setTicked] = useState(false)
  const [joined, setJoined] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [party, setParty] = useState(0)
  const signup = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
    document.body.classList.add('lp-body')
    // live: refresh the waitlist count every 15s
    const load = () =>
      fetch(apiUrl('/api/waitlist/count'))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => typeof d?.count === 'number' && setCount(d.count))
        .catch(() => {})
    void load()
    const id = window.setInterval(load, 15000)
    return () => {
      window.clearInterval(id)
      document.body.classList.remove('lp-body')
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setTicked(true), ea.reduced ? 0 : 60)
    return () => window.clearTimeout(id)
  }, [ready, ea.reduced])

  const onJoined = () => {
    setJoined(true)
    setCount((c) => (c === null ? c : c + 1))
    setParty((n) => n + 1)
  }

  /** "Join the waitlist" in the checklist takes the visitor to the email bar. */
  const goToSignup = () => {
    const box = signup.current
    if (!box) return
    box.scrollIntoView({ behavior: ea.reduced ? 'auto' : 'smooth', block: 'center' })
    box.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    box.classList.remove('nb-nudge')
    void box.offsetWidth
    box.classList.add('nb-nudge')
  }

  return (
    <div
      className={cn(
        'nb-page nb-pro relative min-h-svh overflow-hidden text-lp-ink',
        ea.reduced && 'nb-still',
        !ready && 'nb-hold',
      )}
    >
      {!ea.reduced && <Loader onReveal={() => setReady(true)} />}
      <div aria-hidden="true" className="nb-paper pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="nb-rules pointer-events-none absolute inset-x-0 bottom-0" />
      <div aria-hidden="true" className="nb-margin pointer-events-none absolute inset-y-0" />
      <div aria-hidden="true" className="nb-holes pointer-events-none absolute inset-y-0">
        <span />
        <span />
        <span />
      </div>
      <div aria-hidden="true" className="nb-vignette pointer-events-none absolute inset-0" />

      <div className="nb-sheet relative">
        <header className="nb-head nb-in flex items-end justify-between" style={{ '--t': '80ms' } as CSSProperties}>
          <Logo />
          <p className="nb-date flex items-baseline gap-2.5">
            <span className="text-[12px] font-medium tracking-[0.02em] text-lp-muted">Date</span>
            <span className="nb-date-field font-editorial text-[19px] italic">{date || ' '}</span>
          </p>
        </header>

        <main className="nb-grid">
          <section aria-labelledby="nb-title" className="nb-main">
            <h1 id="nb-title" className="nb-title">
              <span className="nb-mask">
                <span className="nb-roll nb-line-a" style={{ '--t': '250ms' } as CSSProperties}>
                  Your day
                </span>
              </span>
              <span className="nb-pen-line">
                <span className="nb-pen" style={{ '--t': '520ms' } as CSSProperties}>
                  starts{' '}
                  <span className="nb-circled">
                    here.
                    <svg className="nb-ring" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M40 70 C 30 20, 230 4, 280 46 C 312 80, 190 116, 96 108 C 30 102, 8 66, 70 30" />
                    </svg>
                  </span>
                </span>
              </span>
            </h1>

            <p className="nb-in nb-body nb-on-rule" style={{ '--t': '900ms' } as CSSProperties}>
              The easier way to{' '}
              <span className="nb-scribble">
                work with your clients
                <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M2 8 C 50 2, 110 2, 198 7" />
                </svg>
              </span>{' '}
              and plan your week.
            </p>

            <div className="nb-cue nb-in" style={{ '--t': '1100ms' } as CSSProperties}>
              <p className="nb-hand">Join the waitlist &amp; be the first to know when we launch</p>
              <svg className="nb-zig" viewBox="0 0 140 90" aria-hidden="true">
                <path d="M8 6 C 40 2, 64 10, 58 24 L 30 36 L 74 48 L 40 60 C 60 72, 96 80, 124 74" />
                <path className="nb-zig-head" d="M110 64 L 126 74 L 112 86" />
              </svg>
            </div>

            <div ref={signup} className="nb-in nb-signup" style={{ '--t': '1250ms' } as CSSProperties}>
              <Waitlist reduced={ea.reduced} onJoined={onJoined} />
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
                  style={{ '--d': `${STRIKE_DELAY}ms` } as CSSProperties}
                >
                  <span aria-hidden="true" className="nb-highlight" />
                  <span className={cn('relative', joined && 'text-lp-muted')}>Join the waitlist</span>
                  {!joined && (
                    <ArrowRight
                      aria-hidden="true"
                      className="relative ml-1.5 inline h-[0.9em] w-[0.9em] -translate-y-px transition-transform duration-300 group-hover:translate-x-1"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="nb-strike absolute top-[54%] left-[-3px] h-[1.6px] w-[calc(100%+6px)] rounded-full bg-lp-ink"
                    style={{ transform: joined ? 'rotate(-0.7deg) scaleX(1)' : 'rotate(-0.7deg) scaleX(0)' }}
                  />
                  <span className="sr-only">{joined ? ' (done)' : ' (to do — go to the email form)'}</span>
                </button>
              </li>
            </ol>

            {count !== null && (
              <div className="nb-sticky nb-in" style={{ '--t': '1400ms' } as CSSProperties} aria-live="polite">
                <span className="nb-tape" aria-hidden="true" />
                <p className="nb-sticky-n">{count === 0 ? 'Be #1!' : count.toLocaleString()}</p>
                <p className="nb-sticky-t">
                  {count === 0 ? 'nobody has joined yet' : count === 1 ? 'person on the list' : 'people on the list'}
                </p>
                <p className="nb-sticky-live">
                  <span className="wl-live" aria-hidden="true" />
                  live
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {party > 0 && <Balloons key={party} />}
    </div>
  )
}

/* ---------------------------------------------------------- balloons --- */

const BALLOON_COLORS = ['#4f6bed', '#f97316', '#16a34a', '#e11d48', '#facc15', '#0ea5e9', '#a855f7']

function Balloons() {
  const [gone, setGone] = useState(false)
  const [items] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      left: Math.random() * 94,
      delay: Math.random() * 0.9,
      dur: 3.2 + Math.random() * 1.6,
      size: 44 + Math.random() * 30,
      sway: (Math.random() - 0.5) * 80,
      color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    })),
  )
  useEffect(() => {
    const id = window.setTimeout(() => setGone(true), 6200)
    return () => window.clearTimeout(id)
  }, [])
  if (gone) return null
  return (
    <div className="wl-balloons" aria-hidden="true">
      {items.map((b, i) => (
        <span
          key={i}
          className="wl-balloon"
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 1.22,
              background: b.color,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              '--sway': `${b.sway}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ loader --- */

/** The loader's status line moves through what the product does. */
const WORDS = ['Opening your notebook', 'Lining up your tasks', 'Finding your clients', 'Planning your week']

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
        <span key={done ? -1 : Math.floor((mins / Math.max(1, target)) * WORDS.length)} className="nb-cover-word">
          {done ? 'Now' : WORDS[Math.min(WORDS.length - 1, Math.floor((mins / Math.max(1, target)) * WORDS.length))]}
        </span>
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

/* ----------------------------------------------------------- waitlist --- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * The email bar. Once the address looks valid, the dark pill can be dragged
 * left across the bar to join; a click, a tap or Enter does the same.
 */
function Waitlist({ reduced, onJoined }: { reduced: boolean; onJoined: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const [shared, setShared] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const bar = useRef<HTMLFormElement | null>(null)
  const pill = useRef<HTMLButtonElement | null>(null)
  const drag = useRef<{ x: number; moved: boolean } | null>(null)

  const valid = EMAIL.test(email.trim())
  const maxSlide = () => {
    const b = bar.current
    const p = pill.current
    return b && p ? b.clientWidth - p.offsetWidth - 12 : 200
  }

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(false), 6000)
    return () => window.clearTimeout(id)
  }, [toast])

  const join = async () => {
    const value = email.trim()
    if (!EMAIL.test(value)) {
      setState('error')
      setError('Please enter a valid email address.')
      setDx(0)
      return
    }
    setState('sending')
    setDx(-maxSlide())
    try {
      const res = await fetch(apiUrl('/api/waitlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Something went wrong.')
      setState('done')
      setToast(true)
      onJoined()
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setDx(0)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void join()
  }

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (state === 'sending' || state === 'done') return
    drag.current = { x: e.clientX, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const d = Math.min(0, Math.max(-maxSlide(), e.clientX - drag.current.x))
    if (Math.abs(d) > 4) drag.current.moved = true
    setDx(d)
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d?.moved) return
    if (Math.abs(dx) > maxSlide() * 0.6) void join()
    else setDx(0)
  }

  const done = state === 'done'
  const progress = Math.min(1, Math.abs(dx) / Math.max(1, maxSlide()))

  return (
    <div>
      <form
        ref={bar}
        onSubmit={submit}
        noValidate
        className={cn(
          'nb-form wl-bar relative flex h-[60px] w-full items-center p-[6px]',
          state === 'error' && 'nb-form-wrong',
          done && 'wl-bar-done',
        )}
      >
        <Mail
          aria-hidden="true"
          className="ml-3 h-[18px] w-[18px] shrink-0 text-lp-muted"
          style={{ opacity: done ? 0 : 1 - progress }}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (state === 'error') setState('idle')
          }}
          disabled={state === 'sending' || done}
          placeholder="you@email.com"
          aria-label="Email address"
          aria-invalid={state === 'error'}
          autoComplete="email"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] text-lp-ink placeholder:text-lp-muted"
          style={{ outline: 'none', opacity: done ? 0 : 1 - progress }}
        />
        {done && (
          <span
            className="wl-done cs-pop absolute inset-y-0 right-4 flex items-center gap-2 text-[15px] font-semibold text-lp-ink"
            role="status"
          >
            <Check className="h-[18px] w-[18px] text-[#16a34a]" strokeWidth={2.8} />
            You’re on the list!
          </span>
        )}
        <button
          ref={pill}
          type="submit"
          disabled={state === 'sending'}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={(e) => {
            if (dragging || Math.abs(dx) > 4) e.preventDefault()
          }}
          aria-label={done ? 'Joined' : 'Join waitlist — swipe left or press'}
          className={cn(
            'nb-submit wl-pill relative z-10 inline-flex h-[48px] shrink-0 touch-none items-center gap-2 rounded-[10px] px-4.5 text-[15px] font-medium text-white select-none',
            valid && !done && 'wl-pill-ready',
          )}
          style={{
            transform: `translateX(${dx}px)`,
            transition: dragging || reduced ? 'none' : 'transform .55s cubic-bezier(.22,1,.36,1)',
          }}
        >
          {done ? (
            <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
          ) : (
            <>
              <ArrowLeft aria-hidden="true" className="wl-nudge h-[17px] w-[17px]" strokeWidth={2.4} />
              {state === 'sending' ? 'Joining…' : 'Join waitlist'}
            </>
          )}
        </button>
      </form>
      <p className="mt-3 text-[14px] text-lp-body" role={state === 'error' ? 'alert' : undefined}>
        {state === 'error' ? (
          <span className="text-[#b42318]">{error}</span>
        ) : done ? (
          <button
            type="button"
            className="wl-share"
            onClick={() => {
              const url = window.location.origin
              const text =
                'I just joined the Desknoty waitlist, the easier way to work with clients and plan your week.'
              if (navigator.share) void navigator.share({ title: 'Desknoty', text, url }).catch(() => {})
              else void navigator.clipboard?.writeText(`${text} ${url}`).then(() => setShared(true))
            }}
          >
            {shared ? 'Link copied. Thanks for sharing!' : "Know someone who'd love this? Share the waitlist →"}
          </button>
        ) : valid ? (
          'Now swipe the button left to join ←'
        ) : (
          'No spam. One email when we launch.'
        )}
      </p>

      {createPortal(
        <div className={cn('nb-toast', toast && 'nb-toast-on')} role="status" aria-live="polite">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d9f99d] text-lp-ink">
            <Bell className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>
          <span>
            <strong className="block text-[14px] font-semibold">Congrats, you’re on the waitlist 🎉</strong>
            <span className="text-[13px] text-white/70">We’ll send you a notification as soon as possible.</span>
          </span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(false)} className="nb-toast-x">
            ×
          </button>
        </div>,
        document.body,
      )}
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

