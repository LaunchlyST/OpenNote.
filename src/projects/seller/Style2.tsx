import { useEffect, useRef, useState } from 'react'
import { ComingSoon, PriceTag } from './StorePage'
import { Daisy, Flower, Sticky } from '../../landing/AeroPage'
import type { StorePageProps } from './StorePage'
import { affiliateHref, ensureFont, isFreeProduct, mediaUrl } from './model'
import type { ShopProduct } from './model'
import { Style2Carousel } from './Style2Carousel'
import './style2.css'

/**
 * STYLE 2 — the premium digital-product shop.
 *
 * Shows in Seller Studio's phone (Style 2) and on the live store once the
 * seller publishes Style 2. Same data and purchase handlers as Style 1:
 * Buy now always calls onBuy (the real checkout), affiliate products link to
 * Amazon, product links stay /<handle>/p/<productId>.
 *
 * Layout: a dark opening hero over the seller's banner (the featured product,
 * fully usable from the first frame) → a warm ivory catalogue grid → the
 * Coming Soon teaser.
 */
export function Style2Page(props: StorePageProps) {
  const { page, products, handle, only } = props
  useEffect(() => { ensureFont(page.theme.font) }, [page.theme.font])
  const list = only ? [only] : products.filter((p) => !p.hidden)
  const name = (page.name || handle).trim()
  const [glyphs] = useState(makeGlyphs)
  return (
    <div className="s2k">
      <pre className="s2k-glyphs" aria-hidden="true">{glyphs}</pre>
      <header className="s2k-top">
        <a className="s2k-brand" href={props.live ? `/${handle}` : undefined}>
          <span className="s2k-ava" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          {name}
        </a>
        <span className="s2k-status"><i />Open · {list.length} {list.length === 1 ? 'product' : 'products'}</span>
      </header>

      {!only && (
        <section className="s2k-hero">
          <span className="s2k-st s2k-daisy" aria-hidden="true"><Daisy /></span>
          <span className="s2k-st s2k-f1" aria-hidden="true"><Flower c="#e36b62" /></span>
          <span className="s2k-st s2k-f2" aria-hidden="true"><Flower c="#7aa35a" m="#f2c94c" /></span>
          <span className="s2k-st s2k-sticky" aria-hidden="true"><Sticky /></span>
          <h1>Good things<br />from <em>{name}</em><span className="s2k-dot" aria-hidden="true" /></h1>
          <p className="s2k-hand">{page.bio?.trim() || 'made with care, ready to download'}</p>
        </section>
      )}

      {!only && list.length > 0 && <Rail list={list} {...props} />}

      {only
        ? <section id="s2-shop" className="s2k-shop" aria-label="Products">{list.map((p, i) => <Card key={p.id} p={p} n={i} {...props} />)}</section>
        : <div id="s2-shop"><Style2Carousel list={list} props={props} Buy={Buy} /></div>}
      {!only && <div className="s2k-next"><span className="s2k-hand s2k-next-note">psst… next one’s on the way</span><Teaser /></div>}
      {!only && (
        <section className="s2k-promo" aria-label="Stay in the loop">
          <div className="s2k-promo-in">
            <span className="s2k-promo-kicker">New drops, every month</span>
            <h2>Good things take<br />a little time.</h2>
            <a className="s2k-promo-btn" href="#s2-shop">Shop {list.length} {list.length === 1 ? 'product' : 'products'} →</a>
          </div>
        </section>
      )}

      <footer className="s2k-foot">
        <span>© {new Date().getFullYear()} {name}</span>
        <span className="s2k-word" aria-hidden="true">{name}</span>
        <a href="https://desknoty.com" target="_blank" rel="noopener">Made with Desknoty</a>
      </footer>
    </div>
  )
}

