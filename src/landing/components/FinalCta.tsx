import { useAuth } from '../../auth'
import { FINAL_CTA } from '../content'
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

    </Section>
  )
}
