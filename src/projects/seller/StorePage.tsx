import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AtSign, ChevronDown, Globe, Play, X as XIcon } from 'lucide-react'
import { FONTS, PRESETS, formatPrice, mediaUrl } from './model'
import type { Block, Page, ShopProduct } from './model'

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
}

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
  return { background: bg, color: preset.ink, fontFamily: font, '--ac': accentOf(page), '--on': preset.bg, '--r': `${radius}px` } as CSSProperties
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
        page.blocks.filter((b) => !b.hidden && b.type !== 'footer').map((b) => <BlockView key={b.id} block={b} {...props} />)
      )}
      {/* Pinned to the bottom, centred: the store's footer line, then desknoty.com */}
      <div className="sp-end">
        {!only && <BlockView block={page.blocks.find((b) => b.type === 'footer') ?? { id: 'footer', type: 'footer', hidden: false, data: { text: '' } }} {...props} />}
        <a className="sp-made" href="https://desknoty.com" target="_blank" rel="noopener">desknoty.com</a>
      </div>
    </div>
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
    <header className={compact ? 'sp-head sp-head-compact' : 'sp-head'}>
      {/* a banner in the store's own accent colour, so every store looks like its own */}
      {!compact && <span className="sp-band" aria-hidden="true" />}
      <span className="sp-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : { background: 'var(--ac)', color: 'var(--on)' }}>
        {!avatar && (page.name.trim().charAt(0).toUpperCase() || handle.charAt(0).toUpperCase())}
      </span>
      <h1 className="sp-name">{page.name || handle}</h1>
      <p className="sp-handle">@{handle}</p>
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
        <section className="sp-block sp-featured">
          <Cover p={prod} big />
          <div className="sp-feat-body">
            {d.note && <p className="sp-kicker">{d.note}</p>}
            <ProductLink prod={prod} live={p.live} handle={p.handle}>
              <h2>{prod.title}</h2>
            </ProductLink>
            {prod.description && <p>{prod.description.split('\n')[0]}</p>}
            <BuyRow prod={prod} {...p} />
          </div>
        </section>
      ) : p.live ? null : (
        <div className="sp-block sp-empty">Featured product: choose a product</div>
      )
    }
    case 'grid': {
      const ids: string[] = d.productIds ?? []
      const picked = ids.map((id) => p.products.find((x) => x.id === id)).filter((x): x is ShopProduct => Boolean(x))
      // Nothing picked yet: show every product on sale rather than an empty shop.
      const list = picked.length ? picked : p.products
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
                <article key={prod.id} className="sp-card">
                  <ProductLink prod={prod} live={p.live} handle={p.handle}>
                    <Cover p={prod} />
                    <h3>{prod.title}</h3>
                  </ProductLink>
                  <BuyRow prod={prod} {...p} small />
                </article>
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

function ProductLink({ prod, live, handle, children }: { prod: ShopProduct; live?: boolean; handle: string; children: ReactNode }) {
  return live ? (
    <a className="sp-card-link" href={`/${handle}/p/${prod.id}`}>
      {children}
    </a>
  ) : (
    <div className="sp-card-link">{children}</div>
  )
}

function Cover({ p, big = false }: { p: ShopProduct; big?: boolean }) {
  const src = mediaUrl(p.cover)
  // No picture yet: a tinted cover with the product's first letter instead of a blank box.
  return (
    <span className={cn('sp-cover', big && 'sp-cover-big', !src && 'sp-cover-auto')} style={src ? { backgroundImage: `url(${src})` } : undefined} aria-hidden="true">
      {!src && (p.title.trim().charAt(0).toUpperCase() || '✦')}
    </span>
  )
}
const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

function BuyRow({ prod, live, checkoutReady, onBuy, buying, small }: { prod: ShopProduct; small?: boolean } & StorePageProps) {
  const disabled = !live || !checkoutReady || buying === prod.id
  return (
    <div className="sp-buyrow">
      <span className="sp-price">{formatPrice(prod.priceMinor, prod.currency)}</span>
      <button type="button" className={small ? 'sp-btn sp-btn-sm' : 'sp-btn'} disabled={disabled} onClick={() => onBuy?.(prod)} title={live && !checkoutReady ? 'This seller can’t take payments yet' : undefined}>
        {buying === prod.id ? 'Opening checkout…' : 'Buy now'}
      </button>
    </div>
  )
}

function ProductDetail({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  return (
    <section className="sp-block sp-detail">
      <Cover p={p} big />
      <h2>{p.title}</h2>
      <BuyRow prod={p} {...props} />
      {p.description && (
        <div className="sp-desc">
          {p.description.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
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
