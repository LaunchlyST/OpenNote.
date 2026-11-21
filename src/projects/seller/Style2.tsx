import { useEffect, useRef, useState } from 'react'
import { accentOf } from './StorePage'
import type { StorePageProps } from './StorePage'
import { affiliateHref, ensureFont, formatPrice, isFreeProduct, mediaUrl } from './model'
import type { ShopProduct } from './model'
import './style2.css'

/**
 * STYLE 2 — editorial digital-product store.
 * Real store data only: products, prices, live offers (computed by the server, so
 * expired ones never arrive), ratings, formats. Buy always goes through onBuy
 * (the real checkout); affiliate products link out; product links stay
 * /<handle>/p/<productId>. Entrance motion is CSS keyed to mount, so it plays
 * on every page load / visit and is off with reduced motion.
 */
export function Style2Page(props: StorePageProps) {
  const { page, products, handle, only } = props
  useEffect(() => { ensureFont(page.theme.font) }, [page.theme.font])
  const list = only ? [only] : products.filter((p) => !p.hidden)
  const name = (page.name || handle).trim()
  const accent = accentOf(page)
  const style = { ['--ac' as string]: accent }
  const anyFree = list.some((p) => isFreeProduct(p) && !affiliateHref(p))

  return (
    <div className="dk" style={style}>
      <Header name={name} handle={handle} live={props.live} count={list.length} />
      {only ? <ProductPage p={only} {...props} /> : (
        <>
          <Hero name={name} bio={page.bio} handle={handle} list={list} anyFree={anyFree} />
          <section id="dk-shop" className="dk-shop" aria-label="All products">
            <div className="dk-shop-head">
              <h2>The collection</h2>
              <span>{list.length} {list.length === 1 ? 'product' : 'products'} · instant download</span>
            </div>
            <div className="dk-grid">
              {list.map((p, i) => <Card key={p.id} p={p} i={i} {...props} />)}
            </div>
          </section>
          <NextDrop />
        </>
      )}
      <footer className="dk-foot">
        <div className="dk-foot-in">
          <span className="dk-mark" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          <div><b>{name}</b><small>Digital products, delivered instantly.</small></div>
          <a href="https://desknoty.com" target="_blank" rel="noopener">Powered by Desknoty</a>
        </div>
      </footer>
    </div>
  )
}

function Header({ name, handle, live, count }: { name: string; handle: string; live?: boolean; count: number }) {
  return (
    <header className="dk-head">
      <a className="dk-brand" href={live ? `/${handle}` : undefined}>
        <span className="dk-mark" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span>{name}</span>
      </a>
      <nav className="dk-nav" aria-label="Store">
        <a href={live ? `/${handle}#dk-shop` : '#dk-shop'}>Shop</a>
        <a className="dk-bag" href={live ? `/${handle}#dk-shop` : '#dk-shop'}>{count} {count === 1 ? 'item' : 'items'}</a>
      </nav>
    </header>
  )
}

function Hero({ name, bio, handle, list, anyFree }: { name: string; bio?: string; handle: string; list: ShopProduct[]; anyFree: boolean }) {
  const covers = list.filter((p) => mediaUrl(p.cover)).slice(0, 3)
  const deals = list.filter((p) => p.offer).length
  const rated = list.find((p) => p.rating && p.rating.count > 0)
  return (
    <section className="dk-hero" aria-label={name}>
      <div className="dk-hero-copy">
        <span className="dk-kicker">Digital store · @{handle}</span>
        <h1><span>{name}</span></h1>
        <p>{bio?.trim() || `Templates, guides and downloads by ${name}. Buy once, download instantly.`}</p>
        <div className="dk-ctas">
          <a className="dk-btn dk-btn-ink" href="#dk-shop">Shop the collection</a>
          {anyFree && <a className="dk-btn dk-btn-line" href="#dk-shop">Free downloads</a>}
        </div>
        <dl className="dk-stats">
          <div><dt>Products</dt><dd>{list.length}</dd></div>
          {deals > 0 && <div><dt>On sale now</dt><dd>{deals}</dd></div>}
          {rated && <div><dt>Verified rating</dt><dd>★ {rated.rating!.average.toFixed(1)}</dd></div>}
          <div><dt>Delivery</dt><dd>Instant</dd></div>
        </dl>
      </div>
      <div className={`dk-stage n${covers.length}`} aria-hidden="true">
        {covers.map((p, i) => (
          <figure key={p.id} className={`dk-fan f${i}`}>
            <img src={mediaUrl(p.cover)!} alt="" draggable={false} />
            <figcaption>{p.offer ? formatPrice(p.offer.priceMinor, p.currency) : isFreeProduct(p) ? 'Free' : formatPrice(p.priceMinor, p.currency)}</figcaption>
          </figure>
        ))}
        {!covers.length && <div className="dk-fan f0 dk-fan-type">{name}</div>}
      </div>
    </section>
  )
}

