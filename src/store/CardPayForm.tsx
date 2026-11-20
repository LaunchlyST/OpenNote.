/**
 * The card form inside Desknoty's checkout (Stripe Payment Element): card
 * number, expiry and CVC, plus Link / Apple Pay / Google Pay where available.
 * Card details go straight from the buyer to Stripe; Desknoty never sees them.
 * The order is marked paid only after the server reads the payment from Stripe.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { storeApi } from '../projects/seller/api'

export type CardPayHandle = { pay: () => Promise<void> }

const stripes = new Map<string, Promise<Stripe | null>>()
const stripeFor = (pk: string, account: string) => {
  const k = `${pk}|${account}`
  if (!stripes.has(k)) stripes.set(k, loadStripe(pk, { stripeAccount: account }))
  return stripes.get(k)!
}

export const CardPayForm = forwardRef<CardPayHandle, {
  pk: string
  account: string
  handle: string
  productId: string
  amountMinor: number
  currency: string
  email: string
  name?: string
  coupon?: string
  onReady: (ready: boolean) => void
  onBusy: (busy: boolean) => void
}>(function CardPayForm({ pk, account, handle, productId, amountMinor, currency, email, name, coupon, onReady, onBusy }, ref) {
  const quick = useRef<HTMLDivElement>(null)
  const [hasQuick, setHasQuick] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const stripe = useRef<Stripe | null>(null)
  const elements = useRef<StripeElements | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Mount Stripe's form once per amount (a discount code changes the amount).
  useEffect(() => {
    let gone = false
    onReady(false)
    setLoading(true)
    void stripeFor(pk, account).then((s) => {
      if (gone || !s || !box.current) return
      stripe.current = s
      const els = s.elements({ mode: 'payment', amount: amountMinor, currency: currency.toLowerCase(), appearance: { theme: 'stripe', variables: { borderRadius: '10px', fontFamily: 'Inter, system-ui, sans-serif' } } })
      elements.current = els
      // Quick-pay buttons on top (Google Pay / Apple Pay / Link, whichever the device offers), card form below.
      if (quick.current) {
        const ece = els.create('expressCheckout', { buttonHeight: 44, buttonType: { googlePay: 'pay', applePay: 'plain' } })
        ece.on('ready', (e) => { if (!gone) setHasQuick(Boolean(e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean))) })
        ece.on('confirm', () => { void run(false) })
        ece.mount(quick.current)
      }
      const pe = els.create('payment', { layout: { type: 'tabs', defaultCollapsed: false }, wallets: { applePay: 'never', googlePay: 'never' } })
      pe.on('ready', () => { if (!gone) setLoading(false) })
      pe.on('change', (e) => { if (!gone) { onReady(e.complete); setErr(null) } })
      pe.mount(box.current)
    }).catch(() => { if (!gone) { setErr('The card form could not load. Check your connection and try again.'); setLoading(false) } })
    return () => { gone = true; elements.current?.getElement('payment')?.destroy(); elements.current = null }
  }, [pk, account, amountMinor, currency]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shared by the card form (Secure pay) and the quick-pay buttons.
  const live = useRef({ handle, productId, email, name, coupon, onBusy })
  live.current = { handle, productId, email, name, coupon, onBusy }
  async function run(checkForm: boolean) {
      const { handle, productId, email, name, coupon, onBusy } = live.current
      const s = stripe.current
      const els = elements.current
      if (!s || !els) return
      setErr(null)
      onBusy(true)
      try {
        if (checkForm) {
          const checked = await els.submit()
          if (checked.error) throw new Error(checked.error.message)
        }
        // One order per attempt key: a double click or retry reuses the same payment.
        const keyName = `desknoty.checkout.${handle}.${productId}.inline${coupon ? `.${coupon}` : ''}`
        const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID()
        sessionStorage.setItem(keyName, key)
        const r = await storeApi.checkout(handle, productId, key, 'stripe', email || undefined, undefined, coupon, { inline: true })
        if (!r.clientSecret || !r.orderUrl) throw new Error('We could not start the payment. Please try again.')
        const done = await s.confirmPayment({
          elements: els,
          clientSecret: r.clientSecret,
          confirmParams: { return_url: new URL(r.orderUrl, window.location.origin).toString(), ...(email ? { receipt_email: email } : {}), ...(name ? { payment_method_data: { billing_details: { name, ...(email ? { email } : {}) } } } : {}) },
          redirect: 'if_required',
        })
        if (done.error) throw new Error(done.error.message ?? 'Your card was not charged. Please try again.')
        sessionStorage.removeItem(keyName)
        // The order page asks Stripe whether the payment succeeded before unlocking the download.
        window.location.assign(r.orderUrl)
      } catch (e) {
        setErr((e as Error).message)
        onBusy(false)
      }
  }
  useImperativeHandle(ref, () => ({ pay: () => run(true) }), [])

  return (
    <div className="co3-cardform">
      {loading && <p className="co3-hint" role="status">Loading secure card form…</p>}
      <div ref={quick} className={hasQuick ? 'co3-quick' : 'co3-quick off'} />
      {hasQuick && <p className="co3-or"><span>or pay with card</span></p>}
      <div ref={box} />
      {err && <p className="co3-warn" role="alert">{err}</p>}
    </div>
  )
})
