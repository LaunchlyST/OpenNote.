import { PriceTag, accentOf, ctaStyle } from './StorePage'
import type { StorePageProps } from './StorePage'
import { FONTS, mediaUrl, safeExternalUrl } from './model'
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
  const list = only ? [only] : products.filter((p) => !p.hidden)

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
  // Affiliate / external mode: link out instead of selling here. No price, checkout
  // or download is rendered, and the partner link keeps its tracking params.
  const external = safeExternalUrl(p.affiliate?.url ?? '')
  if (external) {
    return (
      <article className="s2p-card">
        {props.live && !props.only ? <a href={`/${props.handle}/p/${p.id}`}>{Img}</a> : Img}
        <div className="s2p-info">
          <h3>{p.title}</h3>
          {props.only && p.description && <p className="s2p-desc">{p.description}</p>}
          <span className="s2p-price">Affiliate</span>
          <a
            className="s2p-buy"
            style={ctaStyle(p)}
            href={external}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={props.live ? undefined : (e) => e.preventDefault()}
          >
            {p.cta?.text || 'View product ↗'}
          </a>
          <p className="s2p-aff-note">
            {p.affiliate?.disclosure || 'Paid partnership · payment and delivery happen on the external website.'}
          </p>
        </div>
      </article>
    )
  }
  return (
    <article className="s2p-card">
      {props.live && !props.only ? <a href={`/${props.handle}/p/${p.id}`}>{Img}</a> : Img}
      <div className="s2p-info">
        <h3>{p.title}</h3>
        {props.only && p.description && <p className="s2p-desc">{p.description}</p>}
        {props.live && props.owned?.[p.id] && p.priceMinor > 0 ? (
          <>
            <span className="s2p-price">Purchased</span>
            {props.onDownload ? (
              <button type="button" className="s2p-buy s2p-dl" onClick={() => props.onDownload!(p)} disabled={props.downloading === p.id}>{props.downloading === p.id ? 'Starting…' : 'Download'}</button>
            ) : (
              <a className="s2p-buy s2p-dl" href={props.owned[p.id]}>Download</a>
            )}
          </>
        ) : (
          <>
            {p.priceMinor === 0 ? <span className="s2p-price">Free</span> : <PriceTag prod={p} />}
            <button type="button" className="s2p-buy" style={ctaStyle(p)} disabled={p.priceMinor === 0 ? !props.live || props.buying === p.id : disabled} onClick={() => (p.priceMinor === 0 && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))} title={props.claims?.[p.id] ? `We emailed a private link to ${props.claims[p.id].email}. Open it to download.` : undefined}>
              {props.buying === p.id ? 'Opening checkout…' : props.claims?.[p.id] ? (props.claims[p.id].waitSeconds > 0 ? `Send again (${props.claims[p.id].waitSeconds}s)` : 'Send again') : (p.cta?.text || (p.priceMinor === 0 ? 'Get it free' : 'Buy now'))}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
