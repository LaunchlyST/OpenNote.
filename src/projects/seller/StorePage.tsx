import { useEffect, useRef, useState } from 'react'

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { AtSign, ChevronDown, Globe, MoreVertical, Play, X as XIcon } from 'lucide-react'
import { FONTS, PRESETS, affiliateHref, amazonUrlCheck, DEFAULT_AFFILIATE_DISCLOSURE, DEFAULT_AMAZON_CTA, ensureFonts, fontById, formatPrice, isFreeProduct, mediaUrl, pageLabel, safeExternalUrl, slidesOf, storePages, MAX_PRODUCT_SLIDES } from './model'
import type { Block, CardPart, Page, ProductSlide, ShopProduct } from './model'
import { Badges, FactLine, Gallery, ProductCard, wasTextDragged } from './ProductCard'

/**
 * The storefront. The editor's mobile and desktop previews and the public
 * page at /store/<handle> all render this component, so what the seller sees
 * is what a buyer gets.
 */
export interface StorePageProps {
  page: Page
  products: ShopProduct[]
  handle: string
  /** Live page: product cards link to their own pages and Buy now works. */
  live?: boolean
  checkoutReady?: boolean
  onBuy?: (p: ShopProduct) => void
  buying?: string | null
  /** Only one product (the product page). */
  only?: ShopProduct
  /**
   * Editor preview: clicking a section selects it for editing. When the click
   * lands on a product card, its product id comes along so the product editor
   * can open instead of the page section; `part` says which part of the card
   * (cover, title, description, button or the card itself) was clicked.
   */
  onPick?: (blockId: string, el: HTMLElement, productId?: string, part?: CardPart) => void
  /**
   * Editor preview: right-click (or the ⋯ menu button) on a section or product.
   * `hit.self` means the section's own background was hit rather than a child.
   */
  onContextMenu?: (hit: ShopHit, at: { x: number; y: number }) => void
  picked?: string | null
  /** Editor preview: which card part is selected, so it stays highlighted. */
  editCard?: { productId: string | null; part: CardPart | null } | null
  /** Editor: typing into the selected title/description on the card. */
  onCardText?: (productId: string, field: 'title' | 'desc', value: string) => void
  /** Editor preview: pressing the grip starts dragging that section. */
  onGrab?: (blockId: string, e: ReactPointerEvent) => void
  /** Live store: products this browser has paid for (product id → order page with the download). */
  owned?: Record<string, string>
  /**
   * Live store: free products this browser has already asked for (product id → resend state).
   * Free products never show Download here: the file only comes from the emailed link.
   */
  claims?: Record<string, { waitSeconds: number; email: string }>
  /** Live store: reopen the email form for a free product, with the address it was sent to prefilled. */
  onClaimAgain?: (p: ShopProduct) => void
  /** Live store: start the download of a bought product right here (no page change). */
  onDownload?: (p: ShopProduct) => void
  downloading?: string | null
  /** Live store: open a product in the detail panel instead of leaving the page. */
  onOpenProduct?: (p: ShopProduct) => void
  /** Live store: saved products and the toggle. */
  savedIds?: string[]
  onToggleSave?: (p: ShopProduct) => void
  /**
   * Which store page is open (Home = 0). The editor controls it; a visitor
   * starts on Home and switches with the tabs under the profile.
   */
  pageIndex?: number
  onPageChange?: (index: number) => void
  /** Editor: choose or add the product for an empty product block. */
  onAddSlide?: (blockId: string) => void
  /**
   * Editor: add a product to slide `slideIndex` of the product block `blockId`
   * (an empty slide in a carousel). Opens the product picker; the chosen product
   * lands in that slide without touching the others.
   */
  onAddSlideProduct?: (blockId: string, slideIndex: number) => void
  /**
   * Editor: which slide of the focused product block is currently selected, so the
   * phone preview scrolls to it and stays in sync with the left-hand editor.
   */
  activeSlide?: number
  /** Editor: the block `activeSlide` belongs to, so each carousel keeps its own position. */
  activeSlideBlock?: string | null
  /** Editor: called when the owner swipes/clicks to a different slide in the phone preview. */
  onSlideChange?: (blockId: string, slideIndex: number) => void
  /**
   * Editor: double-tapping a store page tab (Page 2 and Page 3) hides that page.
   * Hidden pages leave the tab row and the content, so the preview only shows
   * what should be shown. Home (0) is never hidden.
   */
  onHide?: (i: number) => void
  /**
   * Editor: store pages the owner hid (Page 2 and Page 3). Hidden pages leave
   * the tab row and the content, so the preview only shows what should be shown.
   * Home (0) is never hidden.
   */
  hiddenPages?: number[]
}

/** The per-element look as inline style: alignment, size, colour, spacing, font. */
export function lookStyle(look: Block['look']): CSSProperties | undefined {
  if (!look) return undefined
  const size = { s: 0.88, m: 1, l: 1.15, xl: 1.32 }[look.size ?? 'm']
  const space = { tight: '2px', normal: '', roomy: '22px' }[look.space ?? 'normal']
  return {
    ...(look.align ? { textAlign: look.align } : {}),
    ...(size !== 1 ? { fontSize: `${size}em`, ['--sz' as string]: size } : {}),
    ...(look.color ? { color: look.color } : {}),
    ...(space ? { paddingBlock: space } : {}),
    ...(look.font ? { fontFamily: fontById(look.font)?.css } : {}),
  } as CSSProperties
}

