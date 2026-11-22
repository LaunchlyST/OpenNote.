import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { PriceTag } from './StorePage'
import type { StorePageProps } from './StorePage'
import { affiliateHref, formatPrice, isFreeProduct, mediaUrl } from './model'
import type { ShopProduct } from './model'
import './style2.css'

/**
 * STYLE 2 — a gallery storefront for digital files.
 *
 * Shows in Seller Studio's preview (Style 2) and on the live store once the
 * seller publishes Style 2. Same data and purchase handlers as Style 1: the
 * primary action always calls onBuy / onClaimAgain / onDownload, or links to
 * the affiliate page.
 *
 * Layout: slim header → product lineup (covers on a studio shelf; tap one to
 * open it) → "Shop all" grid → dark footer. Opening a product shows the
 * selling view: the cover over its scene, with a white detail panel. Arrows,
 * swipe and ←/→ move through products; closing returns focus to the lineup.
 */

/**
 * Scene library. Free previews from Backgrounds Supply, licensed for commercial
 * website use (https://backgrounds.supply/license-agreement):
 *   garden — Viridian: https://app.backgrounds.supply/api/r2-public/previews/viridian/image-1.webp
 *   dune   — Serenox:  https://app.backgrounds.supply/api/r2-public/previews/serenox/image-8.webp
 *   hill   — Zephyr:   https://app.backgrounds.supply/api/r2-public/previews/zephyr/image-32.webp
 */
const SCENES = {
  garden: { src: '/scenes/viridian-garden.webp' },
  dune: { src: '/scenes/serenox-dune.webp' },
  hill: { src: '/scenes/zephyr-hillside.webp' },
} as const
type SceneId = keyof typeof SCENES
const SCENE_ORDER: SceneId[] = ['garden', 'dune', 'hill']
/** Scenes chosen for x--x039's live products: one scene each, so every swipe changes the background. */
const PINNED: Record<string, SceneId> = {
  prd_4fa03ef1c2370c9aa6f7: 'dune', // hi my name is
  prd_17d36fb55900205394cc: 'hill', // DADAW
  prd_32afe7a32e425e47793b: 'garden', // freedaw (lemon cleaner)
}
const BOTANICAL = /lemon|citrus|lime|orange|fruit|flower|floral|garden|botanic|plant|leaf|spring|summer/i

/** A product's scene is fixed by its id, so swiping back restores it. */
export function sceneFor(p: ShopProduct): SceneId {
  if (PINNED[p.id]) return PINNED[p.id]
  if (BOTANICAL.test(`${p.title} ${p.description ?? ''}`)) return 'garden'
  let h = 0
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) | 0
  return SCENE_ORDER[Math.abs(h) % SCENE_ORDER.length]
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'
function useStyleFonts() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.querySelector('link[data-s2-fonts]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = FONTS; l.dataset.s2Fonts = '1'; l.crossOrigin = 'anonymous'
    document.head.appendChild(l)
  }, [])
}

const reduced = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
/** Run a state change as a view transition (the cover glides into place) when the browser supports it. */
function transition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!d.startViewTransition || reduced()) { fn(); return }
  d.startViewTransition(() => flushSync(fn))
}

const priceText = (p: ShopProduct) => (isFreeProduct(p) ? 'Free' : formatPrice(p.offer?.priceMinor ?? p.priceMinor, p.currency))
const fileType = (p: ShopProduct) => {
  if (affiliateHref(p)) return 'Recommended product'
  const t = p.format || p.fileType
  return t ? `Digital file · ${t.toUpperCase()}` : 'Digital file'
}

