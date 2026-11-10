import { useEffect, useState, useRef } from 'react'
import { StorePage, storeStyle } from '../projects/seller/StorePage'
import { formatPrice } from '../projects/seller/model'
import { storeApi } from '../projects/seller/api'
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

  const buy = async (p: ShopProduct) => {
    const methods = store?.methods ?? ['stripe']
    if (methods.length === 1 && methods[0] !== 'bank') return pay(p, methods[0])
    setBuyErr(null)
    setChoosing(p)
  }
  const pay = async (p: ShopProduct, method: PayMethod, email?: string) => {
    if (checkoutBusy.current) return
    checkoutBusy.current = true
    setBuying(p.id)
    setBuyErr(null)
    try {
      // One key per product and method: a retry or double click reuses the same order.
      const keyName = `desknoty.checkout.${handle}.${p.id}.${method}`
      const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID()
      sessionStorage.setItem(keyName, key)
      const r = await storeApi.checkout(handle, p.id, key, method, email)
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

  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying }
  const chooser = choosing && (
    <PayChooser
      product={choosing}
      methods={store.methods ?? ['stripe']}
      busy={buying === choosing.id}
      onPay={(m, email) => void pay(choosing, m, email)}
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
        <StorePage {...base} only={product} />
        <p className="ps-back"><a href={`/${store.handle}`}>← All products</a></p>
      </Shell>
    )
  }
  return (
    <Shell store={store}>
      {buyErr && <Banner>{buyErr}</Banner>}
      {chooser}
      <StorePage {...base} />
    </Shell>
  )
}

const METHOD_LABEL: Record<PayMethod, string> = { stripe: 'Card (Stripe)', paypal: 'PayPal', bank: 'Bank transfer' }

/** The buyer picks how to pay. Bank transfer asks for an email so the download can be sent once it arrives. */
function PayChooser({ product, methods, busy, onPay, onClose }: { product: ShopProduct; methods: PayMethod[]; busy: boolean; onPay: (m: PayMethod, email?: string) => void; onClose: () => void }) {
  const [bank, setBank] = useState(false)
  const [email, setEmail] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  return (
    <div className="ps-pay" role="dialog" aria-label={`Pay for ${product.title}`}>
      <p className="ps-kicker">How would you like to pay?</p>
      <h2>{product.title} · {formatPrice(product.priceMinor, product.currency)}</h2>
      {!bank ? (
        <div className="ps-pay-list">
          {methods.map((m) => (
            <button key={m} type="button" className="sp-btn" disabled={busy} onClick={() => (m === 'bank' ? setBank(true) : onPay(m))}>
              {busy ? 'Opening…' : METHOD_LABEL[m]}
            </button>
          ))}
        </div>
      ) : (
        <form className="ps-pay-list" onSubmit={(e) => (e.preventDefault(), valid && onPay('bank', email.trim()))}>
          <label>
            Your email (the download is sent here once the seller confirms your transfer)
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button type="submit" className="sp-btn" disabled={busy || !valid}>{busy ? 'Creating order…' : 'Show bank details'}</button>
          <button type="button" className="ps-link" onClick={() => setBank(false)}>Back</button>
        </form>
      )}
      <button type="button" className="ps-link" onClick={onClose}>Cancel</button>
    </div>
  )
}

/** Bank transfer still owed: details, amount, reference. "I've paid" only tells the seller; it never unlocks. */
function BankPending({ order, claim }: { order: PublicOrder; claim?: () => Promise<{ order: PublicOrder }> }) {
  const [claimed, setClaimed] = useState(Boolean(order.buyerClaimedAt))
  const b = order.bank!
  return (
    <div className="ps-msg ps-bank">
      <p className="ps-kicker">Bank transfer · waiting for payment</p>
      <h1>Pay {formatPrice(order.amountMinor, order.currency)} by bank transfer</h1>
      <dl className="ps-bank-details">
        {b.bankName && (<><dt>Bank</dt><dd>{b.bankName}</dd></>)}
        <dt>Account name</dt><dd>{b.accountName}</dd>
        {b.sortCode && (<><dt>Sort code</dt><dd>{b.sortCode}</dd></>)}
        {b.accountNumber && (<><dt>Account number</dt><dd>{b.accountNumber}</dd></>)}
        {b.iban && (<><dt>IBAN</dt><dd>{b.iban}</dd></>)}
        {b.bic && (<><dt>BIC / SWIFT</dt><dd>{b.bic}</dd></>)}
        <dt>Amount</dt><dd>{formatPrice(order.amountMinor, order.currency)}</dd>
        <dt>Reference</dt><dd><b>{b.reference}</b></dd>
      </dl>
      <p>Use the reference exactly, so the seller can match your payment.{b.instructions ? ` ${b.instructions}` : ''}</p>
      <p className="ps-fine">Your download unlocks when the seller confirms the money has arrived. Keep this page’s address to come back to it.</p>
      {claimed ? (
        <p className="ps-fine" role="status">Thanks: the seller has been told you sent it. Your download unlocks once they confirm it arrived.</p>
      ) : (
        claim && (
          <button type="button" className="sp-btn" onClick={() => void claim().then(() => setClaimed(true))}>
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
        {store?.testMode && (
          <Banner>Test store: payments run in Stripe and PayPal test mode (Sandbox). No real money is taken, and nothing bought here is a real sale. Don’t use a real card.</Banner>
        )}
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
