import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, Search, X } from 'lucide-react'
import { sellerApi } from './api'
import { CoverEditor, LAYOUTS } from './ProductEditorParts'
import { useSellerSave } from './use-seller-save'
import {
  CARD_BACKGROUNDS, DEFAULT_TEXT_STYLE, FONTS, FONT_CATALOG, FONT_CATEGORIES,
  TEXT_STYLE_LIMITS, ensureFont, ensureFonts, fontById, isThemeStyle, withExtras,
} from './model'
import type { CardBg, CardPart, DraftProduct, FontCategory, ProductExtras, StoreView, TextStyle } from './model'

/**
 * Click-to-edit settings for one part of a product card, opened from the phone
 * preview in the Page tab. Only the store owner's editor renders it: the public
 * storefront never mounts this file's panel and cards carry no edit markers.
 *
 * Changes autosave through the same product API as the Products tab, so they
 * survive a refresh, are part of the draft and go live on Publish.
 */

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
const CTA_TEXTS = ['Buy now', 'Get Instant Access', 'Download Now']
const CTA_COLOURS = ['#e11d48', '#f97316', '#16a34a', '#2563eb', '#7c3aed', '#111114']

const PART_LABEL: Record<CardPart, string> = { cover: 'Cover', title: 'Title', desc: 'Description', button: 'Button', card: 'Card background' }
const PART_ORDER: CardPart[] = ['cover', 'title', 'desc', 'button', 'card']

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="ss-field">
      <span className="ss-label">{label}</span>
      {children}
      {hint && <span className="ss-hint">{hint}</span>}
    </label>
  )
}

/** The store's own font, so "Store theme" looks like the card does today. */
const themeFontCss = (store: StoreView) => FONTS.find((f) => f.id === store.draft.theme.font)?.css ?? FONTS[0].css

export type PartDraft = { title: string; description: string; cover: string | null; extras: ProductExtras }

