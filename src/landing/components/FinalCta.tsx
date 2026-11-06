import { useAuth } from '../../auth'
import { Button, Reveal } from './primitives'

export function FinalCta() {
  const { user } = useAuth()
  return (
    <section className="lp-final px-4 py-16 sm:px-8 sm:py-20">
      <Reveal className="mx-auto flex max-w-[1120px] flex-col items-center text-center">
        <h2 className="lp-final-h">
          Open a day of your <span className="lp-final-own">own</span>
          <span className="lp-final-dot">.</span>
          <svg className="lp-final-swash" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M6 22 C 70 34, 150 30, 222 20 S 286 10, 292 24" />
          </svg>
        </h2>
        <p className="mt-4 text-[16.5px] text-lp-body">Your plans, tasks and notes on one calendar. Free.</p>
        <div className="mt-7">
          <Button href={user ? '/app/free' : '/app/signup'} variant="primary" size="lg" arrow>
            Open my free calendar
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
