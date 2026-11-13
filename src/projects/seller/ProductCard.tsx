import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Download, Flag, Heart, Share2, X as XIcon } from 'lucide-react'
import { storeApi } from './api'
import type { PublicReview } from './api'
import { mediaUrl } from './model'
import type { ShopProduct } from './model'

/**
 * Product presentation shared by the editor previews and the live store:
 * cover with crop and focal point, swipeable gallery with an optional video,
 * badges, the three card layouts, horizontally movable title and description,
 * and the product detail panel. Keeping it in one place is what makes the
 * editor preview match the published store.
 */

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const SNAPS = [0, 0.5, 1]
const SNAP_DISTANCE = 0.05

/** Cover picture honouring the seller's focal point and zoom. */
export function CoverImage({ p, className }: { p: ShopProduct; className?: string }) {
  const src = mediaUrl(p.cover)
  const c = p.crop ?? { x: 50, y: 50, zoom: 1 }
  return (
    <span
      className={cn('sp-cover', className, !src && 'sp-cover-auto')}
      style={src ? ({ backgroundImage: `url(${src})`, backgroundPosition: `${c.x}% ${c.y}%`, backgroundSize: c.zoom > 1 ? `${c.zoom * 100}%` : 'cover' } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {!src && (p.title.trim().charAt(0).toUpperCase() || '✦')}
    </span>
  )
}

/** Swipeable gallery: cover first, then extra images, then the preview video. Scroll snap does the swiping. */
export function Gallery({ p, label }: { p: ShopProduct; label: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const slides: Array<{ kind: 'cover' } | { kind: 'image'; id: string } | { kind: 'video'; id: string }> = [{ kind: 'cover' }, ...(p.gallery ?? []).map((id) => ({ kind: 'image' as const, id })), ...(p.video ? [{ kind: 'video' as const, id: p.video }] : [])]
  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const n = Math.max(0, Math.min(slides.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  if (slides.length === 1) return <CoverImage p={p} className="sp-gal-single" />
  return (
    <div className="sp-gal" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={track} className="sp-gal-track" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))} tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1) } if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1) } }}>
        {slides.map((s, i) => (
          <div key={i} className="sp-gal-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
            {s.kind === 'cover' ? <CoverImage p={p} /> : s.kind === 'image' ? <img src={mediaUrl(s.id) ?? ''} alt="" loading="lazy" draggable={false} /> : <video src={mediaUrl(s.id) ?? ''} controls playsInline muted preload="metadata" />}
          </div>
        ))}
      </div>
      <button type="button" className="sp-gal-nav prev" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous image"><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" className="sp-gal-nav next" onClick={() => go(at + 1)} disabled={at === slides.length - 1} aria-label="Next image"><ChevronRight className="h-4 w-4" /></button>
      <div className="sp-gal-dots" aria-hidden="true">{slides.map((s, i) => <i key={i} className={cn(i === at && 'on', s.kind === 'video' && 'vid')} />)}</div>
    </div>
  )
}

export function Badges({ p }: { p: ShopProduct }) {
  const b = p.badges
  if (!b?.new && !b?.featured && !p.bundle) return null
  return (
    <span className="sp-pbadges">
      {b?.featured && <span className="sp-pbadge feat">Featured</span>}
      {b?.new && <span className="sp-pbadge new">New</span>}
      {p.bundle && <span className="sp-pbadge bundle">Bundle · {p.bundle.items.length}</span>}
    </span>
  )
}

