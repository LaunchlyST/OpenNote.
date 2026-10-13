import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/id'
import { FAQ } from '../content'
import { Reveal, Section, SectionHeading } from './primitives'

export function Faq() {
  // The first question starts open so the section never reads as a dead list.
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <Section id="faq" tone="muted">
      <Reveal>
        <SectionHeading
          eyebrow={FAQ.eyebrow}
          heading={FAQ.heading}
        />
      </Reveal>

      <Reveal delay={90}>
        <div className="mx-auto mt-12 w-full max-w-[760px] sm:mt-14">
          <ul className="overflow-hidden rounded-[22px] border border-lp-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {FAQ.items.map((item, i) => {
              const open = openIndex === i
              const buttonId = `faq-button-${i}`
              const panelId = `faq-panel-${i}`

              return (
                <li
                  key={item.question}
                  className={cn(
                    i > 0 && 'border-t border-lp-line',
                  )}
                >
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className={cn(
                        'group flex w-full items-center gap-4 px-5 py-5 text-left transition-colors duration-200 sm:px-6',
                        'hover:bg-lp-sunken/60 focus-visible:bg-lp-sunken/60',
                      )}
                    >
                      <span className="min-w-0 flex-1 text-[16px] leading-snug font-medium tracking-[-0.01em] text-lp-ink">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300',
                          open
                            ? 'rotate-45 border-transparent bg-lp-lime text-[#2c3608]'
                            : 'border-lp-line bg-white text-lp-body group-hover:border-lp-lime-600 group-hover:text-lp-ink',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </span>
                    </button>
                  </h3>

                  {/* Height is animated with the grid-rows technique, so no
                      JavaScript measurement and no layout thrash. */}
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!open}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-lp-body sm:px-6 sm:pb-6 sm:pr-14">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </Reveal>
    </Section>
  )
}