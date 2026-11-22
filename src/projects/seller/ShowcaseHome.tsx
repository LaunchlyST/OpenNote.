import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react'
import { gsap } from 'gsap'
import { ArrowRight } from 'lucide-react'
import { mediaUrl } from './model'
import type { Page, ShopProduct } from './model'
import type { StorePageProps } from './StorePage'

/**
 * Style 1 Home: an art-directed mosaic of the seller's own images (banner, covers,
 * gallery shots) around one large central panel, then a short landing page.
 * Inspired by the composition of Oversight's "Home — Product Showcase 01"; the code
 * here is Desknoty's own (their source needs a signed-in account and was not used).
 */

export type View = 'home' | 'products'
export type NavState = 'HOME_READY' | 'HOME_TO_PRODUCTS' | 'PRODUCTS_READY' | 'PRODUCTS_TO_HOME'

type Tile = { src: string; pid?: string; video?: boolean }

/** Unique real images, best first. The centre gets the banner (or the first cover). */
export function mosaicImages(page: Page, products: ShopProduct[]): { hero: Tile | null; tiles: Tile[] } {
  const seen = new Set<string>()
  const out: Tile[] = []
  const add = (src: string | null | undefined, pid?: string, video?: boolean) => {
    if (!src || seen.has(src)) return
    seen.add(src); out.push({ src, pid, video })
  }
  if (page.banner) add(mediaUrl(page.banner.media), undefined, page.banner.kind === 'video')
  for (const p of products) add(mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null), p.id)
  for (const p of products) for (const g of p.gallery ?? []) add(mediaUrl(g))
  const hero = out.shift() ?? null
  return { hero, tiles: out.slice(0, 6) }
}

function Img({ t, className }: { t: Tile; className?: string }) {
  return t.video
    ? <video className={className} src={t.src} muted playsInline preload="metadata" />
    : <img className={className} src={t.src} alt="" loading="eager" decoding="async" draggable={false} />
}

/** The six mosaic slots around the centre, in reading order. */
const SLOTS = ['tl', 'tr', 'ml', 'mr', 'bl', 'br'] as const

