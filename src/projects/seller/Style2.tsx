import { useEffect, useRef, useState } from 'react'
import { ComingSoon, PriceTag } from './StorePage'
import type { StorePageProps } from './StorePage'
import { FONTS, affiliateHref, DEFAULT_AMAZON_CTA, ensureFont, fontById, isFreeProduct, mediaUrl } from './model'
import type { ShopProduct } from './model'
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
  const body = fontById(page.theme.font)?.css ?? FONTS[0].css
  // Display type: bold condensed caps (loaded on demand, like the store fonts).
  useEffect(() => { ensureFont(page.theme.font); ensureFont('anton'); ensureFont('oswald') }, [page.theme.font])
  const avatar = mediaUrl(page.avatar)
  const list = only ? [only] : products.filter((p) => !p.hidden)
  const name = (page.name || handle).trim()
  const freeOne = !only && list.find((p) => isFreeProduct(p) && !affiliateHref(p))

  return (
    <div className="s2p" style={{ fontFamily: body }}>
      <header className="s2-bar">
        <a className="s2-stamp" href={props.live ? `/${handle}` : undefined}>
          {avatar && <span className="s2-ava" style={{ backgroundImage: `url(${avatar})` }} />}
          <span><small>the shop of</small><b>{name}</b></span>
        </a>
        {!only && (
          <nav className="s2-links" aria-label="Shop">
            <a href="#s2-shop">Shop all</a>
            {freeOne && <a href="#s2-shop">Free stuff</a>}
          </nav>
        )}
      </header>

      {!only && (
        <section className="s2-wall" aria-label="Featured">
          <div className="s2-wall-in">
            {list.slice(0, 3).map((p, i) => <Poster key={p.id} p={p} n={i} {...props} />)}
          </div>
        </section>
      )}

      {/* The wall shows the first three; the shelf holds the rest (no product is shown twice). */}
      <section id="s2-shop" className="s2-shelf" aria-label="More products">
        {(only || list.length > 3) && (
          <>
            {!only && <h2 className="s2-h2">More goods <span>· {list.length - 3}</span></h2>}
            <div className="s2-grid">{(only ? [only] : list.slice(3)).map((p) => <Card key={p.id} p={p} {...props} />)}</div>
          </>
        )}
        {!only && <Teaser />}
      </section>

      <footer className="s2-foot">
        <span>© {name}</span>
        <a href="https://desknoty.com" target="_blank" rel="noopener">Made with Desknoty</a>
      </footer>
      {freeOne && list.length > 3 && <a className="s2-promo" href="#s2-shop">Free download inside →</a>}
    </div>
  )
}

/** A product as a pasted-up paper poster on the board: artwork, big condensed title, price sticker, action. */
function Poster({ p, n, ...props }: { p: ShopProduct; n: number } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  return (
    <article className={`s2-poster s2-tilt${n % 3}`}>
      <a className="s2-pimg" href={link} tabIndex={-1} aria-hidden="true">{src ? <img src={src} alt="" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}</a>
      <h3>{link ? <a href={link}>{p.title}</a> : p.title}</h3>
      {p.description && <p className="s2-pdesc">{p.description.split('\n')[0]}</p>}
      <Buy p={p} {...props} />
    </article>
  )
}

/** Only useful facts: file type and a verified rating. */
function Facts({ p }: { p: ShopProduct }) {
  const type = p.format || p.fileType
  if (!type && !(p.rating && p.rating.count > 0)) return null
  return (
    <div className="s2-facts">
      {type && <span>{type}</span>}
      {p.rating && p.rating.count > 0 && <span>★ {p.rating.average.toFixed(1)} · {p.rating.count} verified</span>}
    </div>
  )
}

/** Price + action, using the store's existing purchase flow (paid, free, owned, affiliate). */
function Buy({ p, big, ...props }: { p: ShopProduct; big?: boolean } & StorePageProps) {
  const free = isFreeProduct(p)
  const external = affiliateHref(p)
  const cls = big ? 's2-buy s2-buy-big' : 's2-buy'
  if (external) {
    return (
      <div className="s2-buyrow">
        <span className="s2-price">Amazon</span>
        <a className={cls} href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>
          {p.productType === 'affiliate' ? (p.affiliate?.cta || DEFAULT_AMAZON_CTA) : (p.cta?.text || 'View product ↗')}
        </a>
        <small className="s2-aff">{p.affiliate?.disclosure || 'As an Amazon Associate, I earn from qualifying purchases.'}</small>
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

function Card({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  return (
    <article className="s2-card">
      <a className="s2-cimg" href={link} tabIndex={-1} aria-hidden="true">{src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}</a>
      <div className="s2-cbody">
        <Facts p={p} />
        <h3>{link ? <a href={link}>{p.title}</a> : p.title}</h3>
        <Buy p={p} {...props} />
      </div>
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
