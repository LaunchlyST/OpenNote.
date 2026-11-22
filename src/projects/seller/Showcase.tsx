import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { gsap } from 'gsap'
import { AtSign, Check, ChevronDown, Download, Globe, Heart, MessageSquare, Play, Search, MoreVertical, ShieldCheck, ShoppingBag, Star, X as XIcon } from 'lucide-react'
import { isFreeProduct, mediaUrl } from './model'
import type { Block, CardPart, Page, ShopProduct } from './model'
import { storeApi } from './api'
import type { PublicReview } from './api'
import { Banner, BuyRow } from './StorePage'
import type { StorePageProps } from './StorePage'
import './showcase.css'

/**
 * Style 1 home page: a sticky cinematic panel built from the seller's own banner
 * on the left, and the profile + product list on the right. On narrow screens
 * (container < 900px, which includes the Studio phone) it becomes one column and
 * the left panel is dropped so the banner is never shown twice.
 */
export function Showcase(props: StorePageProps & { rest: ReactNode; foot: ReactNode; pickable: (b: Block, node: ReactNode) => ReactNode }) {
  const { page, handle, live } = props
  const products = props.products.filter((p) => !p.hidden)
  const cats = useMemo(() => [...new Set(products.map((p) => p.category?.trim()).filter(Boolean) as string[])], [products])
  const [cat, setCat] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const list = (cat ? products.filter((p) => p.category?.trim() === cat) : products).filter((p) => !needle || p.title.toLowerCase().includes(needle))
  const [drawer, setDrawer] = useState(false)
  // Which nav item is current: Reviews while the feedback drawer is open, otherwise
  // Products once the collection reaches the top of the screen, else Home.
  const [section, setSection] = useState<'home' | 'products'>('home')
  const active = drawer ? 'reviews' : section
  const links = useRef<HTMLSpanElement>(null)
  const [ind, setInd] = useState<CSSProperties>({ opacity: 0 })
  useEffect(() => {
    const on = () => {
      const c = document.getElementById('sx-collection')
      setSection(c && c.getBoundingClientRect().top < innerHeight * 0.35 ? 'products' : 'home')
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    const place = () => {
      const b = links.current?.querySelector<HTMLElement>(`[data-k="${active}"]`)
      setInd(b ? { opacity: 1, width: b.offsetWidth, transform: `translateX(${b.offsetLeft}px)` } : { opacity: 0 })
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [active])
  const root = useRef<HTMLDivElement>(null)
  const head = page.blocks.find((b) => b.type === 'header') ?? { id: 'header', type: 'header', hidden: false, data: {} } as Block
  const gridId = page.blocks.find((b) => b.type === 'grid' || b.type === 'featured')?.id ?? head.id

  // Entrance: once per page load, quick, and skipped for reduced motion and in the editor.
  useEffect(() => {
    const el = root.current
    if (!el || !live || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.sx-stage-img', { scale: 1.12, opacity: 0, duration: 1.4 })
        .from('.sx-stage-copy > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.07 }, 0.25)
        .from('.sx-panel', { xPercent: 6, opacity: 0, duration: 0.9 }, 0.1)
        .from('.sx-banner', { clipPath: 'inset(0 0 100% 0 round 22px)', duration: 0.9, ease: 'power3.inOut' }, 0.2)
        .from('.sx-avatar', { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(1.7)' }, 0.65)
        .from('.sx-id > *:not(.sx-avatar)', { y: 12, opacity: 0, duration: 0.6, stagger: 0.05 }, 0.75)
      gsap.utils.toArray<HTMLElement>('.sx-row').forEach((row, i) => {
        gsap.from(row, { y: 28, opacity: 0, duration: 0.7, delay: 0.9 + Math.min(i, 4) * 0.08 })
      })
    }, el)
    return () => ctx.revert()
  }, [live])

  // Mouse depth on the stage: the artwork drifts a few px against the pointer.
  const stage = useRef<HTMLDivElement>(null)
  const move = (e: ReactMouseEvent) => {
    const s = stage.current
    if (!s || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = s.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    s.style.setProperty('--mx', String(x)); s.style.setProperty('--my', String(y))
  }
  const shop = () => document.getElementById('sx-collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const banner = page.banner?.kind === 'image' ? mediaUrl(page.banner.media) : null
  const bannerVideo = page.banner?.kind === 'video' ? mediaUrl(page.banner.media) : null
  const freeOnly = products.length > 0 && products.every(isFreeProduct)

  return (
    <div className={products.length > 0 && live ? 'sx sx-has-fb' : 'sx'} ref={root}>
      <nav className="sx-top" aria-label="Store">
        <span className="sx-logo">
          <span className="sx-logo-av" style={mediaUrl(page.avatar) ? { backgroundImage: `url(${mediaUrl(page.avatar)})` } : undefined}>{!page.avatar && (page.name.trim().charAt(0) || handle.charAt(0)).toUpperCase()}</span>
          {page.name || `@${handle}`}
        </span>
        <span className="sx-top-links" ref={links}>
          <button type="button" data-k="home" className={active === 'home' ? 'on' : ''} aria-current={active === 'home' || undefined} onClick={() => { setSection('home'); scrollTo({ top: 0, behavior: 'smooth' }) }}>Home</button>
          {products.length > 0 && <button type="button" data-k="products" className={active === 'products' ? 'on' : ''} aria-current={active === 'products' || undefined} onClick={() => { setSection('products'); shop() }}>Products</button>}
          {products.length > 0 && live && <button type="button" data-k="reviews" className={active === 'reviews' ? 'on' : ''} aria-current={active === 'reviews' || undefined} onClick={() => setDrawer(true)}>Reviews</button>}
          <i className="sx-ind" style={ind} aria-hidden="true" />
        </span>
        {products.length > 8 && (
          <span className={searching ? 'sx-search on' : 'sx-search'}>
            {searching && <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); shop() }} placeholder="Search products" aria-label="Search products" onBlur={() => { if (!q) setSearching(false) }} />}
            <button type="button" aria-label="Search products" onClick={() => setSearching((v) => !v)}><Search aria-hidden="true" /></button>
          </span>
        )}
      </nav>
      <aside className="sx-stage" ref={stage} onMouseMove={move} onMouseLeave={() => { stage.current?.style.setProperty('--mx', '0'); stage.current?.style.setProperty('--my', '0') }}>
        <div className="sx-stage-art">
          {page.banner && (banner || bannerVideo) ? <span className="sx-stage-img sx-stage-banner"><Banner banner={page.banner} /></span>
            : <span className="sx-stage-img sx-stage-plain" />}
          <span className="sx-stage-light" aria-hidden="true" />
        </div>
        <div className="sx-stage-copy">
          <p className="sx-kicker"><span />Creator store<span /></p>
          <p className="sx-stage-name">@{handle}</p>
          {page.name && page.name !== handle && <p className="sx-stage-sub">{page.name}</p>}
          {page.bio?.trim() && <p className="sx-stage-bio">{page.bio}</p>}
          <ul className="sx-trust">
            <li><Download aria-hidden="true" /><span>{freeOnly ? <>Free<br />download</> : <>Instant<br />download</>}</span></li>
            {!freeOnly && <li><ShieldCheck aria-hidden="true" /><span>Secure<br />checkout</span></li>}
          </ul>
          <div className="sx-stage-actions">
            {products.length > 0 && <button type="button" className="sx-cta" onClick={shop}><ShoppingBag aria-hidden="true" /> Shop collection <span aria-hidden="true">→</span></button>}
            {head.data?.showSocials !== false && <Socials page={page} dark />}
          </div>
        </div>
      </aside>

      <main className="sx-panel">
        {props.pickable(head, <Profile page={page} handle={handle} showSocials={head.data?.showSocials !== false} />)}

        {products.length > 0 && (
          <section className="sx-collection" id="sx-collection" aria-labelledby="sx-col-h">
            <p className="sx-kicker sx-kicker-dark"><span />Digital products</p>
            <h2 id="sx-col-h">Explore the <em>collection</em></h2>
            {cats.length > 1 && (
              <div className="sx-filters" role="tablist" aria-label="Filter products">
                {[null, ...cats].map((c) => (
                  <button key={c ?? 'all'} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c ?? 'All products'}</button>
                ))}
              </div>
            )}
            {needle && !list.length && <p className="sx-none">No products match “{q}”.</p>}
            <ol className="sx-list">
              {list.map((p) => <Row key={p.id} p={p} blockId={gridId} {...props} />)}
            </ol>
          </section>
        )}
        {props.rest}
        {props.foot}
      </main>

      {products.length > 0 && live && (
        <>
          <button type="button" className="sx-fab" onClick={() => setDrawer(true)} aria-haspopup="dialog">
            <MessageSquare aria-hidden="true" /> Feedback
          </button>
          <Feedback open={drawer} onClose={() => setDrawer(false)} products={products} handle={handle} owned={props.owned} live={!!live} />
        </>
      )}
    </div>
  )
}

const SOCIALS: Array<{ k: keyof Page['socials']; label: string; icon: ReactNode }> = [
  { k: 'instagram', label: 'Instagram', icon: <AtSign /> },
  { k: 'youtube', label: 'YouTube', icon: <Play /> },
  { k: 'x', label: 'X', icon: <XIcon /> },
  { k: 'website', label: 'Website', icon: <Globe /> },
]

/** Only http(s) links are shown; anything else is dropped rather than linked. */
function safeHref(v: string | undefined): string | null {
  const s = v?.trim()
  if (!s) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch { return null }
}

function Socials({ page, dark }: { page: Page; dark?: boolean }) {
  const list = SOCIALS.map((s) => ({ ...s, href: safeHref(page.socials[s.k]) })).filter((s) => s.href)
  if (!list.length) return null
  return (
    <div className={dark ? 'sx-socials sx-socials-dark' : 'sx-socials'}>
      {list.map((s) => <a key={s.k} href={s.href!} target="_blank" rel="noopener noreferrer nofollow" aria-label={s.label}>{s.icon}</a>)}
    </div>
  )
}

function Profile({ page, handle, showSocials }: { page: Page; handle: string; showSocials: boolean }) {
  const avatar = mediaUrl(page.avatar)
  const banner = page.banner?.kind === 'image' ? mediaUrl(page.banner.media) : null
  const video = page.banner?.kind === 'video' ? mediaUrl(page.banner.media) : null
  return (
    <header className="sx-profile">
      <div className={banner || video ? 'sx-banner' : 'sx-banner sx-banner-plain'}>
        {page.banner && (banner || video) ? <Banner banner={page.banner} /> : null}
      </div>
      <div className="sx-id">
        <span className="sx-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>
          {!avatar && (page.name.trim().charAt(0) || handle.charAt(0)).toUpperCase()}
        </span>
        <h1 className="sx-user">@{handle}</h1>
        {page.name && page.name !== handle && <p className="sx-name">{page.name}</p>}
        {page.bio?.trim() && <p className="sx-bio">{page.bio}</p>}
        {showSocials && <Socials page={page} />}
      </div>
    </header>
  )
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="sx-stars" aria-label={`${value.toFixed(1)} out of 5`} style={{ ['--s' as string]: `${size}px` }}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden="true" className={value >= i - 0.25 ? 'on' : ''} />)}
    </span>
  )
}

