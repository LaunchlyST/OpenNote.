import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { gsap } from 'gsap'
import { ArrowLeft, ArrowRight, Star } from 'lucide-react'
import { isFreeProduct, mediaUrl } from './model'
import type { CardPart, ShopProduct } from './model'
import { BuyRow } from './StorePage'
import type { StorePageProps } from './StorePage'

/**
 * Style 1 Products: a swipeable showroom. One product sits large in the centre,
 * its neighbours peek out behind it, and the whole environment behind the cards
 * takes on the colours of whichever product is in front, blending continuously
 * with the drag. Positions are written straight to the DOM from one `pos` value,
 * so dragging, snapping and the background never re-render React.
 */

export interface Theme { deep: string; a: string; b: string; surface: string; on: string }

/** A shared set of product worlds: one design system, controlled variation. */
const THEMES: Theme[] = [
  { deep: '#0d2419', a: '#a6e05c', b: '#2f8a5a', surface: '#f2f6ec', on: '#10200f' }, // botanical green
  { deep: '#1b1036', a: '#b892ff', b: '#6b3fd4', surface: '#f1ecfb', on: '#ffffff' }, // violet
  { deep: '#2a1405', a: '#ffb64a', b: '#e0761c', surface: '#fbf1e2', on: '#2a1405' }, // amber
  { deep: '#0a1a33', a: '#7cb2ff', b: '#2c5fd6', surface: '#ebf1fd', on: '#ffffff' }, // night blue
  { deep: '#2a0c1c', a: '#ff86b0', b: '#c13e6e', surface: '#fbecf2', on: '#ffffff' }, // rose
  { deep: '#06242a', a: '#5ad7c9', b: '#1b8c88', surface: '#e8f6f4', on: '#062a26' }, // teal
]

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
function lum(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) return 0.5
  const [r, g, b] = m.slice(0, 3).map((x) => parseInt(x, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Same product → same world, every visit. A seller's own button colour wins. */
export function themeOf(p: ShopProduct, i: number, used: number[]): Theme {
  let k = hash(p.id) % THEMES.length
  // neighbours never share a world
  for (let n = 0; n < THEMES.length && (used[i - 1] === k); n++) k = (k + 1) % THEMES.length
  used[i] = k
  const t = THEMES[k]
  const c = p.cta?.color
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return { ...t, a: c, b: c, on: lum(c) > 0.6 ? '#141312' : '#ffffff' }
  return t
}

export function Carousel({ list, blockId, props, focusId }: { list: ShopProduct[]; blockId: string; props: StorePageProps; focusId?: string | null }) {
  const { live } = props
  const used: number[] = []
  const themes = list.map((p, i) => themeOf(p, i, used))
  const root = useRef<HTMLDivElement>(null)
  const pos = useRef(0)
  const snapTween = useRef<gsap.core.Tween | null>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const n = list.length

  // Lay every card and background layer out from the current `pos`.
  const render = useCallback(() => {
    const el = root.current
    if (!el) return
    const w = el.clientWidth
    const narrow = w < 640
    const gap = narrow ? w * 0.8 : Math.min(440, w * 0.44)
    const p = pos.current
    el.querySelectorAll<HTMLElement>('.sx-card').forEach((c, i) => {
      const d = i - p, ad = Math.abs(d)
      const x = d * gap * (ad > 1 ? 0.92 : 1)
      const s = 1 - Math.min(ad, 2) * (narrow ? 0.08 : 0.13)
      const ry = reduce ? 0 : Math.max(-1, Math.min(1, d)) * -14
      c.style.transform = `translate3d(calc(-50% + ${x}px), 0, ${-ad * 120}px) rotateY(${ry}deg) scale(${s})`
      c.style.zIndex = String(100 - Math.round(ad * 10))
      c.style.opacity = String(ad > 2.6 ? 0 : 1 - Math.max(0, ad - 1.6) * 0.9)
      c.style.filter = ad > 0.5 ? `saturate(${1 - Math.min(ad, 1.5) * 0.25}) brightness(${1 - Math.min(ad, 1.5) * 0.12})` : ''
      c.dataset.near = ad < 0.5 ? 'active' : ad < 1.5 ? 'side' : 'far'
    })
    el.querySelectorAll<HTMLElement>('.sx-env-layer').forEach((l, i) => {
      const d = i - p, ad = Math.abs(d)
      l.style.opacity = String(Math.max(0, 1 - ad))
      l.style.transform = reduce ? '' : `translate3d(${-d * 18}%, 0, 0) scale(${1 + ad * 0.15})`
      const art = l.querySelector<HTMLElement>('.sx-env-art')
      if (art && !reduce) art.style.transform = `translate3d(${-d * 30}%, ${ad * 6}%, 0) scale(${1.2 + ad * 0.2})`
    })
    const k = Math.max(0, Math.min(n - 1, Math.round(p)))
    if (k !== activeRef.current) { activeRef.current = k; setActive(k) }
  }, [n, reduce])

  const snap = useCallback((to: number, v = 0) => {
    const target = Math.max(0, Math.min(n - 1, Math.round(to)))
    snapTween.current?.kill()
    snapTween.current = gsap.to(pos, {
      current: target,
      duration: reduce ? 0.2 : 0.62 + Math.min(Math.abs(v) * 0.05, 0.2),
      ease: reduce ? 'power1.out' : 'back.out(1.15)',
      onUpdate: render,
    })
  }, [n, render, reduce])

  useLayoutEffect(() => { pos.current = Math.min(pos.current, Math.max(0, n - 1)); render() }, [n, render])
  useEffect(() => {
    const on = () => render()
    addEventListener('resize', on)
    return () => { removeEventListener('resize', on); snapTween.current?.kill() }
  }, [render])
  // Category filter changed the list: start from the first product.
  const ids = list.map((p) => p.id).join(',')
  useEffect(() => { pos.current = 0; activeRef.current = 0; setActive(0); render() }, [ids, render])

  // A product chosen on Home comes to the front when Products opens.
  useEffect(() => {
    const i = focusId ? list.findIndex((p) => p.id === focusId) : -1
    if (i < 0) return
    snapTween.current?.kill(); pos.current = i; activeRef.current = i; setActive(i); render()
  }, [focusId, render]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag / swipe: the cards follow the finger, then settle on the nearest product.
  const drag = useRef<{ x: number; y: number; p: number; t: number; lastX: number; lastT: number; moved: boolean; axis: 'x' | 'y' | null } | null>(null)
  const down = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input, select, textarea, .sx-menu-pop')) return
    snapTween.current?.kill()
    drag.current = { x: e.clientX, y: e.clientY, p: pos.current, t: performance.now(), lastX: e.clientX, lastT: performance.now(), moved: false, axis: null }
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || !root.current) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (d.axis !== 'x') return
    d.moved = true
    const w = root.current.clientWidth
    const gap = w < 640 ? w * 0.8 : Math.min(440, w * 0.44)
    let p = d.p - dx / gap
    if (p < 0) p = p * 0.35; else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35 // rubber band at the ends
    pos.current = p
    d.lastX = e.clientX; d.lastT = performance.now()
    render()
  }
  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.moved) return
    const dt = Math.max(16, performance.now() - d.lastT + 16)
    const v = (e.clientX - d.lastX) / dt // px per ms
    const w = root.current?.clientWidth ?? 1000
    const gap = w < 640 ? w * 0.8 : Math.min(440, w * 0.44)
    const fling = Math.abs(v) > 0.35 ? -Math.sign(v) * 0.6 : 0
    snap(pos.current + fling, v * 20)
    lastDragAt.current = performance.now()
    void gap
  }
  const lastDragAt = useRef(0)

  // Trackpad: horizontal two-finger swipes move one product at a time.
  const wheelAcc = useRef(0)
  const wheelTimer = useRef<number | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      wheelAcc.current += e.deltaX
      if (Math.abs(wheelAcc.current) > 60 && !wheelTimer.current) {
        snap(activeRef.current + Math.sign(wheelAcc.current))
        wheelAcc.current = 0
        wheelTimer.current = window.setTimeout(() => { wheelTimer.current = null }, 420)
      }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [snap])

  const key = (e: ReactKeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return
    if (e.key === 'ArrowRight') { e.preventDefault(); snap(activeRef.current + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); snap(activeRef.current - 1) }
    if (e.key === 'Home') { e.preventDefault(); snap(0) }
    if (e.key === 'End') { e.preventDefault(); snap(n - 1) }
  }

  if (!n) return null
  const cur = themes[active] ?? themes[0]
  return (
    <div
      className={n === 1 ? 'sx-show sx-show-one' : 'sx-show'}
      ref={root}
      style={{ '--ta': cur.a, '--tb': cur.b } as CSSProperties}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onKeyDown={key}
      onClickCapture={(e) => { if (performance.now() - lastDragAt.current < 250) { e.preventDefault(); e.stopPropagation() } }}
      onDragStart={(e) => e.preventDefault()}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Products"
    >
      <div className="sx-env" aria-hidden="true"><div className="sx-env-inner">
        {list.map((p, i) => {
          const t = themes[i]
          const c = mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null)
          return (
            <div key={p.id} className="sx-env-layer" style={{ '--deep': t.deep, '--a': t.a, '--b': t.b } as CSSProperties}>
              {c && <img className="sx-env-art" src={c} alt="" draggable={false} />}
              <span className="sx-env-arc" />
              <span className="sx-env-glow" />
            </div>
          )
        })}
        <span className="sx-env-floor" />
      </div></div>
      <div className="sx-track">
        {list.map((p, i) => (
          <Card key={p.id} p={p} i={i} t={themes[i]} isActive={i === active} n={n} blockId={blockId} props={props}
            onFocusCard={() => { if (performance.now() - lastDragAt.current > 250 && i !== activeRef.current) snap(i) }} live={!!live} />
        ))}
      </div>
      {n > 1 && (
        <div className="sx-show-nav">
          <button type="button" className="sx-show-arrow" aria-label="Previous product" disabled={active === 0} onClick={() => snap(active - 1)}><ArrowLeft aria-hidden="true" /></button>
          <div className="sx-dots" role="tablist" aria-label="Choose a product">
            {list.map((p, i) => (
              <button key={p.id} type="button" role="tab" aria-selected={i === active} aria-label={`${i + 1} of ${n}: ${p.title}`} className={i === active ? 'on' : ''} onClick={() => snap(i)} />
            ))}
          </div>
          <button type="button" className="sx-show-arrow" aria-label="Next product" disabled={active === n - 1} onClick={() => snap(active + 1)}><ArrowRight aria-hidden="true" /></button>
        </div>
      )}
      <p className="sx-sr" aria-live="polite">{list[active]?.title} — {active + 1} of {n}</p>
    </div>
  )
}