/** What a right-click in the owner's preview landed on. */
export type ShopHit = {
  blockId: string
  /** Set when the click was inside a product card. */
  productId?: string
  part?: CardPart
  /** Human name of the section or product, for the menu and the confirmation. */
  label: string
  /** True when the section's own background was hit, not one of its children. */
  self: boolean
}

/** Timestamp of the last carousel swipe, so a click after a drag doesn't open anything. */
const lastSwipeAt = { current: 0 }

/** In the editor preview, each section is clickable and shows an outline with its name. */
function Pickable({ block, onPick, picked, onGrab, onContextMenu, children }: { block: Block; onPick?: StorePageProps['onPick']; picked?: string | null; onGrab?: StorePageProps['onGrab']; onContextMenu?: StorePageProps['onContextMenu']; children: ReactNode }) {
  const style = lookStyle(block.look)
  const label = PICK_LABEL[block.type] ?? block.type
  // the profile header (photo, name, @username) comes from TikTok and isn't editable here
  if ((!onPick && !onContextMenu) || block.type === 'header') return style ? <div className="sp-look" style={style}>{children}</div> : <>{children}</>
  return (
    <div
      className={picked === block.id ? 'sp-pick on' : 'sp-pick'}
      data-id={block.id}
      data-label={label}
      style={style}
      onContextMenu={onContextMenu ? (e) => {
        if ((e.target as HTMLElement).closest('.sp-grip, .sp-menu-btn, .sp-card-menu')) return
        e.preventDefault()
        e.stopPropagation()
        const target = e.target as HTMLElement
        const card = target.closest<HTMLElement>('[data-product-id]')
        const productId = card?.dataset.productId
        onContextMenu(
          {
            blockId: block.id,
            productId,
            part: target.closest<HTMLElement>('[data-edit-part]')?.dataset.editPart as CardPart | undefined,
            label: productId ? (card?.querySelector('h3')?.textContent?.trim() || 'Product') : label,
            self: !productId && target === e.currentTarget,
          },
          { x: e.clientX, y: e.clientY },
        )
      } : undefined}
      onClickCapture={(e) => {
        if (!onPick) return
        if ((e.target as HTMLElement).closest('.sp-grip, .sp-menu-btn, .sp-card-menu')) return
        // the empty "add product" placeholder opens the picker itself
        if ((e.target as HTMLElement).closest('.sp-slide-empty')) return
        // the carousel's own controls (previous / next arrows, dots) navigate the
        // slides instead of opening the block — let their click through
        if ((e.target as HTMLElement).closest('.sp-car-nav')) return
        e.preventDefault()
        e.stopPropagation()
        // dragging the title or description sideways is not a click on it
        if (wasTextDragged()) return
        // a swipe that just moved the carousel must not open the block or a product
        if (performance.now() - lastSwipeAt.current < 260) return
        // a product card inside the section opens that product, not the section
        const target = e.target as HTMLElement
        const hit = target.closest<HTMLElement>('[data-product-id]')
        const part = target.closest<HTMLElement>('[data-edit-part]')?.dataset.editPart as CardPart | undefined
        onPick(block.id, e.currentTarget, hit?.dataset.productId, part)
      }}
    >
      {onGrab && (
        <button type="button" className="sp-grip" aria-label={`Drag ${label} to move it`} onPointerDown={(e) => (e.stopPropagation(), onGrab(block.id, e))}>
          ⋮⋮
        </button>
      )}
      {onContextMenu && (
        <button
          type="button"
          className="sp-menu-btn"
          aria-label={`More for ${label}`}
          aria-haspopup="menu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            onContextMenu({ blockId: block.id, label, self: true }, { x: r.right, y: r.bottom })
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  )
}
const PICK_LABEL: Record<string, string> = { header: 'Profile', hero: 'Welcome intro', text: 'Text', image: 'Image', links: 'Links', featured: 'Digital product', grid: 'Product collection', faq: 'FAQ', tiktok: 'TikTok videos', email: 'Email support', divider: 'Divider', footer: 'Footer' }

/**
 * A store left on the default black accent gets its own colour, picked from
 * its name, so no two new stores look alike. Choosing an accent overrides it.
 */
const AUTO_ACCENTS = ['#6d4aff', '#ff5a3c', '#0f9f9a', '#2563eb', '#db2777', '#d97706', '#16a34a', '#7c3aed']
export function accentOf(page: Page): string {
  if (page.theme.preset !== 'clean' || page.theme.accent.toLowerCase() !== '#111114') return page.theme.accent
  let h = 0
  for (const ch of page.name || 'store') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AUTO_ACCENTS[h % AUTO_ACCENTS.length]
}

export function storeStyle(page: Page): CSSProperties {
  const preset = PRESETS.find((p) => p.id === page.theme.preset) ?? PRESETS[0]
  const font = fontById(page.theme.font)?.css ?? FONTS[0].css
  const radius = page.theme.button === 'pill' ? 999 : page.theme.button === 'sharp' ? 4 : 12
  const bg =
    page.theme.background === 'gradient'
      ? `linear-gradient(180deg, ${preset.bg} 0%, color-mix(in srgb, ${accentOf(page)} 22%, ${preset.bg}) 100%)`
      : preset.bg
  return { background: bg, color: preset.ink, fontFamily: font, '--ac': accentOf(page), '--on': preset.bg, '--r': `${radius}px`, '--bg': preset.bg, '--fg': preset.ink } as CSSProperties
}

export function StorePage(props: StorePageProps) {
  const { page, only, live } = props
  // Home is `page.blocks`; Page 2 and Page 3 sit beside it. Visitors only get
  // pages with something in them, while the editor shows every page it created
  // so the seller can build an empty one.
  const all = storePages(page)
  const tabs: typeof all = []
  const index = 0
  const current = all[0]
  const select = (_i: number) => {}
  // the store font and any per-block font must be downloaded before they render
  useEffect(() => { ensureFonts([page.theme.font, ...storePages(page).flatMap((pg) => pg.blocks.map((b) => b.look?.font))]) }, [page])
  const head = page.blocks.find((b) => b.type === 'header')
  const foot = page.blocks.find((b) => b.type === 'footer')
  const body = current.blocks.filter((b) => !b.hidden && b.type !== 'header' && b.type !== 'footer')
  return (
    <div className="sp" style={storeStyle(page)}>
      {only ? (
        <>
          <Header page={page} handle={props.handle} showSocials={false} compact />
          <ProductDetail p={only} {...props} />
        </>
      ) : (
        <>
          {/* The profile (with its banner) is shared by every page and rendered once. */}
          <Pickable block={head ?? { id: 'header', type: 'header', hidden: false, data: {} }} onPick={props.onPick} picked={props.picked} onGrab={props.onGrab}>
            <Header page={page} handle={props.handle} showSocials={head?.data?.showSocials !== false} />
          </Pickable>
          {tabs.length > 1 && <PageTabs tabs={tabs.map((t) => t.index)} index={index} onSelect={select} onHide={props.onHide} />}
          <div className="sp-page-panel" id="sp-page-panel" role="tabpanel" aria-labelledby={`sp-page-${index}`}>
            {body.map((b) => (
              <Pickable key={b.id} block={b} onPick={props.onPick} picked={props.picked} onGrab={props.onGrab} onContextMenu={props.onContextMenu}><BlockView block={b} {...props} /></Pickable>
            ))}
            {!body.length && !live && props.onAddSlide && (
              <div className="sp-block sp-drop sp-drop-page">
                <span className="sp-drop-ico" aria-hidden="true">＋</span>
                <b>This page is empty</b>
                <p>Add a product, or drag one in from the left.</p>
              </div>
            )}
          </div>
        </>
      )}
      {/* Pinned to the bottom, centred: the store's footer line, then desknoty.com */}
      <div className="sp-end">
        {!only && <BlockView block={foot ?? { id: 'footer', type: 'footer', hidden: false, data: { text: '' } }} {...props} />}
        <a className="sp-made" href="https://desknoty.com" target="_blank" rel="noopener">desknoty.com</a>
      </div>
    </div>
  )
}

/**
 * Store pages under the banner. Buttons, not a scrolling strip of links: arrow
 * keys move between them and only the open page is in the tab order.
 */
function PageTabs({ tabs, index, onSelect, onHide }: { tabs: number[]; index: number; onSelect: (i: number) => void; onHide?: (i: number) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const at = Math.max(0, tabs.indexOf(index))
  const lastTap = useRef<{ t: number; n: number } | null>(null)
  const key = (e: ReactKeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (at + dir + tabs.length) % tabs.length
    onSelect(tabs[next])
    refs.current[next]?.focus()
  }
  const tap = (n: number) => {
    const now = Date.now()
    const last = lastTap.current
    // a double tap (two quick taps, or a double click) hides that page
    if (last && now - last.t < 280 && last.n === n) { lastTap.current = null; onHide?.(n); return }
    lastTap.current = { t: now, n }
    onSelect(n)
  }
  return (
    <nav className="sp-pages" role="tablist" aria-label="Store pages" onKeyDown={key}>
      {tabs.map((n, i) => (
        <button
          key={n}
          ref={(el) => { refs.current[i] = el }}
          type="button"
          role="tab"
          id={`sp-page-${n}`}
          aria-selected={n === index}
          aria-controls="sp-page-panel"
          tabIndex={n === index ? 0 : -1}
          className={n === index ? 'sp-tab on' : 'sp-tab'}
          onClick={() => tap(n)}
        >
          {pageLabel(n)}
        </button>
      ))}
    </nav>
  )
}

/** The banner behind the profile. Tap it: a video plays once and stops; an image does a short zoom and settles. */
function Banner({ banner }: { banner: NonNullable<Page['banner']> }) {
  const src = mediaUrl(banner.media)
  const [play, setPlay] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const go = () => {
    if (banner.kind === 'video' && video.current) {
      video.current.currentTime = 0
      void video.current.play().catch(() => {})
    } else setPlay((n) => n + 1)
  }
  return (
    <button type="button" className="sp-banner" onClick={go} aria-label="Play the banner">
      {banner.kind === 'video' ? (
        <video ref={video} src={src ?? undefined} muted playsInline preload="metadata" onEnded={(e) => e.currentTarget.pause()} />
      ) : (
        <span key={play} className={play ? 'sp-banner-img sp-banner-go' : 'sp-banner-img'} style={{ backgroundImage: `url(${src})` }} />
      )}
      <span className="sp-banner-hint" aria-hidden="true">▶</span>
    </button>
  )
}

function Header({ page, handle, showSocials, compact = false }: { page: Page; handle: string; showSocials: boolean; compact?: boolean }) {
  const socials = [
    { k: 'instagram', label: 'Instagram', icon: <AtSign className="h-4 w-4" /> },
    { k: 'youtube', label: 'YouTube', icon: <Play className="h-4 w-4" /> },
    { k: 'x', label: 'X', icon: <XIcon className="h-4 w-4" /> },
    { k: 'website', label: 'Website', icon: <Globe className="h-4 w-4" /> },
  ].filter((s) => page.socials[s.k as keyof Page['socials']]?.trim())
  const avatar = mediaUrl(page.avatar)
  return (
    <header className={compact ? 'sp-head sp-head-compact' : page.banner && !compact ? 'sp-head sp-head-banner' : 'sp-head'}>
      <div className="sp-head-id">
        {page.banner && !compact && <Banner banner={page.banner} />}
        <span className="sp-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : { background: 'var(--ac)', color: 'var(--on)' }}>
          {!avatar && (page.name.trim().charAt(0).toUpperCase() || handle.charAt(0).toUpperCase())}
        </span>
        <h1 className="sp-name">{page.name || handle}</h1>
        <p className="sp-handle">@{handle}</p>
      </div>
      {!compact && page.bio && <p className="sp-bio">{page.bio}</p>}
      {showSocials && socials.length > 0 && (
        <div className="sp-socials">
          {socials.map((s) => (
            <a key={s.k} href={page.socials[s.k as keyof Page['socials']]} target="_blank" rel="noopener noreferrer nofollow" aria-label={s.label}>
              {s.icon}
            </a>
          ))}
        </div>
      )}
    </header>
  )
}

function BlockView({ block, ...p }: { block: Block } & StorePageProps) {
  const d = block.data
  switch (block.type) {
    case 'header':
      return <Header page={p.page} handle={p.handle} showSocials={d.showSocials !== false} />
    case 'hero': {
      const src = mediaUrl(d.media)
      const first = p.products[0]
      return (
        <section className="sp-block sp-hero">
          <div className="sp-hero-text">
            <h2>{d.eyebrow || 'Welcome to my store 👋'}</h2>
            <p className="sp-hero-user">{d.title || `@${p.handle}`}</p>
            <p>{d.body || 'Discover digital products designed to help you create, learn, and grow.'}</p>
            {d.button && <a className="sp-btn" href="#shop" onClick={(e) => (e.preventDefault(), document.querySelector('.sp .sp-grid-wrap, .sp .sp-featured')?.scrollIntoView({ behavior: 'smooth' }))}>{d.button}</a>}
          </div>
          <div className="sp-hero-art" style={src ? { backgroundImage: `url(${src})` } : first?.cover ? { backgroundImage: `url(${mediaUrl(first.cover)})` } : undefined}>
            {!src && !first?.cover && <span>{p.live ? '✦' : 'Your image'}</span>}
          </div>
        </section>
      )
    }
    case 'divider':
      return <div className={`sp-block sp-divider sp-divider-${d.style || 'line'}`} role="separator" />
    case 'tiktok': {
      const vids: string[] = (d.videos ?? []).filter(Boolean)
      return (
        <section className="sp-block sp-tiktok">
          {d.heading && <h2 className="sp-h2">{d.heading}</h2>}
          {vids.length ? (
            <div className="sp-tt-grid">{vids.map((u) => <TikTokCard key={u} url={u} live={p.live} />)}</div>
          ) : p.live ? null : (
            <div className="sp-empty">TikTok videos: paste a video link</div>
          )}
        </section>
      )
    }
    case 'email':
      return d.email || !p.live ? (
        <section className="sp-block sp-email">
          {d.heading && <h2>{d.heading}</h2>}
          {d.note && <p>{d.note}</p>}
          <a className="sp-btn" href={d.email ? `mailto:${d.email}` : undefined}>{d.button || 'Email support'}</a>
          {!d.email && !p.live && <small className="sp-empty-note">Add your email address</small>}
        </section>
      ) : null
    case 'text':
      return (
        <section className="sp-block sp-text">
          {d.heading && <h2>{d.heading}</h2>}
          {String(d.body ?? '')
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
        </section>
      )
    case 'image': {
      const src = mediaUrl(d.media)
      return src ? (
        <figure className="sp-block sp-image">
          <img src={src} alt={d.alt ?? ''} loading="lazy" />
          {d.caption && <figcaption>{d.caption}</figcaption>}
        </figure>
      ) : p.live ? null : (
        <div className="sp-block sp-empty">Image block: upload a picture</div>
      )
    }
    case 'links': {
      const links = (d.links ?? []).filter((l: { label: string; url: string }) => l.label && l.url)
      return links.length ? (
        <nav className="sp-block sp-links">
          {links.map((l: { label: string; url: string }, i: number) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="sp-btn sp-btn-line">
              {l.label}
            </a>
          ))}
        </nav>
      ) : p.live ? null : (
        <div className="sp-block sp-empty">Links block: add a link</div>
      )
    }
    case 'featured': {
      // One product, or a swipeable carousel of slides (digital or affiliate).
      // Either way it is ONE product block on the page. In the editor every slide
      // is shown (an empty one waits to be filled); on the public store only the
      // populated slides are.
      const slides = slidesOf(block)
      const usable = slides.filter((s) => (s.kind === 'digital' ? p.products.some((x) => x.id === s.productId) : amazonUrlCheck(s.affiliate.url).ok))
      const shown = p.live ? usable : slides
      // Zero products: the empty state straight away (Studio: the add picker).
      if (!shown.length) {
        if (!p.onAddSlideProduct && p.onAddSlide && !p.live) return <ComingSoon onAdd={() => p.onAddSlide?.(block.id)} />
        return <SlideCarousel {...p} slides={[]} withEnd blockId={block.id} interactive={!p.live} activeSlide={p.activeSlideBlock === block.id ? p.activeSlide : undefined} onCarouselSlideChange={(i) => p.onSlideChange?.(block.id, i)} />
      }
      // Real products, then exactly one "Coming soon" card at the end.
      return <SlideCarousel {...p} slides={shown} withEnd blockId={block.id} interactive={!p.live} activeSlide={p.activeSlideBlock === block.id ? p.activeSlide : undefined} onCarouselSlideChange={(i) => p.onSlideChange?.(block.id, i)} />
    }
    case 'grid': {
      const ids: string[] = d.productIds ?? []
      const picked = ids.map((id) => p.products.find((x) => x.id === id)).filter((x): x is ShopProduct => Boolean(x))
      // Nothing picked yet: show every product on sale rather than an empty shop.
      const list = picked.length ? picked : p.products.filter((x) => !x.hidden)
      if (list.length === 0)
        return p.live ? (
          <ComingSoon />
        ) : (
          <div className="sp-block sp-empty">Product grid: add products to show them here</div>
        )
      return (
        <section className="sp-block sp-grid-wrap">
          {d.heading && <h2 className="sp-h2">{d.heading}</h2>}
          {(
            <div className="sp-grid">
              {list.map((prod) => (
                <ProductCard key={prod.id} p={prod} href={p.live ? `/${p.handle}/p/${prod.id}` : undefined} onOpen={p.live ? p.onOpenProduct : undefined} buy={<BuyRow prod={prod} {...p} small={(prod.layout ?? 'compact') === 'compact'} />} saved={p.savedIds?.includes(prod.id)} onToggleSave={p.onToggleSave ? () => p.onToggleSave!(prod) : undefined} edit={cardEdit(p, prod.id, prod.title, block.id)} />
              ))}
            </div>
          )}
        </section>
      )
    }
    case 'faq':
      return <Faq heading={d.heading} items={d.items ?? []} />
    case 'footer':
      return <footer className="sp-block sp-foot">{d.text || `© ${p.page.name || p.handle}`}</footer>
  }
}

/** Editor: every card is marked editable; the picked part stays highlighted. */
function cardEdit(p: StorePageProps, id: string, title?: string, blockId?: string) {
  if (!p.editCard) return undefined
  return {
    part: p.editCard.productId === id ? p.editCard.part : null,
    onText: p.onCardText ? (field: 'title' | 'desc', value: string) => p.onCardText!(id, field, value) : undefined,
    // The card's ⋯ button (the touch-friendly twin of right-click).
    onMenu: p.onContextMenu
      ? (e: ReactMouseEvent<HTMLButtonElement>) => {
          const r = e.currentTarget.getBoundingClientRect()
          p.onContextMenu!({ blockId: blockId ?? '', productId: id, label: title?.trim() || 'Product', self: false }, { x: r.right, y: r.bottom })
        }
      : undefined,
  }
}

/** One digital product in a product block: cover, title, price and Buy/Get it free. */
function DigitalSlide({ slide, blockId, ...p }: { slide: ProductSlide; blockId?: string } & StorePageProps) {
  const prod = p.products.find((x) => x.id === slide.productId)
  if (!prod) return null
  return (
    <ProductCard
      p={prod}
      layout="featured"
      href={p.live ? `/${p.handle}/p/${prod.id}` : undefined}
      onOpen={p.live ? p.onOpenProduct : undefined}
      buy={<BuyRow prod={prod} {...p} />}
      saved={p.savedIds?.includes(prod.id)}
      onToggleSave={p.onToggleSave ? () => p.onToggleSave!(prod) : undefined}
      edit={cardEdit(p, prod.id, prod.title, blockId)}
    />
  )
}

/**
 * An affiliate slide: a link off Desknoty, never a sale here. No price, Buy
 * button, file or checkout is rendered, the cover and the optional button open
 * the partner site in a new tab, and the destination keeps its tracking params.
 */
function AffiliateSlide({ slide, live }: { slide: ProductSlide } & StorePageProps) {
  const a = slide.affiliate
  const checked = amazonUrlCheck(a.url)
  const href = checked.ok ? checked.url : null
  const cover = mediaUrl(a.cover)
  if (!href) return null
  return (
    <article className="sp-aff">
      <a
        className="sp-aff-cover"
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        aria-label={a.title ? `${a.title} (opens the seller’s partner site)` : 'Open the affiliate product in a new tab'}
        onClick={live ? undefined : (e) => e.preventDefault()}
      >
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="sp-aff-blank" aria-hidden="true">↗</span>}
      </a>
      <div className="sp-aff-body">
        <span className="sp-aff-tag">Affiliate</span>
        {a.title && <h3>{a.title}</h3>}
        {a.description && <p>{a.description}</p>}
        {(live
          ? <a className="sp-btn sp-btn-sm sp-aff-cta" href={href} target="_blank" rel="sponsored noopener noreferrer">{a.cta || DEFAULT_AMAZON_CTA}</a>
          : <span className="sp-btn sp-btn-sm sp-aff-cta">{a.cta || DEFAULT_AMAZON_CTA}</span>)}
        <p className="sp-aff-note">As an Amazon Associate, I earn from qualifying purchases. Payment and delivery happen on Amazon.</p>
      </div>
    </article>
  )
}

/**
 * A product block holding several slides. Mobile swipes, desktop arrows and
 * dots; no autoplay, and a drag never counts as a tap on a product. In the
 * editor an empty slide shows the "Add product slide" action; on the public
 * store only populated slides are shown.
 */
function SlideCarousel({ slides, withEnd, blockId, interactive, activeSlide, onCarouselSlideChange, ...p }: { slides: ProductSlide[]; withEnd?: boolean; blockId?: string; interactive?: boolean; activeSlide?: number; onCarouselSlideChange?: (i: number) => void } & StorePageProps) {
  // Every swipe shows at least three pages: real products, then Coming soon
  // cards fill the rest (at least one, always after the last product).
  const ends = withEnd ? Math.max(1, 3 - slides.length) : 0
  const count = slides.length + ends
  // One slide step = the slide's width plus the track's gap. Using the width
  // alone drifts by the gap on every slide and leaves a card cut off.
  const stepOf = (el: HTMLElement) => Math.max(1, el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0))
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(() => Math.min(count - 1, Math.max(0, activeSlide ?? 0)))
  const scrolledAt = useRef(0)
  const lastScrollLeft = useRef<number | null>(null)
  const mountedAt = useRef(performance.now())
  // The studio owns `activeSlide`: use it directly whenever it is supplied so
  // the preview and the left editor can never disagree about the current slide.
  const current = activeSlide !== undefined ? Math.min(count - 1, Math.max(0, activeSlide)) : at
  useEffect(() => {
    if (activeSlide === undefined) return
    const next = Math.min(count - 1, Math.max(0, activeSlide))
    const el = track.current
    if (el && Math.abs(el.scrollLeft - next * stepOf(el)) > 1) {
      // An external slide change is not a swipe: move the track without going
      // through the scroll handler, which would report it back as a new swipe.
      lastScrollLeft.current = next * stepOf(el)
      el.scrollLeft = next * stepOf(el)
    }
    setAt(next)
  }, [activeSlide, count])
  const goTo = (i: number) => {
    const el = track.current
    if (!el) return
    const next = Math.min(count - 1, Math.max(0, i))
    if (Math.abs(el.scrollLeft - next * stepOf(el)) > 1) {
      lastScrollLeft.current = next * stepOf(el)
      el.scrollLeft = next * stepOf(el)
    }
    if (next !== current) {
      setAt(next)
      onCarouselSlideChange?.(next)
    }
  }
  const onScroll = () => {
    const el = track.current
    if (!el) return
    // Only treat it as a swipe when the position actually changed; ignore the
    // initial layout scroll so it can't swallow the first tap.
    if (lastScrollLeft.current === null) { lastScrollLeft.current = el.scrollLeft; return }
    if (el.scrollLeft === lastScrollLeft.current) return
    lastScrollLeft.current = el.scrollLeft
    // Swipe progress towards the teaser (0 = one slide away, 1 = on it).
    if (withEnd) el.style.setProperty('--sw', Math.min(1, Math.max(0, el.scrollLeft / stepOf(el) - (count - 2))).toFixed(3))
    const i = Math.round(el.scrollLeft / stepOf(el))
    if (i !== current) {
      setAt(i)
      onCarouselSlideChange?.(i)
    }
    // Don't let a swipe that just happened swallow the next tap, but ignore
    // scrolls during the first 400ms after mount (initial layout).
    if (performance.now() - mountedAt.current < 400) return
    scrolledAt.current = performance.now()
    lastSwipeAt.current = performance.now()
  }
  // A swipe that just moved the track must not also open a product.
  const swallow = (e: ReactMouseEvent) => {
    if (performance.now() - lastSwipeAt.current < 260) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  const onKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    goTo(e.key === 'ArrowRight' ? current + 1 : current - 1)
  }
  const isEmpty = (s: ProductSlide) => (s.kind === 'digital' ? !p.products.some((x) => x.id === s.productId) : !safeExternalUrl(s.affiliate.url))
  return (
    <section className="sp-block sp-carousel" aria-roledescription="carousel" aria-label={`${count} slides`} tabIndex={interactive ? 0 : undefined} onKeyDown={interactive ? onKey : undefined}>
      <div className="sp-track" ref={track} onScroll={onScroll} onClickCapture={swallow}>
        {slides.map((s, i) => (
          <div className="sp-slide" key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
            {isEmpty(s) ? (
              !p.live && p.onAddSlideProduct && blockId ? (
                <div className="sp-block sp-featured-v2 sp-slide-empty" role="button" tabIndex={0} onClick={() => p.onAddSlideProduct ? p.onAddSlideProduct(blockId, i) : p.onAddSlide?.(blockId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onAddSlideProduct ? p.onAddSlideProduct(blockId, i) : p.onAddSlide?.(blockId) } }}>
                  <button type="button" className="sp-btn sp-btn-sm sp-slide-empty-btn" onClick={(e) => { e.stopPropagation(); p.onAddSlideProduct ? p.onAddSlideProduct(blockId, i) : p.onAddSlide?.(blockId) }}>+ Add product</button>
                </div>
              ) : (
<ComingSoon className="sp-slide-soon" />
              )
            ) : s.kind === 'digital' ? <DigitalSlide slide={s} blockId={blockId} {...p} /> : <AffiliateSlide slide={s} {...p} />}
          </div>
        ))}
        {Array.from({ length: ends }, (_, k) => (
          <div key={`end-${k}`} className="sp-slide" role="group" aria-roledescription="slide" aria-label={`${slides.length + k + 1} of ${count}`}>
            <ComingSoon className="sp-slide-soon" in={current === slides.length + k} onAdd={!p.live && p.onAddSlideProduct && blockId && slides.length < MAX_PRODUCT_SLIDES ? () => p.onAddSlideProduct!(blockId, slides.length) : undefined} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="sp-car-nav">
          <div className="sp-pager" role="tablist" aria-label="Choose a product">
            <button type="button" className="sp-pg-arrow" aria-label="Previous product" disabled={current === 0} onClick={() => goTo(current - 1)}>‹</button>
            {Array.from({ length: count }, (_, i) => i).filter((i) => Math.abs(i - current) <= 2).map((i) => (
              <button key={i} type="button" role="tab" aria-selected={i === current} aria-label={i < slides.length ? `Product ${i + 1}` : `Coming soon (page ${i + 1})`} className={'sp-pg-num' + (i === current ? ' on' : '') + (Math.abs(i - current) === 2 ? ' far' : '')} onClick={() => goTo(i)}>{i + 1}</button>
            ))}
            <button type="button" className="sp-pg-arrow" aria-label="Next product" disabled={current === count - 1} onClick={() => goTo(current + 1)}>›</button>
          </div>
          <label className="sp-pg-select">
            <span>Select page:</span>
            <span className="sp-pg-pick">
              <select value={current} onChange={(e) => goTo(Number(e.target.value))} aria-label="Select page">
                {Array.from({ length: count }, (_, i) => <option key={i} value={i}>{i < slides.length ? i + 1 : `${i + 1} · Coming soon`}</option>)}
              </select>
              <b aria-hidden="true">{current + 1}</b>
              <i aria-hidden="true">⌃</i>
            </span>
          </label>
        </div>
      )}
    </section>
  )
}

/**
 * A product block with nothing in it. The seller gets a drop target; a visitor
 * gets a finished "Coming soon" card with nothing to buy.
 */
/**
 * "Coming soon": the approved teaser artwork, shown as-is (headline, red TV,
 * holographic glass tiles). It fits the card without cropping. When the slide
 * settles into view, one soft glint sweeps across the glass tiles only; the
 * headline and TV never move. No glint with reduced motion.
 */
const SOON_ART = '/coming-soon.webp'
function ComingSoon({ className, in: shown = true, onAdd }: { className?: string; in?: boolean; onAdd?: () => void }) {
  return (
    <section className={'sp-block sp-soon2' + (shown ? ' is-in' : '') + (className ? ' ' + className : '')} aria-label="Coming soon">
      <div className="soon2-frame">
        <div className="soon2-cam">
          <img src={SOON_ART} alt="Coming soon — our next product." width={1774} height={887} decoding="async" draggable={false} />
          {/* The headline is revealed left to right by a dark panel sliding off it, with a glowing edge. */}
          <span className="soon2-head" aria-hidden="true" />
          <span className="soon2-crt" aria-hidden="true" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} className={`soon2-shard d${i}`} aria-hidden="true" />)}
          <span className="soon2-glint" aria-hidden="true" />
        </div>
        <span className="soon2-sweep" aria-hidden="true" />
      </div>
      {onAdd && <button type="button" className="tv-add" onClick={(e) => { e.stopPropagation(); onAdd() }}>+ Add product</button>}
    </section>
  )
}


