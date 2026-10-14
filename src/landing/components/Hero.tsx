import type { ReactNode } from 'react'
import { BookOpen, CalendarDays, Clock, Coffee, PenLine, Pin, StickyNote, Sun } from 'lucide-react'
import { useAuth } from '../../auth'
import { cn } from '../../lib/id'
import { HERO } from '../content'
import { ResponsiveAppWindow } from './mock/AppWindow'
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

  return (
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
          <h1
            className="lp-bob mt-8 text-[clamp(2.6rem,7vw,5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-lp-ink"
            style={{ animationDelay: '110ms' }}
          >
            {HERO.titleLead}
            <br />
            {HERO.titleEmphasis}
          </h1>
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

        {/* The real interface, in a laptop */}
        <div className="lp-settle relative mx-auto mt-14 max-w-[1040px] sm:mt-16" style={{ animationDelay: '380ms' }}>
          <div className="rounded-[22px] bg-lp-ink p-2 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)] sm:p-3">
            <ResponsiveAppWindow view="week" label="opennote — week of October 5" />
          </div>
          <div aria-hidden="true" className="mx-auto hidden h-3.5 w-[108%] -translate-x-[3.7%] rounded-b-[18px] bg-gradient-to-b from-[#d9d9d6] to-[#bdbdb9] sm:block" />
          <span aria-hidden="true" className="absolute -bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border border-lp-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-lp-body shadow-sm sm:inline-flex">
            <PenLine className="h-3.5 w-3.5" /> Notes on the right <Pin className="ml-1 h-3.5 w-3.5" /> pinned to days
          </span>
        </div>
      </div>
    </section>
  )
}
