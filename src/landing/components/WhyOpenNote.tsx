import { ArrowUpRight, CalendarDays, StickyNote } from 'lucide-react'
import { COLORS } from '../../lib/colors'
import { cn } from '../../lib/id'
import { WHY } from '../content'
import { DEMO_EVENTS, DEMO_NOTES } from '../demo'
import { Eyebrow, Reveal } from './primitives'

/**
 * Deliberately different in rhythm from the feature cards above: a dark,
 * editorial two-column panel rather than another grid of white cards.
 */
export function WhyOpenNote() {
  return (
    <section className="relative overflow-hidden bg-lp-charcoal px-5 py-20 sm:px-8 md:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="lp-drift absolute -top-32 left-[10%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(190,242,100,0.16),transparent_68%)] blur-3xl" />
        <div
          className="lp-drift absolute -right-20 -bottom-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.16),transparent_68%)] blur-3xl"
          style={{ animationDelay: '-11s' }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1180px] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        {/* Statement */}
        <Reveal>
          <div className="max-w-[46ch]">
            <Eyebrow>{WHY.eyebrow}</Eyebrow>

            <h2 className="mt-6 text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.04] font-semibold text-white">
              Less chaos.{' '}
              <span className="relative inline-block">
                <span className="relative z-10">More clarity.</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.3em] rounded-full bg-lp-lime/35"
                />
              </span>
            </h2>

            <p className="mt-6 text-[17px] leading-relaxed text-white/65">
              {WHY.description}
            </p>

            {/* Layered composition: the calendar and the notes, joined together */}
            <div className="mt-10">
              <TogetherVisual />
            </div>
          </div>
        </Reveal>

        {/* Benefits */}
        <Reveal delay={120}>
          <ul className="divide-y divide-white/10 rounded-[22px] border border-white/10 bg-white/[0.03] px-6 backdrop-blur-sm sm:px-7">
            {WHY.benefits.map((benefit) => (
              <li key={benefit.title} className="group py-5">
                <h3 className="flex items-start gap-2 text-[16.5px] font-semibold tracking-[-0.01em] text-white">
                  {benefit.title}
                  <ArrowUpRight
                    className="mt-[3px] h-4 w-4 shrink-0 text-lp-lime opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/55">
                  {benefit.body}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * A miniature "day + note" pairing, illustrating the central promise: the note
 * lives next to the schedule, not in another app.
 */
function TogetherVisual() {
  const dayEvents = DEMO_EVENTS.filter((e) => e.day === 3).slice(0, 3)
  const note = DEMO_NOTES[2]

  return (
    <div className="w-full max-w-[304px]">
      {/* Calendar layer */}
      <div className="w-[236px] overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-lp-lime" aria-hidden="true" />
          <span className="text-[11.5px] font-semibold text-white/85">Your day</span>
          <span className="ml-auto text-[10px] text-white/40">Wed 8 Oct</span>
        </div>
        <ul className="space-y-1.5 p-2.5">
          {dayEvents.map((e) => (
            <li
              key={e.title}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ background: COLORS[e.color].bg }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: COLORS[e.color].dot }}
              />
              <span
                className="truncate text-[11.5px] font-semibold"
                style={{ color: COLORS[e.color].text }}
              >
                {e.title}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Note layer, overlapping the calendar */}
      <div
        className={cn(
          'relative z-10 -mt-7 ml-10 w-[204px] -rotate-[2.5deg] rounded-2xl border border-[#f2e79c]/70 bg-[#fdf6ab] p-3.5',
          'shadow-[0_22px_48px_-22px_rgba(0,0,0,0.75)]',
        )}
      >
        <p className="flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.08em] text-[#a8952f] uppercase">
          <StickyNote className="h-3 w-3" aria-hidden="true" />
          {note.title}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-[1.55] text-[#7d6c1c]">
          {note.body[0]}
        </p>
        <span className="mt-2 inline-block rounded-md bg-[#f6ea92] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#7a6812]">
          Pinned to this day
        </span>
      </div>
    </div>
  )
}