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
    <header
      data-landing-header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-colors duration-300',
        scrolled || open ? 'border-lp-line' : 'border-transparent',
      )}
    >
      <div
        className={cn(
          'relative mx-auto flex h-[60px] w-full max-w-[1200px] items-center gap-3 px-5 sm:px-8',
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
          aria-label="Desknoty — back to top"
        >
          <Logo />
        </a>

        <nav aria-label="Sections" className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
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
                      'relative flex items-center rounded-lg px-3 py-1.5 text-[14px] transition-colors duration-200',
                      isActive ? 'bg-lp-sunken text-lp-ink' : 'text-lp-body hover:bg-lp-sunken hover:text-lp-ink',
                    )}
                  >
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
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
            className="relative grid h-10 w-10 place-items-center rounded-[10px] border border-lp-line bg-white text-lp-ink transition active:scale-95 lg:hidden"
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
        className="fixed inset-x-0 top-[61px] bottom-0 overflow-y-auto bg-white px-5 pt-4 pb-8 sm:px-8 lg:hidden"
      >
        <nav aria-label="Sections (mobile)">
          <ul>
            {NAV_LINKS.map((link) => (
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
                  <span className="text-[22px] font-semibold tracking-[-0.02em] text-lp-ink">{link.label}</span>
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
