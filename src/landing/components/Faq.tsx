import { useState } from 'react'
import { cn } from '../../lib/id'
import { FAQ } from '../content'
import { Reveal, Section, SectionHeading } from './primitives'

export function Faq() {
  // The first question starts open so the section never reads as a dead list.
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <SectionHeading eyebrow={FAQ.eyebrow} index="05" heading={FAQ.heading} />
            <p className="mt-6 max-w-[34ch] text-[15.5px] leading-relaxed text-lp-body">
              Straight answers about what OpenNote does today, and what is still on the way.
            </p>
          </div>
        </Reveal>

        <Reveal delay={90} className="lg:col-span-8">
          <ul className="border-t border-lp-ink/15">
            {FAQ.items.map((item, i) => {
              const open = openIndex === i
              const buttonId = `faq-button-${i}`
              const panelId = `faq-panel-${i}`
              return (
                <li key={item.question} className="border-b border-lp-ink/15">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className="group flex w-full items-baseline gap-5 py-6 text-left sm:py-7"
                    >
                      <span className="w-7 shrink-0 font-mono text-[12px] text-lp-muted transition-colors group-hover:text-lp-signal">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.1] transition-colors',
                          open ? 'text-lp-ink' : 'text-lp-ink/80 group-hover:text-lp-ink',
                        )}
                      >
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'relative grid h-9 w-9 shrink-0 translate-y-1 place-items-center rounded-full border transition-all duration-300',
                          open ? 'border-lp-ink bg-lp-ink text-lp-surface' : 'border-lp-ink/20 text-lp-ink group-hover:border-lp-ink/50',
                        )}
                      >
                        <span className="absolute h-[1.5px] w-3 bg-current" />
                        <span className={cn('absolute h-3 w-[1.5px] bg-current transition-transform duration-300', open && 'scale-y-0')} />
                      </span>
                    </button>
                  </h3>
                  {/* Height animates with the grid-rows technique — no JS measurement. */}
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div id={panelId} role="region" aria-labelledby={buttonId} aria-hidden={!open} className="overflow-hidden">
                      <p className="max-w-[60ch] pb-7 pl-12 text-[16px] leading-relaxed text-lp-body">{item.answer}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}