/** Star rating from real reviews. Nothing is shown when there are none. */
export function Stars({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'lg' }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className={cn('sp-stars', size)} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5${count != null ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}`}>
      <span className="sp-stars-row" aria-hidden="true"><span className="sp-stars-on" style={{ width: `${pct}%` }}>★★★★★</span>★★★★★</span>
      {count != null && <span className="sp-stars-n">{value.toFixed(1)} ({count})</span>}
    </span>
  )
}

/** Save (heart) with a clear on/off state. */
export function SaveButton({ saved, onToggle, label }: { saved: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className={cn('sp-save-btn', saved && 'on')} aria-pressed={saved} aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle() }}>
      <Heart className="h-4 w-4" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}

/** Native share sheet where the browser has one; otherwise copy the product link. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [done, setDone] = useState(false)
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, url }); return }
      await navigator.clipboard.writeText(url)
      setDone(true); window.setTimeout(() => setDone(false), 1600)
    } catch { /* cancelled */ }
  }
  return <button type="button" className="sp-act" onClick={() => void share()}><Share2 className="h-4 w-4" aria-hidden="true" /> {done ? 'Link copied' : 'Share'}</button>
}

/** File format and access in one quiet line; only facts the seller entered or the server worked out. */
export function FactLine({ p }: { p: ShopProduct }) {
  const format = p.format || p.fileType
  const bits = [format, p.included?.length ? `${p.included.length} item${p.included.length === 1 ? '' : 's'} included` : null, p.access].filter(Boolean)
  if (!bits.length) return null
  return <span className="sp-facts">{bits.join(' · ')}</span>
}

/**
 * Title or description placed horizontally inside the card. Live: plain
 * positioned text. Editor: selectable and draggable with mouse, touch or keyboard,
 * snapping to left, centre and right guides. The position is a 0 to 1 fraction of
 * the free space, so it holds at every card width and the text never leaves the card.
 */
export function MovableText({ pos, onMove, label, as: Tag = 'span', className, children }: { pos: number; onMove?: (pos: number) => void; label: string; as?: 'span' | 'h3' | 'p'; className?: string; children: ReactNode }) {
  const el = useRef<HTMLElement | null>(null)
  const drag = useRef<{ startX: number; startPos: number; free: number } | null>(null)
  const [live, setLive] = useState<number | null>(null)
  const [guide, setGuide] = useState<number | null>(null)
  const shown = live ?? pos
  const align = shown < 0.25 ? 'left' : shown > 0.75 ? 'right' : 'center'
  const style = { '--tx': shown, textAlign: align } as CSSProperties

  if (!onMove)
    return <Tag className={cn('sp-move', className)} style={style}>{children}</Tag>

  const snap = (v: number) => {
    const near = SNAPS.find((s) => Math.abs(s - v) < SNAP_DISTANCE)
    setGuide(near ?? null)
    return near ?? v
  }
  const freeSpace = () => {
    const node = el.current
    const box = node?.parentElement
    return node && box ? Math.max(1, box.clientWidth - node.offsetWidth) : 1
  }
  const down = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
    drag.current = { startX: e.clientX, startPos: pos, free: freeSpace() }
    setLive(pos)
  }
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    setLive(snap(clamp01(d.startPos + (e.clientX - d.startX) / d.free)))
  }
  const up = () => {
    if (drag.current && live != null) onMove(Math.round(live * 1000) / 1000)
    drag.current = null; setLive(null); setGuide(null)
  }
  const key = (e: ReactKeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02
    const map: Record<string, number> = { ArrowLeft: pos - step, ArrowRight: pos + step, Home: 0, End: 1 }
    if (e.key in map) { e.preventDefault(); onMove(clamp01(Math.round(map[e.key] * 1000) / 1000)) }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); onMove(0.5) }
  }
  return (
    <span className="sp-move-zone">
      {guide != null && <i className="sp-guide" style={{ left: `${guide * 100}%` }} aria-hidden="true" />}
      <Tag
        ref={(n: HTMLElement | null) => { el.current = n }}
        className={cn('sp-move sp-move-edit', live != null && 'dragging', className)}
        style={style}
        tabIndex={0}
        role="slider"
        aria-label={`${label} position`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown * 100)}
        aria-valuetext={align === 'center' ? 'Centre' : align === 'left' ? `Left ${Math.round(shown * 100)}%` : `Right ${Math.round(shown * 100)}%`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }}
        onKeyDown={key}
      >
        {children}
      </Tag>
    </span>
  )
}

export type CardProps = {
  p: ShopProduct
  /** Opens the product (detail panel on the live store). */
  onOpen?: (p: ShopProduct) => void
  href?: string
  buy: ReactNode
  /** Editor only: move title/description. */
  onMoveText?: (which: 'title' | 'desc', pos: number) => void
  layout?: ShopProduct['layout']
  saved?: boolean
  onToggleSave?: () => void
}

/** One product card in the seller's chosen layout. Unused fields are simply not rendered. */
export function ProductCard({ p, onOpen, href, buy, onMoveText, layout, saved, onToggleSave }: CardProps) {
  const kind = layout ?? p.layout ?? 'compact'
  const tp = p.textPos ?? { title: 0, desc: 0 }
  const sub = p.subtitle || (p.description ? p.description.split('\n')[0] : '')
  const open = (e: React.MouseEvent) => {
    if (!onOpen) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
    e.preventDefault()
    onOpen(p)
  }
  const Link = ({ children, className, label }: { children: ReactNode; className?: string; label?: string }) =>
    href || onOpen ? <a className={cn('sp-card-open', className)} href={href ?? '#'} onClick={open} aria-label={label}>{children}</a> : <span className={cn('sp-card-open', className)}>{children}</span>
  return (
    <article className={cn('sp-card', `sp-card-${kind}`)}>
      <div className="sp-card-media">
        <Link label={`Open ${p.title}`}>{kind === 'compact' ? <CoverImage p={p} /> : <CoverImage p={p} className="sp-cover-big" />}</Link>
        <Badges p={p} />
        {p.offer && <em className="sp-badge sp-badge-float" style={{ background: p.offer.badgeColor }}>{p.offer.badge}</em>}
        {onToggleSave && <SaveButton saved={Boolean(saved)} onToggle={onToggleSave} label={p.title} />}
      </div>
      <div className="sp-card-body">
        <div className="sp-move-box">
          {onMoveText ? (
            <MovableText as="h3" pos={tp.title} onMove={(v) => onMoveText('title', v)} label="Title">{p.title}</MovableText>
          ) : (
            <MovableText as="h3" pos={tp.title} label="Title"><Link>{p.title}</Link></MovableText>
          )}
        </div>
        {sub && (
          <div className="sp-move-box">
            <MovableText as="p" pos={tp.desc} onMove={onMoveText ? (v) => onMoveText('desc', v) : undefined} label="Description" className="sp-card-sub">{sub}</MovableText>
          </div>
        )}
        {p.rating && p.rating.count > 0 && <Stars value={p.rating.average} count={p.rating.count} />}
        {kind !== 'compact' && <FactLine p={p} />}
        {kind === 'featured' && p.included?.length ? (
          <ul className="sp-incl sp-incl-card">{p.included.slice(0, 3).map((x, i) => <li key={i}><Check className="h-3.5 w-3.5" aria-hidden="true" />{x}</li>)}</ul>
        ) : null}
        {buy}
      </div>
    </article>
  )
}

/**
 * Product detail: a side panel on desktop, a full-screen sheet on mobile.
 * Escape and the close button close it; focus moves in on open and returns on close.
 */
export function ProductSheet({ p, onClose, buy, description, handle, products = [], onOpenProduct, saved, onToggleSave, savedNote }: { p: ShopProduct; onClose: () => void; buy: ReactNode; description: ReactNode; handle?: string; products?: ShopProduct[]; onOpenProduct?: (p: ShopProduct) => void; saved?: boolean; onToggleSave?: () => void; savedNote?: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"], video')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prevOverflow; before?.focus?.() }
  }, [onClose])
  return (
    <div className="sp-sheet-wrap" role="presentation">
      <div className="sp-sheet-dim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} className="sp-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <button type="button" className="sp-sheet-x" onClick={onClose} aria-label="Close"><XIcon className="h-4 w-4" /></button>
        <div className="sp-sheet-scroll">
          <Gallery p={p} label={`${p.title} images`} />
          <div className="sp-sheet-head">
            <Badges p={p} />
            <h2 id={titleId}>{p.title}</h2>
            {p.subtitle && <p className="sp-sheet-sub">{p.subtitle}</p>}
            {p.rating && p.rating.count > 0 && <a className="sp-sheet-rating" href="#sp-reviews"><Stars value={p.rating.average} count={p.rating.count} /></a>}
            <FactLine p={p} />
            <div className="sp-acts">
              {onToggleSave && <button type="button" className={cn('sp-act', saved && 'on')} aria-pressed={Boolean(saved)} onClick={onToggleSave}><Heart className="h-4 w-4" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button>}
              {handle && <ShareButton url={`${window.location.origin}/${handle}?p=${p.id}`} title={p.title} />}
              {p.sample?.url && <a className="sp-act" href={p.sample.url} download><Download className="h-4 w-4" aria-hidden="true" /> Free sample</a>}
            </div>
            {savedNote && saved && <p className="sp-fine">{savedNote}</p>}
          </div>
          <div className="sp-sheet-buy">{buy}</div>
          {description}
          {p.included?.length ? (
            <section className="sp-sheet-sec">
              <h3>What’s included</h3>
              <ul className="sp-incl">{p.included.map((x, i) => <li key={i}><Check className="h-4 w-4" aria-hidden="true" />{x}</li>)}</ul>
            </section>
          ) : null}
          {p.bundle ? (
            <section className="sp-sheet-sec">
              <h3>In this bundle</h3>
              <ul className="sp-incl">{p.bundle.items.map((i) => <li key={i.id}><Check className="h-4 w-4" aria-hidden="true" />{i.title}</li>)}</ul>
              {!p.bundle.available && <p className="sp-fine">This bundle can’t be bought right now because one of its products isn’t available.</p>}
            </section>
          ) : null}
          {p.faq?.length ? (
            <section className="sp-sheet-sec">
              <h3>Questions</h3>
              {p.faq.map((f, i) => (
                <details key={i} className="sp-sheet-faq"><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </section>
          ) : null}
          {handle && <Reviews handle={handle} productId={p.id} />}
          {(() => {
            const rel = (p.related ?? []).map((id) => products.find((x) => x.id === id)).filter((x): x is ShopProduct => Boolean(x))
            return rel.length ? (
              <section className="sp-sheet-sec">
                <h3>You might also like</h3>
                <div className="sp-related">
                  {rel.map((r) => (
                    <button key={r.id} type="button" className="sp-rel" onClick={() => onOpenProduct?.(r)}>
                      <CoverImage p={r} />
                      <span>{r.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null
          })()}
          <p className="sp-fine">Instant download after payment. A copy of the link is emailed to you.</p>
        </div>
        <div className="sp-sheet-bar">{buy}</div>
      </div>
    </div>
  )
}


/** Verified reviews with real totals, a rating breakdown, and a way to report abuse. */
function Reviews({ handle, productId }: { handle: string; productId: string }) {
  const [data, setData] = useState<{ summary: { average: number; count: number; breakdown: number[] }; reviews: PublicReview[] } | null>(null)
  const [err, setErr] = useState(false)
  const [reported, setReported] = useState<Record<string, boolean>>({})
  useEffect(() => {
    let alive = true
    storeApi.reviews(handle, productId).then((r) => alive && setData(r)).catch(() => alive && setErr(true))
    return () => { alive = false }
  }, [handle, productId])
  const report = async (id: string) => {
    const reason = window.prompt('What’s wrong with this review? (for example: abusive, spam, not about the product)')
    if (!reason?.trim()) return
    try { await storeApi.reportReview(handle, id, reason.trim()); setReported((r) => ({ ...r, [id]: true })) } catch { /* keep the button */ }
  }
  return (
    <section className="sp-sheet-sec" id="sp-reviews" aria-label="Reviews">
      <h3>Reviews</h3>
      {err ? <p className="sp-fine">Reviews couldn’t be loaded.</p> : !data ? <p className="sp-fine">Loading reviews…</p> : data.summary.count === 0 ? (
        <p className="sp-noreviews">No reviews yet. Buyers can leave one from their order page.</p>
      ) : (
        <>
          <div className="sp-rsum">
            <div><b>{data.summary.average.toFixed(1)}</b><Stars value={data.summary.average} size="lg" /><span>{data.summary.count} review{data.summary.count === 1 ? '' : 's'}</span></div>
            <ol className="sp-rbars" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = data.summary.breakdown[n - 1]
                return <li key={n}><span>{n}★</span><i><b style={{ width: `${data.summary.count ? (c / data.summary.count) * 100 : 0}%` }} /></i><span>{c}</span></li>
              })}
            </ol>
          </div>
          <ul className="sp-rlist">
            {data.reviews.map((r) => (
              <li key={r.id}>
                <div className="sp-rhead"><Stars value={r.rating} /><b>{r.name}</b><span className="sp-verified"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Verified buyer</span></div>
                {r.body && <p>{r.body}</p>}
                <div className="sp-rfoot">
                  <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString()}</time>{r.edited ? ' · edited' : ''}
                  <button type="button" disabled={reported[r.id]} onClick={() => void report(r.id)}><Flag className="h-3 w-3" aria-hidden="true" /> {reported[r.id] ? 'Reported' : 'Report'}</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
