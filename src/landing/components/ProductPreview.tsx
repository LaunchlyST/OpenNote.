import { useState } from 'react'
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
  day: 'Thursday, October 8, 2026',
  week: `${DEMO_WEEK_TITLE}, 2026`,
  month: 'October 2026',
}

export function ProductPreview() {
  const { user } = useAuth()
  const [view, setView] = useState<MockView>('week')
  const index = Math.max(0, VIEW_OPTIONS.findIndex((o) => o.value === view))
  const active = VIEW_OPTIONS[index]

  return (
    <Section id="preview" tone="dark" className="overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,77,28,0.16),transparent_70%)]"
      />

      <div className="relative grid gap-8 lg:grid-cols-12 lg:items-end">
        <Reveal className="lg:col-span-7">
          <SectionHeading
            tone="dark"
            eyebrow="Live preview"
            index="03"
            heading={
              <>
                Take it for a spin. <span className="italic text-white/55">No account needed.</span>
              </>
            }
          />
        </Reveal>
        <Reveal delay={80} className="lg:col-span-5">
          <p className="max-w-[44ch] text-[17px] leading-relaxed text-white/65">
            This is the real OpenNote layout, filled with a sample week. Switch between Day, Full Week and Month
            using the control below or the tabs inside the window.
          </p>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <div className="relative mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Segmented control with a sliding indicator */}
          <div
            role="group"
            aria-label="Calendar view"
            className="relative grid w-full grid-cols-3 rounded-full bg-white/[0.07] p-1 ring-1 ring-white/10 sm:w-[360px]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-lp-surface shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {VIEW_OPTIONS.map((option) => {
              const selected = view === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  aria-pressed={selected}
                  className={
                    'relative z-10 rounded-full py-2.5 text-[14px] font-medium transition-colors duration-300 ' +
                    (selected ? 'text-lp-ink' : 'text-white/65 hover:text-white')
                  }
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <p aria-live="polite" className="font-mono text-[12px] text-white/50">
            <span className="text-lp-signal">●</span> {DATE_LABELS[view]} — {active.hint}
          </p>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <div className="relative mt-6">
          <ResponsiveAppWindow
            view={view}
            onViewChange={setView}
            dateLabel={DATE_LABELS[view]}
            label="opennote.app — sample data"
          />
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="relative mt-10 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[58ch] text-[13.5px] leading-relaxed text-white/45">
            Interactive demonstration with sample data. It is not connected to an account and nothing here can
            change your own calendar.
          </p>
          <Button href={user ? '/app' : HERO.primaryCta.href} variant="signal" size="lg" arrow className="shrink-0">
            {user ? 'Open My Calendar' : 'Start with your own week'}
          </Button>
        </div>
      </Reveal>
    </Section>
  )
}
