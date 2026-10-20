import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'
import type { EarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — Desknoty's launch screen (Interactive Digital Playground).
 *
 * Kinetic type as a playable object: the headline is alive — each letter is
 * pushed away from the cursor and springs back, so the very word "COMING SOON!"
 * becomes the toy. A field of tiny ink dots and a handful of hand-set geometric
 * marks (ring, triangle, plus, squiggle) give it a made, custom feel rather
 * than a generic gradient.
 *
 * Hue family: acid lime (the Desknoty brand accent, pushed to the extreme).
 * Type: Anton + JetBrains Mono. Skeleton: centred kinetic field.
 *
 * The early-access control rests on the RIGHT and is swiped LEFT to unlock;
 * the invite code is validated by the backend before it wipes to /landing.
 */

const LIME = '#c6f24e'
const INK = '#0e0e0e'
const VIOLET = '#6c4cf1'
const MAGENTA = '#ff3d8b'

const WIPE = `linear-gradient(135deg, ${LIME} 0%, ${INK} 100%)`

const LINE1 = 'COMING'
const LINE2 = 'SOON!'

interface Mark {
  kind: 'ring' | 'tri' | 'plus' | 'squiggle'
  colour: string
  size: number
  x: number
  y: number
  rot: number
  depth: number
}

const MARKS: Mark[] = [
  { kind: 'ring', colour: VIOLET, size: 90, x: 12, y: 20, rot: 0, depth: 30 },
  { kind: 'tri', colour: MAGENTA, size: 74, x: 85, y: 22, rot: 12, depth: 26 },
  { kind: 'plus', colour: VIOLET, size: 56, x: 88, y: 74, rot: 0, depth: 34 },
  { kind: 'squiggle', colour: MAGENTA, size: 120, x: 10, y: 78, rot: -8, depth: 22 },
  { kind: 'ring', colour: MAGENTA, size: 40, x: 68, y: 12, rot: 0, depth: 40 },
  { kind: 'plus', colour: VIOLET, size: 34, x: 30, y: 88, rot: 0, depth: 38 },
]

function MarkShape({ m }: { m: Mark }) {
  const common = { width: m.size, height: m.size, color: m.colour }
  if (m.kind === 'ring')
    return <div style={{ ...common, border: `${Math.round(m.size * 0.14)}px solid ${m.colour}`, borderRadius: '50%' }} />
  if (m.kind === 'tri')
    return (
      <svg viewBox="0 0 100 100" style={common} aria-hidden="true">
        <path d="M50 6 L94 88 L6 88 Z" fill={m.colour} />
      </svg>
    )
  if (m.kind === 'plus')
    return (
      <svg viewBox="0 0 100 100" style={common} aria-hidden="true">
        <path d="M42 6h16v36h36v16H58v36H42V58H6V42h36z" fill={m.colour} />
      </svg>
    )
  return (
    <svg viewBox="0 0 120 40" style={{ ...common, height: m.size / 3 }} aria-hidden="true">
      <path
        d="M4 20 Q19 2 34 20 T64 20 T94 20 T124 20"
        fill="none"
        stroke={m.colour}
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const root = useRef<HTMLDivElement | null>(null)
  const letters = useRef<Array<HTMLElement | null>>([])
  const markEls = useRef<Array<HTMLDivElement | null>>([])

  /* Entrance: letters bounce in, marks pop. */
  useEffect(() => {
    if (ea.reduced) return
    const ctx = gsap.context(() => {
      gsap.from(letters.current.filter(Boolean), {
        yPercent: 120,
        scale: 0.6,
        opacity: 0,
        duration: 0.6,
        delay: 0.1,
        stagger: 0.04,
        ease: 'back.out(2)',
      })
      gsap.from(markEls.current.filter(Boolean), {
        scale: 0,
        rotate: -60,
        opacity: 0,
        duration: 0.6,
        delay: 0.25,
        stagger: 0.05,
        ease: 'back.out(1.7)',
      })
      gsap.from('.b-top, .b-ctl', { y: 16, opacity: 0, duration: 0.5, delay: 0.45, stagger: 0.06 })
    }, root)
    return () => ctx.revert()
  }, [ea.reduced])

  /* Kinetic type: letters repel from the cursor, then spring home. */
  useEffect(() => {
    if (ea.reduced) return
    const els = letters.current.filter(Boolean) as HTMLElement[]
    const quick = els.map((el) => ({
      x: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' }),
      r: gsap.quickTo(el, 'rotate', { duration: 0.6, ease: 'power3.out' }),
      el,
    }))
    const onMove = (e: PointerEvent) => {
      const R = 180
      quick.forEach((q, i) => {
        const r = q.el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.hypot(dx, dy)
        if (dist < R) {
          const f = (1 - dist / R) * 46
          const a = Math.atan2(dy, dx)
          q.x(Math.cos(a) * f)
          q.y(Math.sin(a) * f)
          q.r(Math.cos(a) * f * 0.25)
        } else {
          q.x(0)
          q.y(0)
          q.r(0)
        }
        void i
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [ea.reduced])

  /* Marks drift with the cursor for depth. */
  useEffect(() => {
    if (ea.reduced) return
    const q = markEls.current.filter(Boolean).map((el, i) => ({
      x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }),
      d: MARKS[i].depth,
    }))
    const onMove = (e: PointerEvent) => {
      const px = e.clientX / window.innerWidth - 0.5
      const py = e.clientY / window.innerHeight - 0.5
      q.forEach((s) => {
        s.x(-px * s.d)
        s.y(-py * s.d)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [ea.reduced])

  let li = -1
  const renderLine = (text: string) =>
    [...text].map((ch) => {
      li += 1
      const idx = li
      return (
        <span
          key={idx}
          ref={(el) => {
            letters.current[idx] = el
          }}
          className="b-letter inline-block will-change-transform"
        >
          {ch}
        </span>
      )
    })

  return (
    <section
      aria-label="Desknoty — coming soon"
      className="fixed inset-0 overflow-hidden font-impact"
      style={{
        background: LIME,
        color: INK,
        backgroundImage: `radial-gradient(${INK} 1.4px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      }}
    >
      <h1 className="sr-only">Desknoty — Coming Soon</h1>
      <div
        ref={root}
        className={cn(
          'flex h-full w-full flex-col items-center justify-between p-6 transition-opacity duration-500 sm:p-10',
          ea.leaving && 'opacity-0',
        )}
      >
        <header className="b-top flex w-full items-center justify-between">
          <Logo />
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase">
            Early&nbsp;Access
          </span>
        </header>

        {/* marks */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {MARKS.map((m, i) => (
            <div
              key={i}
              ref={(el) => {
                markEls.current[i] = el
              }}
              className="absolute"
              style={{ left: `${m.x}%`, top: `${m.y}%`, transform: `translate(-50%,-50%) rotate(${m.rot}deg)` }}
            >
              <MarkShape m={m} />
            </div>
          ))}
        </div>

        {/* kinetic headline */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="overflow-hidden">
            <span
              className="block leading-[0.8] text-center"
              style={{ fontSize: 'clamp(3.4rem, 17vw, 15rem)', letterSpacing: '0.01em' }}
            >
              {renderLine(LINE1)}
            </span>
          </div>
          <div className="overflow-hidden">
            <span
              className="block leading-[0.8] text-center"
              style={{ fontSize: 'clamp(3.4rem, 17vw, 15rem)', letterSpacing: '0.01em', color: VIOLET }}
            >
              {renderLine(LINE2)}
            </span>
          </div>
        </div>

        <Control ea={ea} />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- control --- */

function Control({ ea }: { ea: EarlyAccess }) {
  const errorId = 'b-invite-error'
  return (
    <div className="b-ctl relative z-10 w-full">
      {ea.phase === 'swipe' ? (
        <div
          ref={ea.trackRef}
          role="button"
          tabIndex={0}
          aria-label="Unlock early access — drag the handle right, or press Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
              e.preventDefault()
              ea.swipeByKeyboard()
            }
          }}
          onPointerDown={ea.onPointerDown}
          className={cn(
            'relative mx-auto flex h-[66px] w-full max-w-[360px] cursor-pointer touch-none items-center rounded-[18px] select-none',
            'shadow-[0_14px_0_-2px_rgba(14,14,14,0.25)]',
            ea.shake && 'cs-shake',
          )}
          style={{ background: INK }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[7px] right-[7px] h-[52px] rounded-[13px]"
            style={{ width: ea.maxX - ea.knobX + 52, minWidth: 52, background: `${MAGENTA}55` }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-[12px] font-bold tracking-[0.18em] uppercase"
            style={{ color: LIME, opacity: 1 - ea.progress * 1.4 }}
          >
            Swipe to unlock
          </span>
          <div
            aria-hidden="true"
            className="absolute top-[7px] left-[7px] flex h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{
              background: MAGENTA,
              color: LIME,
              transform: `translateX(${ea.knobX}px)`,
              transition: ea.dragging ? 'none' : 'transform .5s cubic-bezier(.34,1.6,.5,1)',
            }}
          >
            <ArrowLeft className="h-6 w-6" />
          </div>
        </div>
      ) : (
        <form
          onSubmit={ea.submit}
          className={cn(
            'mx-auto flex h-[66px] w-full max-w-[360px] items-center rounded-[18px] p-[7px]',
            ea.isWrong ? 'ring-3 ring-[#c8341a]' : '',
            ea.shake && 'cs-shake',
          )}
          style={{ background: INK }}
        >
          <input
            value={ea.code}
            onChange={(e) => {
              ea.setCode(e.target.value)
              if (ea.isWrong) ea.setPhase('code')
            }}
            disabled={ea.isChecking || ea.leaving}
            placeholder="Enter invite code"
            aria-label="Invite code"
            aria-invalid={ea.isWrong}
            aria-describedby={ea.isWrong ? errorId : undefined}
            autoFocus
            className="min-w-0 flex-1 rounded-[12px] bg-transparent px-4 font-mono text-[14px] font-bold outline-none"
            style={{ color: LIME }}
          />
          <button
            type="submit"
            disabled={ea.isChecking || ea.leaving}
            aria-label="Submit invite code"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-70"
            style={{ background: MAGENTA, color: LIME }}
          >
            <ArrowRight className="h-6 w-6" />
          </button>
        </form>
      )}

      <div className="mx-auto mt-3 w-full max-w-[360px]">
        {ea.isWrong && (
          <p id={errorId} className="text-center font-mono text-[12px] font-bold" style={{ color: '#8a1600' }}>
            That invite code is not valid.
          </p>
        )}
        {ea.isChecking && (
          <p className="text-center font-mono text-[12px] font-bold opacity-70">Checking…</p>
        )}
      </div>
    </div>
  )
}
