import { useEffect, useRef, useState } from 'react'
import { ComingSoon, PriceTag, accentOf, ctaStyle } from './StorePage'
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
  const font = fontById(page.theme.font)?.css ?? FONTS[0].css
  useEffect(() => { ensureFont(page.theme.font) }, [page.theme.font])
  const accent = accentOf(page)
  const avatar = mediaUrl(page.avatar)
  const list = only ? [only] : products.filter((p) => !p.hidden)
  // The hero steps through every product (01 / 03 ← →); the catalogue lists them all below.
  const [pick, setPick] = useState(0)
  const featured = list[Math.min(pick, list.length - 1)]
  const rest = only ? [] : list

  return (
    <div className="s2p" style={{ fontFamily: font, ['--s2-ac' as string]: accent }}>
      <section className="s2-hero" aria-label={featured ? `Featured: ${featured.title}` : 'Store'}>
        <HeroBackdrop banner={page.banner} />
        <header className="s2-nav">
          <a className="s2-brand" href={props.live ? `/${handle}` : undefined}>
            <span className="s2-logo" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{!avatar && (page.name || handle).charAt(0).toUpperCase()}</span>
            <span>{page.name || handle}</span>
          </a>
          {!only && list.length > 1 && <a className="s2-navlink" href="#s2-shop">Browse products</a>}
        </header>
        {featured ? <Showroom key={featured.id} p={featured} {...props} step={!only && list.length > 1 ? { at: Math.min(pick, list.length - 1), of: list.length, go: (d: number) => setPick((i) => (i + d + list.length) % list.length) } : undefined} /> : (
          <div className="s2-empty-hero"><h1>{page.name || handle}</h1>{page.bio && <p>{page.bio}</p>}</div>
        )}
        <span className="s2-crt" aria-hidden="true" />
      </section>

      {!only && (
        <section id="s2-shop" className="s2-cat" aria-label="All products">
          <div className="s2-cat-head">
            <h2>The shop</h2>
            {page.bio && <p>{page.bio}</p>}
          </div>
          {rest.length > 0 && <div className="s2-grid">{rest.map((p) => <Card key={p.id} p={p} {...props} />)}</div>}
          <Teaser />
        </section>
      )}

      <footer className="s2-foot">
        <span>© {page.name || handle}</span>
        <a href="https://desknoty.com" target="_blank" rel="noopener">desknoty.com</a>
      </footer>
    </div>
  )
}

/** The seller's pixel-art banner, softly lit behind the hero. Muted, no controls, never required. */
function HeroBackdrop({ banner }: { banner: StorePageProps['page']['banner'] }) {
  const src = banner ? mediaUrl(banner.media) : null
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!src) return <span className="s2-bg s2-bg-plain" aria-hidden="true" />
  return banner!.kind === 'video' && !reduce
    ? <video className="s2-bg" src={src} muted playsInline autoPlay loop preload="metadata" aria-hidden="true" />
    : banner!.kind === 'video'
      ? <video className="s2-bg" src={src} muted playsInline preload="metadata" aria-hidden="true" />
      : <span className="s2-bg" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
}

/** Featured product: large preview (+ real thumbnails) beside title, description, price and action. */
function Showroom({ p, step, ...props }: { p: ShopProduct; step?: { at: number; of: number; go: (d: number) => void } } & StorePageProps) {
  const shots = [p.cover, ...(p.gallery ?? [])].map((m) => mediaUrl(m)).filter((u): u is string => Boolean(u))
  const [at, setAt] = useState(0)
  const cur = shots[at] ?? null
  return (
    <div className="s2-show">
      <div className="s2-stage">
        <div className="s2-art">
          {shots.map((u, i) => <img key={u} src={u} alt={i === 0 ? p.title : ''} className={i === at ? 'on' : ''} draggable={false} />)}
          {!cur && <span className="s2-art-ph">{p.title.charAt(0).toUpperCase() || '✦'}</span>}
          <span className="s2-sheen" aria-hidden="true" />
        </div>
        {shots.length > 1 && (
          <div className="s2-thumbs" role="tablist" aria-label="Previews">
            {shots.map((u, i) => (
              <button key={u} type="button" role="tab" aria-selected={i === at} className={i === at ? 'on' : ''} onClick={() => setAt(i)} style={{ backgroundImage: `url(${u})` }} aria-label={`Preview ${i + 1}`} />
            ))}
          </div>
        )}
      </div>
      <div className="s2-glass">
        {step && (
          <div className="s2-step">
            <span>{String(step.at + 1).padStart(2, '0')} / {String(step.of).padStart(2, '0')}</span>
            <button type="button" onClick={() => step.go(-1)} aria-label="Previous product">←</button>
            <button type="button" onClick={() => step.go(1)} aria-label="Next product">→</button>
          </div>
        )}
        <Facts p={p} />
        <h1>{p.title}</h1>
        {p.description && <p className="s2-desc">{p.description.split('\n')[0]}</p>}
        <Buy p={p} {...props} big />
        {props.live && !props.only && <a className="s2-more" href={`/${props.handle}/p/${p.id}`}>Product details →</a>}
      </div>
    </div>
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
        <a className={cls} style={ctaStyle(p)} href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>
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
      <button type="button" className={cls} style={ctaStyle(p)} disabled={disabled} onClick={() => (free && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))}>
        {props.buying === p.id ? 'Opening checkout…' : props.claims?.[p.id] ? 'Send again' : (p.cta?.text || (free ? 'Get it free' : 'Buy now'))}
      </button>
    </div>
  )
}

function Card({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const img = <span className="s2-cimg" style={src ? { backgroundImage: `url(${src})` } : undefined}>{!src && (p.title.charAt(0).toUpperCase() || '✦')}</span>
  return (
    <article className="s2-card">
      {props.live ? <a href={`/${props.handle}/p/${p.id}`} aria-label={p.title}>{img}</a> : img}
      <div className="s2-cbody">
        <Facts p={p} />
        <h3>{p.title}</h3>
        {p.included?.length ? <ul className="s2-incl">{p.included.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
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
