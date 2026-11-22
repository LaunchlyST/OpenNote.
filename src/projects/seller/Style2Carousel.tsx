import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { mediaUrl } from './model'
import type { ShopProduct } from './model'
import type { StorePageProps } from './StorePage'

/**
 * Style 2 product carousel: one card per product (image · details · price + action),
 * centred over a full-width animated backdrop whose colours come from that product's
 * own cover. Swiping uses native scroll-snap (touch, trackpad) plus mouse drag; the
 * backdrop crossfades to whichever product is in front.
 */

type Palette = { a: string; b: string; c: string; tint: string; mood: 'drift' | 'aurora'; on: string }

const FALLBACK: Palette[] = [
  { a: '#c9d9c3', b: '#8fb58a', c: '#eef3e9', tint: '#f1f5ee', mood: 'drift', on: '#14240f' },
  { a: '#6b4ad1', b: '#c08bff', c: '#2a1a5c', tint: '#f2eefb', mood: 'aurora', on: '#ffffff' },
  { a: '#f3c48b', b: '#e98f4a', c: '#fbefe0', tint: '#fbf3ea', mood: 'drift', on: '#2a1606' },
]

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn)
  return { s, l }
}
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 }
const mix = (h1: string, h2: string, t: number) => {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16)
  return hex(((a >> 16) * (1 - t) + (b >> 16) * t), (((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), ((a & 255) * (1 - t) + (b & 255) * t))
}

/** Two or three colours sampled from the cover: its average tone and its most vivid tones. */
function sample(img: HTMLImageElement): Palette | null {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0, 32, 32)
    const d = g.getImageData(0, 0, 32, 32).data
    let ar = 0, ag = 0, ab = 0, n = 0
    const vivid: Array<{ r: number; g: number; b: number; s: number; l: number }> = []
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const r = d[i], gg = d[i + 1], b = d[i + 2]
      ar += r; ag += gg; ab += b; n++
      const { s, l } = rgbToHsl(r, gg, b)
      if (l > 0.12 && l < 0.9) vivid.push({ r, g: gg, b, s, l })
    }
    if (!n) return null
    vivid.sort((x, y) => y.s - x.s)
    const top = vivid.slice(0, Math.max(1, Math.floor(vivid.length * 0.15)))
    const avgOf = (arr: typeof vivid) => hex(arr.reduce((s, p) => s + p.r, 0) / arr.length, arr.reduce((s, p) => s + p.g, 0) / arr.length, arr.reduce((s, p) => s + p.b, 0) / arr.length)
    const base = hex(ar / n, ag / n, ab / n)
    const v1 = top.length ? avgOf(top) : base
    const second = vivid.slice(Math.floor(vivid.length * 0.15), Math.floor(vivid.length * 0.4))
    const v2 = second.length ? avgOf(second) : mix(v1, '#ffffff', 0.4)
    const sat = top.length ? top.reduce((s, p) => s + p.s, 0) / top.length : 0
    const dark = lum(base) < 0.35
    // saturated or dark artwork → a slow aurora; soft / pale artwork → drifting light
    const mood: Palette['mood'] = sat > 0.55 || dark ? 'aurora' : 'drift'
    const btn = v1
    return { a: mood === 'drift' ? mix(base, '#ffffff', 0.35) : mix(v1, '#0b0a14', 0.35), b: v1, c: mood === 'drift' ? mix(v2, '#ffffff', 0.5) : v2, tint: mix(base, '#ffffff', 0.86), mood, on: lum(btn) > 0.6 ? '#141312' : '#ffffff' }
  } catch { return null } // tainted canvas (no CORS): keep the fallback
}

