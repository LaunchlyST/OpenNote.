import type { NextFunction, Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { db } from './db.ts'

/**
 * Subscription plans and what each one unlocks.
 *
 * The plan lives on the user row (`user.plan`), defaults to "free", and can
 * only be changed by the server — Better Auth refuses it as client input.
 * Pro is not on sale yet, so nothing in the app can set it.
 *
 * Feature lists mirror the pricing page (src/landing/content.ts). No usage
 * limits are enforced: the product has not defined numbers for them yet.
 */
export type PlanId = 'free' | 'pro'

export const PLANS: Record<PlanId, { name: string; available: boolean; features: string[] }> = {
  free: {
    name: 'Free',
    available: true,
    features: ['calendar', 'views', 'events', 'notes', 'daily-scheduling', 'colour-calendars'],
  },
  pro: {
    name: 'OpenNote Pro',
    available: false, // Coming soon — cannot be purchased or granted.
    features: ['calendar', 'views', 'events', 'notes', 'daily-scheduling', 'colour-calendars', 'pro-tools'],
  },
}

export function planOf(user: { plan?: string | null } | undefined | null): PlanId {
  return user?.plan === 'pro' ? 'pro' : 'free'
}

/** Gives every existing account without a plan the Free plan. Never downgrades. */
export function backfillPlans() {
  db.prepare("UPDATE \"user\" SET plan = 'free' WHERE plan IS NULL OR plan = ''").run()
}

/** Express guard for Pro-only endpoints. The check happens here, not in the UI. */
export function requirePlan(plan: PlanId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) {
      res.status(401).json({ error: 'Not signed in.' })
      return
    }
    if (plan === 'pro' && planOf(session.user as { plan?: string }) !== 'pro') {
      res.status(403).json({ error: 'This feature needs OpenNote Pro, which is coming soon.', plan: 'free' })
      return
    }
    next()
  }
}
