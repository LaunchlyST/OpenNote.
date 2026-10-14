import { Monitor, Smartphone } from 'lucide-react'
import { useAuth } from '../../auth'
import { FINAL_CTA } from '../content'
import { AppWindow, AppWindowMobile } from './mock/AppWindow'
import { AppIcon, Button, Reveal, Section } from './primitives'

export function FinalCta() {
  const { user } = useAuth()
  return (
    <Section className="pt-10 md:pt-16">
      <Reveal className="flex flex-col items-center text-center">
        <span data-anim="tile" className="inline-block"><AppIcon className="h-14 w-14 text-[56px] shadow-[3px_3px_0_0_#191919]" /></span>
        <h2 data-anim="mask" className="mt-7 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-lp-ink">
          {FINAL_CTA.headingLead} {FINAL_CTA.headingEmphasis}
        </h2>
        <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-lp-body">{FINAL_CTA.description}</p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <Button href={user ? '/app' : FINAL_CTA.primary.href} variant="primary" size="lg" arrow>
            {user ? 'Open My Calendar' : FINAL_CTA.primary.label}
          </Button>
          {!user && (
            <Button href={FINAL_CTA.secondary.href} variant="secondary" size="lg">
              {FINAL_CTA.secondary.label}
            </Button>
          )}
        </div>
      </Reveal>

      <div data-anim="rise3d" className="mt-16 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Reveal>
          <article data-anim-item="" className="flex h-full flex-col overflow-hidden rounded-[18px] bg-lp-sunken">
            <div className="flex items-center gap-2 p-6 text-[16px] font-semibold text-lp-ink sm:p-7">
              <Monitor className="h-5 w-5" aria-hidden="true" /> On your computer
            </div>
            <div aria-hidden="true" className="mt-auto pl-6 sm:pl-7">
              <div className="overflow-hidden rounded-tl-[12px]">
                <AppWindow view="month" dateLabel="October 2026" label="opennote — month" />
              </div>
            </div>
          </article>
        </Reveal>
        <Reveal delay={80}>
          <article data-anim-item="" className="flex h-full flex-col overflow-hidden rounded-[18px] bg-lp-sunken">
            <div className="flex items-center gap-2 p-6 text-[16px] font-semibold text-lp-ink sm:p-7">
              <Smartphone className="h-5 w-5" aria-hidden="true" /> On your phone
            </div>
            <div aria-hidden="true" className="mx-auto mt-auto h-[300px] w-[240px] overflow-hidden">
              <AppWindowMobile view="day" />
            </div>
          </article>
        </Reveal>
      </div>
      <p className="mt-4 text-center text-[13px] text-lp-muted">OpenNote runs in your browser on desktop and mobile.</p>
    </Section>
  )
}
