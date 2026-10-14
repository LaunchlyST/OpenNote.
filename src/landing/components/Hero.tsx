import { useAuth } from '../../auth'
import { HERO, HERO_FACTS } from '../content'
import { ResponsiveAppWindow } from './mock/AppWindow'
import { EventComposer, NoteCloseup, NowChip } from './mock/Closeups'
import { Button, Eyebrow } from './primitives'

/**
 * Editorial hero: an oversized serif headline set left, the pitch and actions
 * in a narrow right-hand column, then the real interface settling into place
 * beneath — flanked by two close-ups (the event editor and a pinned note) that
 * name the two things OpenNote does.
 */
export function Hero() {
  const { user } = useAuth()
  const authed = Boolean(user)
  const primary = authed ? HERO.authenticatedCta : HERO.primaryCta

  return (
    <section id="top" className="relative overflow-hidden px-5 pt-[120px] sm:px-8 sm:pt-[140px]">
      {/* Planner-page ruling, fading out toward the edges */}
      <div
        aria-hidden="true"
        className="lp-ruled pointer-events-none absolute inset-x-0 top-0 -z-0 h-[900px]"
        style={{
          maskImage: 'radial-gradient(80% 70% at 50% 30%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(80% 70% at 50% 30%, #000 0%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1240px]">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <div className="lp-bob" style={{ animationDelay: '40ms' }}>
              <Eyebrow index="●">{HERO.eyebrow}</Eyebrow>
            </div>
            <h1
              className="lp-bob mt-7 font-display text-[clamp(3.2rem,8.2vw,7.2rem)] leading-[0.9] font-normal tracking-[-0.035em] text-lp-ink"
              style={{ animationDelay: '120ms' }}
            >
              {HERO.titleLead}
              <br />
              <span className="italic">
                {HERO.titleEmphasis.replace(/\.$/, '')}
                <span className="text-lp-signal">.</span>
              </span>
            </h1>
          </div>

          <div className="lp-bob lg:col-span-4 lg:pb-3" style={{ animationDelay: '220ms' }}>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-lp-body">{HERO.description}</p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
              <Button href={primary.href} variant="primary" size="lg" className="w-full sm:w-auto" arrow>
                {primary.label}
              </Button>
              {authed ? (
                <Button href={HERO.signInCta.href} variant="secondary" size="lg" className="w-full sm:w-auto">
                  Switch account
                </Button>
              ) : (
                <Button section={HERO.secondaryCta.section} variant="secondary" size="lg" className="w-full sm:w-auto">
                  {HERO.secondaryCta.label}
                </Button>
              )}
            </div>
            <ul className="mt-6 space-y-1.5">
              {HERO.reassurance.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px] text-lp-muted">
                  <span aria-hidden="true" className="h-px w-3 bg-lp-signal" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Showcase */}
        <div className="relative mt-14 sm:mt-16 lg:mt-20">
          <div className="lp-settle relative" style={{ animationDelay: '360ms' }}>
            <ResponsiveAppWindow view="week" label="opennote.app — week of October 5" />
          </div>

          {/* Close-ups — only where there is room beside the window */}
          <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
            <div className="lp-bob absolute -bottom-10 -left-10" style={{ animationDelay: '900ms' }}>
              <div className="lp-float">
                <EventComposer />
              </div>
            </div>
            <div className="lp-bob absolute top-[18%] -right-12" style={{ animationDelay: '1050ms' }}>
              <div className="lp-float" style={{ animationDelay: '-4s' }}>
                <NoteCloseup className="rotate-[2deg]" />
              </div>
            </div>
            <div className="lp-bob absolute -top-5 left-[38%]" style={{ animationDelay: '1200ms' }}>
              <NowChip />
            </div>
          </div>
        </div>

        {/* Facts strip — descriptive only, no numbers we cannot back up */}
        <dl className="mt-20 grid grid-cols-1 border-t border-lp-ink/15 sm:grid-cols-2 lg:mt-28 lg:grid-cols-4">
          {HERO_FACTS.map((fact, i) => (
            <div
              key={fact.label}
              className="flex flex-col gap-1.5 border-b border-lp-ink/10 py-5 sm:px-5 sm:odd:pl-0 lg:border-b-0 lg:border-l lg:px-6 lg:py-7 lg:first:border-l-0 lg:first:pl-0"
            >
              <dt className="font-mono text-[11px] tracking-[0.14em] text-lp-muted uppercase">
                <span className="text-lp-signal">0{i + 1}</span> {fact.label}
              </dt>
              <dd className="text-[15.5px] text-lp-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
