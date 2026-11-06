import { useAuth } from '../../auth'
import { HERO } from '../content'
import { DragHeadline } from './DragHeadline'
import { Glimmer } from './Glimmer'
import { HeroWeek } from './HeroWeek'
import { Button } from './primitives'
import { useLandingNav } from '../hooks'

export function Hero() {
  const { user } = useAuth()
  const href = user ? '/app/free' : HERO.primaryCta.href
  const { goSection } = useLandingNav()

  return (
    <section id="top" className="lp-hero relative overflow-hidden px-4 pt-[104px] pb-14 sm:px-8 sm:pt-[128px] sm:pb-20">
      <Glimmer />
      <div className="relative mx-auto flex w-full max-w-[1120px] flex-col items-center text-center">
        <DragHeadline />
        <p className="lp-hero-sub">A calendar for your plans, tasks and the thoughts you want to keep.</p>
        <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button href={href} variant="inverse" size="lg" className="w-full sm:w-auto" arrow>
            Open my free calendar
          </Button>
          <a href="#preview" className="lp-hero-link" onClick={(e) => (e.preventDefault(), goSection('preview'))}>
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
