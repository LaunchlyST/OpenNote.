import { useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { cn } from '../../lib/id'
import { useAuth } from '../../auth'
import { HERO } from '../content'
import { DEMO_WEEK_TITLE } from '../demo'
import { ResponsiveAppWindow } from './mock/AppWindow'
import type { MockView } from './mock/AppChrome'
import { Button, Reveal, Section, SectionHeading } from './primitives'

const VIEW_OPTIONS: Array<{ value: MockView; label: string; hint: string }> = [
  { value: 'day', label: 'Day', hint: 'One day, hour by hour.' },
  { value: 'week', label: 'Full Week', hint: 'All seven days side by side.' },
  { value: 'month', label: 'Month', hint: 'The whole month at a glance.' },
]

const DATE_LABELS: Record<MockView, string> = {
  day: 'Wednesday, October 8, 2026',
  week: `${DEMO_WEEK_TITLE}, 2026`,
  month: 'October 2026',
}

export function ProductPreview() {
  const { user } = useAuth()
  const [view, setView] = useState<MockView>('week')
  const active = VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[1]

  return (
    <Section id="preview" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow="Preview"
          heading="See your day differently."
          description="Discover a cleaner way to organise your time."
        />
      </Reveal>

      <Reveal delay={90}>
        <div className="mt-10 flex flex-col items-center gap-4 sm:mt-12">
          {/* Primary view switcher — drives the same state as the in-app control */}
          <div
            role="group"
            aria-label="Calendar view"
            className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-lp-line bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            {VIEW_OPTIONS.map((option) => {
              const selected = view === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full px-4 py-2 text-[14px] font-medium transition-all duration-200',
                    selected
                      ? 'bg-lp-lime text-[#2c3608] shadow-[0_2px_8px_rgba(140,185,20,0.28)]'
                      : 'text-lp-body hover:bg-lp-sunken hover:text-lp-ink',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <p
            key={active.hint}
            aria-live="polite"
            className="lp-bob text-[14.5px] text-lp-muted"
          >
            {active.hint}
          </p>
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-8">
          <ResponsiveAppWindow
            view={view}
            onViewChange={setView}
            dateLabel={DATE_LABELS[view]}
            label="OpenNote — demonstration"
          />
        </div>
      </Reveal>

      <Reveal delay={180}>
        <p className="mx-auto mt-5 flex max-w-[62ch] items-start justify-center gap-2 rounded-xl border border-lp-line bg-white/70 px-4 py-3 text-left text-[13.5px] leading-relaxed text-lp-muted">
          <Info className="mt-[2px] h-4 w-4 shrink-0 text-lp-lime-700" aria-hidden="true" />
          <span>
            This is an interactive demonstration using sample data. It is not
            connected to an account and nothing here can change your own
            calendar.
          </span>
        </p>
      </Reveal>

      {/* Closing CTA */}
      <Reveal delay={220}>
        <div className="mt-14 flex flex-col items-center gap-5 text-center sm:mt-16">
          <h3 className="max-w-[20ch] text-[clamp(1.5rem,3vw,2.1rem)] leading-tight font-semibold tracking-[-0.03em] text-lp-ink">
            Ready to plan your day?
          </h3>
          <Button
            href={user ? '/app' : HERO.primaryCta.href}
            variant="primary"
            size="lg"
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            {user ? 'Open My Calendar' : 'Get Started Free'}
          </Button>
        </div>
      </Reveal>
    </Section>
  )
}