function usePalettes(list: ShopProduct[]) {
  const [pals, setPals] = useState<Record<string, Palette>>({})
  useEffect(() => {
    let alive = true
    list.forEach((p) => {
      const src = mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null)
      if (!src || pals[p.id]) return
      const im = new Image(); im.crossOrigin = 'anonymous'
      im.onload = () => { const pal = sample(im); if (alive && pal) setPals((s) => ({ ...s, [p.id]: pal })) }
      im.src = src + (src.includes('?') ? '&' : '?') + 'pal=1'
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((p) => p.id + p.cover).join(',')])
  return (p: ShopProduct, i: number) => pals[p.id] ?? FALLBACK[i % FALLBACK.length]
}

export function Style2Carousel({ list, props, Buy }: { list: ShopProduct[]; props: StorePageProps; Buy: (x: { p: ShopProduct } & StorePageProps) => ReactElement }) {
  const pal = usePalettes(list)
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const n = list.length

  const go = (i: number) => {
    const el = track.current, card = el?.children[Math.max(0, Math.min(n - 1, i))] as HTMLElement | undefined
    if (!el || !card) return
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  // the card nearest the centre is the current one
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0, bd = Infinity
    ;[...el.children].forEach((c, i) => { const h = c as HTMLElement; const d = Math.abs(h.offsetLeft + h.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i } })
    if (best !== at) setAt(best)
  }
  // mouse drag (touch and trackpads already scroll natively)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const down = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('a, button, input, select')) return
    drag.current = { x: e.clientX, left: track.current!.scrollLeft, moved: false }
    track.current!.classList.add('is-drag')
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.x) > 4) d.moved = true
    track.current!.scrollLeft = d.left - (e.clientX - d.x)
  }
  const up = () => {
    if (!drag.current) return
    drag.current = null
    track.current!.classList.remove('is-drag')
    go(at)
  }
  useEffect(() => { if (at > n - 1) setAt(Math.max(0, n - 1)) }, [n, at])

  if (!n) return null
  return (
    <section className="s2c" aria-roledescription="carousel" aria-label="Products" onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1) } if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1) } }}>
      <div className="s2c-bg" aria-hidden="true">
        {list.map((p, i) => {
          const c = pal(p, i)
          return <div key={p.id} className={`s2c-scene s2c-${c.mood}${i === at ? ' on' : ''}`} style={{ '--a': c.a, '--b': c.b, '--c': c.c } as CSSProperties}><i /><i /><i /></div>
        })}
      </div>
      <div className="s2c-track" ref={track} onScroll={onScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
        {list.map((p, i) => {
          const c = pal(p, i)
          const src = mediaUrl(p.cover) ?? mediaUrl(p.affiliate?.image ?? null)
          const link = props.live ? `/${props.handle}/p/${p.id}` : undefined
          return (
            <article key={p.id} className={i === at ? 's2c-card on' : 's2c-card'} aria-roledescription="slide" aria-label={`${i + 1} of ${n}: ${p.title}`} style={{ '--tint': c.tint, '--btn': c.b, '--btn2': c.c, '--on': c.on } as CSSProperties}>
              <a className="s2c-img" href={link} tabIndex={-1} aria-hidden="true" onClick={(e) => { if (drag.current?.moved) e.preventDefault() }}>
                {src ? <img src={src} alt="" draggable={false} /> : <span>{p.title.charAt(0).toUpperCase() || '✦'}</span>}
              </a>
              <div className="s2c-details">
                <h3>{link ? <a href={link}>{p.title}</a> : p.title}</h3>
                {(p.subtitle || p.description) && <p>{(p.subtitle || p.description).split('\n')[0]}</p>}
              </div>
              <div className="s2c-foot"><Buy p={p} {...props} /></div>
              {!props.live && (props.onEditProduct || props.onHideProduct) && (
                <div className="s2k-admin">
                  {props.onEditProduct && <button type="button" onClick={() => props.onEditProduct!(p.id)}>Edit / replace</button>}
                  {props.onHideProduct && <button type="button" onClick={() => props.onHideProduct!(p.id)}>Remove</button>}
                </div>
              )}
            </article>
          )
        })}
      </div>
      {n > 1 && (
        <div className="s2c-nav">
          <button type="button" className="s2c-arrow" aria-label="Previous product" disabled={at === 0} onClick={() => go(at - 1)}><ArrowLeft aria-hidden="true" /></button>
          <div className="s2c-dots" role="tablist" aria-label="Choose a product">
            {list.map((p, i) => <button key={p.id} type="button" role="tab" aria-selected={i === at} aria-label={`${i + 1} of ${n}: ${p.title}`} className={i === at ? 'on' : ''} onClick={() => go(i)} />)}
          </div>
          <button type="button" className="s2c-arrow" aria-label="Next product" disabled={at === n - 1} onClick={() => go(at + 1)}><ArrowRight aria-hidden="true" /></button>
        </div>
      )}
    </section>
  )
}
