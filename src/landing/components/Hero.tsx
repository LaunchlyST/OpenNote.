import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTilt } from '../motion'
import { RollingHeadline } from './RollingHeadline'
import { BookOpen, ChevronLeft, ChevronRight, CalendarDays, Clock, Coffee, StickyNote, Sun } from 'lucide-react'
import { useAuth } from '../../auth'
import { cn } from '../../lib/id'
import { HERO } from '../content'
import { ResponsiveAppWindow } from './mock/AppWindow'
import { PREVIEW_TODAY } from '../today'
import { PLANS, ProOverlay, usePlanSwipe } from './PlanSwipe'
import { AppIcon, Button } from './primitives'

/** Small line-icon tiles scattered around the hero, each in a product colour. */
function Doodle({ children, tint, className }: { children: ReactNode; tint: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'lp-float absolute hidden h-11 w-11 place-items-center rounded-[11px] border-[1.5px] border-lp-ink text-lp-ink shadow-[3px_3px_0_0_#191919] xl:grid',
        className,
      )}
      style={{ background: tint }}
    >
      {children}
    </span>
  )
}

export function Hero() {
  const { user } = useAuth()
  const authed = Boolean(user)
  const primary = authed ? HERO.authenticatedCta : HERO.primaryCta
  const icon = 'h-5 w-5'
  const laptopRef = useRef<HTMLDivElement | null>(null)
  useTilt(laptopRef, 5)

  return (
    <HeroSwipeProvider>
    <section id="top" className="relative overflow-hidden bg-white px-5 pt-[120px] pb-8 sm:px-8 sm:pt-[140px]">
      <div className="relative mx-auto w-full max-w-[1200px]">
        {/* Doodles — desktop only, never over the copy */}
        <Doodle tint="#d8ebff" className="top-2 left-[6%] -rotate-6"><CalendarDays className={icon} /></Doodle>
        <Doodle tint="#ffdce9" className="top-[150px] left-[1%] rotate-6" ><Coffee className={icon} /></Doodle>
        <Doodle tint="#fdf3ad" className="top-[290px] left-[11%] -rotate-3"><StickyNote className={icon} /></Doodle>
        <Doodle tint="#e8f7b5" className="top-0 right-[7%] rotate-6"><Sun className={icon} /></Doodle>
        <Doodle tint="#ffe6cc" className="top-[160px] right-[1%] -rotate-6"><Clock className={icon} /></Doodle>
        <Doodle tint="#e6ddff" className="top-[300px] right-[12%] rotate-3"><BookOpen className={icon} /></Doodle>

        <div className="flex flex-col items-center text-center">
          <div className="lp-bob" style={{ animationDelay: '40ms' }}>
            <AppIcon className="h-[68px] w-[68px] text-[68px] shadow-[4px_4px_0_0_#191919]" />
          </div>
          <RollingHeadline
            lines={[HERO.titleLead, HERO.titleEmphasis]}
            className="mt-8 text-[clamp(2.6rem,7vw,5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-lp-ink"
          />
          <p
            className="lp-bob mt-5 max-w-[46ch] text-[clamp(1.02rem,1.6vw,1.2rem)] leading-relaxed text-lp-body"
            style={{ animationDelay: '180ms' }}
          >
            {HERO.description}
          </p>
          <div className="lp-bob mt-8 flex w-full flex-col items-center justify-center gap-2.5 sm:w-auto sm:flex-row" style={{ animationDelay: '240ms' }}>
            <Button href={primary.href} variant="primary" size="lg" className="w-full sm:w-auto" arrow>
              {primary.label}
            </Button>
            {authed ? (
              <Button href={HERO.signInCta.href} variant="secondary" size="lg" className="w-full sm:w-auto">
                Switch account
              </Button>
            ) : (
              <Button section={HERO.secondaryCta.section} variant="secondary" size="lg" className="w-full sm:w-auto">
                {HERO.secondaryCta.label}
              </Button>
            )}
          </div>
          <p className="lp-bob mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13.5px] text-lp-muted" style={{ animationDelay: '300ms' }}>
            {HERO.reassurance.map((item, i) => (
              <span key={item} className="flex items-center gap-4">
                {i > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-lp-line" />}
                {item}
              </span>
            ))}
          </p>
        </div>

        {/* Beta announcement — a small pill between the hero copy and the laptop */}
        <div
          className="lp-bob mx-auto mt-9 flex w-fit items-center gap-1.5 rounded-full border border-lp-line bg-lp-sunken px-3 py-1"
          style={{ animationDelay: '340ms' }}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#bef264] ring-1 ring-lp-ink/15" />
          <span className="text-[12px] font-semibold tracking-[0.02em] text-lp-body">Beta</span>
        </div>

        {/* The real interface, in a laptop */}
        <div className="lp-settle relative mx-auto mt-7 max-w-[1040px] sm:mt-8" style={{ animationDelay: '380ms' }}>
          <div data-anim="tilt">
          <div ref={laptopRef} className="relative rounded-[22px] bg-lp-ink p-2 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)] sm:p-3">
            <HeroPlanScreens />
          </div>
          <div aria-hidden="true" className="mx-auto hidden h-3.5 w-[108%] -translate-x-[3.7%] rounded-b-[18px] bg-gradient-to-b from-[#d9d9d6] to-[#bdbdb9] sm:block" />
          </div>
        </div>
        <HeroPlanDots />
      </div>
    </section>
    </HeroSwipeProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Free / Pro swipe on the hero laptop                                 */
/* ------------------------------------------------------------------ */

const HeroSwipeContext = createContext<ReturnType<typeof usePlanSwipe> | null>(null)

function HeroSwipeProvider({ children }: { children: ReactNode }) {
  const swipe = usePlanSwipe('hero-plan-tab')
  return <HeroSwipeContext.Provider value={swipe}>{children}</HeroSwipeContext.Provider>
}

function useHeroSwipe() {
  const swipe = useContext(HeroSwipeContext)
  if (!swipe) throw new Error('HeroSwipeProvider missing')
  return swipe
}

function HeroPlanScreens() {
  const { index, go, dragging, trackStyle, viewportProps } = useHeroSwipe()
  return (
    <>
      <div {...viewportProps} className={cn('overflow-hidden rounded-[14px] select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}>
        <div className="flex" style={trackStyle}>
          {PLANS.map((plan, i) => (
            <div
              key={plan.key}
              id={`hero-plan-panel-${plan.key}`}
              aria-label={plan.title}
              aria-hidden={index !== i}
              inert={index !== i}
              className="relative w-full shrink-0"
            >
              {plan.key === 'free' ? (
                <ResponsiveAppWindow view="week" label={`Desknoty — week of ${PREVIEW_TODAY.weekTitle.split(' –')[0]}`} />
              ) : (
                <>
                  <div aria-hidden="true" className="pointer-events-none select-none">
                    <ResponsiveAppWindow view="week" label="Desknoty pro — coming soon" />
                  </div>
                  <ProOverlay />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-label="Show Free plan"
        onClick={() => go(index - 1)}
        disabled={index === 0}
        className="absolute top-1/2 -left-4 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-lp-line bg-white text-lp-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:grid"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Show Pro plan preview"
        onClick={() => go(index + 1)}
        disabled={index === PLANS.length - 1}
        className="absolute top-1/2 -right-4 z-20 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-lp-line bg-white text-lp-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:grid"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  )
}

function HeroPlanDots() {
  const { index, go } = useHeroSwipe()
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      {PLANS.map((plan, i) => (
        <button key={plan.key} type="button" aria-label={`Go to ${plan.title}`} aria-current={index === i} onClick={() => go(i)} className="grid h-6 w-6 place-items-center">
          <span className={cn('block h-2 rounded-full motion-safe:transition-all motion-safe:duration-300', index === i ? 'w-6 bg-lp-ink' : 'w-2 bg-[#cfcdc6]')} />
        </button>
      ))}
    </div>
  )
}
