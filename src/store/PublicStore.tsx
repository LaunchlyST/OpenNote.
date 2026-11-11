import { useEffect, useState, useRef } from 'react'
import { StorePage, storeStyle } from '../projects/seller/StorePage'
import { Style2Page } from '../projects/seller/Style2'
import { formatPrice, mediaUrl } from '../projects/seller/model'
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

  // Download a bought product right here: fetch a fresh signed link (the server checks the payment again), then start it.
  const [downloading, setDownloading] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState<string | null>(null)
  const download = async (p: ShopProduct) => {
    const url = readOwned()[p.id]
    const m = url?.match(/\/order\/([^/?#]+)\?(?:.*&)?k=([^&#]+)/)
    if (!m) return
    setDownloading(p.id)
    setBuyErr(null)
    try {
      const r = await storeApi.order(handle, m[1], decodeURIComponent(m[2]))
      if (r.order.status !== 'paid' || !r.order.downloadUrl) throw new Error('This purchase isn’t confirmed yet.')
      startDownload(r.order.downloadUrl, r.order.fileName)
    } catch (e) {
      setBuyErr((e as Error).message)
    }
    setDownloading(null)
  }

  const buy = async (p: ShopProduct) => {
    setBuyErr(null)
    // free: no checkout, straight to the download
    if (p.priceMinor === 0) return pay(p, 'stripe')
    setChoosing(p)
  }
  const pay = async (p: ShopProduct, method: PayMethod, email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }) => {
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
      // Free (or otherwise already confirmed): download right here, no page change
      if (r.order?.status === 'paid' && r.order.downloadUrl && r.orderUrl) {
        rememberOwned(handle, p.id, r.orderUrl)
        setOwned((o) => ({ ...o, [p.id]: r.orderUrl! }))
        setChoosing(null)
        setCelebrate(p.title)
        window.setTimeout(() => setCelebrate(null), 2600)
        startDownload(r.order.downloadUrl, r.order.fileName)
        setBuying(null)
        checkoutBusy.current = false
        return
      }
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

  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying, owned, onDownload: (p: ShopProduct) => void download(p), downloading }
  const party = celebrate && (
    <div className="ps-party" role="status">
      <div className="ps-tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
      <b>It’s yours!</b>
      <span>{celebrate} is downloading.</span>
    </div>
  )
  const chooser = choosing && (
    <PayChooser
      product={choosing}
      methods={store.methods ?? ['stripe']}
      banks={store.banks ?? []}
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
        {!store.checkoutReady && product.priceMinor > 0 && <Banner>This seller hasn’t added a bank account in Payouts yet, so you can’t buy right now.</Banner>}
        {chooser}
        {party}
        {store.page.layout === 'style2' ? <Style2Page {...base} only={product} /> : <StorePage {...base} only={product} />}
        <p className="ps-back"><a href={`/${store.handle}`}>← All products</a></p>
      </Shell>
    )
  }
  return (
    <Shell store={store}>
      {buyErr && <Banner>{buyErr}</Banner>}
      {chooser}
      {party}
      {store.page.layout === 'style2' ? <Style2Page {...base} /> : <StorePage {...base} />}
    </Shell>
  )
}


/** The buyer picks how to pay. Bank transfer asks for an email so the download can be sent once it arrives. */
type Choice = 'card' | 'paypal' | 'bank'
type Wallet = 'card' | 'apple' | 'google'
const WALLET_LABEL: Record<Wallet, string> = { card: 'Debit or credit card', apple: 'Apple Pay', google: 'Google Pay' }
const CHOICE_METHOD: Record<Choice, PayMethod> = { card: 'stripe', paypal: 'paypal', bank: 'bank' }

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

