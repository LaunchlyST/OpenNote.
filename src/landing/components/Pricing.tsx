import { Check } from 'lucide-react'
import { useAuth } from '../../auth'
import { PRICING } from '../content'
import { Button, Reveal } from './primitives'

/**
 * Free is the plan to use today. Pro and Business each carry one Coming Soon
 * label and nothing that looks like a button. Plan details come from content.ts.
 */
export function Pricing() {
  const { user } = useAuth()
  const [free, pro, business] = PRICING.plans
  return (
    <section id="pricing" className="lp-pricing px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-[1120px]">
        <Reveal>
          <p className="lp-eyebrow">Pricing</p>
          <h2 className="lp-h2">{PRICING.heading}</h2>
        </Reveal>
        <div className="lp-pr-grid">
          <Reveal className="lp-pr-free">
            <div className="lp-pr-head">
              <h3>{free.name}</h3>
              <p className="lp-pr-price">
                <b>£0</b> <span>Free Forever</span>
              </p>
              <p className="lp-pr-desc">{free.description}</p>
            </div>
            <ul className="lp-pr-list">
              {free.features.map((f) => (
                <li key={f.label}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {f.label}
                </li>
              ))}
            </ul>
            <Button href={user ? '/app/free' : '/app/signup'} variant="primary" size="lg" arrow className="w-full sm:w-auto">
              Open my free calendar
            </Button>
            <p className="lp-pr-foot">{free.price.footnote}</p>
          </Reveal>
          <div className="lp-pr-later">
            {[pro, business].map((p, i) => (
              <Reveal key={p.id} className="lp-pr-soon" delay={80 + i * 60}>
                <div className="flex items-center justify-between gap-3">
                  <h3>{p.name}</h3>
                  <span className="lp-pr-label">Coming Soon</span>
                </div>
                <p className="lp-pr-desc">{p.description}</p>
              </Reveal>
            ))}
            <p className="lp-pr-note">
              {pro.cta.note} {PRICING.membershipNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
