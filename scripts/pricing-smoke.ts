/** Unit checks for server/seller-pricing.ts: rounding, windows, timezones, coupons, stacking. */
import { checkCoupon, offerPrice, percentOf, quote, utcToZoned, zonedToUtc } from '../server/seller-pricing.ts'
import type { CouponRow, OfferConfig } from '../server/seller-pricing.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  PASS  ${label}`)
  else { failures += 1; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const offer = (o: Partial<OfferConfig>): OfferConfig => ({ on: true, kind: 'percent', value: 0, starts: null, ends: null, ...o })
const coupon = (c: Partial<CouponRow>): CouponRow => ({ id: 'cpn_1', storeId: 's', code: 'SAVE', kind: 'percent', value: 10, currency: null, productIds: null, startsAt: null, endsAt: null, maxRedemptions: null, perCustomer: null, used: 0, active: 1, createdAt: '', ...c })

console.log('\n  Rounding')
check('percent rounds half up (999 × 15% = 149.85 → 150)', percentOf(999, 15) === 150)
check('percent rounds down below half (1001 × 10% = 100.1 → 100)', percentOf(1001, 10) === 100)
check('exact half rounds up (5 × 10% = 0.5 → 1)', percentOf(5, 10) === 1)
check('no floating point drift (1999 × 33% = 659.67 → 660)', percentOf(1999, 33) === 660)

console.log('\n  Automatic offers and windows')
const now = Date.parse('2026-06-15T12:00:00Z')
check('percent offer', offerPrice(1200, offer({ value: 25 }), now) === 900)
check('fixed offer larger than the price stops at free', offerPrice(500, offer({ kind: 'amount', value: 900 }), now) === 0)
check('switched off: no offer', offerPrice(1200, offer({ on: false, value: 25 }), now) === null)
check('before the start: no offer', offerPrice(1200, offer({ value: 25, startsAt: '2026-06-15T12:00:01Z' }), now) === null)
check('after the end: expired, no offer', offerPrice(1200, offer({ value: 25, endsAt: '2026-06-15T11:59:59Z' }), now) === null)
check('inside the window: offer runs', offerPrice(1200, offer({ value: 25, startsAt: '2026-06-15T11:00:00Z', endsAt: '2026-06-15T13:00:00Z' }), now) === 900)
check('legacy day dates still cover the whole end day (UTC)', offerPrice(1200, offer({ value: 25, ends: '2026-06-15' }), Date.parse('2026-06-15T23:59:00Z')) === 900 && offerPrice(1200, offer({ value: 25, ends: '2026-06-15' }), Date.parse('2026-06-16T00:00:01Z')) === null)

console.log('\n  Timezones')
check('London summer time: 09:00 local = 08:00 UTC', zonedToUtc('2026-06-15T09:00', 'Europe/London') === '2026-06-15T08:00:00.000Z')
check('London winter time: 09:00 local = 09:00 UTC', zonedToUtc('2026-12-15T09:00', 'Europe/London') === '2026-12-15T09:00:00.000Z')
check('New York: 09:00 local = 13:00 UTC in June', zonedToUtc('2026-06-15T09:00', 'America/New_York') === '2026-06-15T13:00:00.000Z')
check('Tokyo: 09:00 local = 00:00 UTC', zonedToUtc('2026-06-15T09:00', 'Asia/Tokyo') === '2026-06-15T00:00:00.000Z')
check('round trip back to local time', utcToZoned('2026-06-15T13:00:00.000Z', 'America/New_York') === '2026-06-15T09:00')
check('a skipped DST hour still resolves to a real instant', Boolean(zonedToUtc('2026-03-29T01:30', 'Europe/London')))
check('unknown timezone is refused', zonedToUtc('2026-06-15T09:00', 'Mars/Olympus') === null)

console.log('\n  Coupons')
check('percent coupon', (checkCoupon(coupon({ value: 10 }), 'p', 'gbp', 1000, now) as { discountMinor: number }).discountMinor === 100)
check('fixed coupon is capped at the price', (checkCoupon(coupon({ kind: 'amount', value: 5000, currency: 'gbp' }), 'p', 'gbp', 1200, now) as { discountMinor: number }).discountMinor === 1200)
check('fixed coupon in another currency is refused', !checkCoupon(coupon({ kind: 'amount', value: 100, currency: 'usd' }), 'p', 'gbp', 1200, now).ok)
check('expired coupon is refused', !checkCoupon(coupon({ endsAt: '2026-06-01T00:00:00Z' }), 'p', 'gbp', 1200, now).ok)
check('not yet valid coupon is refused', !checkCoupon(coupon({ startsAt: '2026-07-01T00:00:00Z' }), 'p', 'gbp', 1200, now).ok)
check('fully redeemed coupon is refused', !checkCoupon(coupon({ maxRedemptions: 3, used: 3 }), 'p', 'gbp', 1200, now).ok)
check('inactive coupon is refused', !checkCoupon(coupon({ active: 0 }), 'p', 'gbp', 1200, now).ok)
check('coupon limited to other products is refused', !checkCoupon(coupon({ productIds: '["other"]' }), 'p', 'gbp', 1200, now).ok)

console.log('\n  Stacking and totals')
const q1 = quote({ productId: 'p', listMinor: 1200, currency: 'gbp', offer: offer({ value: 25 }), coupon: coupon({ value: 10 }), code: 'SAVE', at: now })
check('coupon applies after the offer: 1200 → 900 → 810', q1.offer?.priceMinor === 900 && q1.coupon?.discountMinor === 90 && q1.totalMinor === 810)
check('savings are the full difference from the list price', q1.savedMinor === 390)
const q2 = quote({ productId: 'p', listMinor: 1200, currency: 'gbp', offer: offer({ on: false }), coupon: coupon({ kind: 'amount', value: 9999, currency: 'gbp' }), code: 'SAVE', at: now })
check('total never goes negative', q2.totalMinor === 0)
const q3 = quote({ productId: 'p', listMinor: 1200, currency: 'gbp', offer: offer({ on: false }), coupon: null, code: 'NOPE', at: now })
check('unknown code: clear error, price unchanged', q3.couponError !== null && q3.totalMinor === 1200)
const q4 = quote({ productId: 'p', listMinor: 1200, currency: 'gbp', offer: offer({ value: 25, endsAt: '2026-06-16T00:00:00Z', countdown: true }), at: now })
check('countdown only for an offer with a real end time', q4.offer?.countdown === true && quote({ productId: 'p', listMinor: 1200, currency: 'gbp', offer: offer({ value: 25, countdown: true }), at: now }).offer?.countdown === false)

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll pricing checks passed.')
process.exit(failures ? 1 : 0)