function RowMenu({ p, ...props }: { p: ShopProduct } & StorePageProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    addEventListener('mousedown', off)
    return () => removeEventListener('mousedown', off)
  }, [open])
  const saved = props.savedIds?.includes(p.id)
  const link = `${location.origin}/${props.handle}/p/${p.id}`
  return (
    <div className="sx-menu" ref={ref}>
      <button type="button" className="sx-menu-btn" aria-label={`More options for ${p.title}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreVertical aria-hidden="true" /></button>
      {open && (
        <div className="sx-menu-pop" role="menu">
          {props.onOpenProduct && <button type="button" role="menuitem" onClick={() => { setOpen(false); props.onOpenProduct?.(p) }}>View details</button>}
          {props.onToggleSave && <button type="button" role="menuitem" onClick={() => { props.onToggleSave?.(p); setOpen(false) }}><Heart aria-hidden="true" className={saved ? 'on' : ''} />{saved ? 'Remove from saved' : 'Save for later'}</button>}
          <button type="button" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => { setCopied(false); setOpen(false) }, 900) }) }}>{copied ? 'Link copied' : 'Copy link'}</button>
        </div>
      )}
    </div>
  )
}

function Row({ p, blockId, ...props }: { p: ShopProduct; blockId: string } & StorePageProps) {
  const { live } = props
  const [open, setOpen] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const cover = mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null)
  const meta = [p.format, p.fileType].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
  const extra = (p.included?.length ?? 0) > 0 || (p.description?.length ?? 0) > 110
  // Editor: a click on a part opens that part's settings in the Studio panel.
  const pick = (part: CardPart) => (e: ReactMouseEvent<HTMLElement>) => {
    if (live) return
    e.preventDefault(); e.stopPropagation()
    props.onPick?.(blockId, e.currentTarget, p.id, part)
  }
  const picked = (part: CardPart) => (!live && props.editCard?.productId === p.id && props.editCard.part === part ? ' sx-picked' : '')
  const openIt = () => (live ? props.onOpenProduct?.(p) : undefined)
  useEffect(() => {
    const el = body.current
    if (!el) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.height = open ? 'auto' : '0px'; return }
    gsap.to(el, { height: open ? 'auto' : 0, opacity: open ? 1 : 0, duration: 0.45, ease: 'power3.inOut' })
  }, [open])
  return (
    <li className={'sx-row' + (open ? ' is-open' : '') + picked('card')} onClick={live ? undefined : pick('card')}>
      <button type="button" className={'sx-art' + picked('cover')} onClick={live ? openIt : pick('cover')} aria-label={`View ${p.title}`}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="sx-art-ph">{p.title.slice(0, 2)}</span>}
        {p.offer && <span className="sx-off">−{p.offer.percent}%</span>}
      </button>
      <div className="sx-info">
        <h3 className={'sx-title' + picked('title')} onClick={live ? openIt : pick('title')}>{p.title}</h3>
        {(p.subtitle || p.description) && <p className={'sx-desc' + picked('desc')} onClick={live ? undefined : pick('desc')}>{p.subtitle || p.description}</p>}
        <p className="sx-meta">
          {p.affiliate?.url || p.productType === 'affiliate' ? <span>Partner product</span> : <span>Digital download</span>}
          {meta.map((m) => <span key={m}>{m}</span>)}
          {p.rating && p.rating.count > 0 && <span className="sx-rate"><Stars value={p.rating.average} size={12} /> {p.rating.average.toFixed(1)} ({p.rating.count})</span>}
        </p>
        {extra && (
          <button type="button" className="sx-more" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
            {open ? 'Less' : 'What’s inside'} <ChevronDown aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={'sx-buy' + picked('button')} onClickCapture={live ? undefined : pick('button')}>
        {live && <RowMenu p={p} {...props} />}
        <BuyRow prod={p} {...props} />
      </div>
      {extra && (
        <div className="sx-drawer" ref={body} style={{ height: 0, opacity: 0 }} aria-hidden={!open}>
          <div className="sx-drawer-in">
            {p.description && <p>{p.description}</p>}
            {!!p.included?.length && <ul>{p.included.map((x) => <li key={x}><Check aria-hidden="true" />{x}</li>)}</ul>}
          </div>
        </div>
      )}
    </li>
  )
}

/** "/store/h/order/<id>?k=<key>" → the order id and its key, for the verified-review API. */
function orderOf(path?: string): { id: string; k: string } | null {
  if (!path) return null
  const m = path.match(/\/order\/([^/?#]+)/)
  const k = new URL(path, 'https://x').searchParams.get('k')
  return m && k ? { id: decodeURIComponent(m[1]), k } : null
}

function Feedback({ open, onClose, products, handle, owned, live, docked }: { docked?: boolean; open: boolean; onClose: () => void; products: ShopProduct[]; handle: string; owned?: Record<string, string>; live: boolean }) {
  const [pid, setPid] = useState(products[0]?.id)
  const [tab, setTab] = useState<'read' | 'write'>('read')
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [data, setData] = useState<{ summary: { average: number; count: number }; reviews: PublicReview[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const prod = products.find((p) => p.id === pid) ?? products[0]

  useEffect(() => {
    if (!open || !prod || !live) return
    let off = false
    setData(null); setErr(null)
    storeApi.reviews(handle, prod.id).then((r) => { if (!off) setData(r) }).catch(() => { if (!off) setErr('Reviews couldn’t be loaded. Try again in a moment.') })
    return () => { off = true }
  }, [open, prod?.id, handle, live])

  useEffect(() => {
    if (!open || docked) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    sheet.current?.focus()
    return () => removeEventListener('keydown', k)
  }, [open, onClose])

  const found = products.filter((p) => p.title.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className={(docked ? 'sx-fb sx-fb-docked' : 'sx-fb') + (open ? ' is-open' : '')} aria-hidden={!open}>
      {!docked && <div className="sx-fb-scrim" onClick={onClose} />}
      <div className="sx-fb-sheet" {...(docked ? {} : { role: 'dialog', 'aria-modal': true })} aria-labelledby={docked ? 'sx-fbd-h' : 'sx-fb-h'} tabIndex={-1} ref={sheet}>
        <div className="sx-fb-top">
          <h2 id={docked ? 'sx-fbd-h' : 'sx-fb-h'}><Star aria-hidden="true" /> Product feedback</h2>
          {!docked && <button type="button" className="sx-fb-x" onClick={onClose} aria-label="Close"><XIcon /></button>}
        </div>
        <p className="sx-fb-sub">See what customers think about the digital products.</p>

        <label className="sx-fb-label">Choose a digital product</label>
        <div className="sx-pick">
          <button type="button" className="sx-pick-btn" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            {prod && <Thumb p={prod} />}<span>{prod?.title}</span><ChevronDown aria-hidden="true" />
          </button>
          {picking && (
            <div className="sx-pick-pop">
              {products.length > 5 && <div className="sx-pick-q"><Search aria-hidden="true" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" /></div>}
              <ul role="listbox">
                {found.map((p) => (
                  <li key={p.id} role="option" aria-selected={p.id === prod?.id}>
                    <button type="button" onClick={() => { setPid(p.id); setPicking(false); setQ('') }}><Thumb p={p} />{p.title}</button>
                  </li>
                ))}
                {!found.length && <li className="sx-pick-none">No products match.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="sx-fb-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'read'} className={tab === 'read' ? 'on' : ''} onClick={() => setTab('read')}>Reviews{data && data.summary.count > 0 ? ` (${data.summary.count})` : ''}</button>
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>Write feedback</button>
        </div>

        <div className="sx-fb-body" key={`${prod?.id}-${tab}`}>
          {tab === 'read' ? (
            !live ? <Empty title="Reviews show on your live store" text="Buyers see genuine, verified reviews here." />
              : err ? <Empty title="Something went wrong" text={err} />
                : !data ? <div className="sx-fb-load" aria-label="Loading reviews"><i /><i /><i /></div>
                  : data.reviews.length === 0 ? <Empty title="No reviews yet" text="Reviews appear here after customers who bought this product share their thoughts." />
                    : (
                      <>
                        <div className="sx-fb-sum"><b>{data.summary.average.toFixed(1)}</b><Stars value={data.summary.average} /><span>{data.summary.count} review{data.summary.count === 1 ? '' : 's'}</span></div>
                        <ul className="sx-revs">{data.reviews.map((r) => <Review key={r.id} r={r} handle={handle} />)}</ul>
                      </>
                    )
          ) : prod && <Write p={prod} handle={handle} order={orderOf(owned?.[prod.id])} live={live} onDone={() => setTab('read')} />}
        </div>
      </div>
    </div>
  )
}

function Thumb({ p }: { p: ShopProduct }) {
  const c = mediaUrl(p.cover)
  return <span className="sx-thumb" style={c ? { backgroundImage: `url(${c})` } : undefined} aria-hidden="true" />
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="sx-empty"><span aria-hidden="true"><MessageSquare /></span><b>{title}</b><p>{text}</p></div>
}

function Review({ r, handle }: { r: PublicReview; handle: string }) {
  const [reported, setReported] = useState(false)
  const date = new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <li className="sx-rev">
      <span className="sx-rev-av" aria-hidden="true">{(r.name || '?').charAt(0).toUpperCase()}</span>
      <div>
        <p className="sx-rev-top"><b>{r.name || 'Customer'}</b><time>{date}</time></p>
        <p className="sx-rev-meta"><Stars value={r.rating} size={13} />{r.verified && <span className="sx-ver"><Check aria-hidden="true" /> Verified purchase</span>}</p>
        {r.body && <p className="sx-rev-body">{r.body}</p>}
        <button type="button" className="sx-report" disabled={reported} onClick={() => { void storeApi.reportReview(handle, r.id, 'Reported from the storefront').then(() => setReported(true)).catch(() => {}) }}>{reported ? 'Reported' : 'Report'}</button>
      </div>
    </li>
  )
}

function Write({ p, handle, order, live, onDone }: { p: ShopProduct; handle: string; order: { id: string; k: string } | null; live: boolean; onDone: () => void }) {
  const [state, setState] = useState<'check' | 'no' | 'yes' | 'sending' | 'sent' | 'error'>(order && live ? 'check' : 'no')
  const [rating, setRating] = useState(5)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  useEffect(() => {
    if (!order || !live) return
    storeApi.myReview(handle, order.id, order.k, p.id).then((r) => {
      setState(r.eligible ? 'yes' : 'no')
      if (r.review) { setRating(r.review.rating); setBody(r.review.body); setName(r.review.name) }
    }).catch(() => setState('no'))
  }, [order?.id, p.id])
  if (state === 'check') return <div className="sx-fb-load"><i /><i /><i /></div>
  if (state === 'no') return <Empty title="Only buyers can review" text={`Reviews are verified: buy “${p.title}” and you can leave feedback from this browser or from the link in your order email.`} />
  if (state === 'sent') return <Empty title="Thank you" text="Your review was sent. It appears once it has been checked." />
  const send = () => {
    if (!order) return
    setState('sending')
    storeApi.saveReview(handle, order.id, order.k, { rating, body: body.trim(), name: name.trim(), productId: p.id }).then(() => setState('sent')).catch(() => setState('error'))
  }
  return (
    <form className="sx-write" onSubmit={(e) => { e.preventDefault(); send() }}>
      <div className="sx-rate-in" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} className={rating >= i ? 'on' : ''} onClick={() => setRating(i)}><Star /></button>)}
      </div>
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
      <label>Your review<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} required /></label>
      {state === 'error' && <p className="sx-err">That didn’t send. Please try again.</p>}
      <button type="submit" className="sx-submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Post verified review'}</button>
      <button type="button" className="sx-link" onClick={onDone}>Back to reviews</button>
    </form>
  )
}
