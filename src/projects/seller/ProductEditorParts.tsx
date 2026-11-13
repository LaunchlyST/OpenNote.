import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Monitor, Plus, RotateCcw, Smartphone, Trash2, Video } from 'lucide-react'
import { sellerApi } from './api'
import { trackSellerWork } from './use-seller-save'
import { mediaUrl } from './model'
import type { CardLayout, ProductExtras, ShopProduct, StoreView } from './model'
import { ProductCard } from './ProductCard'
import { storeStyle } from './StorePage'

/**
 * Editor controls for the V2 product card: media and previews, cover crop,
 * lists, FAQ, card layout and the live card preview with movable text.
 * Every control writes into the product's draft extras, which the existing
 * autosave persists.
 */

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

function useMediaUpload(kind: 'image' | 'video') {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (file: File | undefined, done: (id: string) => void) => {
    if (!file) return
    setErr(null)
    if (kind === 'image' && !/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return setErr('Use a PNG, JPG, GIF or WebP image.')
    if (kind === 'image' && file.size > 5 * 1024 * 1024) return setErr('Images can be up to 5 MB.')
    if (kind === 'video' && !/^video\/(mp4|webm|quicktime)$/.test(file.type)) return setErr('Use an MP4, WebM or MOV video.')
    if (kind === 'video' && file.size > 15 * 1024 * 1024) return setErr('Preview videos can be up to 15 MB.')
    setBusy(true)
    try {
      await trackSellerWork(sellerApi.uploadMedia(file).then((r) => done(r.id)))
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return { busy, err, run }
}

/** Cover image with a focal point (click or drag on the picture) and zoom. */
export function CoverEditor({ cover, crop, onCover, onCrop }: { cover: string | null; crop: ProductExtras['crop']; onCover: (id: string | null) => void; onCrop: (c: ProductExtras['crop']) => void }) {
  const up = useMediaUpload('image')
  const src = mediaUrl(cover)
  const box = useRef<HTMLDivElement>(null)
  const setFrom = (clientX: number, clientY: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    onCrop({ ...crop, x: Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))), y: Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))) })
  }
  return (
    <div className="pe2-cover">
      <div className="pe2-crop">
        {src ? (
          <div
            ref={box}
            className="pe2-crop-img"
            style={{ backgroundImage: `url(${src})` }}
            role="application"
            aria-label="Cover focal point. Use arrow keys to move it."
            tabIndex={0}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFrom(e.clientX, e.clientY) }}
            onPointerMove={(e) => { if (e.buttons) setFrom(e.clientX, e.clientY) }}
            onKeyDown={(e) => {
              const d: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }
              if (!d[e.key]) return
              e.preventDefault()
              onCrop({ ...crop, x: Math.min(100, Math.max(0, crop.x + d[e.key][0])), y: Math.min(100, Math.max(0, crop.y + d[e.key][1])) })
            }}
          >
            <i className="pe2-focal" style={{ left: `${crop.x}%`, top: `${crop.y}%` }} aria-hidden="true" />
          </div>
        ) : (
          <div className="pe2-crop-empty">No cover yet</div>
        )}
        {src && (
          <div className="pe2-crop-out" aria-hidden="true">
            <span style={{ backgroundImage: `url(${src})`, backgroundPosition: `${crop.x}% ${crop.y}%`, backgroundSize: crop.zoom > 1 ? `${crop.zoom * 100}%` : 'cover' }} />
            <small>On the card</small>
          </div>
        )}
      </div>
      <div className="ss-row">
        <label className="ss-ghost cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" /> {up.busy ? 'Uploading…' : src ? 'Replace cover' : 'Upload cover'}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => void up.run(e.target.files?.[0], onCover)} />
        </label>
        {src && <button type="button" className="ss-ghost" onClick={() => onCover(null)}>Remove</button>}
      </div>
      {src && (
        <label className="pe2-range">
          <span>Zoom</span>
          <input type="range" min={1} max={2.5} step={0.05} value={crop.zoom} onChange={(e) => onCrop({ ...crop, zoom: Number(e.target.value) })} aria-label="Cover zoom" />
          <button type="button" className="ss-ghost" onClick={() => onCrop({ x: 50, y: 50, zoom: 1 })}>Reset crop</button>
        </label>
      )}
      <span className="ss-hint">Click the picture to choose what stays in view when it’s cropped.</span>
      {up.err && <span className="ss-hint pe2-err">{up.err}</span>}
    </div>
  )
}

