import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth'
import { cn } from '../../lib/id'
import { HERO, NAV_LINKS } from '../content'
import { Button, Logo } from './primitives'
import { useActiveSection, useLandingNav } from '../hooks'

const SECTION_IDS = NAV_LINKS.map((l) => l.section)

/**
 * A floating pill bar. It sits on the paper at the top of the page and tightens
 * into a frosted capsule once the visitor scrolls. Below `lg` the links move
 * into a full-height sheet with large, thumb-friendly targets.
 */
export function Nav() {
  const { user } = useAuth()
  const { goSection } = useLandingNav()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  const active = useActiveSection(useMemo(() => SECTION_IDS, []))

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setScrolled(window.scrollY > 16)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // Lock page scroll behind the sheet.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const authed = Boolean(user)
  const primary = authed ? HERO.authenticatedCta : HERO.primaryCta

  return (
    <header data-landing-header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          'mx-auto flex h-[60px] w-full items-center gap-3 rounded-full pr-2 pl-5 transition-[background-color,box-shadow,border-color,max-width] duration-500 ease-out',
          scrolled || open
            ? 'max-w-[1080px] border border-lp-ink/10 bg-lp-surface/80 shadow-[0_12px_40px_-18px_rgba(40,30,10,0.35)] backdrop-blur-xl backdrop-saturate-150'
            : 'max-w-[1240px] border border-transparent bg-transparent',
        )}
      >
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            setOpen(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="rounded-lg"
          aria-label="OpenNote — back to top"
        >
          <Logo />
        </a>

        <nav aria-label="Sections" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const isActive = active === link.section
              return (
                <li key={link.section}>
                  <a
                    href={`#${link.section}`}
                    onClick={(e) => {
                      e.preventDefault()
                      goSection(link.section)
                    }}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14.5px] transition-colors duration-200',
                      isActive ? 'text-lp-ink' : 'text-lp-body hover:text-lp-ink',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 rounded-full bg-lp-signal transition-all duration-300',
                        isActive ? 'w-1.5 opacity-100' : 'w-0 opacity-0',
                      )}
                    />
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <Button href={HERO.signInCta.href} variant="ghost" size="md" className="max-sm:hidden">
            Sign In
          </Button>
          <Button href={primary.href} variant="primary" size="md" className="max-sm:hidden" arrow>
            {primary.label}
          </Button>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-lp-ink text-lp-surface transition active:scale-95 lg:hidden"
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute h-[1.5px] w-[18px] rounded-full bg-current transition-transform duration-300',
                open ? 'rotate-45' : '-translate-y-[4px]',
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                'absolute h-[1.5px] w-[18px] rounded-full bg-current transition-transform duration-300',
                open ? '-rotate-45' : 'translate-y-[4px]',
              )}
            />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        id="landing-mobile-menu"
        hidden={!open}
        className="fixed inset-x-3 top-[84px] bottom-3 overflow-y-auto rounded-[28px] border border-lp-ink/10 bg-lp-surface p-6 shadow-[0_30px_80px_-30px_rgba(40,30,10,0.5)] sm:inset-x-5 lg:hidden"
      >
        <nav aria-label="Sections (mobile)">
          <ul>
            {NAV_LINKS.map((link, i) => (
              <li key={link.section} className="border-b border-lp-line last:border-b-0">
                <a
                  href={`#${link.section}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setOpen(false)
                    goSection(link.section)
                  }}
                  className="flex items-baseline gap-4 py-4"
                >
                  <span className="font-mono text-[12px] text-lp-signal">0{i + 1}</span>
                  <span className="font-display text-[34px] leading-none text-lp-ink">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 grid gap-2.5">
          <Button href={primary.href} variant="primary" size="lg" className="w-full" arrow>
            {primary.label}
          </Button>
          <Button href={HERO.signInCta.href} variant="secondary" size="lg" className="w-full">
            {authed ? 'Switch account' : 'Sign In'}
          </Button>
        </div>
      </div>
    </header>
  )
}
