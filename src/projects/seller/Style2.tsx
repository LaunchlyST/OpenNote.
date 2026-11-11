import { accentOf } from './StorePage'
import type { StorePageProps } from './StorePage'
import { FONTS, formatPrice, mediaUrl } from './model'
import type { ShopProduct } from './model'
import './style2.css'

/**
 * STYLE 2 — the store's second layout (a Shopify-style shop).
 *
 * Edit this file (and style2.css) to design Style 2. Whatever you change here
 * shows in two places at once:
 *   1. Seller Studio, in the phone preview when "Style 2" is selected
 *   2. the live store (desknoty.com/<handle>) once the seller publishes Style 2
 *
 * It gets exactly the same data as Style 1 (StorePage.tsx), so it shows the
 * seller's real name, photo, bio, theme colour and products:
 *   page          name, bio, avatar (TikTok), theme, socials, blocks
 *   products      the products on sale (title, description, price, cover)
 *   handle        the store's username
 *   live          true on the real store page (links and Buy now work)
 *   checkoutReady the seller can take payments
 *   onBuy(p)      call this to start checkout for a product
 *   buying        id of the product whose checkout is opening
 *   only          set on a single product's own page
 *
 * Rules: keep Buy now calling onBuy (that is the real, secure checkout) and
 * keep product links as /<handle>/p/<productId>.
 */
export function Style2Page(props: StorePageProps) {
  const { page, products, handle, only } = props
  const font = FONTS.find((f) => f.id === page.theme.font)?.css ?? FONTS[0].css
  const accent = accentOf(page)
  const avatar = mediaUrl(page.avatar)
  const list = only ? [only] : products

  return (
    <div className="s2p" style={{ fontFamily: font, ['--s2-ac' as string]: accent }}>
      <header className="s2p-nav">
        <a className="s2p-brand" href={props.live ? `/${handle}` : undefined}>
          <span className="s2p-logo" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{!avatar && (page.name || handle).charAt(0).toUpperCase()}</span>
          {page.name || handle}
        </a>
        <span className="s2p-cart" aria-hidden="true">🛍</span>
      </header>

      {!only && (
        <section className="s2p-hero">
          <p className="s2p-kicker">@{handle}</p>
          <h1>{page.name || handle}</h1>
          {page.bio && <p className="s2p-bio">{page.bio}</p>}
          <a className="s2p-cta" href="#s2p-shop">Shop all</a>
        </section>
      )}

      <section id="s2p-shop" className={only ? 's2p-grid s2p-one' : 's2p-grid'}>
        {list.length === 0 && <p className="s2p-empty">{props.live ? 'New products are on the way.' : 'Add products in the Products tab to show them here.'}</p>}
        {list.map((p) => <Card key={p.id} p={p} {...props} />)}
      </section>

      <footer className="s2p-foot">
        <span>© {page.name || handle}</span>
        <a href="https://desknoty.com" target="_blank" rel="noopener">desknoty.com</a>
      </footer>
    </div>
  )
}

function Card({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const disabled = !props.live || !props.checkoutReady || props.buying === p.id
  const Img = (
    <span className="s2p-img" style={src ? { backgroundImage: `url(${src})` } : undefined}>
      {!src && (p.title.charAt(0).toUpperCase() || '✦')}
    </span>
  )
  return (
    <article className="s2p-card">
      {props.live && !props.only ? <a href={`/${props.handle}/p/${p.id}`}>{Img}</a> : Img}
      <div className="s2p-info">
        <h3>{p.title}</h3>
        {props.only && p.description && <p className="s2p-desc">{p.description}</p>}
        {props.live && props.owned?.[p.id] ? (
          <>
            <span className="s2p-price">Purchased</span>
            <a className="s2p-buy s2p-dl" href={props.owned[p.id]}>Download</a>
          </>
        ) : (
          <>
            <span className="s2p-price">{p.priceMinor === 0 ? 'Free' : formatPrice(p.priceMinor, p.currency)}</span>
            <button type="button" className="s2p-buy" disabled={p.priceMinor === 0 ? !props.live || props.buying === p.id : disabled} onClick={() => props.onBuy?.(p)}>
              {props.buying === p.id ? 'Opening checkout…' : p.priceMinor === 0 ? 'Get it free' : 'Buy now'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
