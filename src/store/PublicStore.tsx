import { useEffect, useState, useRef } from 'react'
import { StorePage, storeStyle } from '../projects/seller/StorePage'
import { Style2Page } from '../projects/seller/Style2'
import { formatPrice } from '../projects/seller/model'
import { storeApi } from '../projects/seller/api'
import { bankIcon } from '../projects/seller/bank-icons'
import type { PublicOrder, PublicStore as Store } from '../projects/seller/api'
import type { PayMethod, ShopProduct } from '../projects/seller/model'

/**
 * Public storefront, no Desknoty account needed:
 *
 *   /store/<handle>                         the store
 *   /store/<handle>/p/<productId>           one product, shareable
 *   /store/<handle>/thanks?session_id=…     back from Stripe Checkout
 *   /store/<handle>/order/<orderId>?k=…     the link in the receipt email
 *
 * Works in TikTok's and Instagram's in-app browsers: plain links and a
 * full-page redirect to Stripe-hosted Checkout, no pop-ups.
 */
export default function PublicStore({ path }: { path: string }) {
  const parts = path.split('/').filter(Boolean).slice(1).map(decodeURIComponent)
  const [handle, kind, id] = [parts[0]?.toLowerCase() ?? '', parts[1] ?? '', parts[2] ?? '']
  const [store, setStore] = useState<Store | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [buyErr, setBuyErr] = useState<string | null>(null)
  const checkoutBusy = useRef(false)
  // More than one way to pay (or bank transfer, which needs an email): the buyer picks first.
  const [choosing, setChoosing] = useState<ShopProduct | null>(null)
  const params = new URLSearchParams(window.location.search)

  useEffect(() => {
    if (kind === 'thanks' || kind === 'order') return
    storeApi.get(handle).then(setStore).catch((e: Error) => setErr(e.message))
  }, [handle])
  useEffect(() => {
    if (store) document.title = `${store.page.name || store.handle} · Desknoty`
  }, [store])

  // Buy now always opens the checkout sheet (email, payment method, summary, Pay).
  // Products this browser has bought: each remembered order is re-checked with the server,
  // and only a confirmed payment turns Buy now into Download.
  const [owned, setOwned] = useState<Record<string, string>>({})
  useEffect(() => {
    if (kind === 'thanks' || kind === 'order') return
    let alive = true
    const ids = new Set((store?.products ?? []).map((p) => p.id))
    const saved = Object.entries(readOwned()).filter(([pid]) => ids.has(pid))
    void Promise.all(saved.map(async ([productId, url]) => {
      const m = url.match(/\/order\/([^/?#]+)\?(?:.*&)?k=([^&#]+)/)
      if (!m) return null
      const r = await storeApi.order(handle, m[1], decodeURIComponent(m[2])).catch(() => null)
      return r?.order.status === 'paid' ? ([productId, url] as const) : null
    })).then((list) => alive && setOwned(Object.fromEntries(list.filter((x): x is readonly [string, string] => Boolean(x)))))
    return () => { alive = false }
  }, [handle, kind, store])

  const buy = async (p: ShopProduct) => {
    setBuyErr(null)
    setChoosing(p)
  }
  const pay = async (p: ShopProduct, method: PayMethod, email?: string, payer?: { payerName: string; payerBank: string }) => {
    if (checkoutBusy.current) return
    checkoutBusy.current = true
    setBuying(p.id)
    setBuyErr(null)
    try {
      // One key per product and method: a retry or double click reuses the same order.
      const keyName = `desknoty.checkout.${handle}.${p.id}.${method}`
      const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID()
      sessionStorage.setItem(keyName, key)
      const r = await storeApi.checkout(handle, p.id, key, method, email, payer)
      window.location.assign(r.url ?? r.orderUrl!)
    } catch (e) {
      setBuyErr((e as Error).message)
      setBuying(null)
      checkoutBusy.current = false
    }
  }

  if (kind === 'thanks' && params.get('paypal_order'))
    return <Shell><OrderStatus handle={handle} load={() => storeApi.paypalConfirm(handle, params.get('paypal_order') ?? '', params.get('k') ?? '')} /></Shell>
  if (kind === 'thanks') return <Shell><OrderStatus handle={handle} load={() => storeApi.session(handle, params.get('session_id') ?? '')} /></Shell>
  if (kind === 'order')
    return (
      <Shell>
        <OrderStatus handle={handle} load={() => storeApi.order(handle, id, params.get('k') ?? '')} claim={() => storeApi.claim(handle, id, params.get('k') ?? '')} />
      </Shell>
    )
  if (err) return <Shell><Message title="Store not found" text={err} /></Shell>
  if (!store) return <Shell><Message title="Loading…" text="" /></Shell>

  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying, owned }
  const chooser = choosing && (
    <PayChooser
      product={choosing}
      methods={store.methods ?? ['stripe']}
      busy={buying === choosing.id}
      error={buyErr}
      seller={store.page.name || store.handle}
      onPay={(m, email, payer) => void pay(choosing, m, email, payer)}
      onClose={() => setChoosing(null)}
    />
  )

  if (kind === 'p') {
    const product = store.products.find((p) => p.id === id)
    if (!product) return <Shell store={store}><Message title="Product not found" text="It may have been removed or isn’t on sale right now." back={`/${store.handle}`} /></Shell>
    return (
      <Shell store={store}>
        {params.get('checkout') === 'cancelled' && <Banner>Checkout cancelled. You weren’t charged.</Banner>}
        {buyErr && <Banner>{buyErr}</Banner>}
        {!store.checkoutReady && <Banner>This seller isn’t taking payments yet.</Banner>}
        {chooser}
        {store.page.layout === 'style2' ? <Style2Page {...base} only={product} /> : <StorePage {...base} only={product} />}
        <p className="ps-back"><a href={`/${store.handle}`}>← All products</a></p>
      </Shell>
    )
  }
  return (
    <Shell store={store}>
      {buyErr && <Banner>{buyErr}</Banner>}
      {chooser}
      {store.page.layout === 'style2' ? <Style2Page {...base} /> : <StorePage {...base} />}
    </Shell>
  )
}


/** The buyer picks how to pay. Bank transfer asks for an email so the download can be sent once it arrives. */
type Choice = 'card' | 'applepay' | 'paypal' | 'bank'
const CHOICE_METHOD: Record<Choice, PayMethod> = { card: 'stripe', applepay: 'stripe', paypal: 'paypal', bank: 'bank' }
const PAYER_BANKS = ['Revolut', 'Monzo', 'Starling Bank', 'Barclays', 'HSBC', 'Lloyds Bank', 'NatWest', 'Santander', 'Halifax', 'Nationwide', 'Wise', 'Other bank']

/** A bank's app icon when we have its logo; otherwise a neat initial. */
function BankIcon({ name }: { name: string }) {
  const icon = bankIcon(name)
  if (icon) return <span className="co2-bi" style={{ background: icon.bg, color: icon.fg }} aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d={icon.path} /></svg></span>
  return <span className="co2-bi co2-bi-txt" aria-hidden="true">{name === 'Other bank' ? '…' : name.charAt(0)}</span>
}

/** Copy a value to the clipboard, with a short "Copied" confirmation. */
function CopyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <div className="bp-row">
      <dt>{label}</dt>
      <dd>{strong ? <b>{value}</b> : value}</dd>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(value).then(() => { setDone(true); window.setTimeout(() => setDone(false), 1400) })} aria-label={`Copy ${label}`}>{done ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

/** The checkout sheet (styled after the seller's reference): steps, payment rows, order summary, Pay bar. */
function PayChooser({ product, methods, busy, error, seller, onPay, onClose }: { product: ShopProduct; methods: PayMethod[]; busy: boolean; error: string | null; seller: string; onPay: (m: PayMethod, email?: string, payer?: { payerName: string; payerBank: string }) => void; onClose: () => void }) {
  const choices: Choice[] = [
    ...(methods.includes('stripe') ? (['card', 'applepay'] as Choice[]) : []),
    ...(methods.includes('paypal') ? (['paypal'] as Choice[]) : []),
    ...(methods.includes('bank') ? (['bank'] as Choice[]) : []),
  ]
  const [choice, setChoice] = useState<Choice>(choices[0] ?? 'card')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState(false)
  const method = CHOICE_METHOD[choice]
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const needEmail = method === 'bank'
  const [payerBank, setPayerBank] = useState('')
  const [payerName, setPayerName] = useState('')
  const bankReady = method !== 'bank' || (Boolean(payerBank) && payerName.trim().length > 1)
  const canPay = !busy && bankReady && (valid || (!needEmail && !email.trim()))
  const price = formatPrice(product.priceMinor, product.currency)
  const zero = formatPrice(0, product.currency).replace(/(\d)$/, '$1.00')
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const steps = ['Customer', 'Delivery', 'Payment', 'Confirm', 'Success']
  const at = 2 // customer and delivery (digital, instant) are done; payment is now
  const row = (c: Choice, label: string, logo: React.ReactNode, body?: React.ReactNode) => (
    <div className={choice === c ? 'co2-row on' : 'co2-row'}>
      <label className="co2-rowhead">
        <input type="radio" name="pay" checked={choice === c} onChange={() => setChoice(c)} aria-label={label} />
        <span className="co2-radio" aria-hidden="true" />
        <span className="co2-rowtitle">{label}</span>
        <span className="co2-logo" aria-hidden="true">{logo}</span>
      </label>
      {choice === c && body && <div className="co2-rowbody">{body}</div>}
    </div>
  )
  return (
    <div className="co-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="co2" role="dialog" aria-modal="true" aria-label={`Pay for ${product.title}`} onSubmit={(e) => (e.preventDefault(), canPay && onPay(method, email.trim() || undefined, method === 'bank' ? { payerName: payerName.trim(), payerBank } : undefined))}>
        <header className="co2-head">
          <button type="button" className="co2-back" onClick={onClose} aria-label="Close checkout">←</button>
          <b>Checkout</b>
        </header>
        <ol className="co2-steps" aria-label="Checkout steps">
          {steps.map((t, i) => (
            <li key={t} className={i < at ? 'done' : i === at ? 'on' : undefined} aria-current={i === at ? 'step' : undefined}>
              <span className="co2-dot">{i < at ? <svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg> : null}</span>
              <small>{t}</small>
            </li>
          ))}
        </ol>

        <div className="co2-body">
          <section className="co2-card">
            <h3>Customer</h3>
            <label className="co2-input">
              <span>Email{needEmail ? '' : ' (optional)'}</span>
              <div><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14v10H3zM3 5l7 6 7-6" /></svg><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required={needEmail} /></div>
            </label>
          </section>

          <section className="co2-card">
            <h3>Payment</h3>
            <p className="co2-secure"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg> All transactions are secure and encrypted.</p>
            <div className="co2-rows" role="radiogroup" aria-label="Payment method">
              {choices.includes('card') && row('card', 'Credit / Debit Card', <><i className="co-visa">VISA</i><i className="co-mc"><span /><span /></i></>,
                <p className="co2-note">You’ll enter your card number, expiry date and CVC on Stripe’s secure page after you press Pay. Desknoty never sees your card.</p>)}
              {choices.includes('paypal') && row('paypal', 'PayPal', <i className="co2-pp"><b>P</b></i>, <p className="co2-note">You’ll finish paying on PayPal.</p>)}
              {choices.includes('applepay') && row('applepay', 'Apple Pay', <i className="co2-apple"><svg viewBox="0 0 14 17"><path d="M11.6 9c0-2 1.6-2.9 1.7-3a3.7 3.7 0 0 0-2.9-1.6c-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7A3.9 3.9 0 0 0 1.5 6.4C.1 8.8 1.1 12.4 2.5 14.4c.7 1 1.5 2 2.5 2s1.4-.6 2.6-.6 1.5.6 2.6.6 1.7-1 2.4-2a8 8 0 0 0 1.1-2.2A3.4 3.4 0 0 1 11.6 9zM9.6 3.1A3.4 3.4 0 0 0 10.4.6a3.5 3.5 0 0 0-2.3 1.2 3.3 3.3 0 0 0-.8 2.4 2.9 2.9 0 0 0 2.3-1.1z" /></svg>Pay</i>,
                <p className="co2-note">Apple Pay appears on Stripe’s secure page on supported devices.</p>)}
              {choices.includes('bank') && row('bank', 'Bank transfer', <i className="co2-bank"><svg viewBox="0 0 20 20"><path d="M2 8l8-5 8 5zM4 9v6M8 9v6M12 9v6M16 9v6M2 17h16" /></svg></i>,
                <div className="co2-bankpay">
                  <span className="co2-sub">Which bank will you pay from?</span>
                  <div className="co2-banks" role="radiogroup" aria-label="Your bank">
                    {PAYER_BANKS.map((b) => (
                      <button key={b} type="button" role="radio" aria-checked={payerBank === b} className={payerBank === b ? 'co2-bankchip on' : 'co2-bankchip'} onClick={() => setPayerBank(b)}>
                        <BankIcon name={b} /> <span>{b}</span>
                      </button>
                    ))}
                  </div>
                  <label className="co2-input">
                    <span>Name on your bank account</span>
                    <div><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.5" /><path d="M3.5 17a6.5 6.5 0 0 1 13 0" /></svg><input autoComplete="name" placeholder="e.g. John Smith" value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={80} /></div>
                  </label>
                  <p className="co2-note">Next you’ll see the seller’s details to pay from your {payerBank || 'bank'} app. Your download unlocks when the seller confirms it arrived.</p>
                </div>)}
            </div>
          </section>

          <section className="co2-card">
            <div className="co2-sumhead"><h3>Order Summary</h3><button type="button" onClick={() => setDetails(!details)}>{details ? 'Hide details' : 'Show details'}</button></div>
            {details && <p className="co2-item"><b>{product.title}</b> · digital download from {seller}</p>}
            <dl className="co2-sum">
              <dt>Subtotal</dt><dd>{price}</dd>
              <dt>Delivery</dt><dd className="co2-free">{method === 'bank' ? 'After confirmation' : 'Free'}</dd>
              <dt>Tax</dt><dd>{zero}</dd>
            </dl>
            <div className="co2-total"><span>Total</span><b>{price}</b></div>
          </section>
          {error && <p className="co-err" role="alert">{error}</p>}
        </div>

        <footer className="co2-foot">
          <p className="co2-secure"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg> Your payment information is secure.</p>
          <button type="submit" className="co2-pay" disabled={!canPay}>
            <span>{busy ? 'Opening secure checkout…' : method === 'bank' ? 'Show bank details' : method === 'paypal' ? `Pay ${price} with PayPal` : `Pay ${price}`}</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
          </button>
        </footer>
      </form>
    </div>
  )
}

/** Bank transfer still owed: details, amount, reference. "I've paid" only tells the seller; it never unlocks. */
function BankPending({ order, claim }: { order: PublicOrder; claim?: () => Promise<{ order: PublicOrder }> }) {
  const [claimed, setClaimed] = useState(Boolean(order.buyerClaimedAt))
  const b = order.bank!
  const amount = formatPrice(order.amountMinor, order.currency)
  const from = order.payerBank && order.payerBank !== 'Other bank' ? order.payerBank : null
  return (
    <div className="ps-msg ps-bank bp">
      <div className="bp-head">
        {from ? <BankIcon name={from} /> : null}
        <div>
          <h1>Pay {amount} from your {from ?? 'bank'} app</h1>
          <p>Open {from ? `the ${from}` : 'your banking'} app, send a payment to the details below, and use the reference exactly.</p>
        </div>
      </div>
      <dl className="bp-details">
        {b.bankName && <CopyRow label="Bank" value={b.bankName} />}
        <CopyRow label="Account name" value={b.accountName} />
        {b.sortCode && <CopyRow label="Sort code" value={b.sortCode} />}
        {b.accountNumber && <CopyRow label="Account number" value={b.accountNumber} />}
        {b.iban && <CopyRow label="IBAN" value={b.iban} />}
        {b.bic && <CopyRow label="BIC / SWIFT" value={b.bic} />}
        <CopyRow label="Amount" value={amount} />
        {b.reference && <CopyRow label="Reference" value={b.reference} strong />}
      </dl>
      {b.instructions && <p>{b.instructions}</p>}
      <p className="ps-fine">Your download unlocks when the seller confirms the money arrived. Keep this page’s address to come back to it.</p>
      {claimed ? (
        <p className="ps-fine" role="status">Thanks: the seller has been told you sent it. Your download unlocks once they confirm it arrived.</p>
      ) : (
        claim && (
          <button type="button" className="sp-btn bp-sent" onClick={() => void claim().then(() => setClaimed(true))}>
            I’ve sent the payment
          </button>
        )
      )}
    </div>
  )
}

function Shell({ store, children }: { store?: Store; children: React.ReactNode }) {
  return (
    <div className="ps" style={store ? storeStyle(store.page) : undefined}>
      <main className="ps-main">
        {children}
      </main>
    </div>
  )
}
function Banner({ children }: { children: React.ReactNode }) {
  return <div className="ps-banner" role="status">{children}</div>
}
function Message({ title, text, back }: { title: string; text: string; back?: string }) {
  return (
    <div className="ps-msg">
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {back && <a href={back}>Back to the store</a>}
    </div>
  )
}

/** Waits for Stripe's confirmation, then shows the download. */
// One list per browser, by product id (ids are unique across stores; the thank-you page
// and the store page can name the store differently).
const OWNED = 'desknoty.owned'
function readOwned(_handle?: string): Record<string, string> {
  try { const j = JSON.parse(localStorage.getItem(OWNED) ?? '{}'); return j && typeof j === 'object' ? j : {} } catch { return {} }
}
function rememberOwned(_handle: string, productId: string, url: string) {
  try { localStorage.setItem(OWNED, JSON.stringify({ ...readOwned(), [productId]: url })) } catch { /* private mode: the receipt email link still works */ }
}

function OrderStatus({ handle, load, claim }: { handle: string; load: () => Promise<{ order: PublicOrder }>; claim?: () => Promise<{ order: PublicOrder }> }) {
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let alive = true
    load()
      .then((r) => alive && setOrder(r.order))
      .catch((e: Error) => alive && setErr(e.message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries])
  // Card payments usually confirm within seconds; keep checking for a while. Bank transfers wait for the seller.
  // remember this purchase in this browser, so the store shows Download for it later
  useEffect(() => {
    if (!order?.productId) return
    if (order.status === 'paid' && order.retrievalUrl) rememberOwned(handle, order.productId, order.retrievalUrl)
    else if (order.status === 'pending' && /\/order\//.test(window.location.pathname)) rememberOwned(handle, order.productId, window.location.pathname + window.location.search)
  }, [order, handle])
  useEffect(() => {
    if (order?.status !== 'pending' || order.method === 'bank' || tries > 40) return
    const t = window.setTimeout(() => setTries((n) => n + 1), tries < 10 ? 1500 : 5000)
    return () => window.clearTimeout(t)
  }, [order, tries])

  const back = `/${handle}`
  if (err) return <Message title="Order not found" text={err} back={back} />
  if (!order) return <Message title="Checking your payment…" text="" />
  if (order.status === 'paid')
    return (
      <div className="ps-msg ps-paid">
        <p className="ps-kicker">Payment confirmed</p>
        <h1>Thanks for your order</h1>
        <p>
          {order.product} · {formatPrice(order.amountMinor, order.currency)}
          {order.receiptSent && order.email ? ` · receipt accepted for sending to ${order.email} (delivery unconfirmed)` : ''}
        </p>
        <a className="sp-btn ps-download" href={order.downloadUrl!} download>
          Download {order.fileName}
        </a>
        <p className="ps-fine">
          {order.downloadExpiresAt
            ? `This download link works until ${new Date(order.downloadExpiresAt).toLocaleString()}.`
            : 'This download link works for 24 hours.'}
          {' Save your permanent purchase link below to get a new download link later.'}
        </p>
        {order.retrievalUrl && <a href={order.retrievalUrl}>Permanent purchase link</a>}
        <p className="ps-fine">Receipt: {order.receiptStatus.replaceAll('_', ' ')}. Email delivery is not confirmed.</p>
        <a href={back}>Back to the store</a>
      </div>
    )
  if (order.status === 'pending' && order.bank) return <BankPending order={order} claim={claim} />
  if (order.status === 'pending')
    return (
      <Message
        title="Waiting for your payment to confirm"
        text={tries > 40 ? 'This is taking longer than usual. Some payment methods take a while to clear; we’ll email you the download as soon as it does.' : 'This usually takes a few seconds. Keep this page open.'}
      />
    )
  if (order.status === 'refunded') return <Message title="Purchase refunded" text="Download access ends after a full or partial refund. Contact the seller with questions." back={back} />
  if (order.status === 'disputed') return <Message title="Download access suspended" text="This payment is disputed. Access returns if the dispute is resolved in the seller’s favour and no refund applies." back={back} />
  if (order.status === 'cancelled') return <Message title="Checkout cancelled" text="You weren’t charged." back={back} />
  return <Message title="Payment didn’t go through" text="You weren’t charged. Try again with another payment method." back={back} />
}