/** Extra gallery images (up to 8) and one optional preview video. */
export function GalleryEditor({ gallery, video, onGallery, onVideo }: { gallery: string[]; video: string | null; onGallery: (g: string[]) => void; onVideo: (v: string | null) => void }) {
  const img = useMediaUpload('image')
  const vid = useMediaUpload('video')
  const move = (i: number, d: number) => {
    const g = [...gallery]
    const j = i + d
    if (j < 0 || j >= g.length) return
    ;[g[i], g[j]] = [g[j], g[i]]
    onGallery(g)
  }
  return (
    <div className="pe2-gal">
      <div className="pe2-gal-list">
        {gallery.map((id, i) => (
          <div key={id} className="pe2-gal-item">
            <span style={{ backgroundImage: `url(${mediaUrl(id)})` }} aria-label={`Gallery image ${i + 1}`} role="img" />
            <div className="pe2-gal-acts">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === gallery.length - 1} aria-label="Move later"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onGallery(gallery.filter((x) => x !== id))} aria-label="Remove image"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {gallery.length < 8 && (
          <label className="pe2-gal-add">
            <ImagePlus className="h-4 w-4" />
            <span>{img.busy ? 'Uploading…' : 'Add image'}</span>
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => void img.run(e.target.files?.[0], (id) => onGallery([...gallery, id]))} />
          </label>
        )}
      </div>
      {img.err && <span className="ss-hint pe2-err">{img.err}</span>}
      <div className="ss-row">
        <label className="ss-ghost cursor-pointer">
          <Video className="h-3.5 w-3.5" /> {vid.busy ? 'Uploading…' : video ? 'Replace preview video' : 'Add preview video'}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => void vid.run(e.target.files?.[0], onVideo)} />
        </label>
        {video && <button type="button" className="ss-ghost" onClick={() => onVideo(null)}>Remove video</button>}
      </div>
      {video && <video className="pe2-vid" src={mediaUrl(video) ?? ''} controls muted playsInline preload="metadata" />}
      {vid.err && <span className="ss-hint pe2-err">{vid.err}</span>}
      <span className="ss-hint">Gallery images and the video are public previews. Your paid file is never shown here.</span>
    </div>
  )
}

/** A short list of lines (what's included). */
export function LinesEditor({ items, onChange, placeholder, max = 12, label }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number; label: string }) {
  const rows = items.length ? items : ['']
  return (
    <div className="pe2-lines" role="group" aria-label={label}>
      {rows.map((v, i) => (
        <div key={i} className="pe2-line">
          <input className="ss-input" maxLength={80} value={v} placeholder={placeholder} aria-label={`${label} ${i + 1}`} onChange={(e) => { const n = [...rows]; n[i] = e.target.value; onChange(n) }} />
          <button type="button" className="ss-ghost" aria-label="Remove line" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {rows.length < max && <button type="button" className="ss-ghost pe2-addline" onClick={() => onChange([...rows, ''])}><Plus className="h-3.5 w-3.5" /> Add line</button>}
    </div>
  )
}

export function FaqEditor({ items, onChange }: { items: ProductExtras['faq']; onChange: (v: ProductExtras['faq']) => void }) {
  return (
    <div className="pe2-lines">
      {items.map((f, i) => (
        <div key={i} className="pe2-faq">
          <input className="ss-input" maxLength={140} value={f.q} placeholder="Question" aria-label={`Question ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
          <textarea className="ss-input" rows={2} maxLength={600} value={f.a} placeholder="Answer" aria-label={`Answer ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          <button type="button" className="ss-ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
        </div>
      ))}
      {items.length < 8 && <button type="button" className="ss-ghost pe2-addline" onClick={() => onChange([...items, { q: '', a: '' }])}><Plus className="h-3.5 w-3.5" /> Add question</button>}
      <span className="ss-hint">Questions without an answer aren’t shown.</span>
    </div>
  )
}

const LAYOUTS: Array<{ id: CardLayout; name: string; text: string }> = [
  { id: 'compact', name: 'Compact', text: 'Small and tidy' },
  { id: 'showcase', name: 'Showcase', text: 'Bigger picture, more detail' },
  { id: 'featured', name: 'Featured', text: 'Full width, the star product' },
]

/** Layout, badges and the live card with movable title and description. */
export function CardAppearance({ x, setX, preview, store, buy }: { x: ProductExtras; setX: (n: Partial<ProductExtras>) => void; preview: ShopProduct; store: StoreView; buy: ReactNode }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const pageStyle = storeStyle(store.draft) as CSSProperties
  return (
    <div className="pe2-look">
      <div className="pe2-layouts" role="radiogroup" aria-label="Card layout">
        {LAYOUTS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={x.layout === l.id} className={cn('pe2-layout', x.layout === l.id && 'on')} onClick={() => setX({ layout: l.id })}>
            <span className={`pe2-lay-ico ${l.id}`} aria-hidden="true"><i /><b /><b /></span>
            <strong>{l.name}</strong>
            <small>{l.text}</small>
          </button>
        ))}
      </div>
      <div className="pe2-badges" role="group" aria-label="Badges">
        <label><input type="checkbox" checked={x.badges.new} onChange={(e) => setX({ badges: { ...x.badges, new: e.target.checked } })} /> New</label>
        <label><input type="checkbox" checked={x.badges.featured} onChange={(e) => setX({ badges: { ...x.badges, featured: e.target.checked } })} /> Featured</label>
      </div>
      <div className="pe2-prev-head">
        <span className="ss-label">Live card</span>
        <div className="pe-seg" role="radiogroup" aria-label="Preview size">
          <button type="button" role="radio" aria-checked={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor className="h-3.5 w-3.5" /> Desktop</button>
          <button type="button" role="radio" aria-checked={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone className="h-3.5 w-3.5" /> Mobile</button>
        </div>
      </div>
      <div className={cn('pe2-stage sp', device)} style={pageStyle}>
        <div className="sp-grid">
          <ProductCard p={preview} buy={buy} onMoveText={(which, pos) => setX({ textPos: { ...x.textPos, [which]: pos } })} />
        </div>
      </div>
      <div className="ss-row">
        <span className="ss-hint">Drag the title or description sideways, or select one and use the arrow keys (C centres it).</span>
        <button type="button" className="ss-ghost" onClick={() => setX({ textPos: { title: 0, desc: 0 } })}><RotateCcw className="h-3.5 w-3.5" /> Reset position</button>
      </div>
    </div>
  )
}
