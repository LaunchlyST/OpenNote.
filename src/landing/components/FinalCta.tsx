import { ArrowRight, Compass } from 'lucide-react'
import { useAuth } from '../../auth'
import { FINAL_CTA } from '../content'
import { Button, Reveal } from './primitives'

/** Decorative week strip — calendar-inspired, decorative only. */
const STRIP_DAYS = [
  { d: 5, label: 'Mon' },
  { d: 6, label: 'Tue' },
  { d: 7, label: 'Wed' },
  { d: 8, label: 'Thu', today: true },
  { d: 9, label: 'Fri' },
  { d: 10, label: 'Sat' },
  { d: 11, label: 'Sun' },
]

export function FinalCta() {
  const { user } = useAuth()
  const authed = Boolean(user)

  return (
    <section className="bg-lp-bg px-5 py-20 sm:px-8 md:py-28">
      <div className="mx-auto w-full max-w-[1180px]">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[28px] border border-lp-lime/35 bg-white px-6 py-14 text-center shadow-[0_40px_90px_-40px_rgba(110,150,10,0.4)] sm:px-12 sm:py-20">
            {/* Gradient wash */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,#f6ffe0_0%,#ffffff_58%)]" />
              <div
                className="lp-drift absolute -bottom-24 left-[6%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(230,221,255,0.7),transparent_68%)] blur-3xl"
              />
              <div
                className="lp-drift absolute -right-16 -bottom-20 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(216,235,255,0.7),transparent_68%)] blur-3xl"
                style={{ animationDelay: '-13s' }}
              />
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(21,23,29,0.06) 1px, transparent 0)',
                  backgroundSize: '20px 20px',
                  maskImage:
                    'radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 75%)',
                  WebkitMaskImage:
                    'radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 75%)',
                }}
              />
            </div>

            <h2 className="mx-auto max-w-[18ch] text-[clamp(2.1rem,5.2vw,3.5rem)] leading-[1.05] font-semibold text-lp-ink">
              Make room for{' '}
              <span className="relative inline-block">
                <span className="relative z-10">what matters.</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.32em] rounded-full bg-lp-lime/60"
                />
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-relaxed text-lp-body">
              {FINAL_CTA.description}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                href={authed ? '/app' : FINAL_CTA.primary.href}
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                {authed ? 'Open My Calendar' : FINAL_CTA.primary.label}
              </Button>
              {authed ? (
                <Button href="/app/signin" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Switch account
                </Button>
              ) : (
                <Button
                  section={FINAL_CTA.secondary.section}
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                  icon={<Compass className="h-4 w-4" aria-hidden="true" />}
                >
                  {FINAL_CTA.secondary.label}
                </Button>
              )}
            </div>

            {/* Calendar-inspired week strip */}
            <div aria-hidden="true" className="mx-auto mt-12 flex max-w-[520px] items-center justify-center gap-1.5 sm:gap-2.5">
              {STRIP_DAYS.map((day) => (
                <span
                  key={day.d}
                  className={
                    day.today
                      ? 'flex h-[52px] w-[52px] flex-col items-center justify-center rounded-2xl bg-lp-lime text-[#33400f] shadow-[0_8px_20px_-8px_rgba(140,185,20,0.6)] sm:h-[60px] sm:w-[60px]'
                      : 'flex h-[52px] w-[52px] flex-col items-center justify-center rounded-2xl border border-lp-line bg-white/80 text-lp-muted sm:h-[60px] sm:w-[60px]'
                  }
                >
                  <span className="text-[9.5px] font-semibold tracking-[0.06em] uppercase">
                    {day.label}
                  </span>
                  <span className="mt-0.5 text-[15px] font-semibold tabular-nums">
                    {day.d}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}