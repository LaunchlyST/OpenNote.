import { useState } from 'react'
import { ArrowRight, Check, Compass } from 'lucide-react'
import { useAuth } from '../../auth'
import { cn } from '../../lib/id'
import { HERO } from '../content'
import { COLORS } from '../../lib/colors'
import { DEMO_NOTES } from '../demo'
import { ResponsiveAppWindow } from './mock/AppWindow'
import { Button, Eyebrow } from './primitives'

export function Hero() {
  const { user } = useAuth()
  const authed = Boolean(user)
  const primary = authed ? HERO.authenticatedCta : HERO.primaryCta

  return (
    <section id="top" className="relative overflow-hidden px-5 pt-[112px] pb-16 sm:px-8 sm:pt-[128px] lg:pb-24">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#ffffff_0%,#fbfbf9_45%,#f4f4f1_100%)]" />
        <div className="lp-drift absolute -top-40 left-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(190,242,100,0.42),transparent_68%)] blur-3xl" />
        <div
          className="lp-drift absolute -top-24 right-[4%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(230,221,255,0.75),transparent_68%)] blur-3xl"
          style={{ animationDelay: '-9s' }}
        />
        <div
          className="lp-drift absolute top-[38%] left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(216,235,255,0.6),transparent_70%)] blur-3xl"
          style={{ animationDelay: '-17s' }}
        />
        {/* Faint dotted grid, fading out toward the edges */}
        <div
          className="absolute inset-x-0 top-0 h-[560px] opacity-[0.5]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(21,23,29,0.07) 1px, transparent 0)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(70% 60% at 50% 20%, #000 0%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(70% 60% at 50% 20%, #000 0%, transparent 78%)',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-[1180px]">
        {/* Copy */}
        <div className="flex flex-col items-center text-center">
          <div className="lp-bob" style={{ animationDelay: '40ms' }}>
            <Eyebrow>{HERO.eyebrow}</Eyebrow>
          </div>

          <h1
            className="lp-bob mt-6 max-w-[16ch] text-[clamp(2.4rem,6.4vw,4.35rem)] leading-[1.03] font-semibold text-lp-ink"
            style={{ animationDelay: '110ms' }}
          >
            Your time. Your plans.{' '}
            <span className="relative inline-block">
              <span className="relative z-10">One beautiful place.</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.34em] rounded-full bg-lp-lime/55"
              />
            </span>
          </h1>

          <p
            className="lp-bob mt-6 max-w-[54ch] text-[clamp(1rem,1.5vw,1.15rem)] leading-relaxed text-lp-body"
            style={{ animationDelay: '180ms' }}
          >
            {HERO.description}
          </p>

          <div
            className="lp-bob mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
            style={{ animationDelay: '250ms' }}
          >
            <Button
              href={primary.href}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
              icon={
                authed ? (
                  <Compass className="h-4.5 w-4.5" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {primary.label}
            </Button>
            {authed ? (
              <Button href={HERO.signInCta.href} variant="secondary" size="lg" className="w-full sm:w-auto">
                Switch account
              </Button>
            ) : (
              <Button
                section={HERO.secondaryCta.section}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                {HERO.secondaryCta.label}
              </Button>
            )}
          </div>

          <ul
            className="lp-bob mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
            style={{ animationDelay: '310ms' }}
          >
            {HERO.reassurance.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[14px] text-lp-muted">
                <Check className="h-3.5 w-3.5 text-lp-lime-700" strokeWidth={3} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Showcase */}
        <div
          className="lp-bob relative mt-14 sm:mt-16 lg:mt-20"
          style={{ animationDelay: '380ms' }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-[6%] -bottom-6 -z-10 h-24 rounded-[50%] bg-lp-charcoal/12 blur-3xl"
          />

          <ResponsiveAppWindow view="week" />

          {/* Floating layers — hidden on small screens so they never cover content */}
          <FloatingTodayChip className="absolute -top-7 left-2 hidden xl:block" />
          <FloatingPinnedTask className="absolute -bottom-6 left-6 hidden xl:block" />
          <FloatingNoteCard className="absolute -right-7 top-1/4 hidden 2xl:block" />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Floating detail cards                                               */
/* ------------------------------------------------------------------ */

/** Today's real date, styled after the mini calendar's lime "today" pill. */
function FloatingTodayChip({ className }: { className?: string }) {
  const [today] = useState(() => new Date())
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
  const month = today.toLocaleDateString('en-US', { month: 'long' })

  return (
    <div
      className={cn(
        'rounded-2xl border border-lp-line bg-white/95 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.35)] backdrop-blur-sm',
        className,
      )}
      style={{ animation: 'lp-float 8s ease-in-out infinite' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.1em] text-lp-muted uppercase">
        Today
      </p>
      <p className="mt-1.5 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-lp-lime text-[14px] font-semibold text-[#33400f] ring-1 ring-inset ring-[#a3d922]/60">
          {today.getDate()}
        </span>
        <span className="text-[12.5px] leading-tight font-medium text-lp-body">
          {weekday}
          <span className="block text-[11.5px] text-lp-muted">{month}</span>
        </span>
      </p>
    </div>
  )
}

/** A pinned event sitting on the timeline, as it appears in the real app. */
function FloatingPinnedTask({ className }: { className?: string }) {
  const c = COLORS.pink
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2 shadow-[0_14px_32px_-16px_rgba(16,24,40,0.4)]',
        className,
      )}
      style={{
        background: c.bg,
        borderColor: c.border,
        animation: 'lp-float 9s ease-in-out -3s infinite',
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.dot }} />
      <span className="leading-tight">
        <span className="block text-[11.5px] font-semibold" style={{ color: c.text }}>
          Dinner with friends
        </span>
        <span className="block text-[10.5px]" style={{ color: c.text, opacity: 0.7 }}>
          19:00 – 21:00
        </span>
      </span>
    </div>
  )
}

/** A note from the Notes rail, tilted like the sticky cards in the app. */
function FloatingNoteCard({ className }: { className?: string }) {
  const note = DEMO_NOTES[1]
  return (
    <div
      className={cn(
        'w-[196px] rounded-2xl border border-[#f2e79c] bg-[#fdf6ab] p-3.5 shadow-[0_20px_44px_-20px_rgba(120,100,20,0.5)]',
        className,
      )}
      style={{ animation: 'lp-float 10s ease-in-out -6s infinite' }}
    >
      <p className="text-[12.5px] font-semibold text-[#6b5b12]">{note.title}</p>
      <p className="mt-1.5 space-y-1 text-[11.5px] leading-[1.5] text-[#7d6c1c]">
        {note.body.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </div>
  )
}