import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  AlignLeft,
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  Globe,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Lock,
  Mail,
  Minus,
  Monitor,
  MonitorPlay,
  Plus,
  Redo2,
  RefreshCw,
  Share2,
  Smartphone,
  Trash2,
  Undo2,
  Upload,
  Video as VideoIcon,
} from 'lucide-react'
import './creator-store.css'

/* ------------------------------------------------------------------ model --- */

type SectionType =
  | 'profile'
  | 'products'
  | 'tiktok'
  | 'links'
  | 'social'
  | 'text'
  | 'image'
  | 'video'
  | 'newsletter'
  | 'divider'
  | 'showcase'
  | 'email'

type SimpleItem = { id: string; label: string; url: string }
type VideoItem = { id: string; caption: string; url: string }
type ImageItem = { id: string; src: string; caption: string }
type ShowcaseItem = { id: string; title: string; body: string }

type Section = {
  id: string
  type: SectionType
  x: number
  y: number
  w: number
  heading?: string
  body?: string
  handle?: string
  email?: string
  buttonLabel?: string
  links?: SimpleItem[]
  videos?: VideoItem[]
  socials?: SimpleItem[]
  images?: ImageItem[]
  showcase?: ShowcaseItem[]
}

type Product = {
  id: string
  title: string
  description: string
  cover: string | null
  link: string
  buttonLabel: string
  price: string
  provider: 'none' | 'stripe'
  acct: string
}

type Doc = {
  sections: Section[]
  products: Product[]
  published: boolean
}

const CANVAS_W = 272
const PAD = 15
const TOP = 50
const GRID = 13

const uid = () => Math.random().toString(36).slice(2, 9)

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const TAG: Record<SectionType, string> = {
  profile: 'Locked',
  products: 'Upload Digital Product',
  tiktok: 'Video preview',
  links: 'Links',
  social: 'Social',
  text: 'Text',
  image: 'Image',
  video: 'Video',
  newsletter: 'Newsletter',
  divider: 'Divider',
  showcase: 'Showcase',
  email: 'Email Support',
}

const NAME: Record<SectionType, string> = {
  profile: 'Profile',
  products: 'Products',
  tiktok: 'TikTok videos',
  links: 'Links',
  social: 'Social',
  text: 'Text',
  image: 'Image',
  video: 'Video',
  newsletter: 'Newsletter',
  divider: 'Divider',
  showcase: 'Showcase',
  email: 'Email Support',
}

function demoDoc(): Doc {
  const section = (type: SectionType, data: Partial<Section> = {}): Section => ({
    id: `sec_${uid()}`,
    type,
    x: PAD,
    y: 0,
    w: CANVAS_W - PAD * 2,
    ...data,
  })
  return {
    published: false,
    products: [
      {
        id: `prd_${uid()}`,
        title: 'Content Planner',
        description: 'A calm 30-day planner for creators who post every week.',
        cover: null,
        link: '',
        buttonLabel: 'Get it',
        price: '12.00',
        provider: 'none',
        acct: '',
      },
      {
        id: `prd_${uid()}`,
        title: 'Lightroom Presets',
        description: 'Eight warm film presets for travel and studio photos.',
        cover: null,
        link: '',
        buttonLabel: 'Get it',
        price: '9.00',
        provider: 'none',
        acct: '',
      },
    ],
    sections: [
      section('profile', {
        heading: 'Ava Lane',
        handle: 'avalane',
        body: 'Digital templates for creators who plan ahead.',
      }),
      section('products', { heading: 'SHOP' }),
      section('tiktok', { heading: 'LATEST ON TIKTOK' }),
      section('links', {
        heading: 'LINKS',
        links: [
          { id: `lnk_${uid()}`, label: 'My website', url: 'https://avalane.co' },
          { id: `lnk_${uid()}`, label: 'Free resources', url: 'https://avalane.co/free' },
        ],
      }),
      section('text', {
        body: 'Everything here is made to be used, not admired from a distance. Pick a product, get the files, start today.',
      }),
      section('email', {
        heading: 'EMAIL SUPPORT',
        email: 'hello@avalane.co',
        body: 'Questions about an order? Send a note and I will reply within one working day.',
        buttonLabel: 'Email us',
      }),
    ],
  }
}

function newSection(type: SectionType): Section {
  const base: Section = { id: `sec_${uid()}`, type, x: PAD, y: 0, w: CANVAS_W - PAD * 2 }
  switch (type) {
    case 'products':
      return { ...base, heading: 'SHOP' }
    case 'tiktok':
      return { ...base, heading: 'LATEST ON TIKTOK' }
    case 'links':
      return { ...base, heading: 'LINKS', links: [{ id: `lnk_${uid()}`, label: 'My website', url: 'https://' }] }
    case 'social':
      return {
        ...base,
        socials: [
          { id: `soc_${uid()}`, label: 'Instagram', url: 'https://instagram.com/' },
          { id: `soc_${uid()}`, label: 'TikTok', url: 'https://tiktok.com/@' },
        ],
      }
    case 'text':
      return { ...base, body: 'Write something about your store.' }
    case 'image':
      return { ...base, images: [{ id: `img_${uid()}`, src: '', caption: 'A look inside' }] }
    case 'video':
      return { ...base, videos: [{ id: `vid_${uid()}`, caption: 'See it in action', url: '' }] }
    case 'newsletter':
      return {
        ...base,
        heading: 'STAY IN TOUCH',
        body: 'New drops and free resources, once a month.',
        buttonLabel: 'Subscribe',
      }
    case 'divider':
      return { ...base }
    case 'showcase':
      return {
        ...base,
        heading: 'FEATURED',
        showcase: [{ id: `shw_${uid()}`, title: 'New this week', body: 'A closer look at the latest product.' }],
      }
    case 'email':
      return {
        ...base,
        heading: 'EMAIL SUPPORT',
        email: 'hello@example.com',
        body: 'Questions about an order? Send a note.',
        buttonLabel: 'Email us',
      }
    default:
      return base
  }
}

