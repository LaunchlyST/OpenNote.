import { useEffect, useState, useRef } from 'react'
import { BuyRow, StorePage, storeStyle } from '../projects/seller/StorePage'
import { ProductSheet } from '../projects/seller/ProductCard'
import { Style2Page } from '../projects/seller/Style2'
import { formatPrice, mediaUrl } from '../projects/seller/model'
import { storeApi } from '../projects/seller/api'
import { BANK_ICONS, bankIcon } from '../projects/seller/bank-icons'
import type { EmailStatus, PriceQuote, PublicOrder, PublicStore as Store } from '../projects/seller/api'
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
  // Free order result: the email status as the provider reported it, plus the order for an immediate download.
  const [freeDone, setFreeDone] = useState<FreeDone | null>(null)
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
      // Free: the order is complete. Show the download right away and the email's real status.
      if (r.emailStatus && r.order && r.orderUrl) {
        sessionStorage.removeItem(keyName)
        rememberOwned(handle, p.id, r.orderUrl)
        setOwned((o) => ({ ...o, [p.id]: r.orderUrl! }))
        setFreeDone({ email: r.email ?? email ?? '', status: r.emailStatus, error: r.emailError ?? null, order: r.order, orderUrl: r.orderUrl })
        setBuying(null)
        checkoutBusy.current = false
        return
      }
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
  const base = { page: store.page, products: store.products, handle: store.handle, live: true, checkoutReady: store.checkoutReady, onBuy: buy, buying, owned, onDownload: (p: ShopProduct) => void download(p), downloading, onOpenProduct: openProduct }
  const sheetProduct = sheet ? store.products.find((p) => p.id === sheet) : undefined
  const sheetView = sheetProduct && (
    <ProductSheet
      p={sheetProduct}
      onClose={closeSheet}
      buy={<BuyRow prod={sheetProduct} {...base} />}
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
      freeDone={freeDone}
      onClose={() => (setChoosing(null), setFreeDone(null))}
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

type FreeDone = { email: string; status: EmailStatus; error: string | null; order: PublicOrder; orderUrl: string }

/**
 * After a free order: the download is right here, and the email's status is what the provider said.
 * "Email sent" only appears once the provider accepted it.
 */
function FreeResult({ handle, product, done, onClose }: { handle: string; product: ShopProduct; done: FreeDone; onClose: () => void }) {
  const [status, setStatus] = useState<EmailStatus>(done.status)
  const [note, setNote] = useState<string | null>(done.error)
  const [sending, setSending] = useState(false)
  const k = new URL(done.orderUrl, window.location.origin).searchParams.get('k') ?? ''
  const resend = async () => {
    setSending(true)
    try {
      const r = await storeApi.resend(handle, done.order.id, k)
      setStatus(r.emailStatus)
      setNote(r.emailStatus === 'sent' ? null : r.emailError ?? null)
    } catch (e) {
      setNote((e as Error).message)
    }
    setSending(false)
  }
  return (
    <div className="co3-sent" role="status" aria-live="polite">
      <div className="ps-tick" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
      <h2>{status === 'sent' ? 'Email sent' : 'Your download is ready'}</h2>
      {status === 'sent' ? (
        <p>We sent the download link for <b>{product.title}</b> to <b>{done.email}</b>. Check your spam folder if you can’t see it.</p>
      ) : (
        <p className="co3-mailnote">{note ?? 'We couldn’t confirm the email was sent.'}</p>
      )}
      {done.order.downloadUrl && (
        <button type="button" className="co3-pay-btn" onClick={() => startDownload(done.order.downloadUrl!, done.order.fileName)}>Download</button>
      )}
      <button type="button" className="co3-resend" disabled={sending} onClick={() => void resend()}>{sending ? 'Sending…' : status === 'sent' ? 'Resend download email' : 'Try sending the email again'}</button>
      {status === 'sent' && note && <p className="co3-mailnote">{note}</p>}
      <button type="button" className="co3-done" onClick={onClose}>Done</button>
    </div>
  )
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
function PayChooser({ product, methods, banks, busy, error, seller, onPay, onClose, freeDone, handle }: { freeDone?: FreeDone | null; product: ShopProduct; methods: PayMethod[]; banks: NonNullable<Store['banks']>; busy: boolean; error: string | null; seller: string; handle: string; onPay: (m: PayMethod, email?: string, payer?: { payerName?: string; payerBank?: string; bankIndex?: number }, coupon?: string) => void; onClose: () => void }) {
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

        {freeDone ? (
          <FreeResult handle={handle} product={product} done={freeDone} onClose={onClose} />
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
        <p className="ps-fine">Receipt email: {order.receiptStatus === 'accepted' ? 'accepted by our email provider' : order.receiptStatus.replaceAll('_', ' ')}.</p>
        {order.email && <ResendEmail handle={handle} orderId={order.id} />}
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
