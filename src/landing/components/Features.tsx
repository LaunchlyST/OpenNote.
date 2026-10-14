import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { COLORS } from '../../lib/colors'
import type { EventColorId } from '../../lib/colors'
import { cn } from '../../lib/id'
import { FEATURES } from '../content'
import { DEMO_CALENDARS, DEMO_EVENTS, DEMO_WEEKDAYS, demoClock } from '../demo'
import { MockDayTimeline, MockMonthGrid, MockNotes } from './mock/AppChrome'
import { EventComposer } from './mock/Closeups'
import { FitStage } from './mock/FitStage'
import { Eyebrow, Reveal, Section, SectionHeading } from './primitives'

/* ------------------------------------------------------------------ */
/* A — Notes beside the calendar (split, interface close-up)           */
/* ------------------------------------------------------------------ */

function NotesShowcase() {
  const f = FEATURES.notes
  return (
    <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
      <Reveal className="lg:col-span-5">
        <Eyebrow>{f.kicker}</Eyebrow>
        <h3 className="mt-5 max-w-[14ch] font-display text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1] text-lp-ink">
          {f.title}
        </h3>
        <p className="mt-5 max-w-[46ch] text-[16.5px] leading-relaxed text-lp-body">{f.body}</p>
        <ul className="mt-7 divide-y divide-lp-ink/10 border-y border-lp-ink/10">
          {f.points.map((p) => (
            <li key={p} className="flex items-center gap-3 py-3.5 text-[15px] text-lp-ink">
              <Check className="h-4 w-4 text-lp-signal" strokeWidth={2.5} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[46ch] text-[14.5px] leading-relaxed text-lp-muted">
          <span className="font-medium text-lp-ink">{FEATURES.daily.title}</span> {FEATURES.daily.body}
        </p>
      </Reveal>

      <Reveal delay={120} className="lg:col-span-7">
        <div className="relative rounded-[32px] bg-[#e4ddcd] p-4 sm:p-8">
          <div aria-hidden="true" className="overflow-hidden rounded-[18px] bg-white shadow-[0_40px_80px_-40px_rgba(40,30,10,0.55)] ring-1 ring-black/[0.06]">
            <FitStage width={420} height={392} maxScale={1.75}>
              <div className="flex h-full">
                <div className="min-w-0 flex-1">
                  <MockDayTimeline dateLabel="Thursday, October 8" />
                </div>
                <MockNotes count={3} />
              </div>
            </FitStage>
          </div>
          <p className="mt-4 text-center font-mono text-[11px] tracking-[0.1em] text-[#7d7562] uppercase">
            Day view with the notes panel open
          </p>
        </div>
      </Reveal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* B — Colour-coded calendars (interactive)                            */
/* ------------------------------------------------------------------ */

function CategoriesShowcase() {
  const f = FEATURES.categories
  const [enabled, setEnabled] = useState<Record<EventColorId, boolean>>(() => ({
    lime: true,
    orange: true,
    purple: true,
    pink: true,
    yellow: true,
    blue: true,
  }))

  const minutesBy = useMemo(() => {
    const totals = new Map<EventColorId, number>()
    for (const e of DEMO_EVENTS) totals.set(e.color, (totals.get(e.color) ?? 0) + e.duration)
    return totals
  }, [])
  const totalShown = DEMO_CALENDARS.reduce((sum, c) => sum + (enabled[c.color] ? minutesBy.get(c.color) ?? 0 : 0), 0)
  const visible = DEMO_EVENTS.filter((e) => enabled[e.color])

  return (
    <div className="overflow-hidden rounded-[36px] bg-lp-ink text-lp-surface">
      <div className="lp-ruled-dark grid gap-12 p-6 sm:p-10 lg:grid-cols-12 lg:gap-14 lg:p-14">
        <Reveal className="lg:col-span-5">
          <Eyebrow tone="dark">{f.kicker}</Eyebrow>
          <h3 className="mt-5 max-w-[14ch] font-display text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1]">{f.title}</h3>
          <p className="mt-5 max-w-[44ch] text-[16.5px] leading-relaxed text-white/65">{f.body}</p>

          <div role="group" aria-label="Show calendars" className="mt-8 grid grid-cols-2 gap-2.5">
            {DEMO_CALENDARS.map((c) => {
              const col = COLORS[c.color]
              const on = enabled[c.color]
              const hours = (minutesBy.get(c.color) ?? 0) / 60
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEnabled((s) => ({ ...s, [c.color]: !s[c.color] }))}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-300',
                    on ? 'border-white/15 bg-white/[0.07]' : 'border-white/[0.06] bg-transparent opacity-50 hover:opacity-80',
                  )}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors"
                    style={{ background: on ? col.dot : 'transparent', boxShadow: `inset 0 0 0 1.5px ${col.dot}` }}
                  >
                    {on && <Check className="h-3 w-3 text-lp-ink" strokeWidth={3} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{c.name}</span>
                    <span className="block font-mono text-[11px] text-white/45">{hours.toFixed(1)} h this week</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Share of the week, per calendar */}
          <div className="mt-6" aria-hidden="true">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              {DEMO_CALENDARS.map((c) => {
                const share = totalShown ? ((enabled[c.color] ? minutesBy.get(c.color) ?? 0 : 0) / totalShown) * 100 : 0
                return (
                  <span
                    key={c.name}
                    className="h-full transition-[width] duration-500 ease-out"
                    style={{ width: `${share}%`, background: COLORS[c.color].dot }}
                  />
                )
              })}
            </div>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              {(totalShown / 60).toFixed(1)} h shown · sample week
            </p>
          </div>
        </Reveal>

        <Reveal delay={120} className="lg:col-span-7">
          <div className="rounded-[22px] bg-white p-3 text-[#1f2330] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] sm:p-4">
            <div className="flex items-center justify-between px-1.5 pb-3">
              <span className="text-[14px] font-semibold">Week of October 5</span>
              <span aria-live="polite" className="font-mono text-[11px] text-[#8b90a0]">
                {visible.length} of {DEMO_EVENTS.length} events
              </span>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {DEMO_WEEKDAYS.map((day, i) => {
                const events = DEMO_EVENTS.filter((e) => e.day === i)
                return (
                  <li key={day} className="rounded-2xl bg-[#f7f8fa] p-3">
                    <p className="font-mono text-[10.5px] tracking-[0.1em] text-[#8b90a0] uppercase">
                      {day} {5 + i}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {events.map((e) => {
                        const col = COLORS[e.color]
                        const on = enabled[e.color]
                        return (
                          <li
                            key={e.title}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-all duration-300',
                              !on && 'opacity-25 grayscale',
                            )}
                            style={{ background: col.bg, color: col.text }}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: col.dot }} />
                            <span className="truncate font-medium">{e.title}</span>
                            <span className="ml-auto shrink-0 font-mono text-[10.5px] opacity-75">{demoClock(e.start)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* C — Compact supporting cards                                        */
/* ------------------------------------------------------------------ */

function NavigateVisual() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-black/[0.06]">
          <ChevronLeft className="h-4 w-4" />
        </span>
        <span className="rounded-full bg-white px-4 py-2.5 text-[13px] font-medium ring-1 ring-black/[0.06]">Today</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-black/[0.06]">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <div className="flex rounded-full bg-white p-1 text-[12.5px] ring-1 ring-black/[0.06]">
        <span className="rounded-full px-3.5 py-1.5 text-[#5b6172]">Day</span>
        <span className="rounded-full bg-lp-ink px-3.5 py-1.5 text-white">Full Week</span>
        <span className="rounded-full px-3.5 py-1.5 text-[#5b6172]">Month</span>
      </div>
    </div>
  )
}

function CompactCards() {
  const visuals: Record<string, ReactNode> = {
    month: (
      <div aria-hidden="true" className="w-full overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]">
        <FitStage width={300} height={200} maxScale={1.4}>
          <MockMonthGrid dense />
        </FitStage>
      </div>
    ),
    navigate: <NavigateVisual />,
    create: (
      <div aria-hidden="true" className="origin-center scale-[0.82]">
        <EventComposer title="Lunch & learn" calendar="pink" caret={false} />
      </div>
    ),
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {FEATURES.compact.map((card, i) => (
        <Reveal key={card.id} delay={i * 90} className="h-full">
          <article className="group flex h-full flex-col rounded-[28px] border border-lp-ink/10 bg-lp-surface p-3 transition-shadow duration-500 hover:shadow-[0_34px_60px_-36px_rgba(40,30,10,0.45)]">
            <div className="grid min-h-[260px] place-items-center overflow-hidden rounded-[20px] bg-lp-sunken/70 p-5">
              {visuals[card.id]}
            </div>
            <div className="flex items-start justify-between gap-4 p-4 pt-5">
              <div>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-lp-ink">{card.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-lp-body">{card.body}</p>
              </div>
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 -translate-x-1 text-lp-signal opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Features() {
  return (
    <Section id="features" className="pt-8 md:pt-12">
      <Reveal>
        <SectionHeading eyebrow={FEATURES.eyebrow} index="02" heading={FEATURES.heading} description={FEATURES.description} />
      </Reveal>

      <div className="mt-16 space-y-24 md:mt-24 md:space-y-32">
        <NotesShowcase />
        <CategoriesShowcase />
        <CompactCards />
      </div>
    </Section>
  )
}