export function Style2Page(props: StorePageProps) {
  const { page, products, handle, only } = props
  useStyleFonts()
  const list = only ? [only] : products.filter((p) => !p.hidden)
  const name = (page.name || handle).trim()
  const accent = page.theme.accent && !/^#?(fff|ffffff)$/i.test(page.theme.accent) ? page.theme.accent : '#1b1a17'
  const avatar = mediaUrl(page.avatar)
  const home = props.live ? `/${handle}` : undefined
  const [sel, setSel] = useState(0)
  const [open, setOpen] = useState<number | null>(only ? 0 : null)
  const returnTo = useRef<'lineup' | 'grid'>('lineup')
  const at = Math.min(sel, Math.max(0, list.length - 1))

  const openAt = (i: number, from: 'lineup' | 'grid') => {
    returnTo.current = from
    transition(() => { setSel(i); setOpen(i) })
  }
  const close = () => {
    if (only) { if (home) window.location.href = home; return }
    const i = open ?? at
    transition(() => { setSel(i); setOpen(null) })
    requestAnimationFrame(() => {
      const id = list[i]?.id
      const el = document.querySelector<HTMLElement>(returnTo.current === 'grid' ? `[data-s2-tile="${id}"]` : `[data-s2-cover="${id}"]`)
      el?.focus({ preventScroll: returnTo.current !== 'grid' })
    })
  }

  const mark = (
    <span className="s2r-mark" aria-hidden="true" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{!avatar && (name.charAt(0).toUpperCase() || '✦')}</span>
  )

  return (
    <div className="s2r" style={{ ['--ac' as string]: accent } as CSSProperties}>
      <header className="s2r-top">
        <a className="s2r-brand" href={home}>{mark}<span className="s2r-name">{name}</span><span className="s2r-handle">@{handle}</span></a>
        {list.length > 1 && !only && <a className="s2r-toplink" href="#s2r-all">Shop all</a>}
      </header>

      {list.length === 0 ? (
        <section className="s2r-empty">
          <h1>{name}</h1>
          <p>{props.live ? 'New products are on the way. Check back soon.' : 'Add products in the Products tab to show them here.'}</p>
        </section>
      ) : (
        <Lineup list={list} at={at} setAt={setSel} hidden={open !== null} onOpen={(i) => openAt(i, 'lineup')} />
      )}

      {list.length > 1 && !only && (
        <section id="s2r-all" className="s2r-all" aria-labelledby="s2r-all-h">
          <div className="s2r-wrap">
            <h2 id="s2r-all-h">Shop all</h2>
            <ul className="s2r-grid">
              {list.map((p, i) => {
                const src = mediaUrl(p.cover)
                return (
                  <li key={p.id}>
                    <button type="button" className="s2r-tile" data-s2-tile={p.id} onClick={() => openAt(i, 'grid')} aria-label={`${p.title}, ${priceText(p)}`}>
                      <span className="s2r-tile-img">{src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <b>{p.title.charAt(0).toUpperCase() || '✦'}</b>}</span>
                      <span className="s2r-tile-meta"><span className="s2r-tile-title">{p.title}</span><span className="s2r-tile-price">{priceText(p)}</span></span>
                    </button>
                    {!props.live && (props.onEditProduct || props.onHideProduct) && (
                      <span className="s2r-admin">
                        {props.onEditProduct && <button type="button" onClick={() => props.onEditProduct!(p.id)}>Edit / replace</button>}
                        {props.onHideProduct && <button type="button" onClick={() => props.onHideProduct!(p.id)}>Remove</button>}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      <footer className="s2r-foot">
        <div className="s2r-wrap s2r-foot-in">
          <a className="s2r-brand s2r-brand-foot" href={home}>{mark}<span className="s2r-name">{name}</span></a>
          <span className="s2r-foot-meta">© {new Date().getFullYear()} {name} · <a href="https://desknoty.com" target="_blank" rel="noopener">Made with Desknoty</a></span>
        </div>
      </footer>

      {open !== null && list[open] && (() => {
        const d = <Detail list={list} i={open} setI={(n) => { setOpen(n); setSel(n) }} onClose={close} canClose={!only || Boolean(home)} {...props} />
        // Live: a real full-screen layer on <body>. Studio preview: stays inside the preview frame.
        return props.live && typeof document !== 'undefined'
          ? createPortal(<div className="s2r-layer" style={{ ['--ac' as string]: accent } as CSSProperties}>{d}</div>, document.body)
          : d
      })()}
    </div>
  )
}

/** Covers on a studio shelf. The selected one is larger; every cover is a button that opens the selling view. */
function Lineup({ list, at, setAt, onOpen, hidden }: { list: ShopProduct[]; at: number; setAt: (i: number) => void; onOpen: (i: number) => void; hidden: boolean }) {
  const shelf = useRef<HTMLDivElement>(null)
  const p = list[at]
  const fromScroll = useRef(false)
  const covers = () => [...(shelf.current?.querySelectorAll<HTMLElement>('[data-s2-cover]') ?? [])]
  // Phones: the shelf scrolls with snap; whichever cover sits in the centre is selected.
  const onScroll = () => {
    const el = shelf.current
    if (!el || el.scrollWidth <= el.clientWidth + 2) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0, d = Infinity
    covers().forEach((c, i) => { const m = c.offsetLeft + c.offsetWidth / 2; if (Math.abs(m - mid) < d) { d = Math.abs(m - mid); best = i } })
    if (best !== at) { fromScroll.current = true; setAt(best) }
  }
  useEffect(() => {
    if (fromScroll.current) { fromScroll.current = false; return }
    const el = shelf.current
    const c = covers()[at]
    if (el && c && el.scrollWidth > el.clientWidth + 2) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' })
  }, [at])
  const key = (e: ReactKeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = Math.min(list.length - 1, Math.max(0, at + d))
    setAt(n)
    covers()[n]?.focus()
  }
  return (
    <section className="s2r-intro" aria-label="Products">
      <div className={'s2r-shelf' + (list.length === 1 ? ' one' : '')} ref={shelf} onScroll={onScroll} onKeyDown={key}>
        {list.map((q, i) => {
          const src = mediaUrl(q.cover)
          const on = i === at
          return (
            <button
              key={q.id}
              type="button"
              data-s2-cover={q.id}
              className={'s2r-cover' + (on ? ' on' : '')}
              style={{ ['--i' as string]: i, viewTransitionName: on && !hidden ? 's2r-art' : undefined } as CSSProperties}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              onClick={() => onOpen(i)}
              aria-label={`${q.title}, ${priceText(q)}. View product`}
            >
              {src ? <img src={src} alt="" draggable={false} /> : <b>{q.title.charAt(0).toUpperCase() || '✦'}</b>}
            </button>
          )
        })}
      </div>
      <div className="s2r-caption" aria-live="polite">
        <p className="s2r-count">{list.length > 1 ? `${String(at + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` : 'Featured'}</p>
        <h1 className="s2r-title">{p.title}</h1>
        <p className="s2r-price">{priceText(p)}</p>
        <button type="button" className="s2r-btn s2r-btn-line" onClick={() => onOpen(at)}>View product</button>
      </div>
    </section>
  )
}

/** The selling view: the cover over its scene, a white detail panel, arrows/swipe between products. */
function Detail({ list, i, setI, onClose, canClose, ...props }: { list: ShopProduct[]; i: number; setI: (i: number) => void; onClose: () => void; canClose: boolean } & StorePageProps) {
  const p = list[i]
  const many = list.length > 1
  const ref = useRef<HTMLDivElement>(null)
  const go = useCallback((d: number) => { if (many) setI((i + d + list.length) % list.length) }, [i, many, list.length, setI])
  const start = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => { ref.current?.querySelector<HTMLElement>('.s2r-d-close, .s2r-d-panel h2')?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (document.querySelector('.co-back')) return // checkout is open on top
      if (e.key === 'Escape' && canClose) onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Tab' && ref.current) { // keep focus inside the dialog
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [go, onClose, canClose])

  const onDown = (e: ReactPointerEvent) => { if (many && !(e.target as HTMLElement).closest('button, a')) start.current = { x: e.clientX, y: e.clientY } }
  const onUp = (e: ReactPointerEvent) => {
    const s = start.current; start.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1)
  }
  const src = mediaUrl(p.cover)
  const scene = sceneFor(p)
  const link = props.live ? `/${props.handle}/p/${p.id}` : undefined

  return (
    <div className="s2r-detail" role="dialog" aria-modal="true" aria-label={p.title} ref={ref} data-product={p.id} data-scene={scene}>
      <div className="s2r-d-stage" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { start.current = null }}>
        <div className="s2r-scenes" aria-hidden="true">
          {SCENE_ORDER.map((id) => <img key={id} src={SCENES[id].src} alt="" className={id === scene ? 'on' : ''} draggable={false} decoding="async" />)}
        </div>
        <div className="s2r-d-art" key={p.id} style={{ viewTransitionName: 's2r-art' } as CSSProperties}>
          {src ? <img src={src} alt={p.title} draggable={false} /> : <b>{p.title.charAt(0).toUpperCase() || '✦'}</b>}
        </div>
        {many && (
          <div className="s2r-d-nav">
            <button type="button" onClick={() => go(-1)} aria-label="Previous product">←</button>
            <span>{i + 1} / {list.length}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next product">→</button>
          </div>
        )}
      </div>
      <aside className="s2r-d-panel" key={'panel-' + p.id}>
        {canClose && <button type="button" className="s2r-d-close" onClick={onClose} aria-label="Close and return to the shop">✕</button>}
        <h2 tabIndex={-1}>{link ? <a href={link}>{p.title}</a> : p.title}</h2>
        <p className="s2r-d-kicker">{fileType(p)}</p>
        {p.rating && p.rating.count > 0 && <p className="s2r-d-rating">★ {p.rating.average.toFixed(1)} <span>({p.rating.count} {p.rating.count === 1 ? 'review' : 'reviews'})</span></p>}
        <Buy p={p} {...props} />
        {p.description && <div className="s2r-d-desc">{p.description.split('\n').filter(Boolean).map((l, k) => <p key={k}>{l}</p>)}</div>}
      </aside>
    </div>
  )
}

/** Price + one primary action, using the store's existing purchase flow (paid, free, owned, affiliate). */
function Buy({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const free = isFreeProduct(p)
  const external = affiliateHref(p)
  if (external) {
    return (
      <div className="s2r-buy">
        <span className="s2r-buy-price"><small title={p.affiliate?.disclosure || 'As an Amazon Associate, I earn from qualifying purchases.'}>Paid link</small></span>
        <a className="s2r-btn" href={external} target="_blank" rel="sponsored noopener noreferrer" onClick={props.live ? undefined : (e) => e.preventDefault()}>
          {p.cta?.text && !/amazon/i.test(p.cta.text) ? p.cta.text : 'View on Amazon'}
        </a>
      </div>
    )
  }
  if (props.live && props.owned?.[p.id] && p.priceMinor > 0) {
    return (
      <div className="s2r-buy">
        <span className="s2r-buy-price">Purchased</span>
        {props.onDownload
          ? <button type="button" className="s2r-btn" onClick={() => props.onDownload!(p)} disabled={props.downloading === p.id}>{props.downloading === p.id ? 'Starting…' : 'Download'}</button>
          : <a className="s2r-btn" href={props.owned[p.id]}>Download</a>}
      </div>
    )
  }
  const disabled = free ? !props.live || props.buying === p.id : !props.live || !props.checkoutReady || props.buying === p.id
  return (
    <div className="s2r-buy">
      <span className="s2r-buy-price">{free ? 'Free' : <PriceTag prod={p} />}</span>
      <button type="button" className="s2r-btn" data-product={p.id} disabled={disabled} onClick={() => (free && props.claims?.[p.id] ? props.onClaimAgain?.(p) : props.onBuy?.(p))}>
        {props.buying === p.id ? 'Opening checkout…' : free && props.claims?.[p.id] ? 'Send again' : (free ? (p.cta?.text && !/^\s*buy/i.test(p.cta.text) ? p.cta.text : 'Get it free') : (p.cta?.text || 'Buy now'))}
      </button>
    </div>
  )
}
