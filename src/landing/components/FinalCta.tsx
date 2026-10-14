import { useAuth } from '../../auth'
import { FINAL_CTA } from '../content'
import { MockWeekTimeline } from './mock/AppChrome'
import { FitStage } from './mock/FitStage'
import { Button, Reveal } from './primitives'

export function FinalCta() {
  const { user } = useAuth()
  return (
    <section className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[36px] bg-lp-signal px-6 pt-20 text-white sm:px-12 sm:pt-28">
        <div aria-hidden="true" className="lp-ruled-dark absolute inset-0 opacity-60" />
        <Reveal className="relative mx-auto max-w-[900px] text-center">
          <h2 className="font-display text-[clamp(3rem,8.5vw,7rem)] leading-[0.92] tracking-[-0.03em]">
            {FINAL_CTA.headingLead}
            <br />
            <span className="italic">{FINAL_CTA.headingEmphasis}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[48ch] text-[17px] leading-relaxed text-white/85">{FINAL_CTA.description}</p>
          <div className="mt-9 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button href={user ? '/app' : FINAL_CTA.primary.href} variant="primary" size="lg" arrow>
              {user ? 'Open My Calendar' : FINAL_CTA.primary.label}
            </Button>
            {!user && (
              <Button href={FINAL_CTA.secondary.href} variant="outline-dark" size="lg">
                {FINAL_CTA.secondary.label}
              </Button>
            )}
          </div>
        </Reveal>
        {/* The week grid rising out of the bottom edge */}
        <div aria-hidden="true" className="relative mx-auto mt-16 h-[180px] max-w-[980px] overflow-hidden rounded-t-[18px] bg-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] sm:h-[240px]">
          <FitStage width={720} height={360} maxScale={1.4}>
            <MockWeekTimeline />
          </FitStage>
        </div>
      </div>
    </section>
  )
}