/** A TikTok video: a poster until tapped, then TikTok's own player (nothing loads from TikTok before that). */
function TikTokCard({ url, live }: { url: string; live?: boolean }) {
  const id = url.match(/\/video\/(\d+)/)?.[1]
  const [on, setOn] = useState(false)
  if (on && id && live) return <iframe className="sp-tt-frame" src={`https://www.tiktok.com/embed/v2/${id}`} title="TikTok video" allow="encrypted-media; fullscreen" allowFullScreen />
  return (
    <button type="button" className="sp-tt-card" onClick={() => (id && live ? setOn(true) : window.open(url, '_blank', 'noopener'))} aria-label="Play TikTok video">
      <span className="sp-tt-play" aria-hidden="true">▶</span>
      <span className="sp-tt-tag">TikTok</span>
    </button>
  )
}


/** Price with a running offer: old price struck through, sale price, savings and (for a real deadline) a countdown.
    In the owner's editor the price carries a marker, so clicking it opens the price settings. */
export function PriceTag({ prod, edit }: { prod: ShopProduct; edit?: boolean }) {
  const mark = edit ? { 'data-edit-part': 'price', 'data-label': 'Price' } : {}
  if (!prod.offer) return <span className={edit ? 'sp-price sp-part' : 'sp-price'} {...mark}>{formatPrice(prod.priceMinor, prod.currency)}</span>
  const saved = prod.offer.savedMinor ?? prod.priceMinor - prod.offer.priceMinor
  return (
    <span className={edit ? 'sp-price sp-price-sale sp-part' : 'sp-price sp-price-sale'} {...mark}>
      <s aria-label={`Was ${formatPrice(prod.priceMinor, prod.currency)}`}>{formatPrice(prod.priceMinor, prod.currency)}</s>
      <b>{formatPrice(prod.offer.priceMinor, prod.currency)}</b>
      <em className="sp-badge" style={{ background: prod.offer.badgeColor }}>{prod.offer.badge}</em>
      {saved > 0 && <small className="sp-save">Save {formatPrice(saved, prod.currency)}</small>}
      {prod.offer.countdown && prod.offer.endsAt && <Countdown endsAt={prod.offer.endsAt} />}
    </span>
  )
}