export function ProductPartPanel({
  product,
  store,
  setStore,
  part,
  onPart,
  onClose,
  onFull,
  onPreview,
}: {
  product: DraftProduct
  store: StoreView
  setStore: (s: StoreView) => void
  part: CardPart
  onPart: (part: CardPart) => void
  onClose: () => void
  onFull: () => void
  /** Instant preview: the phone shows the change before the save round-trip lands. */
  onPreview?: (value: PartDraft) => void
}) {
  const saved = useSellerSave<PartDraft>(
    `desknoty.seller.recovery.${store.id}.${product.id}.part`,
    { title: product.title, description: product.description, cover: product.cover, extras: withExtras(product.extras) },
    product.revision,
    async (value, revision, token) => {
      const r = await sellerApi.updateProduct(product.id, { title: value.title, description: value.description, cover: value.cover, extras: value.extras }, revision, token)
      setStore(r.store)
      return r.product.revision
    },
  )
  const form = saved.value
  const setForm = saved.edit
  const x = withExtras(form.extras)
  const setX = (n: Partial<ProductExtras>) => setForm({ ...form, extras: { ...x, ...n } })

  // keep the caller's callback fresh without re-running the preview on every render
  const preview = useRef(onPreview)
  preview.current = onPreview
  useEffect(() => { preview.current?.({ title: form.title, description: form.description, cover: form.cover, extras: form.extras }) }, [form])

  return (
    <section className="pe-part" aria-label={`Edit ${PART_LABEL[part]}`}>
      <header className="pe-part-head">
        <div className="pe-part-name">
          <span>Editing card</span>
          <b>{form.title.trim() || 'Untitled product'}</b>
        </div>
        <button type="button" className="ss-ghost" onClick={onFull}>All product settings</button>
        <button type="button" className="pe-part-x" aria-label="Close card editing" onClick={onClose}><X className="h-4 w-4" /></button>
      </header>
      <div className="pe-part-tabs" role="tablist" aria-label="Card part">
        {PART_ORDER.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => onPart(p)}>{PART_LABEL[p]}</button>
        ))}
      </div>

      {part === 'cover' && (
        <div className="pe-part-body">
          <CoverEditor cover={form.cover} crop={x.crop} onCover={(cover) => setForm({ ...form, cover })} onCrop={(crop) => setX({ crop })} />
          <p className="ss-hint">Click the picture to set the focal point. The card keeps its square shape.</p>
        </div>
      )}

      {part === 'title' && (
        <div className="pe-part-body">
          <Field label="Title"><input className="ss-input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Content planner template" /></Field>
          <TypographyEditor store={store} kind="title" value={x.titleStyle} onChange={(titleStyle) => setX({ titleStyle })} />
        </div>
      )}

      {part === 'desc' && (
        <div className="pe-part-body">
          <Field label="Description" hint="The first line shows on the card."><textarea className="ss-input" rows={4} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What buyers get, in a few lines" /></Field>
          <TypographyEditor store={store} kind="desc" value={x.descStyle} onChange={(descStyle) => setX({ descStyle })} />
        </div>
      )}

      {part === 'button' && (
        <div className="pe-part-body">
          <div className="ss-field">
            <span className="ss-label">Button label</span>
            <div className="pe-seg pe-seg3">
              {CTA_TEXTS.map((t) => (
                <button key={t} type="button" aria-pressed={(x.cta.text || 'Buy now') === t} onClick={() => setX({ cta: { ...x.cta, text: t === 'Buy now' ? '' : t } })}>{t}</button>
              ))}
            </div>
            <span className="ss-hint">Leave empty for “Buy now”, or “Get it free” on a free product.</span>
          </div>
          <Field label="Or your own text"><input className="ss-input" maxLength={30} value={x.cta.text} placeholder="Buy now" onChange={(e) => setX({ cta: { ...x.cta, text: e.target.value } })} /></Field>
          <div className="ss-field">
            <span className="ss-label">Button colour</span>
            <div className="pe-colours" role="radiogroup" aria-label="Button colour">
              <button type="button" role="radio" aria-checked={!x.cta.color} aria-label="Theme colour" className="pe-theme" onClick={() => setX({ cta: { ...x.cta, color: '' } })}>A</button>
              {CTA_COLOURS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={x.cta.color === c} aria-label={`Button colour ${c}`} style={{ background: c }} onClick={() => setX({ cta: { ...x.cta, color: c } })} />
              ))}
            </div>
          </div>
          <p className="ss-hint">The price and what happens on click (checkout, download or the affiliate link) stay exactly as they are.</p>
        </div>
      )}

      {part === 'card' && (
        <div className="pe-part-body">
          <div className="ss-field">
            <span className="ss-label">Card layout</span>
            <div className="pe2-layouts" role="radiogroup" aria-label="Card layout">
              {LAYOUTS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={x.layout === l.id} className={cn('pe2-layout', x.layout === l.id && 'on')} onClick={() => setX({ layout: l.id })}>
                  <span className={`pe2-lay-ico ${l.id}`} aria-hidden="true"><i /><b /><b /></span>
                  <strong>{l.name}</strong>
                  <small>{l.text}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="ss-field">
            <span className="ss-label">Card background</span>
            <div className="pe-seg pe-seg3">
              {CARD_BACKGROUNDS.map((b) => (
                <button key={b.id || 'theme'} type="button" aria-pressed={(x.cardBg || '') === b.id} onClick={() => setX({ cardBg: b.id as CardBg })}>{b.label}</button>
              ))}
            </div>
          </div>
          <div className="ss-field">
            <span className="ss-label">Corner radius <small>{x.cardRadius == null ? 'Theme' : `${x.cardRadius}px`}</small></span>
            <div className="pe-part-range">
              <input type="range" min={0} max={28} step={1} value={x.cardRadius ?? 12} aria-label="Card corner radius" onChange={(e) => setX({ cardRadius: Number(e.target.value) })} />
              <button type="button" className="ss-ghost" onClick={() => setX({ cardRadius: null })}>Theme</button>
            </div>
          </div>
        </div>
      )}

      <footer className="pe-part-foot" aria-live="polite">{saved.state}</footer>
    </section>
  )
}

/* ------------------------------------------------------- typography + fonts --- */

