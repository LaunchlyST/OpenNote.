import { useState } from 'react'
import { FOOTER } from '../content'
import type { FooterLink } from '../content'
import { useLandingNav } from '../hooks'
import { Logo } from './primitives'

function FooterItem({ link }: { link: FooterLink }) {
  const { go, goSection } = useLandingNav()
  const cls = 'text-[14px] text-lp-body transition-colors hover:text-lp-ink'

  if (link.unavailableNote) {
    // No real page exists yet, so this is text rather than a dead link.
    return (
      <span className="text-[14px] text-lp-muted">
        {link.label} <span className="text-[12px]">({link.unavailableNote.toLowerCase()})</span>
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
    <footer className="border-t border-lp-line bg-white px-5 pt-14 pb-10 sm:px-8">
      <div className="mx-auto grid max-w-[1080px] gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-lp-body">{FOOTER.description}</p>
          <p className="mt-6 text-[12.5px] text-lp-muted">© {year} OpenNote. All rights reserved.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
          {FOOTER.columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-[13px] font-semibold text-lp-ink">{col.heading}</h2>
              <ul className="mt-3 space-y-2">
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
    </footer>
  )
}