/** Discount badge: pops in on every page load (CSS mount animation), static with reduced motion. */
function Off({ p }: { p: ShopProduct }) {
  if (!p.offer || !(p.offer.priceMinor < p.priceMinor)) return null
  const pct = p.offer.percent || Math.round((1 - p.offer.priceMinor / p.priceMinor) * 100)
  return <em className="dk-off" style={p.offer.badgeColor ? { ['--off' as string]: p.offer.badgeColor } : undefined}>{pct > 0 ? `${pct}% OFF` : p.offer.badge || 'SALE'}</em>
}

function Price({ p, big }: { p: ShopProduct; big?: boolean }) {
  if (affiliateHref(p)) return null
  if (isFreeProduct(p)) return <span className={big ? 'dk-price big' : 'dk-price'}><b>Free</b></span>
  if (p.offer && p.offer.priceMinor < p.priceMinor) {
    return <span className={big ? 'dk-price big sale' : 'dk-price sale'}><b>{formatPrice(p.offer.priceMinor, p.currency)}</b><s>{formatPrice(p.priceMinor, p.currency)}</s></span>
  }
  return <span className={big ? 'dk-price big' : 'dk-price'}><b>{formatPrice(p.priceMinor, p.currency)}</b></span>
}

/** The store's existing purchase paths: paid, free claim, owned download, affiliate link. */
function Action({ p, big, ...props }: { p: ShopProduct; big?: boolean } & StorePageProps) {
  const cls = big ? 'dk-btn dk-btn-ink dk-buy big' : 'dk-btn dk-btn-ink dk-buy'
  const free = isFreeProduct(p)
  const external = affiliateHref(p)
  if (external) {
    return (
      <>
        <a className={cls} href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>{p.cta?.text && !/amazon/i.test(p.cta.text) ? p.cta.text : 'View product'} ↗</a>
        <small className="dk-aff" title={p.affiliate?.disclosure || 'As an Amazon Associate, I earn from qualifying purchases.'}>Paid link</small>
      </>
    )
  }
  if (props.live && props.owned?.[p.id] && p.priceMinor > 0) {
    return props.onDownload
      ? <button type="button" className={cls} onClick={() => props.onDownload!(p)} disabled={props.downloading === p.id}>{props.downloading === p.id ? 'Starting…' : 'Download'}</button>
      : <a className={cls} href={props.owned[p.id]}>Download</a>
  }
  const disabled = free ? !props.live || props.buying === p.id : !props.live || !props.checkoutReady || props.buying === p.id
  const label = props.buying === p.id ? 'Opening checkout…' : free ? (props.claims?.[p.id] ? 'Send again' : 'Get it free') : (p.cta?.text && !/^\s*$/.test(p.cta.text) ? p.cta.text : 'Buy now')
  return <button type="button" className={cls} disabled={disabled} onClick={() => (free && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))}>{label}</button>
}

