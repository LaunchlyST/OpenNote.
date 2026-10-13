import { useState } from 'react'
import { cn } from '../../lib/id'
import { FOOTER } from '../content'
import type { FooterLink } from '../content'
import { Logo } from './primitives'
import { useLandingNav } from '../hooks'

function FooterItem({ link }: { link: FooterLink }) {
  const { go, goSection } = useLandingNav()

  // No destination yet — rendered as plain text so the page never shows a
  // dead link or invents a page that does not exist.
  if (link.unavailableNote) {
    return (
      <li>
        <span className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-2 text-[14px] text-lp-muted">
            {link.label}
            <span className="rounded-full bg-lp-sunken px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-lp-muted uppercase ring-1 ring-lp-line">
              Soon
            </span>
          </span>
          <span className="text-[12.5px] leading-relaxed text-lp-muted/80">
            {link.unavailableNote}
          </span>
        </span>
      </li>
    )
  }

  const className =
    'inline-block text-[14px] text-lp-body transition-colors duration-200 hover:text-lp-ink'

  if (link.href) {
    return (
      <li>
        <a
          href={link.href}
          className={className}
          onClick={(e) => {
            e.preventDefault()
            go(link.href as string)
          }}
        >
          {link.label}
        </a>
      </li>
    )
  }

  return (
    <li>
      <a
        href={`#${link.section}`}
        className={className}
        onClick={(e) => {
          e.preventDefault()
          goSection(link.section as string)
        }}
      >
        {link.label}
      </a>
    </li>
  )
}

export function Footer() {
  const [year] = useState(() => new Date().getFullYear())

  return (
    <footer className="border-t border-lp-line bg-lp-sunken px-5 pt-16 pb-10 sm:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-lp-body">
              {FOOTER.description}
            </p>
          </div>

          {/* Columns */}
          {FOOTER.columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[12px] font-semibold tracking-[0.1em] text-lp-ink uppercase">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <FooterItem key={link.label} link={link} />
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div
          className={cn(
            'mt-14 flex flex-col items-center gap-4 border-t border-lp-line pt-7',
            'sm:flex-row sm:justify-between',
          )}
        >
          <p className="text-[13px] text-lp-muted">
            © {year} OpenNote. All rights reserved.
          </p>
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lp-lime-600" aria-hidden="true" />
            <span className="text-[13px] text-lp-muted">
              Your calendar and notes, together.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}