import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../lib/id'
import { Logo } from '../landing/components/primitives'
import { SITE, useDocumentMeta } from '../landing/seo'
import { useEarlyAccess } from '../landing/useEarlyAccess'
import type { EarlyAccess } from '../landing/useEarlyAccess'

/**
 * DESIGN C — Premium Colourful Editorial.
 *
 * Engine: an award-style magazine spread. A rich ultramarine field carries an
 * oversized high-contrast serif headline; a nameplate masthead (mark · issue ·
 * date) and hairline rules frame the composition. Motion is elegant — ink-like
 * mask-wipes and drawn underlines, never bouncy. The early-access control reads
 * as a refined editorial footer element rather than a widget.
 *
 * Hue family: ultramarine. Type: Instrument Serif + Inter. Skeleton: editorial
 * masthead grid — composed on a rule, not a centred hero or a colour-block.
 */

const BLUE = '#1f3bd6'
const DEEP = '#1629a6'
const CREAM = '#f4efe6'
const VERMILION = '#ff5230'
const LIME = '#c6f24e'

const WIPE = `linear-gradient(135deg, ${BLUE} 0%, ${DEEP} 100%)`

export function DesignC() {
  useDocumentMeta(`Coming Soon — ${SITE.name}`, SITE.description)
  const ea = useEarlyAccess({ wipe: WIPE })
  const root = useRef<HTMLDivElement | null>(null)
  const cursorDot = useRef<HTMLDivElement | null>(null)

  /* Entrance: masthead, then words mask-wipe like ink, then the rule draws. */
  useEffect(() => {
    if (ea.reduced) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.c-masthead', { opacity: 0, y: -12, duration: 0.5 }, 0)
        .from('.c-word > span', { yPercent: 115, duration: 0.7, stagger: 0.09 }, 0.12)
        .from('.c-rule', { scaleX: 0, transformOrigin: 'left', duration: 0.7, ease: 'power2.out' }, 0.5)
        // the underline is inline-hidden (dashoffset 1); draw it to 0 so it ends visible
        .to('.c-draw path', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, 0.6)
        .from('.c-meta > *', { opacity: 0, y: 14, duration: 0.5, stagger: 0.06 }, 0.55)
        .from('.c-ctl', { opacity: 0, y: 18, duration: 0.5 }, 0.7)
    }, root)
    return () => ctx.revert()
  }, [ea.reduced])

  /* A small vermilion dot trails the cursor — an elegant, quiet accent. */
  useEffect(() => {
    if (ea.reduced) return
    const onMove = (e: PointerEvent) => {
      gsap.to(cursorDot.current, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.7,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [ea.reduced])

  return (
    <section
      aria-label="Desknoty — coming soon (Design C)"
      className="fixed inset-0 overflow-hidden font-editorial"
      style={{ background: BLUE, color: CREAM }}
    >
      <h1 className="sr-only">Desknoty — Coming Soon</h1>
      {/* trailing accent */}
      <div
        ref={cursorDot}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-30 hidden h-3 w-3 rounded-full sm:block"
        style={{ background: VERMILION, mixBlendMode: 'screen' }}
      />
      <div
        ref={root}
        className={cn(
          'mx-auto flex h-full w-full max-w-[1400px] flex-col p-6 transition-opacity duration-500 sm:p-10',
          ea.leaving && 'opacity-0',
        )}
      >
        {/* masthead / nameplate */}
        <header className="c-masthead flex items-center justify-between border-b pb-3" style={{ borderColor: 'rgba(244,239,230,0.35)' }}>
          <Logo />
          <span className="font-sans text-[10px] font-semibold tracking-[0.32em] uppercase" style={{ color: CREAM }}>
            Issue 01 · Launching 2026
          </span>
        </header>

        {/* headline spread — distributed to fill the column: meta pinned top,
            the oversized headline in the optical centre, body above the control */}
        <div className="flex flex-1 flex-col justify-between gap-8 py-4">
          <div className="c-meta flex items-center gap-4 font-sans text-[11px] font-semibold tracking-[0.26em] uppercase">
            <span style={{ color: LIME }}>Coming</span>
            <span className="h-[1px] flex-1" style={{ background: 'rgba(244,239,230,0.3)' }} />
            <span style={{ color: VERMILION }}>Next</span>
          </div>

          <div>
          <div className="c-word overflow-hidden">
            <span
              className="block leading-[0.86]"
              style={{ fontSize: 'clamp(4rem, 30vw, 14rem)', letterSpacing: '-0.01em' }}
            >
              Coming
            </span>
          </div>
          <div className="c-word relative overflow-hidden">
            <span
              className="block leading-[0.86] italic"
              style={{ fontSize: 'clamp(4rem, 30vw, 14rem)', letterSpacing: '-0.01em', color: VERMILION }}
            >
              Soon
            </span>
            {/* hand-drawn underline */}
            <svg
              className="c-draw absolute -bottom-2 left-0 h-[26px] w-[min(460px,60%)]"
              viewBox="0 0 460 26"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 17C120 6 260 6 456 14"
                stroke={LIME}
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={1}
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              />
            </svg>
          </div>

          <div className="c-rule mt-8 h-[1.5px] w-full" style={{ background: 'rgba(244,239,230,0.45)' }} />
          </div>

          <div className="c-meta grid gap-4 sm:grid-cols-3">
            <p className="font-sans text-[13px] leading-snug" style={{ color: CREAM }}>
              <strong className="font-semibold">Desknoty</strong> is a calendar with
              room to think — days, notes and plans in one calm place.
            </p>
            <p className="font-sans text-[13px] leading-snug" style={{ color: 'rgba(244,239,230,0.75)' }}>
              A considered daily planner for people who want their schedule and
              their thinking side by side.
            </p>
            <p className="font-sans text-[13px] leading-snug" style={{ color: 'rgba(244,239,230,0.75)' }}>
              Early access is opening in limited waves. Hold your place below.
            </p>
          </div>
        </div>

        <ControlC ea={ea} />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- control --- */

function ControlC({ ea }: { ea: EarlyAccess }) {
  const errorId = 'c-invite-error'
  return (
    <div className="c-ctl w-full pt-6">
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
            'relative mx-auto flex h-[58px] w-full max-w-[560px] cursor-pointer touch-none items-center rounded-full border select-none',
            ea.shake && 'cs-shake',
          )}
          style={{ borderColor: 'rgba(244,239,230,0.6)', background: DEEP }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[3px] right-[3px] h-[50px] rounded-full"
            style={{
              width: ea.maxX - ea.knobX + 50,
              minWidth: 50,
              background: `linear-gradient(270deg, ${VERMILION}, ${VERMILION}22)`,
              opacity: 0.35 * ea.progress + 0.12,
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-sans text-[11px] font-semibold tracking-[0.26em] uppercase"
            style={{ color: CREAM, opacity: 1 - ea.progress * 1.4 }}
          >
            Slide for early access
          </span>
          <div
            aria-hidden="true"
            className="absolute top-[3px] left-[3px] flex h-[50px] w-[50px] items-center justify-center rounded-full"
            style={{
              background: CREAM,
              color: BLUE,
              transform: `translateX(${ea.knobX}px)`,
              transition: ea.dragging ? 'none' : 'transform .55s cubic-bezier(.22,1,.36,1)',
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </div>
        </div>
      ) : (
        <form
          onSubmit={ea.submit}
          className={cn(
            'mx-auto flex h-[58px] w-full max-w-[560px] items-center rounded-full border p-[3px]',
            ea.isWrong ? 'border-2' : '',
            ea.shake && 'cs-shake',
          )}
          style={{ borderColor: ea.isWrong ? VERMILION : 'rgba(244,239,230,0.6)', background: DEEP }}
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
            className="min-w-0 flex-1 rounded-full bg-transparent px-5 font-sans text-[14px] font-medium outline-none"
            style={{ color: CREAM }}
          />
          <button
            type="submit"
            disabled={ea.isChecking || ea.leaving}
            aria-label="Submit invite code"
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-70"
            style={{ background: VERMILION, color: CREAM }}
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}

      <div className="mx-auto mt-3 w-full max-w-[560px]">
        {ea.isWrong && (
          <p id={errorId} className="text-center font-sans text-[12px] font-semibold" style={{ color: '#ffd0c4' }}>
            That invite code is not valid.
          </p>
        )}
        {ea.isChecking && (
          <p className="text-center font-sans text-[12px] font-semibold opacity-70">Checking…</p>
        )}
      </div>
    </div>
  )
}