function Card({ p, i, ...props }: { p: ShopProduct; i: number } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  const type = p.format || p.fileType
  return (
    <article className="dk-card" style={{ ['--i' as string]: i }}>
      <div className="dk-media">
        <a href={link} tabIndex={-1} aria-hidden="true" className="dk-media-a">
          {src ? <img src={src} alt="" loading={i < 3 ? 'eager' : 'lazy'} draggable={false} /> : <span className="dk-ph">{p.title}</span>}
        </a>
        <Off p={p} />
        {type && <span className="dk-chip">{type}</span>}
        {props.onToggleSave && (
          <button type="button" className={props.savedIds?.includes(p.id) ? 'dk-fav on' : 'dk-fav'} aria-pressed={Boolean(props.savedIds?.includes(p.id))} aria-label={`Save ${p.title}`} onClick={() => props.onToggleSave!(p)}>♥</button>
        )}
      </div>
      <div className="dk-info">
        <div className="dk-row">
          <h3>{link ? <a href={link}>{p.title}</a> : p.title}</h3>
          <Price p={p} />
        </div>
        {p.description && <p>{p.description.split('\n')[0]}</p>}
        {p.rating && p.rating.count > 0 && <span className="dk-rate">★ {p.rating.average.toFixed(1)} <i>· {p.rating.count} verified</i></span>}
        <div className="dk-cta"><Action p={p} {...props} /></div>
      </div>
      {!props.live && (props.onEditProduct || props.onHideProduct) && (
        <div className="dk-admin">
          {props.onEditProduct && <button type="button" onClick={() => props.onEditProduct!(p.id)}>Edit / replace</button>}
          {props.onHideProduct && <button type="button" onClick={() => props.onHideProduct!(p.id)}>Remove</button>}
        </div>
      )}
    </article>
  )
}

/** Product detail: gallery left, buying column right (stacked on phones). */
function ProductPage({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const shots = [p.cover, ...(p.gallery ?? [])].map((m) => mediaUrl(m)).filter((u): u is string => Boolean(u))
  const [at, setAt] = useState(0)
  const type = p.format || p.fileType
  const gets = [
    ...(p.included ?? []),
    type ? `${type} file` : 'Digital file',
    affiliateHref(p) ? 'Sold and delivered by the partner store' : 'Instant download after checkout, plus a copy by email',
  ]
  return (
    <section className="dk-pdp">
      <div className="dk-gal">
        <div className="dk-gal-main">
          {shots.length ? shots.map((u, i) => <img key={u} src={u} alt={i === 0 ? p.title : ''} className={i === at ? 'on' : ''} />) : <span className="dk-ph">{p.title}</span>}
          <Off p={p} />
        </div>
        {shots.length > 1 && (
          <div className="dk-thumbs">{shots.map((u, i) => <button key={u} type="button" className={i === at ? 'on' : ''} style={{ backgroundImage: `url(${u})` }} onClick={() => setAt(i)} aria-label={`Image ${i + 1}`} />)}</div>
        )}
      </div>
      <div className="dk-buybox">
        {props.live && <a className="dk-back" href={`/${props.handle}`}>← All products</a>}
        {type && <span className="dk-kicker">{type} · digital download</span>}
        <h1>{p.title}</h1>
        {p.rating && p.rating.count > 0 && <span className="dk-rate">★ {p.rating.average.toFixed(1)} <i>· {p.rating.count} verified {p.rating.count === 1 ? 'review' : 'reviews'}</i></span>}
        <div className="dk-pdp-price"><Price p={p} big /><Off p={p} /></div>
        {p.offer && p.offer.priceMinor < p.priceMinor && <span className="dk-save">You save {formatPrice(p.priceMinor - p.offer.priceMinor, p.currency)}</span>}
        <div className="dk-pdp-cta"><Action p={p} big {...props} /></div>
        {!affiliateHref(p) && <p className="dk-secure">Secure checkout · Instant delivery</p>}
        <div className="dk-gets">
          <h2>What you get</h2>
          <ul>{gets.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
        {p.description && <div className="dk-desc">{p.description.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>}
      </div>
    </section>
  )
}

/** Upcoming product: the existing Coming Soon artwork as a campaign panel, revealed on scroll. */
function NextDrop() {
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <section ref={ref} className={seen ? 'dk-next in' : 'dk-next'} aria-label="Coming soon">
      <div className="dk-next-copy">
        <span className="dk-kicker">Next drop</span>
        <h2>Something new is on the way.</h2>
        <p>A new product is being made right now. Keep this page — it lands here first.</p>
        <a className="dk-btn dk-btn-line" href="#dk-shop">Shop what’s live</a>
      </div>
      <div className="dk-next-art"><img src="/coming-soon.webp" alt="Coming soon — our next product." loading="lazy" /></div>
    </section>
  )
}
