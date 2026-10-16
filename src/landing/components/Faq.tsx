import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/id'
import { FAQ } from '../content'
import { Reveal, Section } from './primitives'

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <Section id="faq" innerClassName="max-w-[820px]">
      <Reveal>
        <h2 data-anim="mask" className="text-[clamp(2rem,4.2vw,3rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-lp-ink">
          {FAQ.heading}
        </h2>
      </Reveal>
      <Reveal delay={80}>
        <ul data-anim="lines" className="mt-10 border-t border-lp-line">
          {FAQ.items.map((item, i) => {
            const open = openIndex === i
            const buttonId = `faq-button-${i}`
            const panelId = `faq-panel-${i}`
            return (
              <li key={item.question} data-anim-item="" className="border-b border-lp-line">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="group flex w-full items-center gap-4 py-5 text-left"
                  >
                    <span className="min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.01em] text-lp-ink">
                      {item.question}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('h-5 w-5 shrink-0 text-lp-muted transition-transform duration-300 group-hover:text-lp-ink', open && 'rotate-180')}
                    />
                  </button>
                </h3>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-400 ease-out',
                    open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div id={panelId} role="region" aria-labelledby={buttonId} aria-hidden={!open} className="overflow-hidden">
                    <p className="max-w-[64ch] pb-6 text-[15.5px] leading-relaxed text-lp-body">{item.answer}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </Section>
  )
}
