import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, Bell, Check, Mail } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — the waitlist, after dark.
 *
 * A near-black stage lit by a slow, drifting "grainient" (blurred light
 * fields under film grain) and a dot grid that fades out from the centre.
 * The headline rises word by word out of a blur; pieces of the product
 * (a client call, a task being ticked, a note, the week) float around it
 * and lean away from the cursor.
 *
 * Loader: the visitor's clock counts up from 00:00 while a status line
 * says what is being prepared; then seven shutters lift in a wave to
 * reveal the page.
 *
 * Joining: type an email, then swipe the lime pill LEFT across the bar
 * (or press Enter / click it). Balloons rise, a notification confirms.
 */

const WIPE = '#0a0a0c'

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const [ready, setReady] = useState(ea.reduced)
  const [count, setCount] = useState<number | null>(null)
  const [party, setParty] = useState(0)
  // joining flips the page out of the upside-down into the party
  const [flipped, setFlipped] = useState(false)
  const stage = useRef<HTMLDivElement | null>(null)

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

  // the floating cards lean away from the cursor
  useEffect(() => {
    if (ea.reduced) return
    let raf = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = stage.current
        if (!el) return
        el.style.setProperty('--mx', String(e.clientX / window.innerWidth - 0.5))
        el.style.setProperty('--my', String(e.clientY / window.innerHeight - 0.5))
      })
    }
    window.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [ea.reduced])

  const joined = () => {
    setCount((c) => (c === null ? c : c + 1))
    setParty((n) => n + 1)
    setFlipped(true)
  }

  const words: [string, boolean][] = [
    ['Your', false],
    ['day', false],
    ['starts', true],
    ['here.', true],
  ]

  return (
    <div ref={stage} className={cn('px relative min-h-svh overflow-hidden', flipped && 'px-flip', ea.reduced && 'nb-still', !ready && 'px-hold')}>
      {!ea.reduced && <Loader onReveal={() => setReady(true)} />}

      <div aria-hidden="true" className="px-light">
        <span className="px-blob px-blob-a" />
        <span className="px-blob px-blob-b" />
        <span className="px-blob px-blob-c" />
      </div>
      <div aria-hidden="true" className="px-grid" />
      <div aria-hidden="true" className="px-spores">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            style={
              {
                left: `${(i * 37) % 100}%`,
                animationDelay: `${-((i * 1.7) % 14)}s`,
                animationDuration: `${10 + ((i * 3) % 9)}s`,
                '--s': `${2 + (i % 4)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div aria-hidden="true" className="px-flash" />
      <div aria-hidden="true" className="px-party" />
      <div aria-hidden="true" className="px-grain" />

      <header className="px-head px-in" style={{ '--t': '100ms' } as CSSProperties}>
        <Logo tone="paper" />
        <span className="px-chip">
          <span className="wl-live" aria-hidden="true" />
          Private beta · 2026
        </span>
      </header>

      <Floaters />

      <main className="px-hero">
        <p className="px-chip px-in" style={{ '--t': '200ms' } as CSSProperties} aria-live="polite">
          <span className="wl-live" aria-hidden="true" />
          {count === null || count === 0 ? (
            'Waitlist open · be the first'
          ) : (
            <>
              <strong>{count.toLocaleString()}</strong>&nbsp;{count === 1 ? 'person has' : 'people have'} joined · live
            </>
          )}
        </p>

        <h1 className="px-title" aria-label="Your day starts here.">
          {words.map(([w, serif], i) => (
            <span key={w} aria-hidden="true" className={cn('px-word', serif && 'px-serif')} style={{ '--t': `${300 + i * 110}ms` } as CSSProperties}>
              {w}
            </span>
          ))}
        </h1>

        <p className="px-body px-in" style={{ '--t': '800ms' } as CSSProperties}>
          The easier way to work with your clients and plan your week.
        </p>

        <div className="px-cue px-in" style={{ '--t': '900ms' } as CSSProperties}>
          <p className="px-cue-text">Join the waitlist and be the first to know when we launch.</p>
          <svg className="px-zig" viewBox="0 0 120 150" aria-hidden="true">
            <path d="M14 4 C 70 6, 96 24, 72 40 L 40 58 L 84 76 L 44 94 C 30 104, 46 120, 60 140" />
            <path className="px-zig-head" d="M50 128 L 60 142 L 72 130" />
          </svg>
        </div>

        <div className="px-form px-in" style={{ '--t': '950ms' } as CSSProperties}>
          <Waitlist reduced={ea.reduced} onJoined={joined} />
        </div>
      </main>

      {party > 0 && <Balloons key={party} />}
      {flipped && (
        <p className="px-banner" aria-hidden="true">
          {'YOU\'RE IN!'.split('').map((c, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>
              {c === ' ' ? '\u00a0' : c}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- floaters --- */

/** Pieces of the product drifting around the headline (decorative). */
function Floaters() {
  return (
    <div aria-hidden="true" className="px-floaters">
      <div className="px-card px-f1" style={{ '--depth': 26, '--t': '1100ms' } as CSSProperties}>
        <span className="px-card-tag" style={{ background: '#4f6bed' }} />
        <div>
          <p className="px-card-k">Client call · Northwind</p>
          <p className="px-card-v">Today, 10:30 – 11:00</p>
        </div>
      </div>
      <div className="px-card px-f2" style={{ '--depth': -34, '--t': '1250ms' } as CSSProperties}>
        <span className="px-tick">
          <Check className="h-3 w-3" strokeWidth={3.4} />
        </span>
        <p className="px-card-v px-strike">Send invoice to Studio Lumen</p>
      </div>
      <div className="px-card px-f3 px-note" style={{ '--depth': 18, '--t': '1400ms' } as CSSProperties}>
        <p className="px-card-k">Note</p>
        <p className="px-card-v">Moodboard feedback: warmer tones, bigger type.</p>
      </div>
      <div className="px-card px-f4 px-week" style={{ '--depth': -22, '--t': '1550ms' } as CSSProperties}>
        <p className="px-card-k">This week</p>
        <div className="px-bars">
          {[46, 72, 38, 88, 60].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} data-on={i === 3} />
          ))}
        </div>
        <div className="px-days">
          {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ loader --- */

const WORDS = ['Opening your notebook', 'Lining up your tasks', 'Finding your clients', 'Planning your week']
const COUNT_MS = 1700
const SHUTTERS = 7
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The visitor's own time counts up from 00:00 while a status line names
 * what is being prepared; then the shutters lift in a wave.
 */
function Loader({ onReveal }: { onReveal: () => void }) {
  const [target] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  const [mins, setMins] = useState(0)
  const [stage, setStage] = useState<'count' | 'open' | 'gone'>('count')
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
      const e = 1 - Math.pow(1 - x, 4)
      setMins(Math.round(e * target))
      if (x < 1) {
        raf = requestAnimationFrame(frame)
        return
      }
      timers.push(
        window.setTimeout(() => {
          setStage('open')
          timers.push(window.setTimeout(() => revealRef.current(), 350))
          timers.push(window.setTimeout(() => setStage('gone'), 1500))
        }, 380),
      )
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [target])

  if (stage === 'gone') return null
  const p = target ? mins / target : 1
  const word = mins === target ? 'Now' : WORDS[Math.min(WORDS.length - 1, Math.floor(p * WORDS.length))]

  return (
    <div role="status" aria-label="Loading your day" className={cn('px-loader', `px-l-${stage}`)}>
      {Array.from({ length: SHUTTERS }, (_, i) => (
        <span key={i} className="px-shutter" style={{ '--i': i } as CSSProperties} />
      ))}
      <div className="px-l-ui" aria-hidden="true">
        <div className="px-l-top">
          <span key={word} className="px-l-word">
            {word}
          </span>
          <span>{Math.round(p * 100)}%</span>
        </div>
        <div className="px-l-clock">
          {pad(Math.floor(mins / 60))}
          <span className="px-l-colon">:</span>
          {pad(mins % 60)}
        </div>
        <div className="px-l-line">
          <span style={{ transform: `scaleX(${p})` }} />
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- balloons --- */

const BALLOON_COLORS = ['#ff3d6e', '#ffd23f', '#3ec7ff', '#7cf06b', '#b26bff', '#ff8a3d', '#ff5ec4']
const BALLOON_WORD = 'HAPPYLAUNCH'

function Balloons() {
  const [gone, setGone] = useState(false)
  const [items] = useState(() =>
    Array.from({ length: 22 }, (_, i) => ({
      letter: i < BALLOON_WORD.length ? BALLOON_WORD[i] : '',
      // the letter balloons rise in a row, spelling the word
      left: i < BALLOON_WORD.length ? 4 + i * (86 / BALLOON_WORD.length) : Math.random() * 94,
      delay: i < BALLOON_WORD.length ? 0.3 + i * 0.07 : Math.random() * 1.4,
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
        >
          {b.letter}
        </span>
      ))}
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
