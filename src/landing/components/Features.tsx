import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Palette,
  Plus,
  StickyNote,
  Sun,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { COLORS } from '../../lib/colors'
import { cn } from '../../lib/id'
import { DEMO_CALENDARS } from '../demo'
import { FEATURES } from '../content'
import type { FeatureItem } from '../content'
import {
  MockDayTimeline,
  MockMiniCalendar,
  MockNotes,
  MockWeekTimeline,
} from './mock/AppChrome'
import { Reveal, Section, SectionHeading } from './primitives'

const ICONS: Record<string, ReactNode> = {
  calendar: <CalendarDays className="h-[17px] w-[17px]" strokeWidth={2.1} />,
  clock: <Clock className="h-[17px] w-[17px]" strokeWidth={2.1} />,
  notes: <StickyNote className="h-[17px] w-[17px]" strokeWidth={2.1} />,
  palette: <Palette className="h-[17px] w-[17px]" strokeWidth={2.1} />,
  sun: <Sun className="h-[17px] w-[17px]" strokeWidth={2.1} />,
  compass: <Compass className="h-[17px] w-[17px]" strokeWidth={2.1} />,
}

/* ------------------------------------------------------------------ */
/* Per-feature visuals                                                 */
/* ------------------------------------------------------------------ */

function WeekVisual() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-lp-line bg-white shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
      <div className="h-[150px]">
        <MockWeekTimeline hours={false} dense />
      </div>
    </div>
  )
}

function EventVisual() {
  return (
    <div className="rounded-xl border border-lp-line bg-white p-3 shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
      <p className="mb-1.5 text-[9px] font-semibold tracking-[0.08em] text-lp-muted uppercase">
        Title
      </p>
      <p className="rounded-md border border-lp-line bg-white px-2 py-1.5 text-[11px] text-lp-ink">
        Client call
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {[
          ['Date', '2026-10-06'],
          ['Start', '10:00'],
          ['End', '10:45'],
        ].map(([label, value]) => (
          <span key={label}>
            <span className="mb-1 block text-[8.5px] font-medium text-lp-muted">{label}</span>
            <span className="block rounded-md border border-lp-line bg-white px-1.5 py-1 text-[10px] tabular-nums text-lp-ink">
              {value}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1">
        {(['lime', 'orange', 'pink', 'purple', 'yellow', 'blue'] as const).map((id) => (
          <span
            key={id}
            className={cn(
              'h-[13px] w-[13px] rounded-full ring-2 ring-white',
              id === 'lime' && 'ring-lp-lime-600',
            )}
            style={{ background: COLORS[id].dot }}
          />
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-lp-lime py-1.5 text-center text-[10.5px] font-semibold text-[#2c3608]">
        Save event
      </p>
    </div>
  )
}

function NotesVisual() {
  return (
    <div className="flex h-full origin-top-left scale-[0.86] flex-col overflow-hidden rounded-xl border border-lp-line bg-white shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
      <div className="h-[176px]">
        <MockNotes count={3} />
      </div>
    </div>
  )
}

function ColoursVisual() {
  return (
    <div className="rounded-xl border border-lp-line bg-white p-3 shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[8.5px] font-semibold tracking-[0.08em] text-lp-muted uppercase">
          My Calendars
        </p>
        <Plus className="h-3 w-3 text-lp-muted" strokeWidth={2.6} />
      </div>
      <ul className="space-y-1.5">
        {DEMO_CALENDARS.map((cal) => (
          <li key={cal.name} className="flex items-center gap-2">
            <span
              className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px]"
              style={{ background: COLORS[cal.color].dot }}
            >
              <svg viewBox="0 0 24 24" className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth={4}>
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[11px] text-lp-ink">{cal.name}</span>
            <span
              className="ml-auto h-1.5 w-1.5 rounded-full"
              style={{ background: COLORS[cal.color].dot }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function DayVisual() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-lp-line bg-white shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
      <div className="h-[150px]">
        <MockDayTimeline dayIndex={3} dateLabel="Wednesday" dense />
      </div>
    </div>
  )
}

function NavVisual() {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
      <div className="flex-1 rounded-xl border border-lp-line bg-white shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
        <MockMiniCalendar showCurrent />
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-lp-line bg-white px-3 py-2.5 shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
          <ChevronLeft className="h-3.5 w-3.5 text-lp-muted" />
          <span className="rounded-md border border-lp-line px-2 py-1 text-[10px] font-medium text-lp-body">
            Today
          </span>
          <span className="text-[11px] font-semibold text-lp-ink">October 5 – 11, 2026</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-lp-muted" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1.5 rounded-xl border border-lp-line bg-white p-3 shadow-[0_10px_24px_-16px_rgba(16,24,40,0.35)]">
          <div className="grid grid-cols-4 gap-1.5">
            {(['Day', 'Full Week', 'Month'] as const).map((label, i) => (
              <span
                key={label}
                className={cn(
                  'rounded-md px-2 py-1.5 text-center text-[10px] font-medium',
                  i === 1
                    ? 'bg-[#bef264] text-[#33400f]'
                    : 'bg-lp-sunken text-lp-body',
                )}
              >
                {label}
              </span>
            ))}
            <span className="rounded-md bg-lp-sunken px-2 py-1.5 text-center text-[10px] font-medium text-lp-body">
              T
            </span>
          </div>
          <p className="text-center text-[9px] text-lp-muted">
            Arrow keys move between dates · D / W / M switch view
          </p>
        </div>
      </div>
    </div>
  )
}

const VISUALS: Record<FeatureItem['visual'], ReactNode> = {
  week: <WeekVisual />,
  event: <EventVisual />,
  notes: <NotesVisual />,
  colours: <ColoursVisual />,
  day: <DayVisual />,
  nav: <NavVisual />,
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const VISUAL_HEIGHT: Record<FeatureItem['visual'], string> = {
  week: 'h-[150px]',
  event: 'h-[186px]',
  notes: 'h-[150px]',
  colours: 'h-[186px]',
  day: 'h-[150px]',
  nav: 'h-[158px]',
}

export function Features() {
  return (
    <Section id="features">
      <Reveal>
        <SectionHeading
          eyebrow={FEATURES.eyebrow}
          heading={FEATURES.heading}
          description={FEATURES.description}
        />
      </Reveal>

      <div className="mt-14 grid gap-5 sm:mt-16 lg:grid-cols-12">
        {FEATURES.items.map((feature, i) => (
          <Reveal key={feature.id} delay={(i % 3) * 90} className={feature.colClass}>
            <article
              className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-lp-line bg-white',
                'shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300',
                'hover:-translate-y-1 hover:border-[#dcdcd4] hover:shadow-[0_24px_52px_-28px_rgba(16,24,40,0.32)]',
              )}
            >
              {/* Wash */}
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100',
                  feature.wash,
                )}
              />

              <div className="relative flex items-start gap-3 p-5 pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lp-lime-50 text-lp-lime-700 ring-1 ring-lp-lime/45 transition-transform duration-300 group-hover:scale-105">
                  {ICONS[feature.icon]}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-lp-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-lp-body">
                    {feature.description}
                  </p>
                </div>
              </div>

              <div className="relative mt-auto px-5 pb-5">
                <div className={cn('overflow-hidden', VISUAL_HEIGHT[feature.visual])}>
                  <div className="h-full transition-transform duration-500 group-hover:-translate-y-0.5">
                    {VISUALS[feature.visual]}
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}