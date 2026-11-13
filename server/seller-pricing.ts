/**
 * Store pricing: the single source of truth for what a buyer pays.
 *
 * Rules (Store V2, stage B):
 * - Amounts are integer minor units (pence/cents). All three supported
 *   currencies (GBP, USD, EUR) have two decimals.
 * - Percentage discounts round half up to the nearest minor unit, with
 *   integer maths only: round(base * pct / 100).
 * - The product's automatic offer applies first, only inside its window.
 * - At most one coupon, applied to the price after the offer.
 * - A fixed-amount coupon is capped at that price, so totals never go negative.
 * - Total 0 is a free order. 0 < total < 50 can't go through card checkout.
 */

export type OfferConfig = {
  on: boolean
  kind: 'percent' | 'amount'
  value: number
  /** Legacy whole-day window (UTC), kept for products saved before V2. */
  starts: string | null
  ends: string | null
  /** V2 window: exact UTC instants, plus the seller's local time and timezone they were entered in. */
  startsAt?: string | null
  endsAt?: string | null
  tz?: string
  countdown?: boolean
}

export type CouponRow = {
  id: string
  storeId: string
  code: string
  kind: 'percent' | 'amount'
  value: number
  currency: string | null
  productIds: string | null
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  perCustomer: number | null
  used: number
  active: number
  createdAt: string
}

export const CARD_MINIMUM = 50

/** round(base * pct / 100), half up, integers only. */
export function percentOf(base: number, pct: number): number {
  return Math.floor((base * pct + 50) / 100)
}

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Offset of `tz` from UTC at instant `ms`, in minutes. */
function offsetMinutes(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

/**
 * A wall-clock time in a timezone ('2026-03-29T01:30' in 'Europe/London') to a UTC ISO instant.
 * Times skipped by a clock change resolve to the moment the clocks jump to.
 */
export function zonedToUtc(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m || !isTimeZone(tz)) return null
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  if (Number.isNaN(naive)) return null
  // two passes settle the offset either side of a DST change
  let guess = naive - offsetMinutes(naive, tz) * 60000
  guess = naive - offsetMinutes(guess, tz) * 60000
  return new Date(guess).toISOString()
}

/** A UTC instant shown as local wall-clock time in tz ('YYYY-MM-DDTHH:mm'). */
export function utcToZoned(iso: string, tz: string): string {
  const ms = Date.parse(iso)
  const local = new Date(ms + offsetMinutes(ms, tz) * 60000)
  return local.toISOString().slice(0, 16)
}

/** The offer's live window as epoch ms (null = open ended). Legacy day dates cover whole UTC days. */
export function offerWindow(o: OfferConfig): { start: number | null; end: number | null } {
  const start = o.startsAt ? Date.parse(o.startsAt) : o.starts ? Date.parse(`${o.starts}T00:00:00.000Z`) : null
  const end = o.endsAt ? Date.parse(o.endsAt) : o.ends ? Date.parse(`${o.ends}T23:59:59.999Z`) : null
  return { start: Number.isNaN(start as number) ? null : start, end: Number.isNaN(end as number) ? null : end }
}

/** The automatic offer price right now, or null when no offer is running. */
export function offerPrice(listMinor: number, o: OfferConfig, at = Date.now()): number | null {
  if (!o.on || o.value <= 0 || listMinor <= 0) return null
  const w = offerWindow(o)
  if (w.start != null && at < w.start) return null
  if (w.end != null && at > w.end) return null
  const off = o.kind === 'percent' ? percentOf(listMinor, Math.min(95, o.value)) : Math.min(listMinor, o.value)
  const price = Math.max(0, listMinor - off)
  return price < listMinor ? price : null
}

export type CouponCheck = { ok: true; discountMinor: number } | { ok: false; reason: string }

/** Whether a coupon applies to this product now, and how much it takes off `baseMinor` (the price after the offer). */
export function checkCoupon(c: CouponRow, productId: string, currency: string, baseMinor: number, at = Date.now()): CouponCheck {
  if (!c.active) return { ok: false, reason: 'This code isn’t active.' }
  if (c.startsAt && at < Date.parse(c.startsAt)) return { ok: false, reason: 'This code isn’t valid yet.' }
  if (c.endsAt && at > Date.parse(c.endsAt)) return { ok: false, reason: 'This code has expired.' }
  if (c.maxRedemptions != null && c.used >= c.maxRedemptions) return { ok: false, reason: 'This code has been fully redeemed.' }
  const ids: string[] = c.productIds ? JSON.parse(c.productIds) : []
  if (ids.length && !ids.includes(productId)) return { ok: false, reason: 'This code doesn’t apply to this product.' }
  if (c.kind === 'amount' && c.currency && c.currency !== currency) return { ok: false, reason: 'This code is for a different currency.' }
  if (baseMinor <= 0) return { ok: false, reason: 'This product is already free.' }
  const off = c.kind === 'percent' ? percentOf(baseMinor, Math.min(100, c.value)) : Math.min(baseMinor, c.value)
  if (off <= 0) return { ok: false, reason: 'This code doesn’t reduce the price.' }
  return { ok: true, discountMinor: off }
}

export type Quote = {
  currency: string
  listMinor: number
  /** The automatic offer, when one is running. */
  offer: { priceMinor: number; savedMinor: number; endsAt: string | null; countdown: boolean } | null
  coupon: { code: string; discountMinor: number } | null
  couponError: string | null
  totalMinor: number
  savedMinor: number
}

/** The authoritative breakdown. `coupon` is looked up by the caller (codes are per store). */
export function quote(input: { productId: string; listMinor: number; currency: string; offer: OfferConfig; coupon?: CouponRow | null; code?: string | null; at?: number }): Quote {
  const at = input.at ?? Date.now()
  const sale = offerPrice(input.listMinor, input.offer, at)
  const base = sale ?? input.listMinor
  const w = offerWindow(input.offer)
  let coupon: Quote['coupon'] = null
  let couponError: string | null = null
  if (input.code) {
    if (!input.coupon) couponError = 'That code isn’t valid for this store.'
    else {
      const c = checkCoupon(input.coupon, input.productId, input.currency, base, at)
      if (c.ok) coupon = { code: input.coupon.code, discountMinor: c.discountMinor }
      else couponError = c.reason
    }
  }
  const total = Math.max(0, base - (coupon?.discountMinor ?? 0))
  return {
    currency: input.currency,
    listMinor: input.listMinor,
    offer: sale == null ? null : { priceMinor: sale, savedMinor: input.listMinor - sale, endsAt: w.end != null ? new Date(w.end).toISOString() : null, countdown: Boolean(input.offer.countdown && w.end != null) },
    coupon,
    couponError,
    totalMinor: total,
    savedMinor: input.listMinor - total,
  }
}

/** Coupon codes: letters, digits, dash and underscore, 3 to 24 characters, case-insensitive. */
export function normaliseCode(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase()
  return /^[A-Z0-9_-]{3,24}$/.test(s) ? s : null
}
