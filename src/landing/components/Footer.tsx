import { useState } from 'react'
import { FOOTER } from '../content'
import type { FooterLink } from '../content'
import { useLandingNav } from '../hooks'
import { Logo } from './primitives'

function FooterItem({ link }: { link: FooterLink }) {
  const { go, goSection } = useLandingNav()
  const cls = 'text-[15px] text-white/70 transition-colors hover:text-white'

  if (link.unavailableNote) {
    // No real page exists yet, so this is text rather than a dead link.
    return (
      <span className="text-[15px] text-white/40">
        {link.label} <span className="ml-1 font-mono text-[10.5px] tracking-wide uppercase">· {link.unavailableNote}</span>
      </span>
    )
  }
  if (link.section) {
    return (
      <a href={`#${link.section}`} className={cls} onClick={(e) => { e.preventDefault(); goSection(link.section as string) }}>
        {link.label}
      </a>
    )
  }
  return (
    <a href={link.href} className={cls} onClick={(e) => { e.preventDefault(); go(link.href as string) }}>
      {link.label}
    </a>
  )
}

export function Footer() {
  const [year] = useState(() => new Date().getFullYear())
  return (
    <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[36px] bg-lp-ink px-6 pt-16 pb-8 text-white sm:px-12">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo tone="paper" size="lg" />
            <p className="mt-5 max-w-[36ch] text-[15.5px] leading-relaxed text-white/60">{FOOTER.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            {FOOTER.columns.map((col) => (
              <div key={col.heading}>
                <h2 className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">{col.heading}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterItem link={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p aria-hidden="true" className="mt-16 font-display text-[clamp(4.5rem,21vw,19rem)] leading-[0.8] tracking-[-0.04em] text-white/[0.07] select-none">
          Open<span className="italic">Note</span>
        </p>
        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-[13px] text-white/45 sm:flex-row sm:justify-between">
          <span>© {year} OpenNote. All rights reserved.</span>
          <span className="font-mono text-[11.5px]">Calendar &amp; notes, side by side.</span>
        </div>
      </div>
    </footer>
  )
}