function Card({ p, i, t, isActive, n, blockId, props, onFocusCard, live }: { p: ShopProduct; i: number; t: Theme; isActive: boolean; n: number; blockId: string; props: StorePageProps; onFocusCard: () => void; live: boolean }) {
  const cover = mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null)
  const meta = [p.fileType, p.format].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k)
  const affiliate = !!(p.affiliate?.url || p.productType === 'affiliate')
  // Editor: a click on a part opens that part's settings in the Studio panel.
  const pick = (part: CardPart) => (e: ReactMouseEvent<HTMLElement>) => {
    if (live) return
    if (!isActive) { onFocusCard(); return }
    e.preventDefault(); e.stopPropagation()
    props.onPick?.(blockId, e.currentTarget, p.id, part)
  }
  const sel = (part: CardPart) => (!live && props.editCard?.productId === p.id && props.editCard.part === part ? ' sx-picked' : '')
  return (
    <article
      className={'sx-card' + sel('card')}
      data-pid={p.id}
      aria-roledescription="slide"
      aria-label={`${i + 1} of ${n}: ${p.title}`}
      aria-hidden={!isActive || undefined}
      style={{ '--deep': t.deep, '--a': t.a, '--b': t.b, '--surface': t.surface, '--on': t.on } as CSSProperties}
      onClickCapture={(e) => { if (!isActive) { e.preventDefault(); e.stopPropagation(); onFocusCard() } }}
      onClick={live ? undefined : pick('card')}
    >
      <button type="button" className={'sx-card-art' + sel('cover')} onClick={live ? () => props.onOpenProduct?.(p) : pick('cover')} aria-label={`View ${p.title}`} tabIndex={isActive ? 0 : -1}>
        {cover ? <><img className="sx-card-blur" src={cover} alt="" aria-hidden="true" draggable={false} /><img className="sx-card-img" src={cover} alt="" draggable={false} /></> : <span className="sx-card-ph">{p.title}</span>}
        {p.offer && !isFreeProduct(p) && <i className="sx-card-off">−{p.offer.percent}%</i>}
      </button>
      <div className="sx-card-body">
        <h3 className={'sx-card-title' + sel('title')} onClick={live ? () => props.onOpenProduct?.(p) : pick('title')}>{p.title}</h3>
        {(p.subtitle || p.description) && <p className={'sx-card-desc' + sel('desc')} onClick={live ? undefined : pick('desc')}>{p.subtitle || p.description}</p>}
        <p className="sx-card-meta">
          <span>{affiliate ? 'Partner product' : 'Digital download'}</span>
          {meta.map((m) => <span key={m}>{m}</span>)}
          {p.rating && p.rating.count > 0 && <span className="sx-card-rate"><Star aria-hidden="true" /> {p.rating.average.toFixed(1)} ({p.rating.count})</span>}
        </p>
        <div className={'sx-card-buy' + sel('button')} onClickCapture={live ? undefined : pick('button')}>
          <BuyRow prod={p} {...props} priceInButton />
        </div>
      </div>
    </article>
  )
}
