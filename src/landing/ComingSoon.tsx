import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, Bell, Check, Mail, UserRound } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — the waitlist.
 *
 * A painted morning scene fills the screen; a white card sits on it, its
 * left half holding the headline and the email bar, its right half a window
 * onto the scene (a desk by the window with the day's notebook on it). The
 * page opens with the "open your day" loader.
 *
 * Joining: type an email, then swipe the dark "Join waitlist" pill LEFT
 * across the bar (or press Enter / click it). Balloons float up the screen
 * and a notification confirms we will be in touch.
 */

const WIPE = '#191919'

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const [ready, setReady] = useState(ea.reduced)
  const [count, setCount] = useState<number | null>(null)
  const [party, setParty] = useState(0)

  useEffect(() => {
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

  const joined = () => {
    setCount((c) => (c === null ? c : c + 1))
    setParty((n) => n + 1)
  }

  return (
    <div className={cn('wl-page relative min-h-svh overflow-hidden', ea.reduced && 'nb-still', !ready && 'nb-hold')}>
      {!ea.reduced && <Loader onReveal={() => setReady(true)} />}
      <Scene className="wl-bg" />

      <main className="wl-card nb-in" style={{ '--t': '80ms' } as CSSProperties}>
        <section className="wl-left" aria-labelledby="wl-title">
          <Logo size="lg" />

          <div className="wl-copy">
            <h1 id="wl-title" className="wl-title">
              <span className="nb-mask">
                <span className="nb-roll" style={{ '--t': '250ms' } as CSSProperties}>
                  Your day
                </span>
              </span>
              <span className="nb-mask">
                <span className="nb-roll wl-title-b" style={{ '--t': '400ms' } as CSSProperties}>
                  starts here.
                </span>
              </span>
            </h1>
            <p className="wl-body nb-in" style={{ '--t': '650ms' } as CSSProperties}>
              The easier way to work with your clients and plan your week. Join the waitlist and be the first to know
              when we launch.
            </p>

            <div className="nb-in" style={{ '--t': '850ms' } as CSSProperties}>
              <Waitlist reduced={ea.reduced} onJoined={joined} />
            </div>

            {count !== null && (
              <p className="wl-proof nb-in" style={{ '--t': '1000ms' } as CSSProperties} aria-live="polite">
                <span className="wl-faces" aria-hidden="true">
                  {['#4f6bed', '#f97316', '#16a34a', '#e11d48', '#0ea5e9'].map((c, i) => (
                    <span key={c} style={{ background: c, zIndex: 5 - i }}>
                      <UserRound className="h-[17px] w-[17px]" strokeWidth={2.2} />
                    </span>
                  ))}
                </span>
                <span>
                  <span className="wl-live" aria-hidden="true" />
                  {count === 0 ? (
                    'Be the first to join'
                  ) : (
                    <>
                      <strong>{count.toLocaleString()}</strong> {count === 1 ? 'person has' : 'people have'} joined
                    </>
                  )}
                </span>
              </p>
            )}
          </div>
        </section>

        <div className="wl-right" aria-hidden="true">
          <Scene />
        </div>
      </main>

      {party > 0 && <Balloons key={party} />}
    </div>
  )
}

/* ------------------------------------------------------------- scene --- */

/** An original painted-style morning: sky, sun, hills, leaves and a desk with the day's notebook. */
function Scene({ className }: { className?: string }) {
  return (
    <svg className={cn('wl-scene', className)} viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b8fd6" />
          <stop offset="1" stopColor="#9fd3f2" />
        </linearGradient>
      </defs>
      <rect width="800" height="900" fill="url(#wl-sky)" />
      <circle cx="590" cy="190" r="70" fill="#fde68a" opacity=".9" />
      <path d="M0 560 Q200 470 400 540 T800 500 V900 H0Z" fill="#3f8f4e" />
      <path d="M0 640 Q240 560 470 630 T800 600 V900 H0Z" fill="#2f7a3e" />
      {/* desk + notebook */}
      <rect x="250" y="600" width="420" height="22" rx="6" fill="#b7793f" />
      <rect x="290" y="622" width="16" height="200" fill="#8f5a2b" />
      <rect x="614" y="622" width="16" height="200" fill="#8f5a2b" />
      <g transform="rotate(-6 450 560)">
        <rect x="350" y="500" width="200" height="104" rx="8" fill="#f8f6f1" />
        <rect x="350" y="500" width="200" height="22" rx="8" fill="#191919" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="366" x2="534" y1={540 + i * 16} y2={540 + i * 16} stroke="#c7d2fe" strokeWidth="2" />
        ))}
        <path d="M368 535l6 6 10-12" stroke="#16a34a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <rect x="575" y="540" width="34" height="60" rx="6" fill="#4f6bed" />
      <path d="M575 556 h-12 a10 10 0 0 0 0 22 h12" stroke="#4f6bed" strokeWidth="6" fill="none" />
      {/* leaves */}
      {[
        [-20, 60, 30, '#1f6b34'],
        [60, -20, 70, '#2f8f45'],
        [720, 40, -40, '#1f6b34'],
        [790, 260, -70, '#3fa556'],
        [-30, 760, 20, '#2f8f45'],
        [760, 800, -20, '#1f6b34'],
      ].map(([x, y, r, c], i) => (
        <path
          key={i}
          d="M0 0 C60 -40 160 -30 220 0 C160 30 60 40 0 0Z"
          fill={c as string}
          transform={`translate(${x} ${y}) rotate(${r}) scale(1.4)`}
        />
      ))}
      {[120, 220, 640, 700, 520].map((x, i) => (
        <circle key={x} cx={x} cy={860 - (i % 2) * 30} r="16" fill="#f97316" />
      ))}
    </svg>
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
          style={{ outline: 'none', opacity: 1 - progress }}
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
