import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../lib/id'
import { Logo } from '../landing/components/primitives'
import { SITE, useDocumentMeta } from '../landing/seo'
import { useEarlyAccess } from '../landing/useEarlyAccess'
import type { EarlyAccess } from '../landing/useEarlyAccess'

/**
 * DESIGN A — Happy Creative Studio.
 *
 * Engine: bold contemporary colour-blocking + asymmetric editorial. A confident
 * tangerine field carries an oversized left-stacked grotesque headline; a solid
 * ink panel anchors the right with a slowly-turning lime mark. Everything is
 * art-directed toward one feeling: the warm confidence of a studio that knows
 * it's shipping something good.
 *
 * Hue family: citrus (tangerine). Type: Space Grotesk. Skeleton: asymmetric
 * colour-block — deliberately not the centred-hero default.
 */

const TANGERINE = '#ff6a2b'
const INK = '#1c1108'
const CREAM = '#fff4e6'
const LIME = '#c6f24e'

const WIPE = `linear-gradient(135deg, ${TANGERINE} 0%, ${INK} 100%)`

export function DesignA() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const root = useRef<HTMLDivElement | null>(null)
  const mark = useRef<HTMLDivElement | null>(null)

  /* Entrance: headline protagonist first, then block, then control. */
  useEffect(() => {
    if (ea.reduced) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.a-line > span', { yPercent: 110, duration: 0.6, stagger: 0.07 }, 0)
        .from('.a-rule', { scaleX: 0, transformOrigin: 'left', duration: 0.5 }, 0.35)
        .from('.a-panel', { clipPath: 'inset(0 0 100% 0)', duration: 0.6 }, 0.15)
        .from('.a-mark', { scale: 0, rotate: -90, duration: 0.6, ease: 'back.out(1.6)' }, 0.4)
        .from('.a-top', { y: -14, opacity: 0, duration: 0.5, stagger: 0.05 }, 0.2)
        .from('.a-ctl', { y: 20, opacity: 0, duration: 0.5 }, 0.5)
    }, root)
    return () => ctx.revert()
  }, [ea.reduced])

  /* The lime mark leans toward the cursor — quiet, studio-grade life. */
  useEffect(() => {
    if (ea.reduced) return
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      gsap.to(mark.current, {
        x: nx * 26,
        y: ny * 26,
        rotate: `+=${nx * 6}`,
        duration: 0.8,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [ea.reduced])

  const leaving = ea.leaving

  return (
    <section
      aria-label="Desknoty — coming soon (Design A)"
      className="fixed inset-0 overflow-hidden font-grotesk"
      style={{ background: TANGERINE, color: INK }}
    >
      <h1 className="sr-only">Desknoty — Coming Soon</h1>
      <div
        ref={root}
        className={cn(
          'flex h-full w-full flex-col p-6 transition-opacity duration-500 sm:p-10',
          leaving && 'opacity-0',
        )}
      >
        {/* masthead */}
        <header className="a-top flex items-start justify-between">
          <Logo />
          <span className="a-top text-[11px] font-bold tracking-[0.28em] uppercase">
            Early&nbsp;Access · 2026
          </span>
        </header>

        {/* body */}
        <div className="grid flex-1 grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <div className="min-w-0">
            <div className="a-line overflow-hidden">
              <span
                className="block leading-[0.82] font-bold"
                style={{ fontSize: 'clamp(4rem, 15vw, 12rem)', letterSpacing: '-0.03em' }}
              >
                COMING
              </span>
            </div>
            <div className="a-line overflow-hidden">
              <span
                className="block leading-[0.82] font-bold"
                style={{ fontSize: 'clamp(4rem, 15vw, 12rem)', letterSpacing: '-0.03em' }}
              >
                SOON
              </span>
            </div>
            <div
              className="a-rule mt-4 h-[10px] w-[min(420px,70%)] rounded-full"
              style={{ background: LIME }}
            />
            <p className="a-top mt-6 max-w-[42ch] text-[15px] leading-snug font-medium opacity-80">
              Desknoty is a calendar with room to think — your days, notes and
              plans in one calm place. Opening soon.
            </p>
          </div>

          {/* colour-block panel with the studio mark */}
          <div
            className="a-panel relative hidden aspect-[4/5] w-full overflow-hidden lg:block"
            style={{ background: INK, borderRadius: 2 }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                ref={mark}
                className="a-mark select-none"
                style={{ color: LIME, fontSize: 'min(30vh, 260px)', lineHeight: 1 }}
                aria-hidden="true"
              >
                ✳
              </div>
            </div>
            <span
              className="absolute bottom-4 left-4 text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: CREAM }}
            >
              Launching 2026
            </span>
            <span
              className="absolute top-4 right-4 text-[10px] font-bold tracking-[0.3em] uppercase"
              style={{ color: LIME }}
            >
              v1.0
            </span>
          </div>
        </div>

        {/* control */}
        <ControlA ea={ea} />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- control --- */

function ControlA({ ea }: { ea: EarlyAccess }) {
  const errorId = 'a-invite-error'
  return (
    <div className="a-ctl w-full">
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
            'relative mx-auto flex h-[64px] w-full max-w-[420px] cursor-pointer touch-none items-center rounded-full select-none sm:mx-0',
            'shadow-[0_16px_40px_-18px_rgba(28,17,8,0.6)]',
            ea.shake && 'cs-shake',
          )}
          style={{ background: INK }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[6px] right-[6px] h-[52px] rounded-full"
            style={{
              width: ea.maxX - ea.knobX + 52,
              minWidth: 52,
              background: `linear-gradient(270deg, ${LIME}, ${LIME}22)`,
              opacity: 0.5 * ea.progress + 0.15,
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[12px] font-bold tracking-[0.22em] uppercase"
            style={{ color: CREAM, opacity: 1 - ea.progress * 1.4 }}
          >
            Unlock early access
          </span>
          <div
            aria-hidden="true"
            className="absolute top-[6px] left-[6px] flex h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{
              background: LIME,
              color: INK,
              transform: `translateX(${ea.knobX}px)`,
              transition: ea.dragging ? 'none' : 'transform .5s cubic-bezier(.34,1.5,.5,1)',
              boxShadow: 'inset -3px -5px 10px rgba(28,17,8,0.25)',
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </div>
        </div>
      ) : (
        <form
          onSubmit={ea.submit}
          className={cn(
            'mx-auto flex h-[64px] w-full max-w-[420px] items-center rounded-full p-[6px] sm:mx-0',
            ea.isWrong ? 'ring-2 ring-[#c8341a]' : '',
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
            placeholder="Enter your invite code"
            aria-label="Invite code"
            aria-invalid={ea.isWrong}
            aria-describedby={ea.isWrong ? errorId : undefined}
            autoFocus
            className="min-w-0 flex-1 rounded-full bg-transparent px-4 text-[14px] font-semibold outline-none placeholder:font-medium placeholder:tracking-normal"
            style={{ color: CREAM }}
          />
          <button
            type="submit"
            disabled={ea.isChecking || ea.leaving}
            aria-label="Submit invite code"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-70"
            style={{ background: LIME, color: INK }}
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}

      <div className="mx-auto mt-3 w-full max-w-[420px] sm:mx-0">
        {ea.isWrong && (
          <p id={errorId} className="text-center text-[12px] font-bold" style={{ color: '#7a1d0d' }}>
            That invite code is not valid.
          </p>
        )}
        {ea.isChecking && (
          <p className="text-center text-[12px] font-bold opacity-70">Checking…</p>
        )}
      </div>
    </div>
  )
}