/** Time left on a genuine scheduled offer. Hides itself when the offer ends (the server stops applying it then too). */
function Countdown({ endsAt }: { endsAt: string }) {
  const end = Date.parse(endsAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = end - now
  if (!Number.isFinite(end) || left <= 0) return null
  const d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24, m = Math.floor(left / 60000) % 60, sec = Math.floor(left / 1000) % 60
  const text = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return <small className="sp-countdown" role="timer" aria-label={`Offer ends in ${text}`}>Ends in {text}</small>
}
export const ctaStyle = (prod: ShopProduct): CSSProperties | undefined => (prod.cta?.color ? { background: prod.cta.color, borderColor: prod.cta.color, color: '#fff' } : undefined)

export function BuyRow({ prod, live, checkoutReady, onBuy, buying, small, owned, claims, onClaimAgain, onDownload, downloading }: { prod: ShopProduct; small?: boolean } & StorePageProps) {
  const disabled = !live || !checkoutReady || buying === prod.id
  // Affiliate / external mode: the product is bought on the partner's site, never
  // here. No price, checkout or download is shown; the link keeps its tracking params.
  const affiliate = prod.affiliate
  // New affiliate products are Amazon-only. Old data without an explicit type
  // keeps its original external URL so existing stores and orders still work.
  const external = affiliateHref(prod)
  if (external) {
    return (
      <div className="sp-buyrow sp-aff-row">
        <span className="sp-aff-tag">Affiliate</span>
        <a
          className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'}
          style={ctaStyle(prod)}
          href={external}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={live ? undefined : (e) => e.preventDefault()}
        >
          {prod.productType === 'affiliate' ? (affiliate?.cta || DEFAULT_AMAZON_CTA) : (prod.cta?.text || 'View product ↗')}
        </a>
        <small className="sp-aff-note">{affiliate?.disclosure || DEFAULT_AFFILIATE_DISCLOSURE}</small>
      </div>
    )
  }
  // Already bought in this browser (the server confirmed the payment): Download instead of Buy now.
  // Free products never reach this branch: their file is only ever downloaded from the emailed link.
  if (live && owned?.[prod.id] && prod.priceMinor > 0)
    return (
      <div className="sp-buyrow">
        <span className="sp-price sp-owned">Purchased</span>
        {onDownload ? (
          <button type="button" className={small ? 'sp-btn sp-btn-sm sp-dl' : 'sp-btn sp-dl'} onClick={() => onDownload(prod)} disabled={downloading === prod.id}>
            {downloading === prod.id ? 'Starting…' : 'Download'}
          </button>
        ) : (
          <a className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} href={owned[prod.id]}>Download</a>
        )}
      </div>
    )
  if (prod.bundle && !prod.bundle.available)
    return (
      <div className="sp-buyrow">
        <PriceTag prod={prod} edit={!live} />
        <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} disabled title="One of this bundle’s products isn’t available">Unavailable</button>
      </div>
    )
  // The seller's explicit Free/Paid choice decides this, never a half-typed 0.
  if (isFreeProduct(prod)) {
    // This browser already asked for it: "Send again" reopens the form (the address prefilled),
    // and the button shows the server's resend cooldown while it runs. No link is ever shown here.
    const claim = live ? claims?.[prod.id] : undefined
    const label = buying === prod.id
      ? 'Getting it…'
      : claim
        ? (claim.waitSeconds > 0 ? `Send again (${claim.waitSeconds}s)` : 'Send again')
        : prod.cta?.text || 'Get it free'
    return (
      <div className="sp-buyrow">
        <span className={live ? 'sp-price' : 'sp-price sp-part'} {...(live ? {} : { 'data-edit-part': 'price', 'data-label': 'Price' })}>Free</span>
        <button
          type="button"
          className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'}
          style={ctaStyle(prod)}
          disabled={!live || buying === prod.id}
          onClick={() => { const run = claim && onClaimAgain ? onClaimAgain : onBuy; run?.(prod) }}
          title={claim ? `We emailed a private link to ${claim.email}. Open it to download.` : undefined}
        >
          {label}
        </button>
      </div>
    )
  }
  return (
    <div className="sp-buyrow">
      <PriceTag prod={prod} edit={!live} />
      <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} style={ctaStyle(prod)} disabled={live ? disabled : undefined} aria-disabled={disabled || undefined} onClick={() => { if (!disabled) onBuy?.(prod) }} title={live && !checkoutReady ? 'This seller can’t take payments yet' : undefined}>
        {buying === prod.id ? 'Opening checkout…' : prod.cta?.text || 'Buy now'}
      </button>
    </div>
  )
}

