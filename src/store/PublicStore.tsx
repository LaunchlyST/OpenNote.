import { useEffect, useState } from 'react'
import { StorePage, storeStyle } from '../projects/seller/StorePage'
import { formatPrice } from '../projects/seller/model'
import { storeApi } from '../projects/seller/api'
import type { PublicOrder, PublicStore as Store } from '../projects/seller/api'
import type { ShopProduct } from '../projects/seller/model'

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
  const params = new URLSearchParams(window.location.search)

  useEffect(() => {
    storeApi.get(handle).then(setStore).catch((e: Error) => setErr(e.message))
  }, [handle])
  useEffect(() => {
    if (store) document.title = `${store.page.name || store.handle} · Desknoty`
  }, [store])

  const buy = async (p: ShopProduct) => {
    setBuying(p.id)
    setBuyErr(null)
    try {
      // One id per purchase attempt: a retry or double click reuses the same order.
      const key = `desknoty.checkout.${handle}.${p.id}`
      const fresh = () => {
        const id = crypto.randomUUID()
        try {
          sessionStorage.setItem(key, id)
        } catch {
          /* storage blocked: retries just won't be merged */
        }
        return id
      }
      let requestId: string
      try {
        requestId = sessionStorage.getItem(key) ?? fresh()
      } catch {
        requestId = fresh()
      }
      const r = await storeApi.checkout(handle, p.id, requestId).catch(async (e: Error & { status?: number }) => {
        // That attempt was already paid for: this is a new purchase.
        if (e.status === 409 && /already complete/.test(e.message)) return storeApi.checkout(handle, p.id, fresh())
        throw e
      })
      window.location.assign(r.url)
    } catch (e) {
      setBuyErr((e as Error).message)
      setBuying(null)
    }
  }

  if (err) return <Shell><Message title="Store not found" text={err} /></Shell>
  if (!store) return <Shell><Message title="Loading…" text="" /></Shell>

  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying }

  if (kind === 'thanks') return <Shell store={store}><OrderStatus store={store} load={() => storeApi.session(handle, params.get('session_id') ?? '')} /></Shell>
  if (kind === 'order') return <Shell store={store}><OrderStatus store={store} load={() => storeApi.order(handle, id, params.get('k') ?? '')} /></Shell>
  if (kind === 'p') {
    const product = store.products.find((p) => p.id === id)
    if (!product) return <Shell store={store}><Message title="Product not found" text="It may have been removed or isn’t on sale right now." back={`/store/${store.handle}`} /></Shell>
    return (
      <Shell store={store}>
        {params.get('checkout') === 'cancelled' && <Banner>Checkout cancelled. You weren’t charged.</Banner>}
        {buyErr && <Banner>{buyErr}</Banner>}
        {!store.checkoutReady && <Banner>This seller isn’t taking payments yet.</Banner>}
        <StorePage {...base} only={product} />
        <p className="ps-back"><a href={`/store/${store.handle}`}>← All products</a></p>
      </Shell>
    )
  }
  return (
    <Shell store={store}>
      {buyErr && <Banner>{buyErr}</Banner>}
      <StorePage {...base} />
    </Shell>
  )
}

function Shell({ store, children }: { store?: Store; children: React.ReactNode }) {
  return (
    <div className="ps" style={store ? storeStyle(store.page) : undefined}>
      <main className="ps-main">
        {store?.testMode && (
          <Banner>Test store: payments run in Stripe Sandbox. No real money is taken, and nothing bought here is a real sale. Don’t use a real card.</Banner>
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
function OrderStatus({ store, load }: { store: Store; load: () => Promise<{ order: PublicOrder }> }) {
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
  // Card payments usually confirm within seconds; keep checking for a while.
  useEffect(() => {
    if (order?.status !== 'pending' || tries > 40) return
    const t = window.setTimeout(() => setTries((n) => n + 1), tries < 10 ? 1500 : 5000)
    return () => window.clearTimeout(t)
  }, [order, tries])

  const back = `/store/${store.handle}`
  if (err) return <Message title="Order not found" text={err} back={back} />
  if (!order) return <Message title="Checking your payment…" text="" />
  if (order.status === 'paid')
    return (
      <div className="ps-msg ps-paid">
        <p className="ps-kicker">Payment confirmed</p>
        <h1>Thanks for your order</h1>
        <p>
          {order.product} · {formatPrice(order.amountMinor, order.currency)}
          {order.email && order.receipt === 'sent' ? ` · receipt sent to ${order.email}` : ''}
          {order.email && order.receipt !== 'sent' ? ` · a receipt will be emailed to ${order.email}` : ''}
        </p>
        <a className="sp-btn ps-download" href={order.downloadUrl!} download>
          Download {order.fileName}
        </a>
        <p className="ps-fine">
          This download link works for 24 hours.{' '}
          {order.receipt === 'sent' ? 'The email we sent you can make a new one any time.' : 'Keep this page’s address: it can make a new link any time.'}
        </p>
        <a href={back}>Back to the store</a>
      </div>
    )
  if (order.status === 'pending')
    return (
      <Message
        title="Waiting for your payment to confirm"
        text={tries > 40 ? 'This is taking longer than usual. Some payment methods take a while to clear; we’ll email you the download as soon as it does.' : 'This usually takes a few seconds. Keep this page open.'}
      />
    )
  if (order.status === 'cancelled') return <Message title="Checkout cancelled" text="You weren’t charged." back={back} />
  if (order.status === 'refunded') return <Message title="Order refunded" text="This purchase was refunded, so its download is no longer available." back={back} />
  return <Message title="Payment didn’t go through" text="You weren’t charged. Try again with another payment method." back={back} />
}
