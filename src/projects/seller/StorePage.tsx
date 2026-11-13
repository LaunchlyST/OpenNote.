import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { AtSign, ChevronDown, Globe, Play, X as XIcon } from 'lucide-react'
import { FONTS, PRESETS, formatPrice, mediaUrl } from './model'
import type { Block, Page, ShopProduct } from './model'
import { Badges, FactLine, Gallery, ProductCard } from './ProductCard'

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
  /** Editor preview: clicking a section selects it for editing. */
  onPick?: (blockId: string, el: HTMLElement) => void
  picked?: string | null
  /** Editor preview: pressing the grip starts dragging that section. */
  onGrab?: (blockId: string, e: ReactPointerEvent) => void
  /** Live store: products this browser has paid for (product id → order page with the download). */
  owned?: Record<string, string>
  /** Live store: start the download of a bought product right here (no page change). */
  onDownload?: (p: ShopProduct) => void
  downloading?: string | null
  /** Live store: open a product in the detail panel instead of leaving the page. */
  onOpenProduct?: (p: ShopProduct) => void
  /** Live store: saved products and the toggle. */
  savedIds?: string[]
  onToggleSave?: (p: ShopProduct) => void
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
    ...(look.font ? { fontFamily: FONTS.find((f) => f.id === look.font)?.css } : {}),
  } as CSSProperties
}

