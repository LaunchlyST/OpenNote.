import { useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { DEMO_WEEK_TITLE } from '../demo'
import { ResponsiveAppWindow } from './mock/AppWindow'
import type { MockView } from './mock/AppChrome'
import { Reveal, Section, SectionHeading } from './primitives'

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
  const [view, setView] = useState<MockView>('week')
  const index = Math.max(0, VIEW_OPTIONS.findIndex((o) => o.value === view))
  const active = VIEW_OPTIONS[index]

  return (
    <Section id="preview">
      <Reveal>
        <SectionHeading
          icon={<MousePointerClick className="h-6 w-6" />}
          tint="#ffdce9"
          heading="Try it right here."
          description="This is the real OpenNote layout with a sample week. Switch views below or with the tabs inside the window. No account needed."
        />
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-10 flex flex-col items-center gap-3">
          <div role="group" aria-label="Calendar view" className="relative grid w-full max-w-[340px] grid-cols-3 rounded-[12px] bg-[#ececea] p-1">
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-[9px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                    'relative z-10 rounded-[9px] py-2 text-[14px] font-medium transition-colors duration-300 ' +
                    (selected ? 'text-lp-ink' : 'text-lp-body hover:text-lp-ink')
                  }
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p aria-live="polite" className="text-[13.5px] text-lp-muted">
            {DATE_LABELS[view]} · {active.hint}
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="mt-8 rounded-[22px] bg-lp-sunken p-2 sm:p-6">
          <ResponsiveAppWindow view={view} onViewChange={setView} dateLabel={DATE_LABELS[view]} label="opennote — sample data" />
        </div>
        <p className="mt-4 text-center text-[13px] text-lp-muted">
          Sample data only. This demo isn’t connected to an account and can’t change your calendar.
        </p>
      </Reveal>
    </Section>
  )
}
