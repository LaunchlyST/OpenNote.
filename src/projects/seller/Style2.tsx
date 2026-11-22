import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { ComingSoon, PriceTag } from './StorePage'
import type { StorePageProps } from './StorePage'
import { affiliateHref, ensureFont, isFreeProduct, mediaUrl } from './model'
import type { ShopProduct } from './model'
import './style2.css'

/**
 * STYLE 2 — a premium storefront for digital products.
 *
 * Shows in Seller Studio's preview (Style 2) and on the live store once the
 * seller publishes Style 2. Same data and purchase handlers as Style 1: Buy
 * always calls onBuy (the real checkout), affiliate products link out, product
 * links stay /<handle>/p/<productId>.
 *
 * Layout: slim header → one featured product over a full-width scene (swipe or
 * arrows to change product; the scene follows the product) → "Shop all" grid →
 * Coming soon (once) → compact footer.
 */

/**
 * Scene library. Free previews from Backgrounds Supply, licensed for commercial
 * website use (https://backgrounds.supply/license-agreement):
 *   garden — Viridian: https://app.backgrounds.supply/api/r2-public/previews/viridian/image-1.webp
 *   dune   — Serenox:  https://app.backgrounds.supply/api/r2-public/previews/serenox/image-8.webp
 */
const SCENES = {
  garden: { src: '/scenes/viridian-garden.webp', tint: '#2f3b1f' },
  dune: { src: '/scenes/serenox-dune.webp', tint: '#3a2618' },
} as const
type SceneId = keyof typeof SCENES
const SCENE_ORDER: SceneId[] = ['garden', 'dune']
/** Scenes chosen for specific live products (x--x039's lemon cleaner → the sunlit garden). */
const PINNED: Record<string, SceneId> = { prd_32afe7a32e425e47793b: 'garden' }
const BOTANICAL = /lemon|citrus|lime|orange|fruit|flower|floral|garden|botanic|plant|leaf|spring|summer/i

/** A product's scene is fixed by its id (and botanical products get the garden), so swiping back restores it. */
export function sceneFor(p: ShopProduct): SceneId {
  if (PINNED[p.id]) return PINNED[p.id]
  if (BOTANICAL.test(`${p.title} ${p.description ?? ''}`)) return 'garden'
  let h = 0
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) | 0
  return SCENE_ORDER[Math.abs(h) % SCENE_ORDER.length]
}

export function Style2Page(props: StorePageProps) {
  const { page, products, handle, only } = props
  useEffect(() => { ensureFont(page.theme.font) }, [page.theme.font])
  const list = only ? [only] : products.filter((p) => !p.hidden)
  const name = (page.name || handle).trim()
  const accent = page.theme.accent && !/^#?(fff|ffffff)$/i.test(page.theme.accent) ? page.theme.accent : '#1b1a17'
  const avatar = mediaUrl(page.avatar)
  const home = props.live ? `/${handle}` : undefined

  return (
    <div className="s2s" style={{ ['--ac' as string]: accent } as CSSProperties}>
      <header className="s2s-top">
        <a className="s2s-brand" href={home}>
          <span className="s2s-mark" aria-hidden="true" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{!avatar && (name.charAt(0).toUpperCase() || '✦')}</span>
          <span>{name}</span>
        </a>
        <a className="s2s-shoplink" href={list.length > 1 && !only ? '#s2s-all' : '#s2s-feature'}>Shop</a>
      </header>

      {list.length === 0
        ? <p className="s2s-empty">{props.live ? 'New products are on the way.' : 'Add products in the Products tab to show them here.'}</p>
        : <Feature list={list} {...props} />}

      {!only && list.length > 1 && (
        <section id="s2s-all" className="s2s-all" aria-labelledby="s2s-all-h">
          <div className="s2s-wrap">
            <div className="s2s-all-head">
              <h2 id="s2s-all-h">Shop all</h2>
              <span>{list.length} products</span>
            </div>
            <div className="s2s-grid">
              {list.map((p) => <Card key={p.id} p={p} {...props} />)}
            </div>
          </div>
        </section>
      )}

      {!only && (
        <div className="s2s-wrap s2s-soon"><Teaser /></div>
      )}

      <footer className="s2s-foot">
        <div className="s2s-wrap s2s-foot-in">
          <a className="s2s-brand s2s-brand-sm" href={home}>
            <span className="s2s-mark" aria-hidden="true" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{!avatar && (name.charAt(0).toUpperCase() || '✦')}</span>
            <span>{name}</span>
          </a>
          <span className="s2s-foot-meta">© {new Date().getFullYear()} {name} · <a href="https://desknoty.com" target="_blank" rel="noopener">Made with Desknoty</a></span>
        </div>
      </footer>
    </div>
  )
}