/** Title or description typography, with the visual font picker underneath. */
export function TypographyEditor({ store, kind, value, onChange }: { store: StoreView; kind: 'title' | 'desc'; value?: TextStyle; onChange: (v: TextStyle) => void }) {
  const s: TextStyle = { ...DEFAULT_TEXT_STYLE, ...value }
  const [picking, setPicking] = useState(false)
  const theme = themeFontCss(store)
  const font = fontById(s.font)
  const size = kind === 'title' ? TEXT_STYLE_LIMITS.titleSize : TEXT_STYLE_LIMITS.descSize
  const weights = font ? font.weights : [400, 500, 600, 700]
  const set = (n: Partial<TextStyle>) => onChange({ ...s, ...n })
  useEffect(() => { ensureFonts([s.font]) }, [s.font])
  const dirty = !isThemeStyle(s)

  return (
    <div className="typo">
      <div className="typo-head">
        <span className="ss-label">{kind === 'title' ? 'Title typography' : 'Description typography'}</span>
        <button type="button" className="ss-ghost" onClick={() => onChange({ ...DEFAULT_TEXT_STYLE })} disabled={!dirty}><RotateCcw className="h-3.5 w-3.5" /> Reset to theme</button>
      </div>

      <button type="button" className="typo-font" onClick={() => setPicking(true)} aria-haspopup="dialog" aria-label="Choose a font">
        <span style={{ fontFamily: font?.css ?? theme }}>{font?.label ?? 'Store theme'}</span>
        <small>Change font</small>
      </button>

      <div className="typo-grid">
        <label className="typo-row">
          <span>Weight</span>
          <select className="ss-input" value={s.weight} onChange={(e) => set({ weight: Number(e.target.value) })}>
            <option value={0}>Theme</option>
            {[...new Set([...weights, ...(s.weight ? [s.weight] : [])])].sort((a, b) => a - b).map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="typo-row">
          <span>Align</span>
          <div className="typo-align" role="group" aria-label="Alignment">
            {([['', 'Theme'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] as Array<[TextStyle['align'], string]>).map(([v, label]) => (
              <button key={v || 'theme'} type="button" aria-pressed={s.align === v} onClick={() => set({ align: v })}>{label}</button>
            ))}
          </div>
        </label>
      </div>

      <label className="typo-row">
        <span>Size <b>{s.size ? `${s.size}px` : 'Theme'}</b></span>
        <input type="range" min={size[0]} max={size[1]} step={1} value={s.size || (kind === 'title' ? 15 : 13)} aria-label="Font size" onChange={(e) => set({ size: Number(e.target.value) })} />
      </label>
      <label className="typo-row">
        <span>Line height <b>{s.lineHeight ? s.lineHeight.toFixed(2) : 'Theme'}</b></span>
        <input type="range" min={TEXT_STYLE_LIMITS.lineHeight[0]} max={TEXT_STYLE_LIMITS.lineHeight[1]} step={0.05} value={s.lineHeight || 1.3} aria-label="Line height" onChange={(e) => set({ lineHeight: Number(e.target.value) })} />
      </label>
      <label className="typo-row">
        <span>Letter spacing <b>{s.letterSpacing ? `${s.letterSpacing}px` : 'Theme'}</b></span>
        <input type="range" min={TEXT_STYLE_LIMITS.letterSpacing[0]} max={TEXT_STYLE_LIMITS.letterSpacing[1]} step={0.1} value={s.letterSpacing} aria-label="Letter spacing" onChange={(e) => set({ letterSpacing: Number(e.target.value) })} />
      </label>
      <div className="typo-row">
        <span>Colour</span>
        <div className="typo-colour">
          <input type="color" value={s.color || '#111114'} aria-label="Text colour" onChange={(e) => set({ color: e.target.value })} />
          <button type="button" className="ss-ghost" onClick={() => set({ color: '' })} disabled={!s.color}>Theme colour</button>
        </div>
      </div>

      {picking && <FontPicker value={s.font} theme={theme} onPick={(id) => set({ font: id, weight: 0 })} onClose={() => setPicking(false)} />}
    </div>
  )
}

/**
 * CapCut-style font list: each name in its own typeface, searchable, grouped by
 * category. A family's stylesheet is requested only when its row is drawn, so
 * the whole library is never downloaded at once.
 */
function FontPicker({ value, theme, onPick, onClose }: { value: string; theme: string; onPick: (id: string) => void; onClose: () => void }) {
  const current = fontById(value)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FontCategory | 'All'>(current?.category ?? 'Sans')
  const search = q.trim().toLowerCase()
  const list = useMemo(
    () => FONT_CATALOG.filter((f) => (search ? f.label.toLowerCase().includes(search) : cat === 'All' || f.category === cat)),
    [search, cat],
  )
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="fp-wrap">
      <div className="fp-dim" onClick={onClose} aria-hidden="true" />
      <div className="fp" role="dialog" aria-modal="true" aria-label="Choose a font">
        <header className="fp-head">
          <b>Fonts</b>
          <button type="button" className="ss-ghost" onClick={onClose}><X className="h-4 w-4" /> Done</button>
        </header>
        <label className="fp-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fonts" aria-label="Search fonts" />
        </label>
        <div className="fp-cats" role="tablist" aria-label="Font categories">
          {(['All', ...FONT_CATEGORIES] as Array<FontCategory | 'All'>).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={!search && cat === c} onClick={() => { setQ(''); setCat(c) }}>{c}</button>
          ))}
        </div>
        <ul className="fp-list">
          <li>
            <button type="button" className={cn('fp-row', !value && 'on')} aria-pressed={!value} onClick={() => { onPick(''); onClose() }}>
              <span style={{ fontFamily: theme }}>Store theme</span>
              {!value && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          </li>
          {list.map((f) => <FontRow key={f.id} id={f.id} label={f.label} css={f.css} on={value === f.id} onPick={() => { onPick(f.id); onClose() }} />)}
        </ul>
        {!list.length && <p className="fp-empty">No fonts match “{q}”.</p>}
      </div>
    </div>
  )
}

function FontRow({ id, label, css, on, onPick }: { id: string; label: string; css: string; on: boolean; onPick: () => void }) {
  // fetched when this row is actually drawn, never all at once
  useEffect(() => { ensureFont(id) }, [id])
  return (
    <li>
      <button type="button" className={cn('fp-row', on && 'on')} aria-pressed={on} onClick={onPick}>
        <span style={{ fontFamily: css }}>{label}</span>
        {on && <Check className="h-4 w-4" aria-hidden="true" />}
      </button>
    </li>
  )
}
