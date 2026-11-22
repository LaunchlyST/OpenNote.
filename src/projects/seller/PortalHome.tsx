import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { ArrowRight, Eye } from 'lucide-react'
import { mediaUrl } from './model'
import type { ShopProduct } from './model'
import type { StorePageProps } from './StorePage'
import type { NavState, View } from './ShowcaseHome'
import { kindOf } from './portalKind'
import type { PortalHandle, PortalProduct } from './PortalScene'
import { themeOf } from './ShowcaseCarousel'

/**
 * Style 1 Home — "The Digital Portal": a full-viewport 3D desk scene (canvas) with all copy and
 * controls in accessible HTML. The 3D code is loaded only when Home is shown; reduced motion,
 * missing WebGL or a failed load fall back to a complete still scene built from the seller's banner.
 */

/** Shared between the view and the transition: the scene, once it exists. */
export interface PortalBus { scene: PortalHandle | null; progress: { p: number } }

export function PortalView({ props, products, onEnter, onSkip, homeRef, bus, selected, onSelect, active }: {
  active: boolean
  props: StorePageProps
  products: ShopProduct[]
  onEnter: () => void
  onSkip: () => void
  homeRef: RefObject<HTMLElement | null>
  bus: RefObject<PortalBus>
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { page, handle, live } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'loading' | '3d' | 'still'>('loading')
  const banner = page.banner?.kind === 'image' ? mediaUrl(page.banner.media) : null
  const name = page.name?.trim() || `@${handle}`
  const formats = [...new Set(products.flatMap((p) => [p.format, p.fileType]).filter(Boolean) as string[])].slice(0, 3)
  const featured = products.slice(0, 6)
  const sel = products.find((p) => p.id === selected) ?? null
  useEffect(() => { const i = featured.findIndex((p) => p.id === selected); bus.current?.scene?.setSelected(i < 0 ? null : i) }, [selected, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = canvas.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    // the editor preview and reduced motion get the still scene; so does a browser without WebGL
    const gl = (() => { try { const t = document.createElement('canvas'); return Boolean(t.getContext('webgl2') || t.getContext('webgl')) } catch { return false } })()
    if (!c || !live || !gl || reduce) { setMode('still'); return }
    if (!active) return // load the 3D only once Home is actually shown
    let alive = true
    const mobile = innerWidth < 760
    const used: number[] = []
    const list: PortalProduct[] = featured.map((p, i) => ({ id: p.id, title: p.title, cover: mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null), kind: kindOf(p), accent: themeOf(p, i, used).a }))
    import('./PortalScene').then(({ createPortal }) => createPortal(c, {
      products: list, handle, mobile, reduce,
      onSelect: (i) => onSelect(i === null ? null : list[i]?.id ?? null),
      onHover: () => {},
    })).then((s) => {
      if (!alive) { s.dispose(); return }
      bus.current!.scene = s
      s.setProgress(bus.current!.progress.p)
      setMode('3d')
      // Scene A: lights, camera, CRT power, bird hop, objects (~2 s); the HTML stays clickable throughout
      const o = { t: 0 }
      gsap.to(o, { t: 1, duration: 2.1, ease: 'none', onUpdate: () => s.setIntro(o.t) })
    }).catch(() => { if (alive) setMode('still') })
    const onResize = () => bus.current?.scene?.resize()
    const onVis = () => bus.current?.scene?.setPaused(document.hidden)
    addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      bus.current?.scene?.dispose()
      if (bus.current) bus.current.scene = null
    }
    // the scene is built once per page load from the products on the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, handle, active, featured.map((p) => p.id).join(',')])

  return (
    <section className={`sx-home sx-portal sx-portal-${mode}${live ? '' : ' sx-home-inline'}`} ref={homeRef as RefObject<HTMLElement>} aria-label="Home">
      <div className="sx-portal-stage" aria-hidden="true">
        <canvas ref={canvas} className="sx-portal-canvas" />
        <div className="sx-portal-still" style={banner ? { backgroundImage: `url(${banner})` } : undefined}>
          <span className="sx-portal-scan" />
        </div>
        <span className="sx-portal-flash" />
      </div>
      <div className="sx-portal-copy">
        <a className="sx-portal-skip" href="?view=products" onClick={(e) => { e.preventDefault(); onSkip() }}>Skip to products <ArrowRight aria-hidden="true" /></a>
        <div className="sx-portal-text">
          <p className="sx-kicker"><span />Creator store</p>
          <h1 className="sx-portal-name">{name}</h1>
          {page.bio?.trim() && <p className="sx-portal-bio">{page.bio}</p>}
          {products.length > 0 && <p className="sx-portal-offer">{products.length} digital product{products.length === 1 ? '' : 's'}{formats.length ? ` · ${formats.join(', ')}` : ''}</p>}
          {products.length > 0 && (
            <button type="button" className="sx-portal-cta" onClick={onEnter}>Enter the store <ArrowRight aria-hidden="true" /></button>
          )}
          {featured.length > 0 && (
            <div className="sx-portal-objects" role="group" aria-label="Products inside the computer">
              {featured.map((p) => (
                <button key={p.id} type="button" className={p.id === selected ? 'on' : ''} aria-pressed={p.id === selected} onClick={() => onSelect(p.id === selected ? null : p.id)}>
                  {mediaUrl(p.cover) ? <img src={mediaUrl(p.cover)!} alt="" /> : <i />}
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          )}
          {sel && (
            <div className="sx-portal-pick" role="status">
              <b>{sel.title}</b>
              <button type="button" onClick={() => (live ? props.onOpenProduct?.(sel) : onEnter())}><Eye aria-hidden="true" /> View product</button>
              <button type="button" className="ghost" onClick={onEnter}>Open in the store <ArrowRight aria-hidden="true" /></button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * One paused GSAP timeline is the source of truth for both directions:
 * progress 0 = Home, 1 = Products. It drives the 3D camera (via bus.progress), the
 * HTML copy, the hand-off and the shop's entrance. Home = reverse() of the same timeline.
 */
export function usePortalTransition({ home, root, initial, live, bus, onState }: {
  home: RefObject<HTMLElement | null>
  root: RefObject<HTMLElement | null>
  initial: View
  live?: boolean
  bus: RefObject<PortalBus>
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
    h.style.visibility = v === 'home' ? '' : 'hidden'
    h.inert = v !== 'home'
    for (const el of shopEls()) { el.style.visibility = v === 'home' ? 'hidden' : ''; el.inert = v === 'home' }
    bus.current?.scene?.setPaused(v !== 'home')
    lock(v === 'home')
  }, [home, shopEls, lock, bus])

  const build = useCallback(() => {
    const h = home.current, r = root.current
    if (!h || !r) return null
    tl.current?.kill()
    const els = shopEls()
    for (const el of els) el.style.visibility = ''
    h.style.visibility = ''
    const stage = r.querySelector(':scope > .sx-stage'), panel = r.querySelector(':scope > .sx-panel'), fab = r.querySelector(':scope > .sx-fab')
    const items = r.querySelectorAll('.sx-panel .sx-shop-in > *')
    gsap.set([h, ...h.querySelectorAll('.sx-portal-text, .sx-portal-skip, .sx-portal-flash'), ...els, ...items], { clearProps: 'all' })
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = innerWidth < 760
    const prog = bus.current!.progress
    const t = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.inOut' },
      onUpdate: () => bus.current?.scene?.setProgress(prog.p),
      onComplete: () => { rest('products'); set('PRODUCTS_READY') },
      onReverseComplete: () => { rest('home'); set('HOME_READY') },
    })
    // start state of the shop (hidden, a little back)
    if (stage) gsap.set(stage, { autoAlpha: 0, scale: 1.06, transformOrigin: '30% 50%' })
    if (panel) gsap.set(panel, { autoAlpha: 0, x: 80 })
    gsap.set(items, { autoAlpha: 0, y: 28 })
    if (fab) gsap.set(fab, { autoAlpha: 0, y: 16 })
    // the 3D journey: one linear 0→1 over 1.6 s; the scene maps it to brighten → approach → glass → tunnel
    t.to(prog, { p: 1, duration: 1.6, ease: 'none' }, 0)
    // copy steps aside as the CRT brightens
    t.to(h.querySelectorAll('.sx-portal-text, .sx-portal-skip'), { autoAlpha: 0, y: -18, duration: 0.24, ease: 'power2.in' }, 0)
    // a flash of light at the glass (also the whole effect for the still scene)
    t.fromTo(h.querySelector('.sx-portal-flash'), { autoAlpha: 0 }, { autoAlpha: 0.9, duration: 0.25, immediateRender: false }, 0.62)
    t.to(h.querySelector('.sx-portal-flash'), { autoAlpha: 0, duration: 0.4 }, 1.1)
    t.to(h.querySelector('.sx-portal-still'), { scale: 1.35, duration: 1.1, ease: 'power2.in' }, 0)
    // the tunnel opens into the Products layout
    t.to(h, { autoAlpha: 0, duration: 0.45, ease: 'power1.inOut' }, 1.12)
    if (stage) t.to(stage, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, 1.1)
    if (panel) t.to(panel, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' }, 1.12)
    t.to(items, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.04, ease: 'power3.out' }, 1.18)
    if (fab) t.to(fab, { autoAlpha: 1, y: 0, duration: 0.3 }, 1.35)
    t.timeScale(reduce ? 3 : mobile ? 1.35 : 1)
    tl.current = t
    return t
  }, [home, root, shopEls, rest, set, bus])

  const glide = (to: number, d: number) => {
    if (Math.abs(scrollY - to) < 2) return
    const o = { y: scrollY }
    gsap.to(o, { y: to, duration: d, ease: 'power2.inOut', onUpdate: () => scrollTo(0, o.y) })
  }

  const go = useCallback((v: View, opts?: { fast?: boolean }) => {
    const cur = state.current
    if (v === 'products' && (cur === 'PRODUCTS_READY' || cur === 'HOME_TO_PRODUCTS')) return
    if (v === 'home' && (cur === 'HOME_READY' || cur === 'PRODUCTS_TO_HOME')) return
    if (home.current) home.current.inert = true
    if (v === 'products') {
      if (!tl.current) build()
      for (const el of shopEls()) el.style.visibility = ''
      set('HOME_TO_PRODUCTS')
      lock(false)
      { const mobile = innerWidth < 760, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; tl.current?.timeScale(opts?.fast || reduce ? 3 : mobile ? 1.35 : 1) }
      tl.current?.play()
    } else {
      if (!tl.current) { glide(0, 0.01); build()?.progress(1, true) }
      if (home.current) home.current.style.visibility = ''
      bus.current?.scene?.setPaused(false)
      for (const el of shopEls()) el.inert = true
      set('PRODUCTS_TO_HOME')
      glide(0, 0.4)
      const mobile = innerWidth < 760, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      tl.current?.timeScale(reduce ? 3 : mobile ? 1.35 : 1)
      tl.current?.reverse()
    }
  }, [build, set, home, shopEls, lock, bus])

  useLayoutEffect(() => {
    rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
    if (state.current === 'PRODUCTS_READY') bus.current!.progress.p = 1
    return () => { tl.current?.kill(); tl.current = null; lock(false) }
  }, [rest, lock, bus])

  // measurements and layout change with the window: rebuild lazily at rest
  useEffect(() => {
    const off = () => {
      if (state.current !== 'HOME_READY' && state.current !== 'PRODUCTS_READY') return
      tl.current?.kill(); tl.current = null
      const h = home.current
      if (h) gsap.set([h, ...h.querySelectorAll('.sx-portal-text, .sx-portal-skip, .sx-portal-flash, .sx-portal-still'), ...shopEls(), ...(root.current?.querySelectorAll('.sx-shop-in > *') ?? [])], { clearProps: 'all' })
      rest(state.current === 'PRODUCTS_READY' ? 'products' : 'home')
    }
    addEventListener('resize', off)
    return () => removeEventListener('resize', off)
  }, [home, root, shopEls, rest])

  return go
}
