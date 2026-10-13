import { useState } from 'react'
import { ArrowRight, Check, Clock, Lock, Sparkles } from 'lucide-react'
import { cn } from '../../lib/id'
import { PRICING } from '../content'
import type { Plan, PlanFeature } from '../content'
import { Button, Reveal, Section, SectionHeading } from './primitives'

/* ------------------------------------------------------------------ */
/* Card chrome                                                         */
/* ------------------------------------------------------------------ */

const THEME: Record<Plan['theme'], {
  card: string
  badge: string
  price: string
  period: string
  footnote: string
  divider: string
  featureText: string
  mutedText: string
}> = {
  neutral: {
    card: 'border-lp-line bg-white hover:border-[#dcdcd4] hover:shadow-[0_22px_48px_-28px_rgba(16,24,40,0.3)]',
    badge: '',
    price: 'text-lp-ink',
    period: 'text-lp-body',
    footnote: 'text-lp-muted',
    divider: 'border-lp-line',
    featureText: 'text-lp-body',
    mutedText: 'text-lp-muted',
  },
  lime: {
    card: 'border-lp-lime/45 bg-white ring-1 ring-lp-lime/25 shadow-[0_32px_64px_-28px_rgba(110,150,10,0.42)] hover:shadow-[0_40px_76px_-28px_rgba(110,150,10,0.5)]',
    badge: 'bg-lp-lime text-[#2c3608]',
    price: 'text-lp-ink',
    period: 'text-lp-lime-700',
    footnote: 'text-lp-muted',
    divider: 'border-lp-line',
    featureText: 'text-lp-ink',
    mutedText: 'text-lp-muted',
  },
  charcoal: {
    card: 'border-lp-charcoal bg-lp-charcoal text-white shadow-[0_32px_64px_-30px_rgba(20,22,28,0.55)]',
    badge: 'bg-white/10 text-white ring-1 ring-white/15',
    price: 'text-white',
    period: 'text-white/60',
    footnote: 'text-white/45',
    divider: 'border-white/10',
    featureText: 'text-white/85',
    mutedText: 'text-white/45',
  },
}

/* ------------------------------------------------------------------ */
/* Feature row                                                         */
/* ------------------------------------------------------------------ */

