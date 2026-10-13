import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '../../auth'
import { cn } from '../../lib/id'
import { HERO, NAV_LINKS } from '../content'
import { Button, Logo } from './primitives'
import { useActiveSection, useLandingNav } from '../hooks'

const SECTION_IDS = NAV_LINKS.map((l) => l.section)

export function Nav() {
  const { user } = useAuth()
  const { goSection } = useLandingNav()
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)

  const active = useActiveSection(useMemo(() => SECTION_IDS, []))

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        setScrolled(y > 12)
        const max = document.documentElement.scrollHeight - window.innerHeight
        setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  // Close the mobile menu on Escape and when the viewport grows past the
  // breakpoint where it is shown.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
  const secondary = authed ? HERO.signInCta : HERO.secondaryCta

  return (
    <header
      data-landing-header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-lp-line/80 bg-lp-bg/80 backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center gap-4 px-5 sm:px-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="rounded-lg"
          aria-label="OpenNote — back to top"
        >
          <Logo />
        </a>

        {/* Centre navigation */}
        <nav aria-label="Sections" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
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
                      'relative block rounded-full px-3.5 py-2 text-[14.5px] font-medium transition-colors duration-200',
                      isActive
                        ? 'text-lp-ink'
                        : 'text-lp-body hover:text-lp-ink',
                    )}
                  >
                    {link.label}
                    <span
                      className={cn(
                        'absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-full bg-lp-lime-600 transition-all duration-300',
                        isActive ? 'opacity-100' : 'scale-x-0 opacity-0',
                      )}
                    />
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {!authed && (
            <Button
              href={HERO.signInCta.href}
              variant="ghost"
              size="md"
              className="hidden sm:inline-flex"
            >
              Sign In
            </Button>
          )}

          <Button href={primary.href} variant="primary" size="md" className="hidden sm:inline-flex">
            {primary.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-10 w-10 place-items-center rounded-xl border border-lp-line bg-white text-lp-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-lp-sunken lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Reading-progress hairline */}
      <div
        aria-hidden="true"
        className="h-px origin-left bg-lp-lime-600 transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />

      {/* Mobile menu */}
      <div
        id="landing-mobile-menu"
        hidden={!open}
        className="lg:hidden"
      >
        <div className="border-t border-lp-line bg-lp-bg/95 px-5 pt-3 pb-6 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.3)] backdrop-blur-xl sm:px-8">
          <nav aria-label="Sections">
            <ul className="space-y-0.5">
              {NAV_LINKS.map((link) => (
                <li key={link.section}>
                  <a
                    href={`#${link.section}`}
                    onClick={(e) => {
                      e.preventDefault()
                      setOpen(false)
                      goSection(link.section)
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-3 text-[16px] font-medium transition-colors',
                      active === link.section
                        ? 'bg-white text-lp-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04]'
                        : 'text-lp-body hover:bg-white/70 hover:text-lp-ink',
                    )}
                  >
                    {link.label}
                    <ArrowRight
                      className="h-4 w-4 text-lp-muted"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-5 space-y-2.5">
            <Button
              href={primary.href}
              variant="primary"
              size="lg"
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              {primary.label}
            </Button>
            {authed ? (
              <Button href={HERO.signInCta.href} variant="secondary" size="lg" className="w-full">
                {secondary.label}
              </Button>
            ) : (
              <Button
                section={HERO.secondaryCta.section}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                {secondary.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}