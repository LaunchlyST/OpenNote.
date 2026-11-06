import { useAuth } from '../../auth'
import { HERO } from '../content'
import { Glimmer } from './Glimmer'
import { HeroWeek } from './HeroWeek'
import { Button } from './primitives'

export function Hero() {
  const { user } = useAuth()
  const primary = user ? { label: 'Open my free calendar', href: '/app/free' } : HERO.primaryCta

  return (
    <section id="top" className="lp-hero relative overflow-hidden px-4 pt-[112px] pb-16 sm:px-8 sm:pt-[136px] sm:pb-24">
      <Glimmer />
      <div className="relative mx-auto flex w-full max-w-[1120px] flex-col items-center text-center">
        <span className="lp-hero-kicker">Calendar · tasks · notes</span>
        <h1 className="lp-hero-title">
          Plan the day.
          <br />
          <span>Keep the thought.</span>
        </h1>
        <p className="lp-hero-sub">Your calendar, tasks and notes in one place.</p>
        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button href={primary.href} variant="inverse" size="lg" className="w-full sm:w-auto" arrow>
            {primary.label}
          </Button>
          <a href="#preview" className="lp-hero-link">
            Try the demo <span aria-hidden="true">↓</span>
          </a>
        </div>
        <p className="lp-hero-free mt-4 text-[13.5px]">Free plan, no card required.</p>

        <div className="lp-hero-stage">
          <HeroWeek />
        </div>
      </div>
    </section>
  )
}
