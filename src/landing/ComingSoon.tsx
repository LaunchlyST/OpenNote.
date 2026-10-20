import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../lib/id'
import { Logo } from './components/primitives'
import { SITE, useDocumentMeta } from './seo'
import { useEarlyAccess } from './useEarlyAccess'
import type { EarlyAccess } from './useEarlyAccess'

/**
 * Coming Soon — "The future is unlocked."
 *
 * The scene is a time lock: a dial of concentric calendar rings (months,
 * days, hours, weekdays) sitting out of register. Each ring carries one lit
 * cell and a few coloured event arcs. Dragging the early-access handle LEFT
 * turns every ring towards the needle; when the handle crosses the threshold
 * the lit cells line up, the keyhole turns and the headline rolls over from
 * "COMING soon." to "FUTURE unlocked." before the invite code is asked
 * for. A correct code (checked by the backend) spins the dial and wipes to
 * /landing.
 *
 * Type: Space Grotesk 700 against Instrument Serif italic, JetBrains Mono for
 * the instrument labels. Colour: midnight ink and warm paper, with tangerine,
 * cobalt, saffron and lilac used only as calendar "events".
 */

const INK = '#0c0b14'
const PAPER = '#f3eee4'
const TANGERINE = '#ff5b22'
const COBALT = '#4b5bff'
const SAFFRON = '#ffc23a'
const LILAC = '#b9a6ff'

const WIPE = `linear-gradient(160deg, ${TANGERINE} 0%, ${COBALT} 100%)`

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface Arc {
  colour: string
  /** Start angle (deg) measured from the lit cell, which rests at 9 o'clock. */
  at: number
  span: number
}

interface Ring {
  r: number
  labels: string[]
  lit: number
  size: number
  /** How far out of register (deg) the ring sits while locked. */
  offset: number
  /** Idle drift speed. */
  drift: number
  arcs: Arc[]
}

const RINGS: Ring[] = [
  {
    r: 452,
    labels: MONTHS,
    lit: 0,
    size: 19,
    offset: 74,
    drift: 1.1,
    arcs: [
      { colour: TANGERINE, at: 40, span: 46 },
      { colour: LILAC, at: 200, span: 22 },
    ],
  },
  {
    r: 366,
    labels: DAYS,
    lit: 0,
    size: 16,
    offset: -128,
    drift: -1.6,
    arcs: [
      { colour: COBALT, at: 70, span: 64 },
      { colour: SAFFRON, at: 250, span: 30 },
    ],
  },
  {
    r: 284,
    labels: HOURS,
    lit: 9,
    size: 14,
    offset: 156,
    drift: 2.2,
    arcs: [
      { colour: SAFFRON, at: 120, span: 52 },
      { colour: TANGERINE, at: 300, span: 18 },
    ],
  },
  {
    r: 206,
    labels: WEEK,
    lit: 0,
    size: 15,
    offset: -52,
    drift: -3,
    arcs: [{ colour: LILAC, at: 150, span: 78 }],
  },
]

