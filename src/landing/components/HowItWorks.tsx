import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react'
import { COLORS } from '../../lib/colors'
import { cn } from '../../lib/id'
import { HOW_IT_WORKS } from '../content'
import { Reveal, Section, SectionHeading } from './primitives'

/* ------------------------------------------------------------------ */
/* Step visuals — each one a different moment in the real app          */
/* ------------------------------------------------------------------ */

/** October 2026 starts on a Thursday; Monday-first grid → 3 leading blanks. */
const OCT_BLANKS = 3
const OCT_DAYS = 31
const SELECTED = 8
const TODAY = 5

function PickDayVisual() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-4 shadow-[0_20px_40px_-24px_rgba(40,30,10,0.4)] ring-1 ring-black/[0.05]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1f2330]">October 2026</span>
        <span className="flex gap-1 text-[#8b90a0]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center font-mono text-[10.5px]">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-1 text-[#a5aab8]">
            {d}
          </span>
        ))}
        {Array.from({ length: OCT_BLANKS }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: OCT_DAYS }, (_, i) => {
          const day = i + 1
          const selected = day === SELECTED
          const today = day === TODAY
          return (
            <span
              key={day}
              className={cn(
                'mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px]',
                selected && 'bg-lp-signal font-semibold text-white shadow-[0_6px_14px_-6px_rgba(255,77,28,0.9)]',
                today && !selected && 'font-semibold text-[#1f2330] ring-1 ring-[#1f2330]/25',
                !selected && !today && 'text-[#3d4354]',
              )}
            >
              {day}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function BlockTimeVisual() {
  const lime = COLORS.lime
  const hours = ['09:00', '10:00', '11:00', '12:00']
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-4 shadow-[0_20px_40px_-24px_rgba(40,30,10,0.4)] ring-1 ring-black/[0.05]">
      <p className="text-[13px] font-semibold text-[#1f2330]">Mon 5 October</p>
      <div className="relative mt-3 h-[216px]">
        {hours.map((h, i) => (
          <div key={h} className="absolute inset-x-0 flex items-start gap-2" style={{ top: i * 60 }}>
            <span className="w-9 shrink-0 -translate-y-1.5 font-mono text-[10px] text-[#a5aab8]">{h}</span>
            <span className="mt-0 h-px flex-1 bg-[#eceef2]" />
          </div>
        ))}
        {/* Existing event */}
        <div
          className="absolute right-0 left-11 rounded-lg px-2.5 py-1 text-[11px]"
          style={{ top: 0, height: 30, background: lime.bg, color: lime.text, boxShadow: `inset 3px 0 0 ${lime.dot}` }}
        >
          <span className="font-semibold">Morning planning</span>
        </div>
        {/* The one being created */}
        <div
          className="absolute right-0 left-11 rounded-lg px-2.5 py-1.5 text-[11px] ring-2 ring-lp-signal/70"
          style={{ top: 150, height: 60, background: lime.bg, color: lime.text, boxShadow: `inset 3px 0 0 ${lime.dot}` }}
        >
          <span className="block font-semibold">Design review</span>
          <span className="font-mono text-[10px] opacity-80">11:30 – 12:30</span>
        </div>
      </div>
    </div>
  )
}

function PinNoteVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[280px] pt-2">
      <div className="rotate-[-2deg] rounded-2xl bg-[#fdf6ab] p-4 shadow-[0_20px_40px_-22px_rgba(90,70,0,0.5)] ring-1 ring-[#eeda5c]/50">
        <p className="text-[14px] font-semibold text-[#2b2a14]">Ideas</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-[#3d3a1e]">Add a focus timer to the planner.</p>
        <p className="mt-1 text-[12.5px] leading-snug text-[#3d3a1e]">Try a softer accent for highlights.</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[10.5px] font-semibold text-[#7a6410]">
          <Pin className="h-3 w-3" aria-hidden="true" />
          Pin to day
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-[0_14px_30px_-20px_rgba(40,30,10,0.4)] ring-1 ring-black/[0.05]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-lp-ink font-mono text-[11px] text-white">8</span>
        <span className="text-[12px] text-[#3d4354]">
          <span className="font-semibold text-[#1f2330]">Thursday</span> · 1 note pinned
        </span>
        <span className="ml-auto h-2 w-2 rounded-full bg-lp-signal" />
      </div>
    </div>
  )
}

const VISUALS: ReactNode[] = [<PickDayVisual key="a" />, <BlockTimeVisual key="b" />, <PinNoteVisual key="c" />]

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <Reveal className="lg:col-span-7">
          <SectionHeading eyebrow={HOW_IT_WORKS.eyebrow} index="01" heading={HOW_IT_WORKS.heading} />
        </Reveal>
        <Reveal delay={80} className="lg:col-span-5">
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-lp-body">{HOW_IT_WORKS.description}</p>
        </Reveal>
      </div>

      <ol className="mt-16 grid gap-5 md:mt-20 lg:grid-cols-3">
        {HOW_IT_WORKS.steps.map((step, i) => (
          <Reveal as="li" key={step.number} delay={i * 110} className="h-full">
            <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-lp-ink/10 bg-lp-surface transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_40px_70px_-40px_rgba(40,30,10,0.45)]">
              <div className="lp-ruled relative flex min-h-[300px] items-center bg-lp-sunken/60 px-6 py-8">
                <span
                  aria-hidden="true"
                  className="absolute top-3 left-5 font-display text-[64px] leading-none text-lp-ink/10 italic"
                >
                  {step.number}
                </span>
                <div className="relative w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                  {VISUALS[i]}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <p className="font-mono text-[11px] tracking-[0.14em] text-lp-signal uppercase">Step {step.number}</p>
                <h3 className="mt-2 font-display text-[34px] leading-none text-lp-ink">{step.title}</h3>
                <p className="mt-3 text-[15.5px] leading-relaxed text-lp-body">{step.description}</p>
                <p className="mt-auto pt-5 font-mono text-[11.5px] text-lp-muted">{step.detail}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
