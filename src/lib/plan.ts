/**
 * Subscription plans.
 *
 * OpenNote has no billing backend yet — the landing page's PRICING table marks
 * every paid plan as `unavailable` ("Payments coming soon — checkout is not
 * switched on yet"). So a plan is a value *stored on the account record* and
 * read back here. It is never inferred from whether someone happens to be
 * signed in: an account only reads as paid once a `plan` has actually been
 * written to it. Until a checkout exists, every account defaults to `free`.
 *
 * Plan ids and prices mirror `landing/content.ts` so the dashboard and the
 * marketing site can never drift apart.
 */

export type PlanId = 'free' | 'pro' | 'business'

export interface Plan {
  id: PlanId
  /** Full product name, e.g. "OpenNote Pro". */
  label: string
  /** Compact name for the badge, e.g. "Pro". */
  shortLabel: string
  /** Human-readable price, e.g. "£9 / mo". */
  price: string
  /** Whether this plan can actually be bought today. */
  purchasable: boolean
  /** Short reassurance line shown in the account popover. */
  blurb: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    label: 'Free',
    shortLabel: 'Free',
    price: '£0 forever',
    purchasable: true,
    blurb: 'Every planning feature is included.',
  },
  pro: {
    id: 'pro',
    label: 'OpenNote Pro',
    shortLabel: 'Pro',
    price: '£9 / mo',
    purchasable: false,
    blurb: 'Checkout is not switched on yet.',
  },
  business: {
    id: 'business',
    label: 'OpenNote Business',
    shortLabel: 'Business',
    price: 'Coming soon',
    purchasable: false,
    blurb: 'Pricing has not been set.',
  },
}

/** What an account gets when it carries no explicit plan. */
export const DEFAULT_PLAN: PlanId = 'free'

/** Resolves a stored plan id, falling back to the free tier. */
export function planOf(id: string | null | undefined): Plan {
  return PLANS[id as PlanId] ?? PLANS[DEFAULT_PLAN]
}