/** Virtual-store rail: products hang on a rail; pick one to bring it forward. Pill tabs filter. */
function Rail({ list, ...props }: { list: ShopProduct[] } & StorePageProps) {
  const [tab, setTab] = useState<'all' | 'paid' | 'free'>('all')
  const shown = list.filter((p) => tab === 'all' || (tab === 'free' ? isFreeProduct(p) : !isFreeProduct(p)))
  const [at, setAt] = useState(0)
  const cur = shown[Math.min(at, shown.length - 1)]
  const hasFree = list.some(isFreeProduct), hasPaid = list.some((p) => !isFreeProduct(p))
  return (
    <section className="s2k-rail" aria-label="Pick a product">
      <div className="s2k-bar" aria-hidden="true" />
      <div className="s2k-hang" role="listbox" aria-label="Products">
        {shown.map((p, i) => {
          const src = mediaUrl(p.cover)
          return (
            <button key={p.id} type="button" role="option" aria-selected={p === cur} className={p === cur ? 'on' : ''} onClick={() => setAt(i)} onMouseEnter={() => setAt(i)} style={{ ['--d' as string]: `${(i % 5) * 0.4}s` }}>
              <i className="s2k-hook" aria-hidden="true" />
              <span className="s2k-tag">{src ? <img src={src} alt="" draggable={false} /> : <b>{p.title.charAt(0).toUpperCase()}</b>}</span>
              <span className="s2k-sr">{p.title}</span>
            </button>
          )
        })}
      </div>
      {cur && (
        <div className="s2k-pick" key={cur.id}>
          <h2>{props.live ? <a href={`/${props.handle}/p/${cur.id}`}>{cur.title}</a> : cur.title}</h2>
          <Buy p={cur} {...props} />
        </div>
      )}
      {hasFree && hasPaid && (
        <div className="s2k-pills" role="tablist" aria-label="Filter">
          {(['all', 'paid', 'free'] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setAt(0) }}>{t === 'all' ? 'All' : t === 'paid' ? 'Paid' : 'Free'}</button>)}
        </div>
      )}
    </section>
  )
}

/** The waitlist-style tile field: rows of faint typewriter characters (same feel as desknoty.com). */
function makeGlyphs() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let seed = 7, out = ''
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let y = 0; y < 90; y++) { for (let x = 0; x < 260; x++) out += A[Math.floor(r() * A.length)]; out += '\n' }
  return out
}


/** Price + action, using the store's existing purchase flow (paid, free, owned, affiliate). */
function Buy({ p, big, ...props }: { p: ShopProduct; big?: boolean } & StorePageProps) {
  const free = isFreeProduct(p)
  const external = affiliateHref(p)
  const cls = big ? 's2-buy s2-buy-big' : 's2-buy'
  if (external) {
    return (
      <div className="s2-buyrow">
        <a className={cls} href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>
          {p.cta?.text && !/amazon/i.test(p.cta.text) ? p.cta.text : 'View product'}
        </a>
        <small className="s2-aff" title={p.affiliate?.disclosure || 'As an Amazon Associate, I earn from qualifying purchases.'}>Paid link</small>
      </div>
    )
  }

  if (props.live && props.owned?.[p.id] && p.priceMinor > 0) {
    return (
      <div className="s2-buyrow">
        <span className="s2-price">Purchased</span>
        {props.onDownload
          ? <button type="button" className={cls} onClick={() => props.onDownload!(p)} disabled={props.downloading === p.id}>{props.downloading === p.id ? 'Starting…' : 'Download'}</button>
          : <a className={cls} href={props.owned[p.id]}>Download</a>}
      </div>
    )
  }
  const disabled = free ? !props.live || props.buying === p.id : !props.live || !props.checkoutReady || props.buying === p.id
  return (
    <div className="s2-buyrow">
      {free ? <span className="s2-price">Free</span> : <span className="s2-price"><PriceTag prod={p} /></span>}
      <button type="button" className={cls} disabled={disabled} onClick={() => (free && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))}>
        {props.buying === p.id ? 'Opening checkout…' : props.claims?.[p.id] ? 'Send again' : (free ? (p.cta?.text && !/^\s*buy/i.test(p.cta.text) ? p.cta.text : 'Get it free') : (p.cta?.text || 'Buy now'))}
      </button>
    </div>
  )
}

function Card({ p, n, ...props }: { p: ShopProduct; n: number } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  const type = p.format || p.fileType
  return (
    <article className={`s2k-card s2k-r${n % 3}`}>
      <a className="s2k-img" href={link} tabIndex={-1} aria-hidden="true">
        {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}
        {p.rating && p.rating.count > 0 && <em className="s2k-badge">★ {p.rating.average.toFixed(1)}</em>}
      </a>
      <div className="s2k-body">
        <h2>{link ? <a href={link}>{p.title}</a> : p.title}</h2>
        {p.description && <p>{p.description.split('\n')[0]}</p>}
      </div>
      <div className="s2k-foot2">
        <Buy p={p} {...props} />
        <small className="s2k-note">{affiliateHref(p) ? 'Ships from the store' : type ? `Instant download · ${type}` : 'Instant download'}</small>
      </div>
      {!props.live && (props.onEditProduct || props.onHideProduct) && (
        <div className="s2k-admin">
          {props.onEditProduct && <button type="button" onClick={() => props.onEditProduct!(p.id)}>Edit / replace</button>}
          {props.onHideProduct && <button type="button" onClick={() => props.onHideProduct!(p.id)}>Remove</button>}
        </div>
      )}
    </article>
  )
}

/** Coming Soon teaser: plays its reveal once when it scrolls into view, then rests. */
function Teaser() {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return <div ref={ref} className="s2-teaser"><ComingSoon in={seen} /></div>
}