/** Checkout: Payment Details on the left, Order Summary on the right (stacked on phones). */
function PayChooser({ product, methods, banks, busy, error, seller, onPay, onClose }: { product: ShopProduct; methods: PayMethod[]; banks: NonNullable<Store['banks']>; busy: boolean; error: string | null; seller: string; onPay: (m: PayMethod, email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }) => void; onClose: () => void }) {
  const choices: Choice[] = [
    ...(methods.includes('bank') ? (['bank'] as Choice[]) : []),
    ...(methods.includes('stripe') ? (['card'] as Choice[]) : []),
    ...(methods.includes('paypal') ? (['paypal'] as Choice[]) : []),
  ]
  const [choice, setChoice] = useState<Choice>(choices[0] ?? 'card')
  const [email, setEmail] = useState('')
  // Card, Apple Pay (Apple devices that support it) and Google Pay; Stripe shows them on its secure page
  const wallets: Wallet[] = ['card', ...(typeof window !== 'undefined' && 'ApplePaySession' in window ? (['apple'] as Wallet[]) : []), 'google']
  const [wallet, setWallet] = useState<Wallet>('card')
  const [payTo, setPayTo] = useState<number>(() => (banks.find((b) => b.inUse) ?? banks[0])?.index ?? -1)
  const [remember, setRemember] = useState(() => { try { return Boolean(localStorage.getItem('desknoty.payer')) } catch { return false } })
  useEffect(() => {
    // details this buyer chose to remember on this device
    try { const j = JSON.parse(localStorage.getItem('desknoty.payer') ?? 'null'); if (j) setEmail(j.email ?? '') } catch { /* none */ }
  }, [])
  const method = CHOICE_METHOD[choice]
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const isBank = method === 'bank'
  const noBank = isBank && banks.length === 0
  const ready = isBank ? valid && !noBank && payTo >= 0 : valid || !email.trim()
  const canPay = !busy && ready
  const price = formatPrice(product.priceMinor, product.currency)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  const submit = () => {
    if (!canPay) return
    try {
      if (remember) localStorage.setItem('desknoty.payer', JSON.stringify({ email: email.trim() }))
      else localStorage.removeItem('desknoty.payer')
    } catch { /* storage blocked */ }
    onPay(method, email.trim() || undefined, isBank ? { bankIndex: payTo } : undefined)
  }
  const cover = product.cover ? mediaUrl(product.cover) : null
  return (
    <div className="co-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="co3" role="dialog" aria-modal="true" aria-label={`Pay for ${product.title}`} onSubmit={(e) => (e.preventDefault(), submit())}>
        <nav className="co3-trail" aria-label="Checkout steps">
          <button type="button" onClick={onClose}>{seller}</button><i aria-hidden="true" />
          <button type="button" onClick={onClose}>{product.title}</button><i aria-hidden="true" />
          <b aria-current="step">Checkout</b><i aria-hidden="true" />
          <span>Confirmation</span>
          <button type="button" className="co3-x" onClick={onClose} aria-label="Close checkout">✕</button>
        </nav>

        <div className="co3-grid">
          <section className="co3-pay" aria-label="Payment details">
            <h2>Payment Details</h2>
            {choices.length > 1 && (
              <div className="co3-tabs" role="radiogroup" aria-label="Payment method">
                {choices.map((c) => (
                  <label key={c} className={choice === c ? 'on' : undefined}>
                    <input type="radio" name="pm" checked={choice === c} onChange={() => setChoice(c)} aria-label={c === 'card' ? 'Credit / Debit Card' : c === 'paypal' ? 'PayPal' : 'Bank transfer'} />
                    {c === 'card' ? 'Card' : c === 'paypal' ? 'PayPal' : 'Bank transfer'}
                  </label>
                ))}
              </div>
            )}

            {isBank ? (
              <>
                {noBank ? (
                  <p className="co3-warn" role="alert">{seller} hasn’t added a bank account yet. The seller needs to add one in Payouts before you can pay by bank transfer.</p>
                ) : (
                  <label className="co3-field">
                    <span>Pay to</span>
                    <div className="co3-selectwrap">
                      <select value={payTo} onChange={(e) => setPayTo(Number(e.target.value))} aria-label="Pay to">
                        {banks.map((b) => <option key={b.index} value={b.index}>{b.bankName} ••{b.last4}</option>)}
                      </select>
                      {banks.find((b) => b.index === payTo) && <BankIcon name={banks.find((b) => b.index === payTo)!.bankName} />}
                    </div>
                  </label>
                )}
                <label className="co3-field"><span>Email for your download</span><input type="email" autoComplete="email" inputMode="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" /></label>
                
              </>
            ) : (
              <>
                <label className="co3-field"><span>Email for your receipt</span><input type="email" autoComplete="email" inputMode="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" /></label>
                {method === 'paypal' ? (
                  <div className="co3-cardnote"><p>You’ll finish paying on PayPal.</p></div>
                ) : (
                  <>
                    <div className="co3-wallets" role="radiogroup" aria-label="Pay with">
                      {wallets.map((w) => (
                        <label key={w} className={wallet === w ? 'on' : undefined}>
                          <input type="radio" name="wallet" checked={wallet === w} onChange={() => setWallet(w)} aria-label={WALLET_LABEL[w]} />
                          <span className="co3-wlogo" aria-hidden="true">{w === 'card' ? <><i className="co-visa">VISA</i><i className="co-mc"><span /><span /></i></> : w === 'apple' ? <b className="co3-apple">Pay</b> : <b className="co3-gpay"><span>G</span> Pay</b>}</span>
                          <span>{WALLET_LABEL[w]}</span>
                        </label>
                      ))}
                    </div>
                    <p className="co3-hint">{wallet === 'card' ? 'You’ll type your card on Stripe’s secure page. Desknoty never sees your card.' : `On Stripe’s secure page, tap ${WALLET_LABEL[wallet]}. Want to use a different card? You can type one there instead.`}</p>
                  </>
                )}
              </>
            )}
            <label className="co3-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Save my details on this device</label>
          </section>

          <section className="co3-sum" aria-label="Order summary">
            <h2>Order Summary</h2>
            <div className="co3-item">
              <span className="co3-thumb" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>{!cover && (product.title.charAt(0).toUpperCase() || '✦')}</span>
              <div>
                <div className="co3-itemtop"><b>{product.title}</b><strong>{price}</strong></div>
                {product.description && <small>{product.description.split('\n')[0].slice(0, 90)}</small>}
                <div className="co3-meta"><span>Format: Digital download</span><span>Quantity: 1</span></div>
              </div>
            </div>
            <dl className="co3-lines">
              <dt>Subtotal</dt><dd>{price}</dd>
              <dt>Delivery</dt><dd>FREE</dd>
            </dl>
            <div className="co3-total"><span>Total</span><b>{price}</b></div>
            {error && <p className="co-err" role="alert">{error}</p>}
            <button type="submit" className="co3-pay-btn" disabled={!canPay}>{busy ? 'Opening…' : 'Pay Now'}</button>
            <p className="co3-terms">By continuing, you agree to pay {seller} {price} for this digital download.</p>
          </section>
        </div>
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
/** Start a file download without leaving the page (the server sends it as an attachment). */
function startDownload(url: string, fileName?: string) {
  const a = document.createElement('a')
  a.href = url
  if (fileName) a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

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
    // just paid: start the file straight away (once per order)
    if (order.status === 'paid' && order.downloadUrl) {
      const k = `desknoty.autodl.${order.id}`
      try { if (!sessionStorage.getItem(k) && !localStorage.getItem(k)) { localStorage.setItem(k, '1'); startDownload(order.downloadUrl, order.fileName) } } catch { /* storage blocked: the Download button still works */ }
    }
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
        <div className="ps-tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
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
