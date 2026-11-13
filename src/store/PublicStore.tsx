import { useEffect, useState, useRef, useMemo } from 'react'
import { BuyRow, StorePage, storeStyle } from '../projects/seller/StorePage'
import { ProductSheet } from '../projects/seller/ProductCard'
import { Style2Page } from '../projects/seller/Style2'
import { formatPrice, mediaUrl } from '../projects/seller/model'
import { storeApi } from '../projects/seller/api'
import { BANK_ICONS, bankIcon } from '../projects/seller/bank-icons'
import type { ClaimState, PriceQuote, PublicOrder, PublicStore as Store } from '../projects/seller/api'
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
  // Saved products: in the account when signed in, otherwise only in this browser.
  const fav = useFavourites()
  // Free products this browser already asked for, with the live resend cooldown from the server.
  const { claims, waitSeconds } = useClaims(handle, store?.products, kind)
  // Product detail panel: ?p=<id> opens it, so links and the browser Back button work.
  const [sheet, setSheet] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('p')))
  useEffect(() => {
    const sync = () => setSheet(new URLSearchParams(window.location.search).get('p'))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const checkoutBusy = useRef(false)
  // More than one way to pay (or bank transfer, which needs an email): the buyer picks first.
  const [choosing, setChoosing] = useState<ShopProduct | null>(null)
  const params = new URLSearchParams(window.location.search)

  useEffect(() => {
    if (kind === 'thanks' || kind === 'order' || kind === 'claim') return
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
    if (kind === 'thanks' || kind === 'order' || kind === 'claim') return
    let alive = true
    const ids = new Set((store?.products ?? []).map((p) => p.id))
    const saved = Object.entries(readOwned()).filter(([pid]) => ids.has(pid))
    void Promise.all(saved.map(async ([productId, url]) => {
      const m = url.match(/\/order\/([^/?#]+)\?(?:.*&)?k=([^&#]+)/)
      if (!m) return null
      const r = await storeApi.order(handle, m[1], decodeURIComponent(m[2])).catch(() => null)
      return r?.order.status === 'paid' && (r.order.method as string) !== 'free' ? ([productId, url] as const) : null
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
    // every product, free or paid, opens the checkout popup first
    setChoosing(p)
  }
  const pay = async (p: ShopProduct, method: PayMethod, email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }, coupon?: string) => {
    if (checkoutBusy.current) return
    checkoutBusy.current = true
    setBuying(p.id)
    setBuyErr(null)
    try {
      // One key per product, method and code: a retry or double click reuses the same order.
      const keyName = `desknoty.checkout.${handle}.${p.id}.${method}${coupon ? `.${coupon}` : ''}`
      const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID()
      sessionStorage.setItem(keyName, key)
      const r = await storeApi.checkout(handle, p.id, key, method, email, payer, coupon)
      // Free (or otherwise already confirmed): download right here, no page change.
      // Only a paid product with a real price is remembered as owned: free ones stay email-only.
      if (p.priceMinor > 0 && r.order?.status === 'paid' && r.order.downloadUrl && r.orderUrl) {
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

  if (kind === 'claim') return <Shell><ClaimOpen handle={handle} claimId={id} token={params.get('t') ?? ''} /></Shell>
  if (kind === 'thanks' && params.get('paypal_order'))
    return <Shell><OrderStatus backToStore handle={handle} load={() => storeApi.paypalConfirm(handle, params.get('paypal_order') ?? '', params.get('k') ?? '')} /></Shell>
  if (kind === 'thanks') return <Shell><OrderStatus backToStore handle={handle} load={() => storeApi.session(handle, params.get('session_id') ?? '')} /></Shell>
  if (kind === 'order')
    return (
      <Shell>
        <OrderStatus handle={handle} load={() => storeApi.order(handle, id, params.get('k') ?? '')} claim={() => storeApi.claim(handle, id, params.get('k') ?? '')} />
      </Shell>
    )
  if (err) return <Shell><Message title="Store not found" text={err} /></Shell>
  if (!store) return <Shell><Message title="Loading…" text="" /></Shell>

  const openProduct = (p: ShopProduct) => {
    const u = new URL(window.location.href)
    u.searchParams.set('p', p.id)
    window.history.pushState({ sheet: p.id }, '', u)
    setSheet(p.id)
  }
  const closeSheet = () => {
    if (window.history.state?.sheet) window.history.back()
    else {
      const u = new URL(window.location.href)
      u.searchParams.delete('p')
      window.history.replaceState(null, '', u)
      setSheet(null)
    }
  }
  const openClaimAgain = (p: ShopProduct) => { setChoosing(p) }
  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying, owned, onDownload: (p: ShopProduct) => void download(p), downloading, onOpenProduct: openProduct, savedIds: fav.ids, onToggleSave: (p: ShopProduct) => void fav.toggle(p.id), claims: Object.fromEntries(Object.entries(claims).map(([pid, c]) => [pid, { waitSeconds: waitSeconds(pid), email: c.email }])) as Record<string, { waitSeconds: number; email: string }>, onClaimAgain: openClaimAgain }
  const paidId = params.get('paid')
  const paidProduct = paidId ? store.products.find((p) => (owned[p.id] ?? '').includes(`/order/${paidId}`)) : undefined
  const sheetProduct = sheet ? store.products.find((p) => p.id === sheet) : undefined
  const sheetView = sheetProduct && (
    <ProductSheet
      key={sheetProduct.id}
      p={sheetProduct}
      onClose={closeSheet}
      buy={<BuyRow prod={sheetProduct} {...base} />}
      handle={store.handle}
      products={store.products}
      onOpenProduct={openProduct}
      saved={fav.ids.includes(sheetProduct.id)}
      onToggleSave={() => void fav.toggle(sheetProduct.id)}
      savedNote={fav.mode === 'local' ? 'Saved in this browser only. Sign in to Desknoty to keep saved products on every device.' : undefined}
      description={sheetProduct.description ? <div className="sp-desc">{sheetProduct.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div> : null}
    />
  )
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
      handle={store.handle}
      onPay={(m, email, payer, coupon) => void pay(choosing, m, email, payer, coupon)}
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
      {paidProduct && <PaidConfirm product={paidProduct} onDownload={() => void download(paidProduct)} />}
      {sheetView}
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

/** Order page: the buyer rates what they bought. One review per product, editable; shown as a verified review. */
function ReviewForm({ handle, orderId, products }: { handle: string; orderId: string; products: Array<{ id: string; title: string }> }) {
  const k = new URLSearchParams(window.location.search).get('k') ?? ''
  const [pid, setPid] = useState(products[0]?.id ?? '')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<{ busy: boolean; msg: string | null; removed: boolean; had: boolean }>({ busy: false, msg: null, removed: false, had: false })
  useEffect(() => {
    if (!k || !pid) return
    storeApi.myReview(handle, orderId, k, pid).then((r) => {
      if (r.review) { setRating(r.review.rating); setBody(r.review.body); setName(r.review.name); setState((s) => ({ ...s, had: true, removed: r.review!.status === 'removed' })) }
      else { setRating(0); setBody(''); setState((s) => ({ ...s, had: false, removed: false })) }
    }).catch(() => {})
  }, [handle, orderId, k, pid])
  if (!k) return null
  const save = async () => {
    setState((s) => ({ ...s, busy: true, msg: null }))
    try {
      await storeApi.saveReview(handle, orderId, k, { rating, body, name, productId: pid })
      setState((s) => ({ ...s, busy: false, had: true, msg: 'Thanks. Your review is live.' }))
    } catch (e) { setState((s) => ({ ...s, busy: false, msg: (e as Error).message })) }
  }
  return (
    <form className="ps-review" onSubmit={(e) => { e.preventDefault(); if (rating) void save() }}>
      <h2>{state.had ? 'Your review' : 'Rate this product'}</h2>
      {products.length > 1 && (
        <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Product to review">{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      )}
      {state.removed ? <p className="ps-fine">Your review for this product was removed by Desknoty for breaking the review rules.</p> : (
        <>
          <div className="ps-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)}>★</button>)}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="What did you think? (optional)" aria-label="Your review" />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name to show (optional)" aria-label="Name to show" />
          <button type="submit" className="sp-btn" disabled={!rating || state.busy}>{state.busy ? 'Saving…' : state.had ? 'Update review' : 'Post review'}</button>
          <p className="ps-fine">Shown as a verified buyer review. You can edit it any time from this page.</p>
        </>
      )}
      {state.msg && <p className="ps-fine" role="status">{state.msg}</p>}
    </form>
  )
}

/** Order page: send the download email again (same order, same link; the server rate-limits it). */
function ResendEmail({ handle, orderId }: { handle: string; orderId: string }) {
  const [state, setState] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null })
  const k = new URLSearchParams(window.location.search).get('k') ?? ''
  const go = async () => {
    setState({ busy: true, text: null })
    try {
      const r = await storeApi.resend(handle, orderId, k)
      setState({ busy: false, text: r.emailStatus === 'sent' ? `Email sent to ${r.to}.` : r.emailError ?? 'Not confirmed yet.' })
    } catch (e) {
      setState({ busy: false, text: (e as Error).message })
    }
  }
  return (
    <div className="ps-resend" aria-live="polite">
      <button type="button" className="sp-btn sp-btn-line" disabled={state.busy || !k} onClick={() => void go()}>{state.busy ? 'Sending…' : 'Resend download email'}</button>
      {state.text && <p className="ps-fine">{state.text}</p>}
    </div>
  )
}

/**
 * Saved products. Signed-in Desknoty users keep them in their account (private to them).
 * Guests keep them in this browser only: they vanish if site data is cleared, and don't sync.
 */
function useFavourites() {
  const KEY = 'desknoty.saved'
  const [ids, setIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } })
  const [mode, setMode] = useState<'account' | 'local'>('local')
  useEffect(() => {
    storeApi.favourites().then((r) => { setMode('account'); setIds(r.productIds) }).catch(() => setMode('local'))
  }, [])
  const toggle = async (id: string) => {
    const on = !ids.includes(id)
    const next = on ? [id, ...ids] : ids.filter((x) => x !== id)
    setIds(next)
    if (mode === 'account') {
      try { await storeApi.favourite(id, on) } catch { setIds(ids) }
    } else {
      try { localStorage.setItem(KEY, JSON.stringify(next.slice(0, 200))) } catch { /* storage blocked: saved for this visit only */ }
    }
  }
  return { ids, mode, toggle }
}

/** A free product the browser already asked for: claim id + address + cooldown end. No link, ever. */
type ClaimMemo = { claimId: string; email: string; until: number }
const CLAIM_EVENT = 'desknoty:claim'
function claimKey(productId: string) { return `desknoty.claim.${productId}` }
function readClaimMemo(productId: string): ClaimMemo | null {
  try { const j = JSON.parse(localStorage.getItem(claimKey(productId)) ?? 'null'); const claimId = typeof j?.claimId === 'string' ? j.claimId : ''; const email = typeof j?.email === 'string' ? j.email : ''; const until = typeof j?.until === 'number' ? j.until : 0; if (!claimId) return null; return { claimId, email, until } } catch { return null }
}
function writeClaimMemo(productId: string, m: ClaimMemo) { try { localStorage.setItem(claimKey(productId), JSON.stringify(m)) } catch { /* storage blocked: this visit only */ } }
function dropClaimMemo(productId: string) { try { localStorage.removeItem(claimKey(productId)) } catch { /* ignore */ } }

/**
 * Free products asked for in this browser, with the live resend cooldown. Backed by the server:
 * the claim status is re-checked on load, so closing the popup and refreshing brings the same
 * "Send again" state back. Nothing private (no download token, no link) is stored here.
 */
function useClaims(handle: string, products: ShopProduct[] | undefined, kind: string) {
  const [claims, setClaims] = useState<Record<string, { claimId: string; email: string; until: number; sendsLeftToday: number }>>({})
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (kind === 'thanks' || kind === 'order' || kind === 'claim' || !products) return
    let alive = true
    void Promise.all(products.filter((p) => !p.hidden).map(async (p) => {
      const memo = readClaimMemo(p.id)
      const ref = (() => { try { return localStorage.getItem(`desknoty.claimref.${p.id}`) ?? '' } catch { return '' } })()
      if (!memo || !ref) return null
      const r = await storeApi.claimStatus(handle, memo.claimId, ref).catch(() => null)
      if (!r) { dropClaimMemo(p.id); return null }
      const until = memo.until > Date.now() ? memo.until : Date.now() + Math.max(0, r.cooldownSeconds) * 1000
      const next = { claimId: memo.claimId, email: r.email || memo.email, until, sendsLeftToday: r.sendsLeftToday }
      writeClaimMemo(p.id, { claimId: next.claimId, email: next.email, until: next.until })
      return [p.id, next] as const
    })).then((list) => {
      const nextClaims: Record<string, { claimId: string; email: string; until: number; sendsLeftToday: number }> = {}
      for (const entry of list) {
        const [pid, v] = (entry ?? []) as readonly [string, { claimId: string; email: string; until: number; sendsLeftToday: number }]
        if (v) nextClaims[pid] = v
      }
      if (alive) setClaims(nextClaims)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, kind, products])
  useEffect(() => {
    const onClaim = (e: Event) => {
      const detail = (e as CustomEvent).detail as { productId?: string; claim?: { claimId?: string; email?: string; cooldownSeconds?: number } }
      if (!detail?.productId) return
      const claim = detail.claim
      if (claim?.claimId) {
        const until = Date.now() + Math.max(0, Math.ceil(claim.cooldownSeconds ?? 60)) * 1000
        writeClaimMemo(detail.productId, { claimId: claim.claimId, email: claim.email ?? '', until })
        setClaims((c) => ({ ...c, [detail.productId!]: { claimId: claim.claimId!, email: claim.email ?? '', until, sendsLeftToday: 0 } }))
      } else setClaims((c) => { const n = { ...c }; delete n[detail.productId!]; return n })
    }
    window.addEventListener(CLAIM_EVENT, onClaim)
    return () => window.removeEventListener(CLAIM_EVENT, onClaim)
  }, [])
  useEffect(() => { if (!Object.keys(claims).length) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t) }, [Object.keys(claims).length])
  const waitSeconds = (productId: string) => {
    const c = claims[productId]
    if (!c) return 0
    return Math.max(0, Math.ceil((c.until - Date.now()) / 1000))
  }
  return { claims, now, waitSeconds }
}


/** "Payment confirmed": shown briefly on the store after returning from the payment page, then closes itself. */
function PaidConfirm({ product, onDownload }: { product: ShopProduct; onDownload: () => void }) {
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    const u = new URL(window.location.href)
    u.searchParams.delete('paid')
    window.history.replaceState(null, '', u)
  }
  useEffect(() => {
    if (!open) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(close, reduce ? 8000 : 4500)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', k)
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', k) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null
  return (
    <div className="co-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="co3 co3-paid" role="dialog" aria-modal="true" aria-labelledby="paid-h">
        <div className="ps-tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
        <h2 id="paid-h">Payment confirmed — your download is ready.</h2>
        <p>{product.title}. We’ve also emailed you a receipt with a secure download link.</p>
        <button type="button" className="co3-pay-btn" onClick={onDownload}>Download</button>
        <button type="button" className="co3-done" autoFocus onClick={close}>Continue</button>
      </div>
    </div>
  )
}

/**
 * Free products: name + email, then a private link by email. Nothing here unlocks the file;
 * only opening the emailed link does. The same browser reuses its claim (no duplicate orders),
 * and a corrected address replaces the old link.
 */
function FreeClaim({ handle, product, coupon, onClose }: { handle: string; product: ShopProduct; coupon?: string; onClose: () => void }) {
  const refKey = `desknoty.claimref.${product.id}`
  const [ref] = useState(() => {
    try { const r = localStorage.getItem(refKey); if (r) return r; const n = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem(refKey, n); return n } catch { return crypto.randomUUID().replace(/-/g, '') }
  })
  const payer = useMemo(() => { try { return JSON.parse(localStorage.getItem('desknoty.payer') ?? 'null') ?? {} } catch { return {} } }, [])
  const [name, setName] = useState(() => String(payer?.name ?? ''))
  // A free product already asked about in this browser: keep the address it was sent to, so
  // reopening the form via "Send again" is just a resend, not a new claim.
  const [email, setEmail] = useState(() => String(readClaimMemo(product.id)?.email || payer?.email || ''))
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [sent, setSent] = useState<ClaimState | null>(() => { const m = readClaimMemo(product.id); return m ? { claimId: m.claimId, email: m.email, delivery: null, cooldownSeconds: 0, sendsLeftToday: 0 } : null })
  const [wait, setWait] = useState(() => { const m = readClaimMemo(product.id); return m ? Math.max(0, Math.ceil((m.until - Date.now()) / 1000)) : 0 })
  const [bounced, setBounced] = useState<string | null>(null)
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait((w) => w - 1), 1000); return () => window.clearTimeout(t) }, [wait])
  // after "sent", check for a bounce for a few minutes (the server learns of it from Resend)
  useEffect(() => {
    if (!sent) return
    let n = 0
    const t = window.setInterval(() => {
      n += 1
      if (n > 24) return window.clearInterval(t)
      storeApi.claimStatus(handle, sent.claimId, ref).then((r) => { if (r.delivery === 'bounced') { setBounced(r.message); window.clearInterval(t) } }).catch(() => {})
    }, 10000)
    return () => window.clearInterval(t)
  }, [sent, handle, ref])
  const submit = async (acceptSuggestion = false, override?: string) => {
    const addr = (override ?? email).trim()
    setBusy(true); setError(null); setBounced(null)
    try {
      const r = await storeApi.claimFree(handle, { productId: product.id, email: addr, name: name.trim(), clientRef: ref, acceptSuggestion, coupon, website })
      try { localStorage.setItem('desknoty.payer', JSON.stringify({ ...(JSON.parse(localStorage.getItem('desknoty.payer') ?? '{}') ?? {}), email: addr, name: name.trim() })) } catch { /* storage blocked */ }
      setSuggestion(null)
      setSent(r)
      const cooldown = r.cooldownSeconds || 60
      setWait(cooldown)
      // remember the claim on this device so the store can show "Send again" again after a
      // close/refresh; the sent address and cooldown are re-derived from the server when it re-checks.
      writeClaimMemo(product.id, { claimId: r.claimId, email: addr, until: Date.now() + cooldown * 1000 })
      window.dispatchEvent(new CustomEvent(CLAIM_EVENT, { detail: { productId: product.id, claim: { claimId: r.claimId, email: addr, cooldownSeconds: cooldown } } }))
      if (r.status === 'queued') setError('We’re still sending your link. If it hasn’t arrived in a few minutes, use Send again.')
    } catch (e) {
      const err = e as Error & { body?: { code?: string; suggestion?: string; cooldownSeconds?: number } }
      const body = (err as unknown as { data?: { code?: string; suggestion?: string; cooldownSeconds?: number } }).data ?? err.body
      if (body?.code === 'suggest' && body.suggestion) { setSuggestion(body.suggestion); setBusy(false); return }
      if (typeof body?.cooldownSeconds === 'number') setWait(body.cooldownSeconds)
      setError(err.message)
    }
    setBusy(false)
  }
  const validLook = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  return (
    <div className="co3-claim">
      <section className="co3-pay" aria-label="Your details">
        <h2>Get it free</h2>
        <p className="co3-claim-lead">We’ll email you a private link to <b>{product.title}</b>. Open it to download.</p>
        {coupon && <p className="co3-code-on" role="status"><span>Code <b>{coupon}</b> applied: this one’s free</span></p>}
        <label className="co3-field"><span>Name</span><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Jane Smith" /></label>
        <label className="co3-field"><span>Email</span>
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setSuggestion(null); setError(null) }} maxLength={254} placeholder="jane@example.com" aria-label="Email" aria-invalid={Boolean(error && !sent)} aria-describedby={error ? 'claim-err' : undefined} />
        </label>
        {/* left empty by people; filled by bots */}
        <label className="co3-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        {suggestion && (
          <div className="co3-suggest" role="alert">
            <span>Did you mean <b>{suggestion}</b>?</span>
            <div>
              <button type="button" onClick={() => { setEmail(suggestion); void submit(false, suggestion) }}>Yes, use it</button>
              <button type="button" onClick={() => void submit(true)}>No, keep {email.trim()}</button>
            </div>
          </div>
        )}
        {error && <p id="claim-err" className="co3-code-err" role="alert">{error}</p>}
        {bounced && <p className="co3-code-err" role="alert">{bounced}</p>}
        {sent && !error && !bounced && <p className="co3-claim-sent" role="status">Check your inbox for your download link.</p>}
        <button type="button" className="co3-pay-btn" disabled={busy || !validLook || wait > 0} onClick={() => void submit()}>
          {busy ? 'Sending…' : sent ? (wait > 0 ? `Send again (${wait}s)` : 'Send again') : (error ? 'Try again' : 'Send me the product')}
        </button>
        {sent && <p className="co3-hint-line">Sent to {sent.email}. Wrong address? Change it above and press Send again; the old link stops working.</p>}
        <button type="button" className="co3-done" onClick={onClose}>Close</button>
      </section>
    </div>
  )
}

/** The emailed link: proves the address, then shows the download. */
function ClaimOpen({ handle, claimId, token }: { handle: string; claimId: string; token: string }) {
  const [state, setState] = useState<{ error?: string; orderUrl?: string } | null>(null)
  useEffect(() => {
    storeApi.openClaim(handle, claimId, token)
      .then((r) => { window.location.replace(r.orderUrl.replace(/^\/store\/[^/]+\//, `/store/${handle}/`)); setState({ orderUrl: r.orderUrl }) })
      .catch((e: Error) => setState({ error: e.message }))
  }, [handle, claimId, token])
  if (!state) return <Message title="Opening your download…" text="" />
  if (state.error) return <Message title="We couldn’t open this link" text={state.error} />
  return <Message title="Opening your download…" text="" />
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
function PayChooser({ product, methods, banks, busy, error, seller, onPay, onClose, handle }: { product: ShopProduct; methods: PayMethod[]; banks: NonNullable<Store['banks']>; busy: boolean; error: string | null; seller: string; handle: string; onPay: (m: PayMethod, email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }, coupon?: string) => void; onClose: () => void }) {
  // The server's quote is the price: list price, live offer, then the code. The card's price is only a first guess.
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [noQuotes, setNoQuotes] = useState(false)
  const loadQuote = async (c?: string) => {
    setChecking(true)
    try {
      const r = await storeApi.quote(handle, product.id, c)
      if (c && r.quote.couponError) { setCodeErr(r.quote.couponError); setChecking(false); return }
      setQuote(r.quote)
      setApplied(c ? r.quote.coupon?.code ?? null : null)
      setCodeErr(null)
    } catch (e) {
      // an API without quotes (not updated yet): keep the card's price and don't offer codes
      if (!c) setNoQuotes(true)
      else setCodeErr((e as Error).message)
    }
    setChecking(false)
  }
  useEffect(() => { void loadQuote() }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalMinor = quote ? quote.totalMinor : (product.offer?.priceMinor ?? product.priceMinor)
  const free = totalMinor === 0
  const choices: Choice[] = free ? ['card'] : [
    ...(methods.includes('bank') ? (['bank'] as Choice[]) : []),
    ...(methods.includes('stripe') ? (['card'] as Choice[]) : []),
    ...(methods.includes('paypal') ? (['paypal'] as Choice[]) : []),
  ]
  const [choice, setChoice] = useState<Choice>(choices[0] ?? 'card')
  const [email, setEmail] = useState('')
  // the buyer's own bank and name (never their account number); remembered on this device if they choose
  const [payerBank, setPayerBank] = useState('')
  const [payerName, setPayerName] = useState('')
  // Card, Apple Pay (Apple devices that support it) and Google Pay; Stripe shows them on its secure page
  const wallets: Wallet[] = ['card', ...(typeof window !== 'undefined' && 'ApplePaySession' in window ? (['apple'] as Wallet[]) : []), 'google']
  const [wallet, setWallet] = useState<Wallet>('card')
  const [payTo, setPayTo] = useState<number>(() => (banks.find((b) => b.inUse) ?? banks[0])?.index ?? -1)
  const [remember, setRemember] = useState(true)
  useEffect(() => {
    // details this buyer chose to remember on this device
    try { const j = JSON.parse(localStorage.getItem('desknoty.payer') ?? 'null'); if (j) { setEmail(j.email ?? ''); setPayerBank(j.payerBank ?? ''); setPayerName(j.payerName ?? '') } } catch { /* none */ }
  }, [])
  const method = CHOICE_METHOD[choice]
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  // a free order (also when a code makes it free) has no payment method: just the email for the download
  const isBank = method === 'bank' && !free
  const noBank = isBank && banks.length === 0
  const needsEmail = Boolean(quote?.needsEmail)
  // free (also when a code makes it free) and per-customer codes need an email; bank transfer needs the payer's details
  const ready = free ? valid : isBank ? valid && !noBank && payTo >= 0 && payerBank !== '' && payerName.trim().length >= 2 : needsEmail ? valid : valid || !email.trim()
  const canPay = !busy && ready
  const price = formatPrice(totalMinor, product.currency)
  const money = (m: number) => formatPrice(m, product.currency)
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
      if (remember) localStorage.setItem('desknoty.payer', JSON.stringify({ email: email.trim(), ...(isBank ? { payerBank, payerName: payerName.trim() } : (() => { try { const o = JSON.parse(localStorage.getItem('desknoty.payer') ?? 'null'); return o ? { payerBank: o.payerBank, payerName: o.payerName } : {} } catch { return {} } })()) }))
      else localStorage.removeItem('desknoty.payer')
    } catch { /* storage blocked */ }
    onPay(method, email.trim() || undefined, isBank && !free ? { bankIndex: payTo, payerBank, payerName: payerName.trim() } : undefined, applied ?? undefined)
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

        {free ? (
          <FreeClaim handle={handle} product={product} coupon={applied ?? undefined} onClose={onClose} />
        ) : (
        <div className="co3-grid">
          <section className="co3-pay" aria-label="Payment details">
            <h2>Payment Details</h2>
            {choices.length > 1 && !free && (
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
                <label className="co3-field">
                  <span>Your bank (you’ll pay from its app)</span>
                  <div className="co3-selectwrap">
                    <select value={payerBank} onChange={(e) => setPayerBank(e.target.value)} required aria-label="Your bank">
                      <option value="" disabled>Choose your bank</option>
                      {[...BANK_ICONS.map((b) => b.name), 'Lloyds', 'NatWest', 'Santander', 'Nationwide', 'Halifax', 'Other bank'].filter((v, i, a) => a.indexOf(v) === i).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {payerBank && payerBank !== 'Other bank' && <BankIcon name={payerBank} />}
                  </div>
                </label>
                <label className="co3-field"><span>Name on your bank account</span><input autoComplete="name" placeholder="Jane Smith" value={payerName} onChange={(e) => setPayerName(e.target.value)} required maxLength={80} aria-label="Name on your bank account" /></label>
                <label className="co3-field"><span>Email for your download</span><input type="email" autoComplete="email" inputMode="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" /></label>
                
              </>
            ) : (
              <>
                <label className="co3-field"><span>{free ? 'Your email (we send the download here)' : 'Email for your receipt'}</span><input type="email" autoComplete="email" inputMode="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required={free} aria-label="Email" /></label>
                {free ? (
                  <p className="co3-hint">This product is free. Enter your email and we’ll send you the download link.</p>
                ) : method === 'paypal' ? (
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
                <div className="co3-meta"><span>Format: {product.format || product.fileType || 'Digital download'}</span><span>Quantity: 1</span></div>
              </div>
            </div>
            {!noQuotes && (quote?.listMinor ?? product.priceMinor) > 0 && (
              <div className="co3-code">
                {applied ? (
                  <div className="co3-code-on" role="status">
                    <span>Code <b>{applied}</b> applied</span>
                    <button type="button" onClick={() => { setCode(''); void loadQuote() }}>Remove</button>
                  </div>
                ) : (
                  <>
                    <label htmlFor="co3-code-in">Discount code</label>
                    <div className="co3-code-row">
                      <input id="co3-code-in" value={code} onChange={(e) => { setCode(e.target.value); setCodeErr(null) }} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Enter code" aria-invalid={Boolean(codeErr)} aria-describedby={codeErr ? 'co3-code-err' : undefined} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (code.trim()) void loadQuote(code.trim()) } }} />
                      <button type="button" disabled={!code.trim() || checking} onClick={() => void loadQuote(code.trim())}>{checking ? 'Checking…' : 'Apply'}</button>
                    </div>
                    {codeErr && <p id="co3-code-err" className="co3-code-err" role="alert">{codeErr}</p>}
                  </>
                )}
              </div>
            )}
            <dl className="co3-lines">
              <dt>Subtotal</dt><dd>{money(quote?.listMinor ?? product.priceMinor)}</dd>
              {quote?.offer && <><dt>Offer</dt><dd className="co3-minus">−{money(quote.offer.savedMinor)}</dd></>}
              {quote?.coupon && <><dt>Code {quote.coupon.code}</dt><dd className="co3-minus">−{money(quote.coupon.discountMinor)}</dd></>}
              <dt>Delivery</dt><dd>FREE</dd>
            </dl>
            <div className="co3-total"><span>Total</span><b>{price}</b></div>
            {quote && quote.savedMinor > 0 && <p className="co3-saved">You save {money(quote.savedMinor)}</p>}
            {needsEmail && !free && <p className="co3-hint-line">This code is once per customer, so we need your email.</p>}
            {error && <p className="co-err" role="alert">{error}</p>}
            <button type="submit" className="co3-pay-btn" disabled={!canPay}>{busy ? (free ? 'Sending…' : 'Opening…') : free ? 'Send digital product' : 'Pay Now'}</button>
            <p className="co3-terms">By continuing, you agree to pay {seller} {price} for this digital download.</p>
          </section>
        </div>
        )}
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

function OrderStatus({ handle, load, claim, backToStore }: { handle: string; load: () => Promise<{ order: PublicOrder }>; claim?: () => Promise<{ order: PublicOrder }>; backToStore?: boolean }) {
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
    // paid purchases unlock Download on the store in this browser; free products stay email-only
    if (order.status === 'paid' && order.retrievalUrl && (order.method as string) !== 'free') rememberOwned(handle, order.productId, order.retrievalUrl)
    // back from Stripe or PayPal with a confirmed payment: return to the store, which shows the confirmation
    if (backToStore && order.status === 'paid' && (order.method as string) !== 'free' && order.storeHandle) { window.location.replace(`/${order.storeHandle}?paid=${encodeURIComponent(order.id)}`); return }
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
        <p className="ps-kicker">{(order.method as string) === 'free' ? 'Download ready' : 'Payment confirmed'}</p>
        <h1>{(order.method as string) === 'free' ? 'Your download is ready' : 'Thanks for your order'}</h1>
        <p>
          {order.product}
          {order.amountMinor > 0 && <> · {formatPrice(order.amountMinor, order.currency)}</>}
          {order.receiptSent && order.email ? ` · receipt accepted for sending to ${order.email} (delivery unconfirmed)` : ''}
        </p>
        {order.downloadUrl && (
          <a className="sp-btn ps-download" href={order.downloadUrl} download>
            Download {order.fileName}
          </a>
        )}
        {order.items && order.items.length > 0 && (
          <ul className="ps-items" aria-label="Products in this bundle">
            {order.items.map((i) => <li key={i.productId}><span>{i.title}</span><a className="sp-btn sp-btn-sm" href={i.downloadUrl} download>Download</a></li>)}
          </ul>
        )}
        <p className="ps-fine">
          {order.downloadExpiresAt
            ? `This download link works until ${new Date(order.downloadExpiresAt).toLocaleString()}.`
            : 'This download link works for 24 hours.'}
          {' Save your permanent purchase link below to get a new download link later.'}
        </p>
        {order.retrievalUrl && <a href={order.retrievalUrl}>Permanent purchase link</a>}
        {(order.method as string) !== 'free' && <p className="ps-fine">Receipt email: {order.receiptStatus === 'accepted' ? 'accepted by our email provider' : order.receiptStatus.replaceAll('_', ' ')}.</p>}
        {order.email && <ResendEmail handle={handle} orderId={order.id} />}
        <ReviewForm handle={handle} orderId={order.id} products={order.items && order.items.length ? order.items.map((i) => ({ id: i.productId, title: i.title })) : [{ id: order.productId ?? '', title: order.product }]} />
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
