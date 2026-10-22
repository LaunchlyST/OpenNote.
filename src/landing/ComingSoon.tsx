import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { apiUrl } from '../lib/api-base'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — the sheet and the sky.
 *
 * The page is one white sheet lying on a field of sky blue. Everything the
 * visitor reads is on the sheet; the sky behind it holds today's date and
 * the invite door.
 *
 * Loading: the sky shows first, with today's date; then the sheet slides in
 * over it and settles. That is the whole loader — the same motion the
 * visitor will use later.
 *
 * Invite: drag the sheet's edge (or the page itself) to the left — on
 * phones, upward — and it slides aside to uncover the invite-code field on
 * the sky. Let go early and it settles back. Enter / Space on the edge
 * handle does the same.
 */

const WIPE = '#10260f'
const INTRO_HOLD = 650
const OFFLINE = 'We can’t reach the server right now. Please try again in a moment.'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const root = useRef<HTMLDivElement | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; y: number; from: number; moved: boolean } | null>(null)
  // a drag that ends on the edge handle must not also count as a click on it
  const justDragged = useRef(false)
  const pRef = useRef(ea.reduced ? 0 : 1.45)
  const [open, setOpen] = useState(false)
  const [settled, setSettled] = useState(ea.reduced)
  // the words start rising while the sheet is still easing in
  const [shown, setShown] = useState(ea.reduced)
  const [dragging, setDragging] = useState(false)
  const [date] = useState(() =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
  )
  const [count, setCount] = useState<number | null>(null)

  const setP = useCallback((p: number) => {
    pRef.current = p
    root.current?.style.setProperty('--p', String(p))
  }, [])

  useEffect(() => {
    document.body.classList.add('lp-body')
    setP(pRef.current)
    const load = () =>
      fetch(apiUrl('/api/waitlist/count'))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => typeof d?.count === 'number' && setCount(d.count))
        .catch(() => {})
    void load()
    const id = window.setInterval(load, 15000)
    // the first scene: sky and date, then the sheet slides in over it
    const intro = ea.reduced
      ? 0
      : window.setTimeout(() => {
          setP(0)
          window.setTimeout(() => setShown(true), 520)
          window.setTimeout(() => setSettled(true), 1250)
        }, INTRO_HOLD)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(intro)
      document.body.classList.remove('lp-body')
    }
  }, [ea.reduced, setP])

  const vertical = () => window.matchMedia('(max-width: 760px)').matches
  const travel = () => {
    const f = frame.current
    if (!f) return 400
    return vertical() ? f.clientHeight * 0.62 : f.clientWidth * 0.6
  }

  const snap = (to: boolean) => {
    setOpen(to)
    setP(to ? 1 : 0)
  }

  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!settled || e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('input, button:not(.vx-edge), a, form')) return
    drag.current = { x: e.clientX, y: e.clientY, from: pRef.current, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const delta = vertical() ? d.y - e.clientY : d.x - e.clientX
    if (!d.moved && Math.abs(delta) < 6) return
    if (!d.moved) setDragging(true)
    d.moved = true
    const raw = d.from + delta / travel()
    // a little resistance past either end
    const p = raw < 0 ? raw * 0.2 : raw > 1 ? 1 + (raw - 1) * 0.2 : raw
    setP(p)
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d?.moved) return
    justDragged.current = true
    window.setTimeout(() => (justDragged.current = false), 0)
    const p = pRef.current
    snap(open ? p > 0.7 : p > 0.3)
  }

  return (
    <div
      ref={root}
      className={cn(
        'vx',
        open && 'vx-open',
        dragging && 'vx-dragging',
        settled && 'vx-settled',
        shown && 'vx-shown',
        ea.reduced && 'vx-still',
      )}
      style={{ '--p': pRef.current } as CSSProperties}
    >
      <TileField reduced={ea.reduced} />
      <div
        ref={frame}
        className="vx-frame"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* the sky: today's date, and the invite door */}
        <div className="vx-sky">
          <p className="vx-date" aria-hidden={!open}>
            {date}
          </p>
          <div className="vx-door" aria-hidden={!open}>
            <p className="vx-door-k">Invite only</p>
            <h2 className="vx-door-h">Have an invite?</h2>
            <form onSubmit={ea.submit} className={cn('vx-code', ea.isWrong && 'vx-code-wrong', ea.shake && 'cs-shake')}>
              <input
                value={ea.code}
                onChange={(e) => {
                  ea.setCode(e.target.value)
                  if (ea.isWrong) ea.setPhase('code')
                }}
                tabIndex={open ? 0 : -1}
                disabled={ea.isChecking || ea.leaving}
                placeholder="Invite code"
                aria-label="Invite code"
                aria-invalid={ea.isWrong}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button type="submit" tabIndex={open ? 0 : -1} disabled={ea.isChecking || ea.leaving}>
                {ea.isChecking ? 'Checking…' : ea.leaving ? 'Opening…' : 'Enter'}
              </button>
            </form>
            <p className="vx-door-note" role={ea.isWrong ? 'alert' : undefined}>
              {ea.isWrong ? 'That code didn’t work. Check it and try again.' : 'Type the code from your invite.'}
            </p>
            <button type="button" className="vx-back" tabIndex={open ? 0 : -1} onClick={() => snap(false)}>
              <ArrowRight aria-hidden="true" className="vx-back-arrow h-4 w-4" />
              Back to the page
            </button>
          </div>
        </div>

        {/* the sheet */}
        <section className="vx-sheet" aria-labelledby="vx-title" aria-hidden={open}>
          <Logo size="lg" className="vx-logo" />

          <div className="vx-copy">
            <h1 id="vx-title" className="vx-title">
              <span className="vx-line" style={{ '--i': 0 } as CSSProperties}>
                Your day
              </span>
              <span className="vx-line vx-title-b" style={{ '--i': 1 } as CSSProperties}>
                starts here.
              </span>
            </h1>
            <p className="vx-body vx-line" style={{ '--i': 2 } as CSSProperties}>
              <span className="vx-lead">The easier way to work with your clients and plan your week.</span>
              Join the waitlist and be the first to know when we launch.
            </p>
            <div className="vx-line" style={{ '--i': 3 } as CSSProperties}>
              <Waitlist disabled={open} onJoined={() => setCount((c) => (c === null ? c : c + 1))} />
            </div>
            {count !== null && (
              <p className="vx-proof vx-line" style={{ '--i': 4 } as CSSProperties} aria-live="polite">
                <span className="vx-live" aria-hidden="true" />
                <span>
                  {count === 0 ? (
                    'Be the first on the waitlist'
                  ) : (
                    <>
                      <strong>{count.toLocaleString()}</strong> {count === 1 ? 'person is' : 'people are'} on the
                      waitlist
                    </>
                  )}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            className="vx-edge"
            aria-label={open ? 'Close the invite field' : 'Have an invite? Open the invite field'}
            aria-expanded={open}
            onClick={() => {
              if (!justDragged.current) snap(!open)
            }}
          >
            <span className="vx-edge-grip" aria-hidden="true">
              <ArrowLeft className="h-4 w-4" />
            </span>
          </button>
        </section>

        <p className="vx-hint" aria-hidden="true">
          Have an invite? <span>Slide the page</span>
        </p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- waitlist --- */

function Waitlist({ disabled, onJoined }: { disabled: boolean; onJoined: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'done'>('idle')
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
    if (!EMAIL.test(value)) {
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
      }).catch(() => null)
      // no answer at all, or a proxy error page: the API isn't reachable
      if (!res) throw new Error(OFFLINE)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? OFFLINE)
      setState('done')
      setToast(true)
      onJoined()
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    }
  }

  const done = state === 'done'

  return (
    <div className="vx-join">
      <form onSubmit={submit} noValidate className="vx-form">
        <label className={cn('vx-field', state === 'error' && 'vx-field-wrong', done && 'vx-field-done')}>
          <Mail aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
          <input
            type="email"
            value={done ? 'You’re on the list.' : email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (state === 'error') setState('idle')
            }}
            readOnly={done}
            tabIndex={disabled ? -1 : 0}
            disabled={state === 'sending'}
            placeholder="Enter your email"
            aria-label="Email address"
            aria-invalid={state === 'error'}
            autoComplete="email"
          />
        </label>
        <button type="submit" className="vx-cta" tabIndex={disabled ? -1 : 0} disabled={state === 'sending' || done}>
          {state === 'sending' ? 'Joining…' : done ? 'Joined' : 'Join Waitlist'}
        </button>
      </form>
      {state === 'error' && (
        <p className="vx-error" role="alert">
          {error}
        </p>
      )}

      {createPortal(
        <div className={cn('vx-toast', toast && 'vx-toast-on')} role="status" aria-live="polite">
          <strong>You’re on the waitlist.</strong>
          <span>We’ll send you a notification as soon as possible.</span>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* --------------------------------------------------------- tile field --- */

const CELL = 38
const GAP = 3

/**
 * The background: a quiet grid of tiles on white. Two soft green lights
 * follow the pointer — one close behind it, one lagging further — and the
 * tiles under them light up. With no pointer (phones), the lights drift.
 */
function TileField({ reduced }: { reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const size = () => {
      w = el.clientWidth
      h = el.clientHeight
      el.width = w * dpr
      el.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()

    const target = { x: w * 0.72, y: h * 0.4 }
    const a = { ...target }
    const b = { x: w * 0.6, y: h * 0.6 }
    let pointer = false
    let raf = 0
    const start = performance.now()
    const noise = Array.from({ length: 997 }, () => Math.random())

    const draw = (t: number) => {
      if (!pointer) {
        // idle drift, slow
        const s = (t - start) / 1000
        target.x = w * (0.62 + 0.22 * Math.sin(s * 0.23))
        target.y = h * (0.45 + 0.25 * Math.sin(s * 0.31 + 1))
      }
      a.x += (target.x - a.x) * 0.12
      a.y += (target.y - a.y) * 0.12
      b.x += (a.x - b.x) * 0.035
      b.y += (a.y - b.y) * 0.035

      ctx.clearRect(0, 0, w, h)
      const step = CELL + GAP
      const cols = Math.ceil(w / step) + 1
      const rows = Math.ceil(h / step) + 1
      const ox = (w - cols * step) / 2
      const oy = (h - rows * step) / 2
      const ra = 2 * 115 * 115
      const rb = 2 * 165 * 165
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + c * step
          const y = oy + r * step
          const cx = x + CELL / 2
          const cy = y + CELL / 2
          const ia = Math.exp(-((cx - a.x) ** 2 + (cy - a.y) ** 2) / ra)
          const ib = Math.exp(-((cx - b.x) ** 2 + (cy - b.y) ** 2) / rb) * 0.75
          // the near light is pale mint with a bright core, the lagging one a deeper green;
          // each tile carries a fixed flicker so the field has texture, as in a real panel
          const n = noise[(r * 131 + c * 17) % noise.length]
          const i = Math.min(1, (ia + ib) * (0.85 + n * 0.3))
          const mix = ia / (ia + ib + 1e-6)
          const core = Math.max(0, ia - 0.6) * 2.2
          const red = Math.round(30 + 110 * mix + 90 * core)
          const grn = Math.round(150 + 70 * mix + 30 * core)
          const blu = Math.round(95 + 55 * mix + 80 * core)
          ctx.fillStyle = `rgba(${red},${grn},${blu},${0.035 + i * 0.78})`
          ctx.beginPath()
          ctx.roundRect(x, y, CELL, CELL, 4)
          ctx.fill()
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      pointer = true
      const rect = el.getBoundingClientRect()
      target.x = e.clientX - rect.left
      target.y = e.clientY - rect.top
    }
    const leave = () => (pointer = false)
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    window.addEventListener('resize', size)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', size)
    }
  }, [reduced])

  return <canvas ref={canvas} aria-hidden="true" className="vx-tiles" />
}