export function HomeView({ props, products, onExplore, homeRef }: {
  props: StorePageProps
  products: ShopProduct[]
  onExplore: () => void
  homeRef: RefObject<HTMLElement | null>
}) {
  const { page, handle } = props
  const { hero, tiles } = mosaicImages(page, products)
  const frame = useRef<HTMLDivElement>(null)
  const formats = [...new Set(products.flatMap((p) => [p.format, p.fileType]).filter(Boolean) as string[])].slice(0, 6)
  const kicker = formats.length ? formats.slice(0, 3).join(' · ') : 'Digital products'
  const title = page.name?.trim() || `@${handle}`

  // Pointer depth: tiles drift a little against the pointer; the centre stays steady.
  const move = (e: ReactMouseEvent) => {
    const f = frame.current
    if (!f || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = f.getBoundingClientRect()
    f.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
    f.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
  }
  const leave = () => { frame.current?.style.setProperty('--px', '0'); frame.current?.style.setProperty('--py', '0') }

  return (
    <section className={props.live ? 'sx-home' : 'sx-home sx-home-inline'} ref={homeRef as RefObject<HTMLElement>} aria-label="Home">
      <div className="sx-mo" ref={frame} onMouseMove={move} onMouseLeave={leave}>
        {SLOTS.map((k, i) => {
          const t = tiles[i]
          return (
            <div key={k} className={`sx-mo-tile sx-mo-${k}${t ? '' : ' sx-mo-tone'}`} data-pid={t?.pid}>
              {t && <Img t={t} />}
            </div>
          )
        })}
        <div className="sx-mo-slot" aria-hidden="true" />
        <div className="sx-mo-hero">
          {hero ? <Img t={hero} className="sx-mo-hero-img" /> : <span className="sx-mo-hero-img sx-mo-hero-plain" />}
          <span className="sx-mo-veil" aria-hidden="true" />
          <div className="sx-mo-copy">
            <p className="sx-mo-kicker">{kicker}</p>
            <h2 className="sx-mo-title">{title}</h2>
            {page.bio?.trim() && <p className="sx-mo-bio">{page.bio}</p>}
            {products.length > 0 && (
              <button type="button" className="sx-mo-cta" onClick={onExplore}>
                Explore the collection <ArrowRight aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

    </section>
  )
}

/**
 * One GSAP timeline drives Home ⇄ Products. Progress 0 = the full-screen Home intro,
 * 1 = the shopping layout. Home reverses the very same timeline (a literal rewind);
 * clicking mid-way flips direction from the current progress.
 */
export function useViewTransition({ home, root, initial, live, onState }: {
  home: RefObject<HTMLElement | null>
  root: RefObject<HTMLElement | null>
  initial: View
  live?: boolean
  onState: (s: NavState) => void
}) {
  const tl = useRef<gsap.core.Timeline | null>(null)
  const state = useRef<NavState>(initial === 'products' ? 'PRODUCTS_READY' : 'HOME_READY')
  const set = useCallback((s: NavState) => { state.current = s; onState(s) }, [onState])
  const shopEls = useCallback(() => root.current ? [...root.current.querySelectorAll<HTMLElement>(':scope > .sx-stage, :scope > .sx-panel, :scope > .sx-fab')] : [], [root])
  const lock = useCallback((on: boolean) => { if (live) document.documentElement.style.overflow = on ? 'hidden' : '' }, [live])

  const rest = useCallback((v: View) => {
    const h = home.current
    if (!h) return
    h.style.display = v === 'home' ? '' : 'none'
    h.inert = v !== 'home'
    for (const el of shopEls()) { el.style.visibility = v === 'home' ? 'hidden' : ''; el.inert = v === 'home' }
    lock(v === 'home')
  }, [home, shopEls, lock])

  const build = useCallback(() => {
    const h = home.current, r = root.current
    if (!h || !r) return null
    tl.current?.kill()
    h.style.display = ''
    const els = shopEls()
    for (const el of els) { el.style.visibility = ''; }
    gsap.set([...h.querySelectorAll('.sx-mo-tile, .sx-mo-copy, .sx-mo-hero, .sx-mo-hero-img'), h, ...els, ...r.querySelectorAll('.sx-row, .sx-art')], { clearProps: 'all' })
    const frame = h.querySelector<HTMLElement>('.sx-mo')!
    const hero = h.querySelector<HTMLElement>('.sx-mo-hero')!
    const slot = h.querySelector<HTMLElement>('.sx-mo-slot')!
    const fr = frame.getBoundingClientRect(), sr = slot.getBoundingClientRect()
    const rad = parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 18
    const clipFrom = `inset(${sr.top - fr.top}px ${fr.right - sr.right}px ${fr.bottom - sr.bottom}px ${sr.left - fr.left}px round ${rad}px)`
    const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    // where each product cover lives in the shopping layout (measured before hiding it)
    const arts = new Map([...r.querySelectorAll<HTMLElement>('.sx-row[data-pid]')].map((row) => [row.dataset.pid!, row.querySelector<HTMLElement>('.sx-art')!]))
    const artRect = new Map([...arts].map(([k, a]) => [k, a.getBoundingClientRect()]))
    const stage = r.querySelector(':scope > .sx-stage'), panel = r.querySelector(':scope > .sx-panel'), fab = r.querySelector(':scope > .sx-fab')
    const rows = r.querySelectorAll('.sx-panel .sx-shop-in > *, .sx-row')

    const t = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onComplete: () => { rest('products'); set('PRODUCTS_READY') },
      onReverseComplete: () => { rest('home'); set('HOME_READY') },
    })
    // start state of the shopping layout: hidden, slightly back
    if (stage) gsap.set(stage, { autoAlpha: 0, scale: 1.08, transformOrigin: '30% 50%' })
    if (panel) gsap.set(panel, { autoAlpha: 0, x: 90 })
    gsap.set(rows, { autoAlpha: 0, y: 34 })
    if (fab) gsap.set(fab, { autoAlpha: 0, y: 20 })
    gsap.set(hero, { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', gridArea: 'auto', borderRadius: 0, clipPath: clipFrom })

    // 1 — the introduction steps back
    t.to(h.querySelector('.sx-mo-copy'), { autoAlpha: 0, y: -26, scale: 0.98, duration: 0.3, ease: 'power2.in' }, 0)
    // 2 — panels part and rush past the camera; product covers fly to their place in the list
    h.querySelectorAll<HTMLElement>('.sx-mo-tile').forEach((el) => {
      const b = el.getBoundingClientRect()
      const a = el.dataset.pid ? artRect.get(el.dataset.pid) : undefined
      if (a && a.width && !reduce) {
        t.to(el, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0', borderRadius: 16, duration: 0.8, ease: 'power3.inOut' }, 0.08)
        const art = arts.get(el.dataset.pid!)!
        gsap.set(art, { autoAlpha: 0 })
        t.to(art, { autoAlpha: 1, duration: 0.15 }, 0.84)
        t.to(el, { autoAlpha: 0, duration: 0.15 }, 0.86)
      } else {
        const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy
        t.to(el, { x: reduce ? 0 : dx * 0.9, y: reduce ? 0 : dy * 0.9, scale: reduce ? 1 : 1.3, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0.04)
      }
    })
    // 3 — the centre panel opens to the whole screen and the camera keeps moving in
    t.to(hero, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.62, ease: 'power3.inOut' }, 0.1)
    t.to(h.querySelector('.sx-mo-hero-img'), { scale: reduce ? 1 : 1.28, duration: 0.95, ease: 'power2.in' }, 0.08)
    // 4 — the environment dissolves into the shop
    t.to(frame, { backgroundColor: 'rgba(15,14,12,0)', duration: 0.3 }, 0.3)
    t.to(h, { backgroundColor: 'rgba(15,14,12,0)', duration: 0.3 }, 0.42)
    t.to(hero, { autoAlpha: 0, duration: 0.34, ease: 'power1.inOut' }, 0.6)
    if (stage) t.to(stage, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'power3.out' }, 0.5)
    if (panel) t.to(panel, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }, 0.56)
    t.to(rows, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.04, ease: 'power3.out' }, 0.64)
    if (fab) t.to(fab, { autoAlpha: 1, y: 0, duration: 0.3 }, 0.9)
    if (reduce) t.timeScale(2.6)
    tl.current = t
    return t
  }, [home, root, shopEls, rest, set])

  const glide = (to: number, d: number) => {
    if (Math.abs(scrollY - to) < 2) return
    const o = { y: scrollY }
    gsap.to(o, { y: to, duration: d, ease: 'power2.inOut', onUpdate: () => scrollTo(0, o.y) })
  }

  const go = useCallback((v: View) => {
    const cur = state.current
    if (v === 'products' && (cur === 'PRODUCTS_READY' || cur === 'HOME_TO_PRODUCTS')) return
    if (v === 'home' && (cur === 'HOME_READY' || cur === 'PRODUCTS_TO_HOME')) return
    if (home.current) { home.current.style.display = ''; home.current.inert = true }
    if (v === 'products') {
      if (cur === 'HOME_READY' || !tl.current) build()
      for (const el of shopEls()) el.style.visibility = ''
      set('HOME_TO_PRODUCTS')
      lock(false)
      tl.current?.play()
    } else {
      if (!tl.current) { glide(0, 0.01); build()?.progress(1, true) }
      for (const el of shopEls()) el.inert = true
      set('PRODUCTS_TO_HOME')
      glide(0, 0.45)
      tl.current?.reverse()
    }
  }, [build, set, home, shopEls, lock])

  useLayoutEffect(() => {
    rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
    return () => { tl.current?.kill(); tl.current = null; lock(false) }
  }, [rest, lock])

  // A resize invalidates measurements: drop the timeline at rest; the next move rebuilds it.
  useEffect(() => {
    const off = () => {
      if (state.current !== 'HOME_READY' && state.current !== 'PRODUCTS_READY') return
      tl.current?.kill(); tl.current = null
      const h = home.current, r = root.current
      if (h && r) gsap.set([...h.querySelectorAll('.sx-mo-tile, .sx-mo-copy, .sx-mo-hero, .sx-mo-hero-img, .sx-mo'), h, ...shopEls(), ...r.querySelectorAll('.sx-shop-in > *, .sx-row, .sx-art')], { clearProps: 'all' })
      rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
    }
    addEventListener('resize', off)
    return () => removeEventListener('resize', off)
  }, [home, root, shopEls, rest])

  return go
}

export function useInitialView(live?: boolean): View {
  const [v] = useState<View>(() => {
    if (!live) return 'home'
    try { return new URLSearchParams(location.search).get('view') === 'products' ? 'products' : 'home' } catch { return 'home' }
  })
  return v
}

export type { ReactNode }