/** The featured product over its scene. Swipe, arrows or ←/→ change product; one product hides the controls. */
function Feature({ list, ...props }: { list: ShopProduct[] } & StorePageProps) {
  const [at, setAt] = useState(0)
  const i = Math.min(at, list.length - 1)
  const p = list[i]
  const many = list.length > 1
  const go = useCallback((d: number) => setAt((n) => (Math.min(n, list.length - 1) + d + list.length) % list.length), [list.length])
  const start = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    if (!many || (e.target as HTMLElement).closest('button, a, input')) return
    start.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e: ReactPointerEvent) => {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }
  const scene = SCENES[sceneFor(p)]
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  const type = p.format || p.fileType

  return (
    <section
      id="s2s-feature"
      className="s2s-feature"
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label="Featured product"
      data-product={p.id}
      data-scene={sceneFor(p)}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => { start.current = null }}
      onKeyDown={(e) => { if (!many) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }}
      style={{ ['--tint' as string]: scene.tint } as CSSProperties}
    >
      <div className="s2s-scenes" aria-hidden="true">
        {SCENE_ORDER.map((id) => (
          <img key={id} src={SCENES[id].src} alt="" className={id === sceneFor(p) ? 'on' : ''} draggable={false} decoding="async" />
        ))}
      </div>
      <div className="s2s-wrap s2s-feature-in" key={p.id} aria-live="polite">
        <a className="s2s-art" href={link} tabIndex={-1} aria-hidden="true" draggable={false}>
          {src ? <img src={src} alt="" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}
        </a>
        <div className="s2s-info">
          <p className="s2s-kicker">{affiliateHref(p) ? 'Recommended' : type ? `Digital download · ${type}` : 'Digital download'}</p>
          <h1>{link ? <a href={link}>{p.title}</a> : p.title}</h1>
          {p.description && <p className="s2s-desc">{p.description.split('\n')[0]}</p>}
          {p.rating && p.rating.count > 0 && <p className="s2s-rating">★ {p.rating.average.toFixed(1)} <span>({p.rating.count})</span></p>}
          <Buy p={p} big {...props} />
          {many && (
            <div className="s2s-ctrl">
              <button type="button" onClick={() => go(-1)} aria-label="Previous product">←</button>
              <span>{i + 1} / {list.length}</span>
              <button type="button" onClick={() => go(1)} aria-label="Next product">→</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Price + action, using the store's existing purchase flow (paid, free, owned, affiliate). */
function Buy({ p, big, ...props }: { p: ShopProduct; big?: boolean } & StorePageProps) {
  const free = isFreeProduct(p)
  const external = affiliateHref(p)
  const cls = big ? 's2s-btn s2s-btn-big' : 's2s-btn'
  if (external) {
    return (
      <div className="s2s-buyrow">
        <small className="s2s-price s2s-aff" title={p.affiliate?.disclosure || 'As an Amazon Associate, I earn from qualifying purchases.'}>Paid link</small>
        <a className={cls} href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>
          {p.cta?.text && !/amazon/i.test(p.cta.text) ? p.cta.text : 'View product'}
        </a>
      </div>
    )
  }
  if (props.live && props.owned?.[p.id] && p.priceMinor > 0) {
    return (
      <div className="s2s-buyrow">
        <span className="s2s-price">Purchased</span>
        {props.onDownload
          ? <button type="button" className={cls} onClick={() => props.onDownload!(p)} disabled={props.downloading === p.id}>{props.downloading === p.id ? 'Starting…' : 'Download'}</button>
          : <a className={cls} href={props.owned[p.id]}>Download</a>}
      </div>
    )
  }
  const disabled = free ? !props.live || props.buying === p.id : !props.live || !props.checkoutReady || props.buying === p.id
  return (
    <div className="s2s-buyrow">
      {free ? <span className="s2s-price">Free</span> : <span className="s2s-price"><PriceTag prod={p} /></span>}
      <button type="button" className={cls} disabled={disabled} onClick={() => (free && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))}>
        {props.buying === p.id ? 'Opening checkout…' : free && props.claims?.[p.id] ? 'Send again' : (free ? (p.cta?.text && !/^\s*buy/i.test(p.cta.text) ? p.cta.text : 'Get it free') : (p.cta?.text || 'Buy now'))}
      </button>
    </div>
  )
}

function Card({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const src = mediaUrl(p.cover)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
  const type = p.format || p.fileType
  return (
    <article className="s2s-card">
      <a className="s2s-card-img" href={link} tabIndex={-1} aria-hidden="true">
        {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}
      </a>
      <div className="s2s-card-body">
        <small>{affiliateHref(p) ? 'Recommended' : type ? `Digital · ${type}` : 'Digital download'}</small>
        <h3>{link ? <a href={link}>{p.title}</a> : p.title}</h3>
        {p.description && <p>{p.description.split('\n')[0]}</p>}
        <Buy p={p} {...props} />
      </div>
      {!props.live && (props.onEditProduct || props.onHideProduct) && (
        <div className="s2s-admin">
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