/** In the editor preview, each section is clickable and shows an outline with its name. */
function Pickable({ block, onPick, picked, onGrab, children }: { block: Block; onPick?: StorePageProps['onPick']; picked?: string | null; onGrab?: StorePageProps['onGrab']; children: ReactNode }) {
  const style = lookStyle(block.look)
  // the profile header (photo, name, @username) comes from TikTok and isn't editable here
  if (!onPick || block.type === 'header') return style ? <div className="sp-look" style={style}>{children}</div> : <>{children}</>
  return (
    <div
      className={picked === block.id ? 'sp-pick on' : 'sp-pick'}
      data-id={block.id}
      data-label={PICK_LABEL[block.type] ?? block.type}
      style={style}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('.sp-grip')) return
        e.preventDefault()
        e.stopPropagation()
        onPick(block.id, e.currentTarget)
      }}
    >
      {onGrab && (
        <button type="button" className="sp-grip" aria-label={`Drag ${PICK_LABEL[block.type] ?? block.type} to move it`} onPointerDown={(e) => (e.stopPropagation(), onGrab(block.id, e))}>
          ⋮⋮
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
  const font = FONTS.find((f) => f.id === page.theme.font)?.css ?? FONTS[0].css
  const radius = page.theme.button === 'pill' ? 999 : page.theme.button === 'sharp' ? 4 : 12
  const bg =
    page.theme.background === 'gradient'
      ? `linear-gradient(180deg, ${preset.bg} 0%, color-mix(in srgb, ${accentOf(page)} 22%, ${preset.bg}) 100%)`
      : preset.bg
  return { background: bg, color: preset.ink, fontFamily: font, '--ac': accentOf(page), '--on': preset.bg, '--r': `${radius}px`, '--bg': preset.bg, '--fg': preset.ink } as CSSProperties
}

export function StorePage(props: StorePageProps) {
  const { page, only } = props
  return (
    <div className="sp" style={storeStyle(page)}>
      {only ? (
        <>
          <Header page={page} handle={props.handle} showSocials={false} compact />
          <ProductDetail p={only} {...props} />
        </>
      ) : (
        page.blocks.filter((b) => !b.hidden && b.type !== 'footer').map((b) => (
          <Pickable key={b.id} block={b} onPick={props.onPick} picked={props.picked} onGrab={props.onGrab}><BlockView block={b} {...props} /></Pickable>
        ))
      )}
      {/* Pinned to the bottom, centred: the store's footer line, then desknoty.com */}
      <div className="sp-end">
        {!only && <BlockView block={page.blocks.find((b) => b.type === 'footer') ?? { id: 'footer', type: 'footer', hidden: false, data: { text: '' } }} {...props} />}
        <a className="sp-made" href="https://desknoty.com" target="_blank" rel="noopener">desknoty.com</a>
      </div>
    </div>
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
      const prod = p.products.find((x) => x.id === d.productId)
      return prod ? (
        <section className="sp-block sp-featured-v2">
          <ProductCard p={prod} layout="featured" href={p.live ? `/${p.handle}/p/${prod.id}` : undefined} onOpen={p.live ? p.onOpenProduct : undefined} buy={<BuyRow prod={prod} {...p} />} saved={p.savedIds?.includes(prod.id)} onToggleSave={p.onToggleSave ? () => p.onToggleSave!(prod) : undefined} />
        </section>
      ) : p.live ? null : (
        <div className="sp-block sp-empty sp-feat-empty">Digital product: click to choose a product</div>
      )
    }
    case 'grid': {
      const ids: string[] = d.productIds ?? []
      const picked = ids.map((id) => p.products.find((x) => x.id === id)).filter((x): x is ShopProduct => Boolean(x))
      // Nothing picked yet: show every product on sale rather than an empty shop.
      const list = picked.length ? picked : p.products.filter((x) => !x.hidden)
      if (list.length === 0)
        return p.live ? (
          <section className="sp-block sp-soon">
            <span aria-hidden="true">✦</span>
            <h2>New products are on the way</h2>
            <p>Check back soon, or follow along on socials.</p>
          </section>
        ) : (
          <div className="sp-block sp-empty">Product grid: add products to show them here</div>
        )
      return (
        <section className="sp-block sp-grid-wrap">
          {d.heading && <h2 className="sp-h2">{d.heading}</h2>}
          {(
            <div className="sp-grid">
              {list.map((prod) => (
                <ProductCard key={prod.id} p={prod} href={p.live ? `/${p.handle}/p/${prod.id}` : undefined} onOpen={p.live ? p.onOpenProduct : undefined} buy={<BuyRow prod={prod} {...p} small={(prod.layout ?? 'compact') === 'compact'} />} saved={p.savedIds?.includes(prod.id)} onToggleSave={p.onToggleSave ? () => p.onToggleSave!(prod) : undefined} />
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


/** Price with a running offer: old price struck through, sale price, savings and (for a real deadline) a countdown. */
export function PriceTag({ prod }: { prod: ShopProduct }) {
  if (!prod.offer) return <span className="sp-price">{formatPrice(prod.priceMinor, prod.currency)}</span>
  const saved = prod.offer.savedMinor ?? prod.priceMinor - prod.offer.priceMinor
  return (
    <span className="sp-price sp-price-sale">
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

export function BuyRow({ prod, live, checkoutReady, onBuy, buying, small, owned, onDownload, downloading }: { prod: ShopProduct; small?: boolean } & StorePageProps) {
  const disabled = !live || !checkoutReady || buying === prod.id
  // Already bought in this browser (the server confirmed the payment): Download instead of Buy now.
  if (live && owned?.[prod.id])
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
        <PriceTag prod={prod} />
        <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} disabled title="One of this bundle’s products isn’t available">Unavailable</button>
      </div>
    )
  if (prod.priceMinor === 0)
    return (
      <div className="sp-buyrow">
        <span className="sp-price">Free</span>
        <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} style={ctaStyle(prod)} disabled={!live || buying === prod.id} onClick={() => onBuy?.(prod)}>
          {buying === prod.id ? 'Getting it…' : prod.cta?.text || 'Get it free'}
        </button>
      </div>
    )
  return (
    <div className="sp-buyrow">
      <PriceTag prod={prod} />
      <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} style={ctaStyle(prod)} disabled={disabled} onClick={() => onBuy?.(prod)} title={live && !checkoutReady ? 'This seller can’t take payments yet' : undefined}>
        {buying === prod.id ? 'Opening checkout…' : prod.cta?.text || 'Buy now'}
      </button>
    </div>
  )
}

function ProductDetail({ p, ...props }: { p: ShopProduct } & StorePageProps) {
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
      <p className="sp-fine">Instant download after payment. A copy of the link is emailed to you.</p>
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