/** Arc on a circle of radius r (0° = 12 o'clock, clockwise). */
function arcPath(r: number, from: number, span: number) {
  const a0 = ((from - 90) * Math.PI) / 180
  const a1 = ((from + span - 90) * Math.PI) / 180
  const p = (a: number) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`
  return `M${p(a0)} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${p(a1)}`
}

const HEAD_A = ['COMING', 'soon.']
const HEAD_B = ['FUTURE', 'unlocked.']

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function ComingSoon() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const now = useClock()
  const unlocked = ea.phase !== 'swipe'

  const root = useRef<HTMLDivElement | null>(null)
  const ringEls = useRef<Array<SVGGElement | null>>([])
  const secEl = useRef<SVGGElement | null>(null)
  const dialEl = useRef<HTMLDivElement | null>(null)

  // Values the animation loop reads every frame without re-subscribing.
  const live = useRef({ target: 0, leaving: false })
  useEffect(() => {
    live.current.target = unlocked ? 1 : ea.progress
    live.current.leaving = ea.leaving
  }, [unlocked, ea.progress, ea.leaving])

  /* Entrance: quiet → the needle draws, rings open out, events paint in. */
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (ea.reduced) {
        gsap.set('.tl-arc', { strokeDashoffset: 0 })
        return
      }
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from('.tl-needle', { scaleX: 0, transformOrigin: '100% 50%', duration: 0.9, ease: 'power3.inOut' })
        .from('.tl-hub', { scale: 0, transformOrigin: '50% 50%', duration: 0.7 }, '-=0.35')
        .from('.tl-ring', { scale: 0.55, opacity: 0, transformOrigin: '50% 50%', duration: 1.3, stagger: 0.09 }, '-=0.45')
        .to('.tl-arc', { strokeDashoffset: 0, duration: 1.1, stagger: 0.06, ease: 'power2.out' }, '-=0.9')
        .from('.tl-char-a', { yPercent: 115, duration: 1, stagger: 0.035 }, 0.55)
        .from('.tl-fade', { y: 14, opacity: 0, duration: 0.8, stagger: 0.08 }, 1)
    }, root)
    return () => ctx.revert()
  }, [ea.reduced])

  /* Dial loop: idle drift, drag-driven alignment, live seconds, exit spin. */
  useEffect(() => {
    const reduced = ea.reduced
    let raf = 0
    let last = performance.now()
    let s = 0
    let t = 0
    let spin = 0
    let spinV = 0
    let px = 0
    let tpx = 0
    const onMove = (e: PointerEvent) => {
      tpx = e.clientX / window.innerWidth - 0.5
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    const frame = (ms: number) => {
      const dt = Math.min(0.05, (ms - last) / 1000)
      last = ms
      const { target, leaving } = live.current
      if (reduced) {
        s = target
      } else {
        s += (target - s) * Math.min(1, dt * 7)
        t += dt * (1 - s)
        px += (tpx - px) * Math.min(1, dt * 3)
        if (leaving) spinV = Math.min(720, spinV + dt * 1400)
        spin += spinV * dt
      }
      const e = 1 - Math.pow(1 - s, 3)
      RINGS.forEach((ring, i) => {
        const el = ringEls.current[i]
        if (!el) return
        const dir = i % 2 ? -1 : 1
        const a = (ring.offset + ring.drift * t * 6 + px * 12 * dir) * (1 - e) + spin * dir * (1 + i * 0.3)
        el.setAttribute('transform', `rotate(${a.toFixed(2)})`)
      })
      if (secEl.current) {
        const d = new Date()
        const sec = d.getSeconds() + (reduced ? 0 : d.getMilliseconds() / 1000)
        secEl.current.setAttribute('transform', `rotate(${(sec * 6).toFixed(2)})`)
      }
      dialEl.current?.style.setProperty('--unlock', e.toFixed(3))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [ea.reduced])

  /* Headline letters lift gently towards the pointer. */
  useEffect(() => {
    if (ea.reduced) return
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>('.tl-lift') ?? [])
    const q = els.map((el) => ({ el, y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' }) }))
    const onMove = (e: PointerEvent) => {
      q.forEach(({ el, y }) => {
        const r = el.getBoundingClientRect()
        const d = Math.hypot(r.left + r.width / 2 - e.clientX, (r.top + r.height / 2 - e.clientY) * 0.6)
        y(d < 220 ? -(1 - d / 220) * 16 : 0)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [ea.reduced])

  const time = now
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--'
  const date = now
    ? now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()
    : ''

  return (
    <section
      aria-label="Desknoty — coming soon"
      className="fixed inset-0 overflow-hidden"
      style={{ background: INK, color: PAPER }}
    >
      <h1 className="sr-only">Desknoty — Coming Soon</h1>
      <div ref={root} className="relative h-full w-full">
        <div aria-hidden="true" className="tl-glow pointer-events-none absolute" />

        <Dial dialRef={dialEl} ringRefs={ringEls} secRef={secEl} unlocked={unlocked} leaving={ea.leaving} />

        <div className="relative z-10 flex h-full flex-col justify-between px-5 pt-5 pb-6 sm:px-10 sm:pt-8 sm:pb-10">
          <header className="tl-fade flex items-center justify-between gap-4">
            <Logo tone="paper" />
            <div aria-hidden="true" className="text-right font-mono text-[11px] leading-[1.5] tracking-[0.14em] uppercase opacity-70">
              <div className="tabular-nums">{time}</div>
              <div>{date}</div>
            </div>
          </header>

          <div className="flex flex-col gap-6 sm:gap-9">
            <div>
              <p className="tl-fade mb-3 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase sm:mb-5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full transition-all duration-500"
                  style={{ background: unlocked ? TANGERINE : PAPER, boxShadow: unlocked ? `0 0 14px ${TANGERINE}` : 'none' }}
                />
                <span>{unlocked ? 'The future is unlocked' : 'Calendar · Notes · Time'}</span>
              </p>
              <Headline unlocked={unlocked} />
            </div>
            <Control ea={ea} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- dial --- */

function Dial({
  dialRef,
  ringRefs,
  secRef,
  unlocked,
  leaving,
}: {
  dialRef: RefObject<HTMLDivElement | null>
  ringRefs: RefObject<Array<SVGGElement | null>>
  secRef: RefObject<SVGGElement | null>
  unlocked: boolean
  leaving: boolean
}) {
  return (
    <div ref={dialRef} aria-hidden="true" className="tl-dial pointer-events-none absolute" style={{ '--unlock': 0 } as CSSProperties}>
      <svg viewBox="-520 -520 1040 1040" className="h-full w-full overflow-visible">
        {/* the needle: from the hub out past 9 o'clock, towards the handle */}
        <g className="tl-needle">
          <line x1="-560" y1="0" x2="-140" y2="0" stroke={TANGERINE} strokeWidth="2" />
          <circle cx="-140" cy="0" r="6" fill={TANGERINE} />
        </g>

        {RINGS.map((ring, i) => {
          const step = 360 / ring.labels.length
          const phase0 = -90 - ring.lit * step
          const arcR = ring.r - 40
          return (
            <g key={i} className="tl-ring">
              <g
                ref={(el) => {
                  ringRefs.current[i] = el
                }}
              >
                <circle r={ring.r + 24} fill="none" stroke={PAPER} strokeOpacity="0.14" />
                {ring.arcs.map((arc, k) => {
                  const len = ((Math.PI * 2 * arcR) / 360) * arc.span + 40
                  return (
                    <path
                      key={k}
                      className="tl-arc"
                      d={arcPath(arcR, -90 + arc.at, arc.span)}
                      fill="none"
                      stroke={arc.colour}
                      strokeWidth="30"
                      strokeLinecap="round"
                      strokeDasharray={len}
                      strokeDashoffset={len}
                    />
                  )
                })}
                {ring.labels.map((label, k) => {
                  const lit = k === ring.lit
                  return (
                    <g key={k} transform={`rotate(${phase0 + k * step}) translate(0 ${-ring.r})`}>
                      {lit && (
                        <rect
                          x={-ring.size * 1.3}
                          y={-ring.size * 0.95}
                          width={ring.size * 2.6}
                          height={ring.size * 1.9}
                          rx={ring.size * 0.95}
                          fill={unlocked ? TANGERINE : PAPER}
                          style={{ transition: 'fill .5s ease' }}
                        />
                      )}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="JetBrains Mono, ui-monospace, monospace"
                        fontSize={ring.size}
                        fontWeight={500}
                        fill={lit ? INK : PAPER}
                        fillOpacity={lit ? 1 : 0.5}
                      >
                        {label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </g>
          )
        })}

        {/* hub: live seconds around a keyhole that turns open */}
        <g className="tl-hub">
          <circle r="134" fill={INK} stroke={PAPER} strokeOpacity="0.22" />
          {Array.from({ length: 60 }, (_, k) => (
            <line
              key={k}
              x1="0"
              y1={-120}
              x2="0"
              y2={k % 5 ? -113 : -104}
              stroke={PAPER}
              strokeOpacity={k % 5 ? 0.25 : 0.6}
              strokeWidth="2"
              transform={`rotate(${k * 6})`}
            />
          ))}
          <g ref={secRef}>
            <circle cx="0" cy="-120" r="6" fill={SAFFRON} />
          </g>
          <g
            style={{
              transform: `rotate(${unlocked ? 90 : 0}deg) scale(${leaving ? 1.25 : 1})`,
              transition: 'transform .9s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            <circle r="76" fill={unlocked ? TANGERINE : PAPER} style={{ transition: 'fill .5s ease' }} />
            <circle cy="-14" r="17" fill={INK} />
            <path d="M-10 -6 L10 -6 L16 36 L-16 36 Z" fill={INK} />
          </g>
        </g>
      </svg>
    </div>
  )
}

/* ----------------------------------------------------------- headline --- */

type LineState = 'in' | 'out-up' | 'out-down'

function HeadLine({ text, delay, state, charClass }: { text: string; delay: number; state: LineState; charClass?: string }) {
  const y = state === 'in' ? '0' : state === 'out-up' ? '-118%' : '118%'
  return (
    <span aria-hidden="true" className="block whitespace-nowrap">
      {[...text].map((ch, i) => (
        <span
          key={i}
          className="inline-block"
          style={{ transform: `translateY(${y})`, transition: `transform .85s cubic-bezier(.7,0,.2,1) ${delay + i * 28}ms` }}
        >
          <span className={cn('tl-lift inline-block', charClass)}>{ch === ' ' ? ' ' : ch}</span>
        </span>
      ))}
    </span>
  )
}

function Headline({ unlocked }: { unlocked: boolean }) {
  return (
    <div className="select-none">
      <p className="sr-only" aria-live="polite">
        {unlocked ? 'The future is unlocked.' : 'Coming soon.'}
      </p>
      {[0, 1].map((li) => {
        const serif = li === 1
        return (
          <div
            key={li}
            className={cn('relative overflow-hidden', serif ? 'tl-serif pr-[0.25em] pb-[0.1em]' : 'tl-sans pb-[0.04em]')}
            style={{ color: serif ? (unlocked ? TANGERINE : LILAC) : PAPER, transition: 'color .8s ease' }}
          >
            <HeadLine text={HEAD_A[li]} delay={serif ? 120 : 0} state={unlocked ? 'out-up' : 'in'} charClass="tl-char-a" />
            <div className="absolute inset-0">
              <HeadLine text={HEAD_B[li]} delay={serif ? 260 : 140} state={unlocked ? 'in' : 'out-down'} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ control --- */

const TICKS = 29

function Control({ ea }: { ea: EarlyAccess }) {
  const errorId = 'tl-invite-error'
  const passed = ea.progress
  return (
    <div className="tl-fade w-full max-w-[420px]">
      {ea.phase === 'swipe' ? (
        <div
          ref={ea.trackRef}
          role="button"
          tabIndex={0}
          aria-label="Unlock early access — drag the handle left, or press Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowLeft') {
              e.preventDefault()
              ea.swipeByKeyboard()
            }
          }}
          onPointerDown={ea.onPointerDown}
          className={cn(
            'relative flex h-[60px] w-full cursor-grab touch-none items-center rounded-full outline-none select-none active:cursor-grabbing',
            'focus-visible:ring-2 focus-visible:ring-[#ff5b22] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0c0b14]',
            ea.shake && 'cs-shake',
          )}
          style={{ background: 'rgba(243,238,228,0.06)', boxShadow: 'inset 0 0 0 1px rgba(243,238,228,0.18)', outline: 'none' }}
        >
          {/* the track is a timeline: its ticks light up as the handle passes */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-[30px] top-1/2 flex -translate-y-1/2 items-center justify-between">
            {Array.from({ length: TICKS }, (_, k) => {
              const lit = k / (TICKS - 1) >= 1 - passed
              return (
                <span
                  key={k}
                  className="block w-px"
                  style={{
                    height: k % 7 === 0 ? 16 : 8,
                    background: lit ? TANGERINE : PAPER,
                    opacity: lit ? 1 : 0.28,
                  }}
                />
              )
            })}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[6px] right-[6px] h-[48px] rounded-full"
            style={{
              width: ea.maxX - ea.knobX + 48,
              background: `linear-gradient(90deg, ${TANGERINE}, ${TANGERINE}10)`,
              opacity: Math.min(1, passed * 2.4),
              transition: ea.dragging ? 'none' : 'width .55s cubic-bezier(.34,1.56,.64,1), opacity .3s',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.2em] whitespace-nowrap uppercase"
            style={{ background: INK, opacity: Math.max(0, 1 - passed * 2) }}
          >
            Slide into the future
          </span>
          <div
            aria-hidden="true"
            className="absolute top-[6px] left-[6px] flex h-[48px] w-[48px] items-center justify-center rounded-full"
            style={{
              background: PAPER,
              color: INK,
              transform: `translateX(${ea.knobX}px)`,
              transition: ea.dragging ? 'none' : 'transform .55s cubic-bezier(.34,1.56,.64,1)',
              boxShadow: ea.dragging ? `0 0 0 8px ${TANGERINE}40` : `0 0 0 0 ${TANGERINE}00`,
            }}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>
      ) : (
        <form
          onSubmit={ea.submit}
          className={cn('cs-pop flex h-[60px] w-full items-center rounded-full p-[6px] focus-within:ring-2 focus-within:ring-[#ff5b22]/60', ea.shake && 'cs-shake')}
          style={{
            background: 'rgba(243,238,228,0.08)',
            boxShadow: `inset 0 0 0 ${ea.isWrong ? 2 : 1}px ${ea.isWrong ? TANGERINE : 'rgba(243,238,228,0.3)'}`,
          }}
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
            className="min-w-0 flex-1 bg-transparent px-5 focus-visible:outline-none font-mono text-[15px] tracking-[0.08em] outline-none placeholder:text-[#f3eee4]/45"
            style={{ color: PAPER, outline: 'none' }}
          />
          <button
            type="submit"
            disabled={ea.isChecking || ea.leaving}
            aria-label="Submit invite code"
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-70"
            style={{ background: TANGERINE, color: INK }}
          >
            <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </form>
      )}

      <div className="mt-3 min-h-[18px] px-2 font-mono text-[11px] tracking-[0.12em] uppercase">
        {ea.phase === 'swipe' && <p className="opacity-50">Early access · invite only</p>}
        {ea.phase === 'code' && <p className="opacity-60">Enter the code from your invite</p>}
        {ea.isChecking && <p className="opacity-60">Checking…</p>}
        {ea.leaving && <p className="opacity-60">Opening…</p>}
        {ea.isWrong && (
          <p id={errorId} role="alert" style={{ color: TANGERINE }}>
            That code didn’t open it. Check it and try again.
          </p>
        )}
      </div>
    </div>
  )
}
