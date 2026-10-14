import { useState } from 'react'
import { Check, Clock, Lock } from 'lucide-react'
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
    card: 'border-lp-ink/12 bg-lp-surface hover:shadow-[0_40px_70px_-44px_rgba(40,30,10,0.5)]',
    badge: '',
    price: 'text-lp-ink',
    period: 'text-lp-body',
    footnote: 'text-lp-muted',
    divider: 'bg-lp-ink/10',
    featureText: 'text-lp-body',
    mutedText: 'text-lp-muted',
  },
  lime: {
    card: 'border-lp-ink bg-lp-surface shadow-[8px_8px_0_0_var(--color-lp-ink)] hover:shadow-[12px_12px_0_0_var(--color-lp-ink)] hover:-translate-x-0.5 hover:-translate-y-0.5',
    badge: 'bg-lp-signal text-white',
    price: 'text-lp-ink',
    period: 'text-lp-signal',
    footnote: 'text-lp-muted',
    divider: 'bg-lp-ink/10',
    featureText: 'text-lp-ink',
    mutedText: 'text-lp-muted',
  },
  charcoal: {
    card: 'border-lp-ink bg-lp-ink text-white',
    badge: 'bg-lp-surface text-lp-ink ring-1 ring-lp-ink/15',
    price: 'text-white',
    period: 'text-white/60',
    footnote: 'text-white/45',
    divider: 'bg-white/10',
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
            isDark ? 'text-lp-signal' : 'text-lp-signal',
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
                : 'bg-lp-sunken text-lp-muted',
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
            'font-display text-[clamp(2.4rem,5vw,3rem)] leading-none',
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
            'font-display text-[clamp(3.6rem,8vw,5rem)] leading-none tracking-[-0.02em]',
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
          'relative flex h-full flex-col rounded-[28px] border p-6 transition-all duration-300 sm:p-8',
          t.card,
        )}
        aria-labelledby={`plan-${plan.id}`}
      >
        {/* Badge */}
        {plan.badge && (
          <span
            className={cn(
              'absolute -top-3.5 right-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10.5px] tracking-[0.08em] uppercase',
              t.badge,
            )}
          >
                        {plan.badge}
          </span>
        )}

        <header>
          <h3
            id={`plan-${plan.id}`}
            className={cn(
              'font-display text-[30px] leading-none',
              isDark ? 'text-white' : 'text-lp-ink',
            )}
          >
            {plan.name}
          </h3>
          <p
            className={cn(
              'mt-2',
              'font-mono text-[11.5px] tracking-[0.06em] uppercase',
              isDark ? 'text-white/50' : 'text-lp-signal',
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
                : 'border-lp-signal/25 bg-lp-signal-50 text-[#9a2c0b]',
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
                arrow
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
                  'inline-flex h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
                  'bg-lp-ink text-lp-surface',
                  'transition-all duration-200',
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
                    ? 'bg-lp-signal-50 text-[#9a2c0b] ring-1 ring-lp-signal/30'
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
                  'inline-flex h-[54px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
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
    <Section id="pricing" tone="muted">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <Reveal className="lg:col-span-7">
          <SectionHeading eyebrow={PRICING.eyebrow} index="04" heading={PRICING.heading} />
        </Reveal>
        <Reveal delay={80} className="lg:col-span-5">
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-lp-body">{PRICING.subtitle}</p>
        </Reveal>
      </div>

      <div className="mt-16 grid items-stretch gap-8 sm:mt-20 lg:grid-cols-3 lg:gap-6">
        {PRICING.plans.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} index={i} />
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mt-12 max-w-[80ch] border-t border-lp-ink/15 pt-6 text-[13.5px] leading-relaxed text-lp-muted">
          {PRICING.billingNote}
        </p>
      </Reveal>
    </Section>
  )
}
