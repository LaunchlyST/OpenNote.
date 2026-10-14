import { useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Compass, LayoutGrid, Palette, Plus, StickyNote } from 'lucide-react'
import { COLORS } from '../../lib/colors'
import type { EventColorId } from '../../lib/colors'
import { cn } from '../../lib/id'
import { FEATURES } from '../content'
import { DEMO_CALENDARS, DEMO_EVENTS, DEMO_WEEKDAYS, demoClock } from '../demo'
import { MockDayTimeline, MockMonthGrid, MockNotes } from './mock/AppChrome'
import { EventComposer } from './mock/Closeups'
import { FitStage } from './mock/FitStage'
import { FeatureCard, Reveal, Section, SectionHeading } from './primitives'

const ICON = 'h-5 w-5'

/** The interface sits on the card floor, cropped by the card edge. */
function Screen({ children, expand }: { children: ReactNode; expand?: boolean }) {
  return (
    <div aria-hidden="true" data-anim={expand ? 'expand' : undefined} className="overflow-hidden rounded-t-[12px] border border-b-0 border-black/[0.08] bg-white shadow-[0_-8px_30px_-18px_rgba(0,0,0,0.25)]">
      {children}
    </div>
  )
}

/* Interactive calendar filter: the same four calendars as the app. */
function CalendarFilter() {
  const [enabled, setEnabled] = useState<Partial<Record<EventColorId, boolean>>>({
    lime: true,
    orange: true,
    purple: true,
    pink: true,
  })
  const days = [0, 1, 4]
  const shown = DEMO_EVENTS.filter((e) => enabled[e.color]).length

  return (
    <div className="pb-6 sm:pb-7">
      <div role="group" aria-label="Show calendars" className="flex flex-wrap gap-1.5">
        {DEMO_CALENDARS.map((c) => {
          const col = COLORS[c.color]
          const on = Boolean(enabled[c.color])
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              onClick={() => setEnabled((s) => ({ ...s, [c.color]: !s[c.color] }))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all duration-200',
                on ? 'border-transparent' : 'border-lp-line bg-white text-lp-muted',
              )}
              style={on ? { background: col.bg, color: col.text, boxShadow: `inset 0 0 0 1px ${col.border}` } : undefined}
            >
              <span
                className="grid h-3.5 w-3.5 place-items-center rounded-[4px]"
                style={{ background: on ? col.dot : 'transparent', boxShadow: `inset 0 0 0 1.5px ${col.dot}` }}
              >
                {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} aria-hidden="true" />}
              </span>
              {c.name}
            </button>
          )
        })}
      </div>
      <div className="mt-4 grid gap-2 rounded-[12px] border border-black/[0.06] bg-white p-3 sm:grid-cols-3">
        {days.map((d) => (
          <div key={d} className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-lp-muted uppercase">
              {DEMO_WEEKDAYS[d]} {5 + d}
            </p>
            <ul className="mt-1.5 space-y-1">
              {DEMO_EVENTS.filter((e) => e.day === d).map((e) => {
                const col = COLORS[e.color]
                const on = Boolean(enabled[e.color])
                return (
                  <li
                    key={e.title}
                    className={cn('rounded-md px-2 py-1 text-[11.5px] transition-opacity duration-300', !on && 'opacity-20')}
                    style={{ background: col.bg, color: col.text, boxShadow: `inset 2px 0 0 ${col.dot}` }}
                  >
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="opacity-75">{demoClock(e.start)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="mt-2.5 text-[12.5px] text-lp-muted">
        Showing {shown} of {DEMO_EVENTS.length} events this week
      </p>
    </div>
  )
}

function NavigateVisual() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-3 pt-4 pb-10">
      <div className="flex items-center gap-1.5 rounded-[12px] border border-black/[0.06] bg-white p-1.5 shadow-sm">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-lp-body"><ChevronLeft className="h-4 w-4" /></span>
        <span className="rounded-lg border border-lp-line px-3 py-1.5 text-[13px] font-medium">Today</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg text-lp-body"><ChevronRight className="h-4 w-4" /></span>
        <span className="px-2 text-[13px] font-semibold">October 5 – 11, 2026</span>
      </div>
      <div className="flex rounded-[10px] bg-[#ececea] p-1 text-[13px]">
        <span className="rounded-[7px] px-3.5 py-1.5 text-lp-body">Day</span>
        <span className="rounded-[7px] bg-white px-3.5 py-1.5 font-medium shadow-sm">Full Week</span>
        <span className="rounded-[7px] px-3.5 py-1.5 text-lp-body">Month</span>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <Section id="features">
      <Reveal>
        <SectionHeading
          icon={<CalendarDays className="h-6 w-6" />}
          tint="#d8ebff"
          heading="Your calendar and notes, finally together."
          description={FEATURES.description}
        />
      </Reveal>

      <div data-anim="assemble" className="mt-14 grid gap-4 md:mt-16">
        <Reveal data-anim-item="">
          <FeatureCard icon={<StickyNote className={ICON} />} title={FEATURES.notes.title} body={FEATURES.notes.body}>
            <Screen expand>
              <FitStage width={720} height={330} maxScale={1.45}>
                <div className="flex h-full">
                  <div className="min-w-0 flex-1">
                    <MockDayTimeline dateLabel="Thursday, October 8" />
                  </div>
                  <MockNotes count={3} className="w-[240px]" />
                </div>
              </FitStage>
            </Screen>
          </FeatureCard>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          <Reveal data-anim-item="">
            <FeatureCard icon={<Palette className={ICON} />} title={FEATURES.categories.title} body={FEATURES.categories.body}>
              <CalendarFilter />
            </FeatureCard>
          </Reveal>
          <Reveal data-anim-item="" delay={80}>
            <FeatureCard
              icon={<Plus className={ICON} />}
              title={FEATURES.compact[2].title}
              body={FEATURES.compact[2].body}
              visualClassName="flex justify-center"
            >
              <div aria-hidden="true" className="translate-y-6">
                <EventComposer caret />
              </div>
            </FeatureCard>
          </Reveal>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Reveal data-anim-item="">
            <FeatureCard icon={<LayoutGrid className={ICON} />} title={FEATURES.compact[0].title} body={FEATURES.compact[0].body}>
              <Screen>
                <FitStage width={420} height={250} maxScale={1.3}>
                  <MockMonthGrid dense />
                </FitStage>
              </Screen>
            </FeatureCard>
          </Reveal>
          <Reveal data-anim-item="" delay={80}>
            <FeatureCard icon={<Compass className={ICON} />} title={FEATURES.compact[1].title} body={FEATURES.compact[1].body}>
              <NavigateVisual />
            </FeatureCard>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