function ProductDetail({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const external = affiliateHref(p)
  return (
    <section className="sp-block sp-detail">
      <Gallery p={p} label={`${p.title} images`} />
      <Badges p={p} />
      <h2>{p.title}</h2>
      {p.subtitle && <p className="sp-sheet-sub">{p.subtitle}</p>}
      <FactLine p={p} />
      <BuyRow prod={p} {...props} />
      {p.description && (
        <div className="sp-desc">
          {p.description.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
      {p.included?.length ? (
        <div className="sp-sheet-sec">
          <h3>What’s included</h3>
          <ul className="sp-incl">{p.included.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ) : null}
      {p.faq?.length ? <Faq heading="Questions" items={p.faq} /> : null}
      {external ? (
        <p className="sp-aff-note">
          {p.affiliate?.disclosure || (p.productType === 'affiliate' ? DEFAULT_AFFILIATE_DISCLOSURE : 'Paid partnership · payment and delivery happen on the external website.')}
        </p>
      ) : (
        <p className="sp-fine">{isFreeProduct(p) ? 'A private link is emailed to you. Open it to download.' : 'Instant download after payment. A copy of the link is emailed to you.'}</p>
      )}
    </section>
  )
}

function Faq({ heading, items }: { heading?: string; items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(null)
  const list = items.filter((x) => x.q)
  if (!list.length) return null
  return (
    <section className="sp-block sp-faq">
      {heading && <h2 className="sp-h2">{heading}</h2>}
      {list.map((x, i) => (
        <div key={i} className="sp-faq-item">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {x.q}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          {open === i && <p>{x.a}</p>}
        </div>
      ))}
    </section>
  )
}
