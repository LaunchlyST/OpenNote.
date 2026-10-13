import { CalendarDays, Clock, StickyNote } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/id'
import { HOW_IT_WORKS } from '../content'
import type { Step } from '../content'
import {
  MockMiniCalendar,
  MockNotes,
  MockWeekTimeline,
} from './mock/AppChrome'
import { Reveal, Section, SectionHeading } from './primitives'

const STEP_ICONS: Record<Step['icon'], ReactNode> = {
  calendar: <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2.1} />,
  clock: <Clock className="h-[18px] w-[18px]" strokeWidth={2.1} />,
  notes: <StickyNote className="h-[18px] w-[18px]" strokeWidth={2.1} />,
}

/** Trimmed note list so the third panel stays legible when scaled up. */
const DEMO_NOTES_ONE = [
  { title: 'Ideas', body: ['Add a focus timer to the planner.', 'Try a soft lime accent.'], tilt: '-rotate-[0.35deg]' },
  { title: 'Call back', body: ['Sam — invoice question before Friday.'], tilt: 'rotate-[0.3deg]' },
]

/** Each step gets its own slice of the real interface, not a generic icon. */
function StepVisual({ icon }: { icon: Step['icon'] }) {
  if (icon === 'calendar') {
    return (
      <div className="origin-top scale-[1.22] overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_12px_28px_-16px_rgba(16,24,40,0.3)] transition-transform duration-500 group-hover:scale-[1.26]">
        <MockMiniCalendar showCurrent={false} />
      </div>
    )
  }

  if (icon === 'clock') {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_12px_28px_-16px_rgba(16,24,40,0.3)]">
        <div className="h-[196px]">
          <MockWeekTimeline hours={false} dense />
        </div>
      </div>
    )
  }

  return (
    <div className="origin-top scale-[1.12] overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_12px_28px_-16px_rgba(16,24,40,0.3)] transition-transform duration-500 group-hover:scale-[1.16]">
      <div className="h-[208px]">
        <MockNotes count={2} notes={DEMO_NOTES_ONE} />
      </div>
    </div>
  )
}

const TINTS = [
  'from-lp-lime/45',
  'from-lp-blue/50',
  'from-lp-yellow/50',
]

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow={HOW_IT_WORKS.eyebrow}
          heading={HOW_IT_WORKS.heading}
          description={HOW_IT_WORKS.description}
        />
      </Reveal>

      {/* Connecting rule sits behind the cards on wide screens */}
      <div
        aria-hidden="true"
        className="relative mt-14 hidden lg:block"
      >
        <span className="absolute top-[86px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-lp-line to-transparent" />
      </div>

      <ol className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-7">
        {HOW_IT_WORKS.steps.map((step, i) => (
          <Reveal as="li" key={step.number} delay={i * 110}>
            <article
              className={cn(
                'group relative flex h-full flex-col rounded-[22px] border border-lp-line bg-white p-5',
                'shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300',
                'hover:-translate-y-1 hover:border-[#dcdcd4] hover:shadow-[0_20px_44px_-24px_rgba(16,24,40,0.28)]',
              )}
            >
              {/* Numbered badge */}
              <span className="absolute -top-3.5 left-5 z-10 grid h-8 min-w-8 place-items-center rounded-full bg-lp-charcoal px-2 text-[12px] font-semibold tracking-[0.04em] text-white shadow-[0_6px_14px_-6px_rgba(20,22,28,0.6)]">
                {step.number}
              </span>

              {/* Visual */}
              <div
                className={cn(
                  'relative mt-3 h-[210px] overflow-hidden rounded-2xl bg-gradient-to-br to-transparent p-4',
                  TINTS[i],
                )}
              >
                <StepVisual icon={step.icon} />
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lp-lime-50 text-lp-lime-700 ring-1 ring-lp-lime/45">
                  {STEP_ICONS[step.icon]}
                </span>
                <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-lp-ink">
                  {step.title}
                </h3>
              </div>

              <p className="mt-3 text-[15px] leading-relaxed text-lp-body">
                {step.description}
              </p>
            </article>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}