function IconFor({ type, size = 13 }: { type: SectionType; size?: number }) {
  const p = { size, strokeWidth: 1.9 }
  switch (type) {
    case 'profile':
      return <Lock {...p} />
    case 'products':
      return <Upload {...p} />
    case 'tiktok':
      return <MonitorPlay {...p} />
    case 'links':
      return <Link2 {...p} />
    case 'social':
      return <Share2 {...p} />
    case 'text':
      return <AlignLeft {...p} />
    case 'image':
      return <ImageIcon {...p} />
    case 'video':
      return <VideoIcon {...p} />
    case 'newsletter':
      return <Mail {...p} />
    case 'divider':
      return <Minus {...p} />
    case 'showcase':
      return <LayoutGrid {...p} />
    case 'email':
      return <Mail {...p} />
    default:
      return null
  }
}

/* ------------------------------------------------------------------- page --- */

export function CreatorStore() {
  const [doc, setDoc] = useState<Doc>(demoDoc)
  const docRef = useRef(doc)
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  const [selected, setSelected] = useState<string | null>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState<string | null>(null)
  const [viewer, setViewer] = useState(false)
  const [viewerDevice, setViewerDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [dropPreview, setDropPreview] = useState<number | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ id: string; y: number } | null>(null)
  const settleDrop = useCallback(() => setPendingDrop(null), [])

  const past = useRef<Doc[]>([])
  const future = useRef<Doc[]>([])
  const [, bump] = useState(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)
  const dragSnapshot = useRef<Doc | null>(null)

  const syncHistory = useCallback(() => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(saveTimer.current)
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  const markSaving = useCallback(() => {
    setSaveState('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveState('saved'), 650)
  }, [])

  const flash = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  /** A normal edit: records one history step and marks the draft saving. */
  const edit = useCallback(
    (updater: (current: Doc) => Doc) => {
      const current = docRef.current
      const next = updater(current)
      if (next === current) return
      past.current.push(clone(current))
      if (past.current.length > 60) past.current.shift()
      future.current = []
      docRef.current = next
      setDoc(next)
      bump((n) => n + 1)
      syncHistory()
      markSaving()
    },
    [markSaving, syncHistory],
  )

  /** A live edit while dragging: no history entry until the pointer is released. */
  const live = useCallback((updater: (current: Doc) => Doc) => {
    const next = updater(docRef.current)
    docRef.current = next
    setDoc(next)
  }, [])

  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(clone(docRef.current))
    docRef.current = prev
    setDoc(prev)
    bump((n) => n + 1)
    syncHistory()
    markSaving()
  }

  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(clone(docRef.current))
    docRef.current = next
    setDoc(next)
    bump((n) => n + 1)
    syncHistory()
    markSaving()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const profile = doc.sections.find((s) => s.type === 'profile')
  const handle = profile?.handle || 'avalane'
  const storeUrl = `https://launchly.store/@${handle}`

  const selectedSection = doc.sections.find((s) => s.id === selected) ?? null

  const clearSelection = useCallback(() => {
    setSelected(null)
    setProductId(null)
    setPayId(null)
  }, [])

  const focusSection = useCallback((id: string) => {
    setSelected(id)
    setProductId(null)
    setPayId(null)
  }, [])

  const addSection = useCallback(
    (type: SectionType, y?: number) => {
      const next = newSection(type)
      const current = docRef.current
      const canvas = document.querySelector('.cs-canvas')
      const heightOf = (section: Section) => {
        const el = canvas?.querySelector<HTMLElement>(`[data-id="${section.id}"]`)
        return el?.offsetHeight ?? 110
      }
      const profile = current.sections.find((s) => s.type === 'profile')
      const floor = profile ? Math.round((profile.y + heightOf(profile) + GRID) / GRID) * GRID : TOP
      if (y !== undefined) {
        // Dropped at a point: land exactly there, then push anything it covers down.
        next.y = Math.max(floor, Math.round(y / GRID) * GRID)
        edit((doc) => ({ ...doc, sections: [...doc.sections, next] }))
        setPendingDrop({ id: next.id, y: next.y })
      } else {
        const bottom = current.sections.reduce((max, s) => Math.max(max, s.y + heightOf(s)), TOP)
        let nextY = Math.max(floor, bottom + GRID)
        nextY = Math.round(nextY / GRID) * GRID
        for (let pass = 0; pass < 12; pass++) {
          const hit = current.sections.find(
            (s) => s.type !== 'profile' && nextY < s.y + heightOf(s) && nextY + 90 > s.y && s.id !== next.id,
          )
          if (!hit) break
          nextY = Math.round((hit.y + heightOf(hit) + GRID) / GRID) * GRID
        }
        next.y = nextY
        edit((doc) => ({ ...doc, sections: [...doc.sections, next] }))
      }
      focusSection(next.id)
      flash(`${TAG[type]} added${type === 'products' ? ' — set its price' : ''}`)
    },
    [edit, flash, focusSection],
  )

  const removeSection = (id: string) => {
    edit((current) => ({ ...current, sections: current.sections.filter((s) => s.id !== id) }))
    clearSelection()
    flash('Section removed')
  }

  const resetSection = (id: string) => {
    const fresh = newSection(doc.sections.find((s) => s.id === id)?.type ?? 'text')
    edit((current) => ({
      ...current,
      sections: current.sections.map((s) => (s.id === id ? { ...fresh, x: s.x, y: s.y, w: s.w } : s)),
    }))
    flash('Section reset')
  }

  const updateSection = (id: string, patch: Partial<Section>) => {
    edit((current) => ({
      ...current,
      sections: current.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  const updateProduct = (id: string, patch: Partial<Product>) => {
    edit((current) => ({
      ...current,
      products: current.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  const addProduct = () => {
    const product: Product = {
      id: `prd_${uid()}`,
      title: 'New product',
      description: '',
      cover: null,
      link: '',
      buttonLabel: 'Get it',
      price: '',
      provider: 'none',
      acct: '',
    }
    edit((current) => ({ ...current, products: [...current.products, product] }))
    setProductId(product.id)
    setPayId(product.id)
    flash('Product added — set its price')
  }

  const deleteProduct = (id: string) => {
    edit((current) => ({ ...current, products: current.products.filter((p) => p.id !== id) }))
    setProductId(null)
    setPayId(null)
    flash('Product deleted')
  }

  const publish = () => {
    edit((current) => ({ ...current, published: true }))
    flash('Store published — your page is live')
  }

  const share = () => {
    void navigator.clipboard?.writeText(storeUrl).then(
      () => flash('Store link copied'),
      () => flash(storeUrl),
    )
  }

  const productBeingEdited = doc.products.find((p) => p.id === productId) ?? null
  const payingProduct = doc.products.find((p) => p.id === payId) ?? null

  return (
    <div className="cs-page">
      <div className="cs-stage" aria-hidden="true">
        <span className="cs-blob cs-blob-a" />
        <span className="cs-blob cs-blob-b" />
        <span className="cs-blob cs-blob-c" />
        <span className="cs-blob cs-blob-d" />
        <span className="cs-blob cs-blob-e" />
      </div>

      <div className="cs-workspace">
        <h1 className="cs-title" title="Creator Store">
          Creator Store
        </h1>

        <div className="cs-actions" role="toolbar" aria-label="Editor actions">
          <button
            type="button"
            className="cs-tool cs-tool-icon"
            aria-label="Undo"
            title="Undo"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="cs-tool cs-tool-icon"
            aria-label="Redo"
            title="Redo"
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 size={14} />
          </button>
          <span className={`cs-save ${saveState}`} role="status" aria-live="polite">
            <span className="cs-dot" aria-hidden="true" />
            {saveState === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
          <button type="button" className="cs-tool" onClick={() => setViewer(true)}>
            <Eye size={14} /> Preview
          </button>
          <button type="button" className="cs-tool" onClick={share}>
            <Share2 size={14} /> Share
          </button>
          <button type="button" className="cs-publish" onClick={publish}>
            <Globe size={14} /> {doc.published ? 'Published ✓' : 'Publish'}
          </button>
        </div>

        <div className="cs-divider" aria-hidden="true" />

        <div className="cs-tools">
          <div className="cs-card">
            <div className="cs-card-head">
              <span className="cs-eyebrow">EDITOR TOOLS</span>
              {selected && (
                <button
                  type="button"
                  className="cs-clear"
                  aria-label="Clear selection"
                  title="Clear selection"
                  onClick={clearSelection}
                >
                  ×
                </button>
              )}
            </div>

            {!selected && (
              <>
                <p className="cs-hint">
                  Click a section in the phone to edit it, or drag one from below into the phone to place it anywhere
                  below your profile.
                </p>
                <span className="cs-eyebrow">YOUR SECTIONS · {doc.sections.length}</span>
                <div className="cs-rows">
                  {doc.sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`cs-row ${selected === section.id ? 'is-selected' : ''}`}
                      onClick={() => focusSection(section.id)}
                    >
                      <span className="cs-row-icon">
                        <IconFor type={section.type} />
                      </span>
                      <span className="cs-row-name">{NAME[section.type]}</span>
                      <span className="cs-row-tag">{TAG[section.type]}</span>
                    </button>
                  ))}
                </div>

                <span className="cs-eyebrow">ADD A SECTION · DRAG INTO THE PHONE</span>
                <Palette doc={doc} onAdd={(type) => addSection(type)} onDrop={addSection} onPreview={setDropPreview} />
              </>
            )}

            {selected && selectedSection && (
              <>
                <span className="cs-context">
                  Editing · {NAME[selectedSection.type]}
                </span>

                {selectedSection.type === 'profile' && <ProfileEditor section={selectedSection} onSync={() => flash('TikTok profile synced')} />}

                {selectedSection.type === 'products' && !productBeingEdited && !payingProduct && (
                  <ProductsEditor
                    products={doc.products}
                    onAdd={addProduct}
                    onEdit={(id) => setProductId(id)}
                  />
                )}

                {selectedSection.type === 'products' && productBeingEdited && !payingProduct && (
                  <ProductEditor
                    product={productBeingEdited}
                    onChange={(patch) => updateProduct(productBeingEdited.id, patch)}
                    onDelete={() => deleteProduct(productBeingEdited.id)}
                    onPayment={() => setPayId(productBeingEdited.id)}
                    onBack={() => setProductId(null)}
                  />
                )}

                {selectedSection.type === 'products' && payingProduct && (
                  <PaymentStep
                    product={payingProduct}
                    onChange={(patch) => updateProduct(payingProduct.id, patch)}
                    onBack={() => setPayId(null)}
                    onSave={() => {
                      setPayId(null)
                      setProductId(null)
                      flash('Payment details saved')
                    }}
                  />
                )}

                {selectedSection.type !== 'profile' && selectedSection.type !== 'products' && (
                  <SectionFields section={selectedSection} onChange={(patch) => updateSection(selectedSection.id, patch)} />
                )}

                {selectedSection.type !== 'profile' && selectedSection.type !== 'products' && (
                  <div className="cs-danger-zone">
                    <button type="button" className="cs-quiet" onClick={() => resetSection(selectedSection.id)}>
                      Reset section
                    </button>
                    <button type="button" className="cs-danger" onClick={() => removeSection(selectedSection.id)}>
                      <Trash2 size={13} /> Delete section
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="cs-preview">
          <Phone
            doc={doc}
            selected={selected}
            onSelect={focusSection}
            onClear={clearSelection}
            dropPreview={dropPreview}
            pendingDrop={pendingDrop}
            onDropSettled={settleDrop}
            onDragStart={() => {
              dragSnapshot.current = clone(docRef.current)
            }}
            onDragLive={live}
            onDragEnd={() => {
              if (!dragSnapshot.current) return
              past.current.push(dragSnapshot.current)
              future.current = []
              dragSnapshot.current = null
              syncHistory()
              markSaving()
              flash('Section moved')
            }}
            storeUrl={storeUrl}
          />
        </div>
      </div>

      {toast && (
        <div className="cs-toast" role="status">
          <span className="cs-toast-icon">
            <Check size={14} />
          </span>
          {toast}
        </div>
      )}

      {viewer && (
        <StorefrontViewer
          doc={doc}
          storeUrl={storeUrl}
          device={viewerDevice}
          onDevice={setViewerDevice}
          onClose={() => setViewer(false)}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- palette --- */

const PALETTE: Array<{ type: SectionType; icon: ReactNode; label: string; description: string }> = [
  {
    type: 'products',
    icon: <Upload size={15} />,
    label: 'Upload Digital Product',
    description: 'Files, image, title & price',
  },
  {
    type: 'tiktok',
    icon: <MonitorPlay size={15} />,
    label: 'Digital Product Video Preview',
    description: 'Video + swipeable Buy page',
  },
  {
    type: 'email',
    icon: <Mail size={15} />,
    label: 'Email Support',
    description: 'Contact about orders',
  },
]

function Palette({
  doc,
  onAdd,
  onDrop,
  onPreview,
}: {
  doc: Doc
  onAdd: (type: SectionType) => void
  onDrop: (type: SectionType, y: number) => void
  onPreview: (y: number | null) => void
}) {
  const suppress = useRef(false)
  const moved = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef<{ type: SectionType; preview: number | null } | null>(null)

  const phone = () => document.querySelector<HTMLElement>('[data-phone-screen]')

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return
      const dx = e.clientX - (start.current?.x ?? e.clientX)
      const dy = e.clientY - (start.current?.y ?? e.clientY)
      if (Math.hypot(dx, dy) > 5) moved.current = true
      const screen = phone()
      if (!screen) return
      const rect = screen.getBoundingClientRect()
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      if (!inside) {
        onPreview(null)
        drag.current.preview = null
        return
      }
      if (e.clientY < rect.top + 44) screen.scrollTop -= 10
      if (e.clientY > rect.bottom - 44) screen.scrollTop += 10
      const scale = Number(screen.dataset.scale || 1)
      const yInCanvas = (e.clientY - rect.top + screen.scrollTop) / scale
      const snapped = Math.max(TOP, Math.round(yInCanvas / GRID) * GRID)
      drag.current.preview = snapped
      onPreview(snapped)
    }
    const onUp = () => {
      const current = drag.current
      drag.current = null
      onPreview(null)
      if (!current) return
      if (moved.current && current.preview !== null) {
        suppress.current = true
        onDrop(current.type, current.preview)
      }
      moved.current = false
      window.setTimeout(() => (suppress.current = false), 0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [onDrop, onPreview])

  return (
    <div className="cs-palette">
      {PALETTE.map((card) => {
        const exists = doc.sections.some((s) => s.type === card.type)
        return (
          <button
            key={card.type}
            type="button"
            className="cs-palette-card"
            aria-label={`Add ${card.label}`}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              if ((e.target as HTMLElement).closest('button') !== e.currentTarget) return
              start.current = { x: e.clientX, y: e.clientY }
              moved.current = false
              drag.current = { type: card.type, preview: null }
            }}
            onClick={() => {
              if (suppress.current) return
              onAdd(card.type)
            }}
          >
            <span className="cs-palette-icon">{card.icon}</span>
            <span className="cs-palette-label">{card.label}</span>
            <span className="cs-palette-desc">{exists ? 'Add another' : card.description}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ phone --- */

function Phone({
  doc,
  selected,
  onSelect,
  onClear,
  dropPreview,
  pendingDrop,
  onDropSettled,
  onDragStart,
  onDragLive,
  onDragEnd,
  storeUrl,
}: {
  doc: Doc
  selected: string | null
  onSelect: (id: string) => void
  onClear: () => void
  dropPreview: number | null
  pendingDrop: { id: string; y: number } | null
  onDropSettled: () => void
  onDragStart: () => void
  onDragLive: (updater: (current: Doc) => Doc) => void
  onDragEnd: () => void
  storeUrl: string
}) {
  const screenRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const heights = useRef(new Map<string, number>())
  const stacked = useRef(false)
  const [scale, setScale] = useState(1)
  const [canvasH, setCanvasH] = useState(640)
  const [width, setWidth] = useState(() => {
    if (typeof localStorage === 'undefined') return 292
    const saved = Number(localStorage.getItem('cs.device-width'))
    return Number.isFinite(saved) && saved >= 150 ? saved : 292
  })
  const drag = useRef<{
    id: string
    startX: number
    startY: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const update = () => {
      const next = Math.max(0.4, wrap.clientWidth / CANVAS_W)
      setScale(next)
      if (screenRef.current) screenRef.current.dataset.scale = String(next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    for (const section of doc.sections) {
      const el = canvasRef.current?.querySelector<HTMLElement>(`[data-id="${section.id}"]`)
      if (el) heights.current.set(section.id, el.offsetHeight)
    }
    if (!stacked.current) {
      stacked.current = true
      let cursor = TOP
      const positions = new Map<string, number>()
      for (const section of doc.sections) {
        positions.set(section.id, cursor)
        cursor += (heights.current.get(section.id) ?? 110) + GRID
      }
      onDragLive((current) => ({
        ...current,
        sections: current.sections.map((s) => ({ ...s, y: positions.get(s.id) ?? s.y })),
      }))
    }
    if (pendingDrop) {
      const dropped = doc.sections.find((s) => s.id === pendingDrop.id)
      if (dropped) {
        const height = heights.current.get(dropped.id) ?? 90
        const covered = doc.sections.filter(
          (s) => s.id !== dropped.id && s.type !== 'profile' && s.y + (heights.current.get(s.id) ?? 0) > pendingDrop.y,
        )
        if (covered.length) {
          const top = Math.min(...covered.map((s) => s.y))
          const delta = dropped.y + height + GRID - top
          if (delta > 0) {
            const ids = new Set(covered.map((s) => s.id))
            onDragLive((current) => ({
              ...current,
              sections: current.sections.map((s) =>
                ids.has(s.id) ? { ...s, y: Math.round((s.y + delta) / GRID) * GRID } : s,
              ),
            }))
          }
        }
      }
      onDropSettled()
    }
    let max = 640
    for (const section of doc.sections) {
      max = Math.max(max, section.y + (heights.current.get(section.id) ?? 0) + 40)
    }
    setCanvasH(max)
  }, [doc, onDragLive, scale, pendingDrop, onDropSettled])

  const resize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const move = (ev: PointerEvent) => {
      const next = Math.round(Math.min(420, Math.max(150, startW + (ev.clientX - startX))))
      setWidth(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useEffect(() => {
    try {
      localStorage.setItem('cs.device-width', String(width))
    } catch {
      /* storage blocked */
    }
  }, [width])

  const beginDrag = (e: ReactPointerEvent, section: Section) => {
    if (section.type === 'profile') return
    e.preventDefault()
    e.stopPropagation()
    onSelect(section.id)
    const currentProfile = doc.sections.find((s) => s.type === 'profile')
    const profileBottom = (currentProfile?.y ?? 0) + (heights.current.get(currentProfile?.id ?? '') ?? 90)
    drag.current = {
      id: section.id,
      startX: e.clientX,
      startY: e.clientY,
      x: section.x,
      y: section.y,
      moved: false,
    }
    setDragging(section.id)
    onDragStart()

    const screen = screenRef.current
    const currentScale = () => Number(screen?.dataset.scale || scale || 1)

    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const s = currentScale()
      const dx = (ev.clientX - d.startX) / s
      const dy = (ev.clientY - d.startY) / s
      if (Math.hypot(dx, dy) > 2) d.moved = true
      if (screen) {
        const rect = screen.getBoundingClientRect()
        if (ev.clientY < rect.top + 44) screen.scrollTop -= 10
        if (ev.clientY > rect.bottom - 44) screen.scrollTop += 10
      }
      let x = Math.round((d.x + dx) / GRID) * GRID
      x = Math.max(PAD, Math.min(CANVAS_W - PAD - section.w, x))
      let y = Math.round((d.y + dy) / GRID) * GRID
      y = Math.max(Math.max(TOP, Math.round((profileBottom + GRID) / GRID) * GRID), y)

      // Never cover another block: nudge the dragged block clear.
      const others = docRefSections(doc, section.id)
      for (let pass = 0; pass < 12; pass++) {
        const h = heights.current.get(section.id) ?? 80
        const hit = others.find((o) => {
          const oh = heights.current.get(o.id) ?? 80
          return x < o.x + o.w && x + section.w > o.x && y < o.y + oh && y + h > o.y
        })
        if (!hit) break
        y = hit.y + (heights.current.get(hit.id) ?? 80) + GRID
      }

      onDragLive((current) => ({
        ...current,
        sections: current.sections.map((s) => (s.id === section.id ? { ...s, x, y } : s)),
      }))
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDragging(null)
      if (drag.current?.moved) onDragEnd()
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div className="cs-phone-wrap">
      <div className="cs-phone" style={{ '--device-w': `${width}px` } as CSSProperties}>
        <span className="cs-notch" aria-hidden="true" />
        <div
          className="cs-screen"
          ref={screenRef}
          data-phone-screen
          data-scale={scale}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('.cs-block, .cs-grip, button, input, a')) return
            onClear()
          }}
        >
          <div className="cs-screen-bg" aria-hidden="true" />
          <div className="cs-canvas-wrap" ref={wrapRef} style={{ height: canvasH * scale }}>
            <div
              className="cs-canvas"
              ref={canvasRef}
              style={{ width: CANVAS_W, height: canvasH, transform: `scale(${scale})` }}
            >
              {doc.sections.map((section) => {
                const isProfile = section.type === 'profile'
                return (
                  <div
                    key={section.id}
                    data-id={section.id}
                    data-type={section.type}
                    className={[
                      'cs-block',
                      isProfile && 'cs-block-profile',
                      selected === section.id && 'is-selected',
                      dragging === section.id && 'is-dragging',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: section.x, top: section.y, width: section.w }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${NAME[section.type]}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(section.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(section.id)
                      }
                    }}
                  >
                    <BlockContent section={section} products={doc.products} />
                    {!isProfile && (
                      <button
                        type="button"
                        className="cs-grip"
                        aria-label={`Move ${NAME[section.type]}`}
                        title="Drag to move"
                        onPointerDown={(e) => beginDrag(e, section)}
                      >
                        <GripVertical size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
              {dropPreview !== null && (
                <div
                  className="cs-drop-preview"
                  style={{ left: PAD, top: dropPreview, width: CANVAS_W - PAD * 2 }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>
        <span className="cs-resize" role="separator" aria-label="Resize preview" onPointerDown={resize} title="Drag to resize">
          <span />
          <span />
        </span>
      </div>
      <p className="cs-caption">
        <Link2 size={12} />
        <span>Live preview · {storeUrl}</span>
      </p>
    </div>
  )
}

function docRefSections(doc: Doc, except: string) {
  return doc.sections.filter((s) => s.id !== except && s.type !== 'profile')
}

/* ----------------------------------------------------------------- blocks --- */

function BlockContent({ section, products }: { section: Section; products: Product[] }) {
  switch (section.type) {
    case 'profile':
      return (
        <div className="cs-profile">
          <span className="cs-avatar">{(section.heading || 'A').slice(0, 1).toUpperCase()}</span>
          <strong>{section.heading || 'Your name'}</strong>
          <span className="cs-handle">@{section.handle || 'handle'}</span>
          <p>{section.body}</p>
        </div>
      )
    case 'products':
      return (
        <div className="cs-sect">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          <div className="cs-products">
            {products
              .filter((p) => p.title.trim())
              .map((product) => (
                <div className="cs-product" key={product.id}>
                  <div className="cs-product-cover" style={product.cover ? { backgroundImage: `url(${product.cover})` } : undefined}>
                    {!product.cover && product.title.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="cs-product-info">
                    <strong>{product.title}</strong>
                    {product.description && <span>{product.description}</span>}
                  </div>
                  <div className="cs-product-buy">
                    <b>{product.price ? `£${product.price}` : 'Price not set'}</b>
                    <span>{product.buttonLabel || 'Get it'}</span>
                  </div>
                </div>
              ))}
            {!products.some((p) => p.title.trim()) && <p className="cs-empty">No products yet.</p>}
          </div>
        </div>
      )
    case 'tiktok':
      return (
        <div className="cs-sect">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          <div className="cs-video-card">
            <span className="cs-play" aria-hidden="true">
              ▶
            </span>
            <span className="cs-video-meta">@avalane · 128K views</span>
          </div>
        </div>
      )
    case 'links':
      return (
        <div className="cs-sect">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          <div className="cs-link-list">
            {(section.links ?? []).map((link) => (
              <span className="cs-link" key={link.id}>
                {link.label || 'Untitled link'}
              </span>
            ))}
          </div>
        </div>
      )
    case 'social':
      return (
        <div className="cs-social">
          {(section.socials ?? []).map((social) => (
            <span key={social.id}>{social.label || 'Social'}</span>
          ))}
        </div>
      )
    case 'text':
      return <p className="cs-text">{section.body}</p>
    case 'image':
      return (
        <div className="cs-sect">
          {(section.images ?? []).map((image) => (
            <div className="cs-image" key={image.id}>
              <div className="cs-image-frame" style={image.src ? { backgroundImage: `url(${image.src})` } : undefined} />
              {image.caption && <span>{image.caption}</span>}
            </div>
          ))}
        </div>
      )
    case 'video':
      return (
        <div className="cs-sect">
          {(section.videos ?? []).map((video) => (
            <div className="cs-video-embed" key={video.id}>
              <span className="cs-play" aria-hidden="true">
                ▶
              </span>
              {video.caption && <span>{video.caption}</span>}
            </div>
          ))}
        </div>
      )
    case 'newsletter':
      return (
        <div className="cs-newsletter">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          {section.body && <p>{section.body}</p>}
          <div className="cs-subscribe">
            <span>you@email.com</span>
            <b>{section.buttonLabel || 'Subscribe'}</b>
          </div>
        </div>
      )
    case 'divider':
      return <hr className="cs-hr" />
    case 'showcase':
      return (
        <div className="cs-sect">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          {(section.showcase ?? []).map((item) => (
            <div className="cs-showcase" key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
          ))}
        </div>
      )
    case 'email':
      return (
        <div className="cs-sect">
          {section.heading && <span className="cs-sect-caption">{section.heading}</span>}
          <div className="cs-email">
            <span className="cs-email-icon">
              <Mail size={18} />
            </span>
            <div>
              <strong>Questions about your order?</strong>
              {section.body && <p>{section.body}</p>}
            </div>
            <span className="cs-email-btn">{section.buttonLabel || 'Email us'}</span>
          </div>
        </div>
      )
    default:
      return null
  }
}

/* ---------------------------------------------------------------- editors --- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cs-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ProfileEditor({ section, onSync }: { section: Section; onSync: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const sync = () => {
    setSyncing(true)
    window.setTimeout(() => (setSyncing(false), onSync()), 900)
  }
  return (
    <div className="cs-form">
      <div className="cs-profile-mini">
        <span className="cs-avatar">{(section.heading || 'A').slice(0, 1).toUpperCase()}</span>
        <strong>{section.heading}</strong>
        <span className="cs-handle">@{section.handle}</span>
        <p>{section.body}</p>
      </div>
      <p className="cs-note">
        To change your photo, name or bio, edit your TikTok profile — then sync here. This section is locked at the top
        of your store and cannot be moved.
      </p>
      <div className="cs-inline">
        <button type="button" className="cs-quiet" onClick={sync} disabled={syncing}>
          <RefreshCw size={13} className={syncing ? 'cs-spin' : undefined} /> {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
        <span className="cs-timestamp">Last synced 2 minutes ago</span>
      </div>
      <div className="cs-warning">
        <AlertTriangle size={14} />
        <span>Profile details come from TikTok. Reconnect if your photo or name looks out of date.</span>
      </div>
      <div className="cs-inline">
        <button type="button" className="cs-quiet" onClick={onSync}>
          Reconnect TikTok
        </button>
        <button type="button" className="cs-danger cs-danger-plain" onClick={onSync}>
          Disconnect
        </button>
      </div>
    </div>
  )
}

function ProductsEditor({
  products,
  onAdd,
  onEdit,
}: {
  products: Product[]
  onAdd: () => void
  onEdit: (id: string) => void
}) {
  return (
    <div className="cs-form">
      <div className="cs-list">
        {products.map((product) => (
          <button type="button" key={product.id} className="cs-product-row" onClick={() => onEdit(product.id)}>
            <span className="cs-thumb" style={product.cover ? { backgroundImage: `url(${product.cover})` } : undefined}>
              {!product.cover && (product.title || 'N').slice(0, 1).toUpperCase()}
            </span>
            <span className="cs-product-row-text">
              <strong>{product.title || 'Untitled product'}</strong>
              <span>{product.price ? `£${product.price}` : 'No price yet'}</span>
            </span>
            <span className="cs-row-tag">{product.provider === 'stripe' ? 'Stripe' : 'No provider'}</span>
          </button>
        ))}
      </div>
      <button type="button" className="cs-outline" onClick={onAdd}>
        <Plus size={13} /> Add product
      </button>
    </div>
  )
}

function ProductEditor({
  product,
  onChange,
  onDelete,
  onPayment,
  onBack,
}: {
  product: Product
  onChange: (patch: Partial<Product>) => void
  onDelete: () => void
  onPayment: () => void
  onBack: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const upload = (f: File | undefined) => {
    setError(null)
    if (!f) return
    if (f.size > 1.5 * 1024 * 1024) {
      setError('That image is larger than 1.5 MB. Choose a smaller file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange({ cover: String(reader.result) })
    reader.readAsDataURL(f)
  }

  return (
    <div className="cs-form">
      <div className="cs-cover-row">
        <button type="button" className="cs-cover" onClick={() => file.current?.click()} style={product.cover ? { backgroundImage: `url(${product.cover})` } : undefined}>
          {!product.cover && <Plus size={16} />}
          <span className="sr-only">Upload cover image</span>
        </button>
        <div>
          <strong>Cover image</strong>
          <span className="cs-timestamp">PNG or JPG, up to 1.5 MB</span>
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      <Field label="Title">
        <input className="cs-input" value={product.title} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea className="cs-input" rows={3} value={product.description} onChange={(e) => onChange({ description: e.target.value })} />
      </Field>
      <Field label="Link (optional)">
        <input className="cs-input" value={product.link} placeholder="https://" onChange={(e) => onChange({ link: e.target.value })} />
      </Field>
      <Field label="Button label">
        <input className="cs-input" value={product.buttonLabel} maxLength={40} placeholder="Get it" onChange={(e) => onChange({ buttonLabel: e.target.value })} />
      </Field>
      <div className="cs-inline cs-inline-end">
        <button type="button" className="cs-quiet" onClick={onBack}>
          <ArrowLeft size={13} /> Products
        </button>
        <button type="button" className="cs-primary-sm" onClick={onPayment}>
          Price &amp; payment
        </button>
      </div>
      <button type="button" className="cs-danger" onClick={onDelete}>
        <Trash2 size={13} /> Delete product
      </button>
    </div>
  )
}

function PaymentStep({
  product,
  onChange,
  onBack,
  onSave,
}: {
  product: Product
  onChange: (patch: Partial<Product>) => void
  onBack: () => void
  onSave: () => void
}) {
  const [price, setPrice] = useState(product.price)
  const [error, setError] = useState<string | null>(null)

  const validate = (value: string) => {
    if (!value.trim()) return null
    if (!/^\d*\.?\d{0,2}$/.test(value)) return 'Enter a price like 12.00'
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) return 'Enter a price like 12.00'
    return null
  }

  return (
    <div className="cs-form">
      <div className="cs-pay-summary">
        <span className="cs-thumb" style={product.cover ? { backgroundImage: `url(${product.cover})` } : undefined}>
          {!product.cover && (product.title || 'N').slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{product.title || 'New product'}</strong>
          <span className="cs-timestamp">Price shown to buyers in pounds sterling (GBP).</span>
        </div>
      </div>

      <dl className="cs-status">
        <div>
          <dt>Price</dt>
          <dd>{product.price ? `£${product.price}` : 'Not set'}</dd>
        </div>
        <div>
          <dt>Payments</dt>
          <dd>
            {product.provider === 'stripe'
              ? 'Stripe Connect chosen — account ID still needed'
              : 'No payment provider chosen'}
          </dd>
        </div>
      </dl>

      <Field label="Price (GBP)">
        <input
          className="cs-input"
          inputMode="decimal"
          value={price}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const value = e.target.value.replace(/[^\d.]/g, '')
            setPrice(value)
            setError(validate(value))
          }}
        />
      </Field>
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      {!price.trim() && (
        <p className="cs-note">No price set yet — the storefront shows “Price not set” until you enter one.</p>
      )}

      <div className="cs-field">
        <span>Payment provider</span>
        <div className="cs-seg" role="group" aria-label="Payment provider">
          <button type="button" aria-pressed={product.provider === 'none'} onClick={() => onChange({ provider: 'none' })}>
            None
          </button>
          <button type="button" aria-pressed={product.provider === 'stripe'} onClick={() => onChange({ provider: 'stripe' })}>
            Stripe Connect
          </button>
        </div>
      </div>

      {product.provider === 'stripe' && (
        <>
          <Field label="Stripe account ID (optional)">
            <input className="cs-input" value={product.acct} placeholder="acct_…" onChange={(e) => onChange({ acct: e.target.value })} />
          </Field>
          <p className="cs-note">
            Stripe Connect is not connected yet. You can save the account ID now and finish connecting it later.
          </p>
        </>
      )}

      <div className="cs-inline cs-inline-end">
        <button type="button" className="cs-quiet" onClick={onBack}>
          <ArrowLeft size={13} /> Back
        </button>
        <button
          type="button"
          className="cs-primary-sm"
          disabled={Boolean(validate(price))}
          onClick={() => {
            const parsed = price.trim() ? Number(price).toFixed(2) : ''
            onChange({ price: parsed })
            onSave()
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function SectionFields({ section, onChange }: { section: Section; onChange: (patch: Partial<Section>) => void }) {
  const itemCard = (key: string, children: ReactNode, remove?: () => void) => (
    <div className="cs-item" key={key}>
      {children}
      {remove && (
        <button type="button" className="cs-item-delete" aria-label="Delete item" onClick={remove}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )

  switch (section.type) {
    case 'links':
      return (
        <div className="cs-form">
          {(section.links ?? []).map((link, index) =>
            itemCard(
              link.id,
              <>
                <Field label={`Label ${index + 1}`}>
                  <input
                    className="cs-input"
                    value={link.label}
                    onChange={(e) =>
                      onChange({ links: (section.links ?? []).map((l) => (l.id === link.id ? { ...l, label: e.target.value } : l)) })
                    }
                  />
                </Field>
                <Field label="Address">
                  <input
                    className="cs-input"
                    value={link.url}
                    onChange={(e) =>
                      onChange({ links: (section.links ?? []).map((l) => (l.id === link.id ? { ...l, url: e.target.value } : l)) })
                    }
                  />
                </Field>
              </>,
              () => onChange({ links: (section.links ?? []).filter((l) => l.id !== link.id) }),
            ),
          )}
          <button
            type="button"
            className="cs-outline"
            onClick={() => onChange({ links: [...(section.links ?? []), { id: `lnk_${uid()}`, label: 'New link', url: 'https://' }] })}
          >
            <Plus size={13} /> Add link
          </button>
        </div>
      )
    case 'tiktok':
    case 'video':
      return (
        <div className="cs-form">
          {(section.videos ?? []).map((video) =>
            itemCard(
              video.id,
              <>
                <Field label="Caption">
                  <input
                    className="cs-input"
                    value={video.caption}
                    onChange={(e) =>
                      onChange({ videos: (section.videos ?? []).map((v) => (v.id === video.id ? { ...v, caption: e.target.value } : v)) })
                    }
                  />
                </Field>
                <Field label="Video URL">
                  <input
                    className="cs-input"
                    value={video.url}
                    placeholder="https://"
                    onChange={(e) =>
                      onChange({ videos: (section.videos ?? []).map((v) => (v.id === video.id ? { ...v, url: e.target.value } : v)) })
                    }
                  />
                </Field>
              </>,
              () => onChange({ videos: (section.videos ?? []).filter((v) => v.id !== video.id) }),
            ),
          )}
          <button
            type="button"
            className="cs-outline"
            onClick={() => onChange({ videos: [...(section.videos ?? []), { id: `vid_${uid()}`, caption: '', url: '' }] })}
          >
            <Plus size={13} /> Add video
          </button>
        </div>
      )
    case 'social':
      return (
        <div className="cs-form">
          {(section.socials ?? []).map((social) =>
            itemCard(
              social.id,
              <>
                <Field label="Network">
                  <input
                    className="cs-input"
                    value={social.label}
                    onChange={(e) =>
                      onChange({ socials: (section.socials ?? []).map((s) => (s.id === social.id ? { ...s, label: e.target.value } : s)) })
                    }
                  />
                </Field>
                <Field label="Address">
                  <input
                    className="cs-input"
                    value={social.url}
                    onChange={(e) =>
                      onChange({ socials: (section.socials ?? []).map((s) => (s.id === social.id ? { ...s, url: e.target.value } : s)) })
                    }
                  />
                </Field>
              </>,
              () => onChange({ socials: (section.socials ?? []).filter((s) => s.id !== social.id) }),
            ),
          )}
          <button
            type="button"
            className="cs-outline"
            onClick={() => onChange({ socials: [...(section.socials ?? []), { id: `soc_${uid()}`, label: 'Instagram', url: 'https://' }] })}
          >
            <Plus size={13} /> Add social link
          </button>
        </div>
      )
    case 'text':
      return (
        <div className="cs-form">
          <Field label="Text">
            <textarea className="cs-input" rows={5} value={section.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} />
          </Field>
        </div>
      )
    case 'image':
      return (
        <div className="cs-form">
          {(section.images ?? []).map((image, index) =>
            itemCard(
              image.id,
              <>
                <Field label={`Image URL ${index + 1}`}>
                  <input
                    className="cs-input"
                    value={image.src}
                    placeholder="https://"
                    onChange={(e) =>
                      onChange({ images: (section.images ?? []).map((i) => (i.id === image.id ? { ...i, src: e.target.value } : i)) })
                    }
                  />
                </Field>
                <Field label="Caption">
                  <input
                    className="cs-input"
                    value={image.caption}
                    onChange={(e) =>
                      onChange({ images: (section.images ?? []).map((i) => (i.id === image.id ? { ...i, caption: e.target.value } : i)) })
                    }
                  />
                </Field>
              </>,
              () => onChange({ images: (section.images ?? []).filter((i) => i.id !== image.id) }),
            ),
          )}
          <button
            type="button"
            className="cs-outline"
            onClick={() => onChange({ images: [...(section.images ?? []), { id: `img_${uid()}`, src: '', caption: '' }] })}
          >
            <Plus size={13} /> Add image
          </button>
        </div>
      )
    case 'newsletter':
      return (
        <div className="cs-form">
          <Field label="Heading">
            <input className="cs-input" value={section.heading ?? ''} onChange={(e) => onChange({ heading: e.target.value })} />
          </Field>
          <Field label="Text">
            <textarea className="cs-input" rows={3} value={section.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} />
          </Field>
          <Field label="Button label">
            <input className="cs-input" value={section.buttonLabel ?? ''} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
          </Field>
        </div>
      )
    case 'divider':
      return (
        <div className="cs-form">
          <p className="cs-note">A quiet line that gives the page room to breathe.</p>
          <Field label="Preview">
            <hr className="cs-hr" />
          </Field>
        </div>
      )
    case 'showcase':
      return (
        <div className="cs-form">
          {(section.showcase ?? []).map((item) =>
            itemCard(
              item.id,
              <>
                <Field label="Title">
                  <input
                    className="cs-input"
                    value={item.title}
                    onChange={(e) =>
                      onChange({ showcase: (section.showcase ?? []).map((s) => (s.id === item.id ? { ...s, title: e.target.value } : s)) })
                    }
                  />
                </Field>
                <Field label="Text">
                  <textarea
                    className="cs-input"
                    rows={2}
                    value={item.body}
                    onChange={(e) =>
                      onChange({ showcase: (section.showcase ?? []).map((s) => (s.id === item.id ? { ...s, body: e.target.value } : s)) })
                    }
                  />
                </Field>
              </>,
              () => onChange({ showcase: (section.showcase ?? []).filter((s) => s.id !== item.id) }),
            ),
          )}
          <button
            type="button"
            className="cs-outline"
            onClick={() => onChange({ showcase: [...(section.showcase ?? []), { id: `shw_${uid()}`, title: '', body: '' }] })}
          >
            <Plus size={13} /> Add card
          </button>
        </div>
      )
    case 'email':
      return (
        <div className="cs-form">
          <Field label="Support email">
            <input className="cs-input" value={section.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className="cs-input" rows={3} value={section.body ?? ''} onChange={(e) => onChange({ body: e.target.value })} />
          </Field>
          <Field label="Button label">
            <input className="cs-input" value={section.buttonLabel ?? ''} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
          </Field>
        </div>
      )
    default:
      return null
  }
}

/* --------------------------------------------------------------- storefront --- */

function StorefrontViewer({
  doc,
  storeUrl,
  device,
  onDevice,
  onClose,
}: {
  doc: Doc
  storeUrl: string
  device: 'mobile' | 'desktop'
  onDevice: (device: 'mobile' | 'desktop') => void
  onClose: () => void
}) {
  const width = device === 'mobile' ? 320 : 400
  return (
    <div className="cs-viewer" role="dialog" aria-modal="true" aria-label="Store preview">
      <div className="cs-viewer-bar">
        <button type="button" className="cs-back-editor" onClick={onClose}>
          <ArrowLeft size={14} /> Back to Editor
        </button>
        <span className="cs-viewer-url">
          <Link2 size={12} /> {storeUrl}
        </span>
        <div className="cs-seg cs-viewer-seg" role="group" aria-label="Preview device">
          <button type="button" aria-pressed={device === 'mobile'} onClick={() => onDevice('mobile')} aria-label="Mobile preview">
            <Smartphone size={14} />
          </button>
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => onDevice('desktop')} aria-label="Desktop preview">
            <Monitor size={14} />
          </button>
        </div>
      </div>
      <div className="cs-viewer-stage">
        <div className="cs-viewer-phone" style={{ width }}>
          <span className="cs-notch" aria-hidden="true" />
          <div className="cs-viewer-screen">
            <div className="cs-screen-bg" aria-hidden="true" />
            <Storefront doc={doc} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Storefront({ doc }: { doc: Doc }) {
  return (
    <div className="cs-storefront">
      {doc.sections
        .filter((s) => s.type !== 'divider')
        .map((section) => (
          <div key={section.id} className="cs-storefront-block">
            <BlockContent section={section} products={doc.products} />
          </div>
        ))}
      <p className="cs-storefront-foot">Made with Launchly</p>
    </div>
  )
}