function FeatureRow({
  feature,
  theme,
}: {
  feature: PlanFeature
  theme: Plan['theme']
}) {
  const t = THEME[theme]
  const planned = feature.status === 'planned'
  const isDark = theme === 'charcoal'

  return (
    <li className="flex items-start gap-2.5">
      {planned ? (
        <Clock
          className={cn('mt-[3px] h-4 w-4 shrink-0', t.mutedText)}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      ) : (
        <Check
          className={cn(
            'mt-[3px] h-4 w-4 shrink-0',
            isDark ? 'text-lp-lime' : 'text-lp-lime-700',
          )}
          strokeWidth={2.8}
          aria-hidden="true"
        />
      )}

      <span className="min-w-0">
        <span
          className={cn(
            'text-[14.5px] leading-[1.45]',
            planned ? t.mutedText : t.featureText,
          )}
        >
          {feature.label}
        </span>
        {planned && (
          <span
            className={cn(
              'ml-2 inline-block translate-y-px rounded-full px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] uppercase',
              isDark
                ? 'bg-white/10 text-white/60'
                : 'bg-lp-sunken text-lp-muted ring-1 ring-lp-line',
            )}
          >
            Planned
          </span>
        )}
      </span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Price block                                                         */
/* ------------------------------------------------------------------ */

function PriceBlock({ plan }: { plan: Plan }) {
  const t = THEME[plan.theme]

  if (plan.price.amount === null) {
    return (
      <div className="min-h-[92px]">
        <p
          className={cn(
            'text-[clamp(1.5rem,3.4vw,1.9rem)] leading-tight font-semibold tracking-[-0.03em]',
            t.price,
          )}
        >
          Coming Soon
        </p>
        <p className={cn('mt-2 text-[13px]', t.footnote)}>{plan.price.footnote}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[92px]">
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[clamp(2.6rem,6vw,3.4rem)] leading-none font-semibold tracking-[-0.04em]',
            t.price,
          )}
        >
          {plan.price.currency}
          {plan.price.amount}
        </span>
        <span className={cn('text-[14.5px] font-medium', t.period)}>
          {plan.price.period}
        </span>
      </p>
      <p className={cn('mt-2.5 text-[12.5px] leading-relaxed', t.footnote)}>
        {plan.price.footnote}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const t = THEME[plan.theme]
  const isDark = plan.theme === 'charcoal'
  const [acknowledged, setAcknowledged] = useState(false)

  const hasPlanned = plan.features.some((f) => f.status === 'planned')

  return (
    <Reveal delay={index * 110} className="h-full">
      <article
        className={cn(
          'relative flex h-full flex-col rounded-[22px] border p-6 transition-all duration-300 sm:p-7',
          t.card,
        )}
        aria-labelledby={`plan-${plan.id}`}
      >
        {/* Badge */}
        {plan.badge && (
          <span
            className={cn(
              'absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.03em] shadow-[0_6px_16px_-8px_rgba(16,24,40,0.5)]',
              t.badge,
            )}
          >
            {plan.featured && <Sparkles className="h-3 w-3" aria-hidden="true" />}
            {plan.badge}
          </span>
        )}

        <header>
          <h3
            id={`plan-${plan.id}`}
            className={cn(
              'text-[19px] font-semibold tracking-[-0.02em]',
              isDark ? 'text-white' : 'text-lp-ink',
            )}
          >
            {plan.name}
          </h3>
          <p
            className={cn(
              'mt-1 text-[13px] font-medium',
              isDark ? 'text-lp-lime' : 'text-lp-lime-700',
            )}
          >
            {plan.tagline}
          </p>
          <p
            className={cn(
              'mt-3 text-[14.5px] leading-relaxed',
              isDark ? 'text-white/60' : 'text-lp-body',
            )}
          >
            {plan.description}
          </p>
        </header>

        <div className="mt-6">
          <PriceBlock plan={plan} />
        </div>

        <div className={cn('mt-6 mb-5 h-px', t.divider)} />

        <ul className="flex-1 space-y-2.5">
          {plan.features.map((feature) => (
            <FeatureRow key={feature.label} feature={feature} theme={plan.theme} />
          ))}
        </ul>

        {/* Membership reassurance, only where it applies */}
        {plan.id === 'pro' && (
          <p
            className={cn(
              'mt-6 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed',
              isDark
                ? 'border-white/10 bg-white/5 text-white/65'
                : 'border-lp-lime/40 bg-lp-lime-50/70 text-lp-lime-700',
            )}
          >
            {PRICING.membershipNote}
          </p>
        )}

        {/* CTA */}
        <div className="mt-6">
          {plan.cta.kind === 'signup' && (
            <>
              <Button
                href="/app/signup"
                variant="primary"
                size="lg"
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                {plan.cta.label}
              </Button>
              {plan.footnote && (
                <p className="mt-3 text-center text-[12.5px] text-lp-muted">
                  {plan.footnote}
                </p>
              )}
            </>
          )}

          {plan.cta.kind === 'unavailable' && (
            <>
              {/* Not a real purchase: no payment provider is wired up, so the
                  control explains the state instead of starting a checkout. */}
              <button
                type="button"
                aria-disabled="true"
                onClick={() => setAcknowledged(true)}
                className={cn(
                  'inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
                  'bg-lp-lime text-[#2c3608] shadow-[0_8px_22px_rgba(140,185,20,0.3)]',
                  'transition-all duration-200 hover:bg-[#b4ee56]',
                  'aria-disabled:hover:bg-lp-lime',
                )}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                {plan.cta.label}
              </button>
              <p
                role="status"
                className={cn(
                  'mt-3 rounded-xl px-3.5 py-2.5 text-center text-[12.5px] leading-relaxed transition-colors',
                  acknowledged
                    ? 'bg-lp-lime-50 text-lp-lime-700 ring-1 ring-lp-lime/45'
                    : 'bg-lp-sunken text-lp-muted',
                )}
              >
                {plan.cta.note}
              </p>
            </>
          )}

          {plan.cta.kind === 'disabled' && (
            <>
              <button
                type="button"
                disabled
                className={cn(
                  'inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
                  isDark
                    ? 'bg-white/10 text-white/50 ring-1 ring-white/10'
                    : 'bg-lp-sunken text-lp-muted',
                )}
              >
                {plan.cta.label}
              </button>
              {plan.footnote && (
                <p
                  className={cn(
                    'mt-3 text-center text-[12.5px]',
                    isDark ? 'text-white/45' : 'text-lp-muted',
                  )}
                >
                  {plan.footnote}
                </p>
              )}
            </>
          )}
        </div>

        {hasPlanned && plan.id !== 'pro' && (
          <p className={cn('mt-5 text-[12.5px] leading-relaxed', t.footnote)}>
            Items marked <span className="font-semibold">Planned</span> are not
            available yet.
          </p>
        )}
      </article>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Pricing() {
  return (
    <Section id="pricing">
      <Reveal>
        <SectionHeading
          eyebrow={PRICING.eyebrow}
          heading={PRICING.heading}
          description={PRICING.subtitle}
        />
      </Reveal>

      <div className="mt-14 grid items-stretch gap-6 sm:mt-16 lg:grid-cols-3 lg:gap-7">
        {PRICING.plans.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} index={i} />
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mx-auto mt-10 max-w-[72ch] text-center text-[13.5px] leading-relaxed text-lp-muted">
          {PRICING.billingNote}
        </p>
      </Reveal>
    </Section>
  )
}