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
    <section className="sx-home" ref={homeRef as RefObject<HTMLElement>} aria-label="Home">
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
 * One GSAP timeline drives Home ⇄ Products. Progress 0 is Home, 1 is Products.
 * Forward plays it, Home reverses the very same timeline, so going back is a
 * literal rewind. Clicking mid-way flips direction from the current progress.
 */
export function useViewTransition({ home, shop, initial, onState }: {
  home: RefObject<HTMLElement | null>
  shop: RefObject<HTMLElement | null>
  initial: View
  onState: (s: NavState) => void
}) {
  const tl = useRef<gsap.core.Timeline | null>(null)
  const state = useRef<NavState>(initial === 'products' ? 'PRODUCTS_READY' : 'HOME_READY')
  const set = useCallback((s: NavState) => { state.current = s; onState(s) }, [onState])

  // Both layers take part while moving; at rest only the current one is shown.
  const rest = useCallback((v: View) => {
    const h = home.current, s = shop.current
    if (!h || !s) return
    h.style.display = v === 'home' ? '' : 'none'
    s.style.display = v === 'products' ? '' : 'none'
    s.classList.remove('sx-over'); h.classList.remove('sx-moving')
    h.inert = v !== 'home'; s.inert = v !== 'products'
  }, [home, shop])
  const stage = useCallback(() => {
    const h = home.current, s = shop.current
    if (!h || !s) return
    h.style.display = ''; s.style.display = ''
    s.classList.add('sx-over'); h.classList.add('sx-moving')
    h.inert = true; s.inert = true
  }, [home, shop])

  const build = useCallback(() => {
    const h = home.current, s = shop.current
    if (!h || !s) return null
    tl.current?.kill()
    // measure in the Home state: clear anything a previous timeline left behind
    gsap.set(h.querySelectorAll('.sx-mo-tile, .sx-mo-copy, .sx-mo-hero, .sx-story'), { clearProps: 'all' })
    gsap.set(s.querySelectorAll('.sx-shop-in > *, .sx-row, .sx-art'), { clearProps: 'all' })
    const frame = h.querySelector<HTMLElement>('.sx-mo')!
    const hero = h.querySelector<HTMLElement>('.sx-mo-hero')!
    const slot = h.querySelector<HTMLElement>('.sx-mo-slot')!
    const fr = frame.getBoundingClientRect(), sr = slot.getBoundingClientRect()
    const r = parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 14
    const clipFrom = `inset(${sr.top - fr.top}px ${fr.right - sr.right}px ${fr.bottom - sr.bottom}px ${sr.left - fr.left}px round ${r}px)`
    const clipTo = `inset(0px 0px 0px 0px round ${parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0}px)`
    const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    const t = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onComplete: () => { rest('products'); set('PRODUCTS_READY') },
      onReverseComplete: () => { rest('home'); set('HOME_READY') },
    })
    gsap.set(hero, { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', gridArea: 'auto', borderRadius: 0, clipPath: clipFrom })
    // Products start hidden: nothing of them shows until the centre panel has opened.
    gsap.set(s, { autoAlpha: 0 })
    gsap.set(s.querySelectorAll('.sx-shop-in > :not(.sx-list-wrap)'), { autoAlpha: 0, y: 26 })
    gsap.set(s.querySelectorAll('.sx-row'), { autoAlpha: 0, y: 34 })
    // Phase 1: the copy steps back, the story below sinks away
    t.to(h.querySelector('.sx-mo-copy'), { autoAlpha: 0, y: -18, duration: 0.28, ease: 'power2.in' }, 0)
    const story = h.querySelector('.sx-story')
    if (story) t.to(story, { autoAlpha: 0, y: 40, duration: 0.35, ease: 'power2.in' }, 0)
    // Phase 1–2: surrounding panels part from the centre (product covers fly to their row instead)
    const rows = new Map([...s.querySelectorAll<HTMLElement>('.sx-row[data-pid]')].map((el) => [el.dataset.pid!, el]))
    h.querySelectorAll<HTMLElement>('.sx-mo-tile').forEach((el) => {
      const b = el.getBoundingClientRect()
      const art = el.dataset.pid ? rows.get(el.dataset.pid)?.querySelector<HTMLElement>('.sx-art') : null
      if (art && !reduce) {
        const a = art.getBoundingClientRect()
        t.to(el, { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / b.width, scaleY: a.height / b.height, transformOrigin: '0 0', borderRadius: 16, duration: 0.75, ease: 'power3.inOut' }, 0.12)
        t.to(el, { autoAlpha: 0, duration: 0.18 }, 0.82)
        gsap.set(art, { autoAlpha: 0 })
        t.to(art, { autoAlpha: 1, duration: 0.18 }, 0.8)
      } else {
        const dx = (b.left + b.width / 2 - cx) * 0.45, dy = (b.top + b.height / 2 - cy) * 0.45
        t.to(el, { x: reduce ? 0 : dx, y: reduce ? 0 : dy, scale: reduce ? 1 : 0.94, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0.06)
      }
    })
    // Phase 2: the central panel opens to fill the frame
    t.to(hero, { clipPath: clipTo, duration: 0.62, ease: 'power3.inOut' }, 0.14)
    t.to(frame, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.4 }, 0.3)
    // Phase 3: the products arrive on top of the opened panel, then the panel lets go
    t.to(s, { autoAlpha: 1, duration: 0.01 }, 0.56)
    t.to(s.querySelectorAll('.sx-shop-in > :not(.sx-list-wrap)'), { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' }, 0.6)
    t.to(s.querySelectorAll('.sx-row'), { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.05, ease: 'power3.out' }, 0.68)
    t.to(hero, { autoAlpha: 0, duration: 0.26, ease: 'power1.inOut' }, 0.5)
    if (reduce) t.timeScale(2.6)
    tl.current = t
    return t
  }, [home, shop, rest, set])

  // Scroll moves with the transition (never a jump).
  const glide = (to: number, d: number) => {
    if (Math.abs(scrollY - to) < 2) return
    const o = { y: scrollY }
    gsap.to(o, { y: to, duration: d, ease: 'power2.inOut', onUpdate: () => scrollTo(0, o.y) })
  }

  const go = useCallback((v: View) => {
    const cur = state.current
    if (v === 'products' && (cur === 'PRODUCTS_READY' || cur === 'HOME_TO_PRODUCTS')) return
    if (v === 'home' && (cur === 'HOME_READY' || cur === 'PRODUCTS_TO_HOME')) return
    const top = Math.max(0, (home.current?.parentElement?.getBoundingClientRect().top ?? 0) + scrollY - 90)
    if (v === 'products') {
      if (cur === 'HOME_READY') { stage(); build() } else stage()
      set('HOME_TO_PRODUCTS')
      glide(Math.min(scrollY, top), 0.5)
      tl.current?.play()
    } else {
      if (cur === 'PRODUCTS_READY' && !tl.current) { stage(); build()?.progress(1, true) }
      stage()
      set('PRODUCTS_TO_HOME')
      glide(Math.min(scrollY, top), 0.5)
      tl.current?.reverse()
    }
  }, [build, stage, set, home])

  // First paint: show the starting view without animating.
  useLayoutEffect(() => {
    rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
    return () => { tl.current?.kill(); tl.current = null }
  }, [rest])

  // A resize invalidates measurements: drop the timeline; the next move rebuilds it.
  useEffect(() => {
    const off = () => {
      if (state.current === 'HOME_READY' || state.current === 'PRODUCTS_READY') {
        tl.current?.kill(); tl.current = null
        const h = home.current, s = shop.current
        if (h && s) gsap.set([...h.querySelectorAll('.sx-mo-tile, .sx-mo-copy, .sx-mo-hero, .sx-story, .sx-mo'), ...s.querySelectorAll('.sx-shop-in > *, .sx-row, .sx-art'), s], { clearProps: 'all' })
        rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
      }
    }
    addEventListener('resize', off)
    return () => removeEventListener('resize', off)
  }, [home, shop, rest])

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
