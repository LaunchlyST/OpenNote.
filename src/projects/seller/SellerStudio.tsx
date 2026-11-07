import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Landmark,
  Monitor,
  Package,
  Plus,
  Smartphone,
  Store,
  Trash2,
  Upload,
} from 'lucide-react'
import { cn } from '../../lib/id'
import { StorePage } from './StorePage'
import { SellerError, dataUrlToBlob, sellerApi } from './api'
import {
  BLOCKS,
  BUTTON_STYLES,
  CURRENCIES,
  FONTS,
  PLATFORM_FEE_PERCENT,
  PRESETS,
  blockLabel,
  forgetLegacyDraft,
  formatPrice,
  handleProblem,
  mediaUrl,
  newBlock,
  readLegacyDraft,
  toHandle,
} from './model'

/** Largest product file a seller can upload (Supabase Free allows 50 MB per file). */
const MAX_PRODUCT_FILE_MB = 50
import type { Block, BlockType, DraftProduct, Page, SellerSetup, StoreView } from './model'

/**
 * Seller Studio: Start your store → optional Connect TikTok → build the page,
 * add products, connect payouts, publish, copy the bio link.
 *
 * Everything is saved on the Desknoty server, on the signed-in account. The
 * draft stays private until Publish; the live store keeps serving the last
 * published version meanwhile.
 */

type Tab = 'page' | 'products' | 'payouts' | 'link' | 'orders'

/** Single-panel states (loading, errors, start, TikTok): one white panel on the page background. */
function Solo({ compact = false, children }: { compact?: boolean; children: ReactNode }) {
  return (
    <div className={cn('ss ss-solo', compact && 'ss-compact')}>
      <section className="ss-editor">{children}</section>
    </div>
  )
}
const TT_KEY = (id: string) => `desknoty.seller.tiktok-step.${id}`

/** Where Stripe and TikTok send the seller back to: this page, Seller open. */
function returnPath() {
  return `${window.location.pathname}?tool=seller`
}

export function SellerStudio() {
  const [setup, setSetup] = useState<SellerSetup | null>(null)
  const [store, setStore] = useState<StoreView | null | undefined>(undefined)
  const [error, setError] = useState<SellerError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    try {
      const [s, st] = await Promise.all([sellerApi.setup(), sellerApi.store(refresh)])
      setSetup(s)
      setStore(st.store)
      setError(null)
    } catch (e) {
      setError(e instanceof SellerError ? e : new SellerError((e as Error).message, 0))
      setStore(null)
    }
  }, [])

  // Coming back from Stripe or TikTok
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const stripe = q.get('stripe')
    const tiktok = q.get('tiktok')
    void load(Boolean(stripe)).then(async () => {
      if (stripe === 'refresh') {
        // The onboarding link expired: open a fresh one, as Stripe recommends.
        try {
          window.location.href = (await sellerApi.onboard(returnPath())).url
        } catch (e) {
          setNotice((e as Error).message)
        }
      }
    })
    if (tiktok)
      setNotice(
        tiktok === 'connected' ? 'TikTok connected.' : tiktok === 'cancelled' ? 'TikTok connection was cancelled.' : 'TikTok connection failed. You can try again, or continue without TikTok.',
      )
    if (stripe || tiktok) {
      q.delete('stripe')
      q.delete('tiktok')
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q}`)
    }
  }, [load])

  if (store === undefined)
    return (
      <Solo compact>
        <div className="ss-state" role="status" aria-live="polite">
          <span className="ss-spinner" aria-hidden="true" />
          <p>Loading your store…</p>
        </div>
      </Solo>
    )
  if (error && !setup)
    return <StartCard setup={null} problem={error} retrying={retrying} onRetry={() => (setRetrying(true), void load().finally(() => setRetrying(false)))} onCreated={() => {}} />
  if (!store) return <StartCard setup={setup} onCreated={(s, skipTikTok) => (skipTikTok && localStorage.setItem(TT_KEY(s.id), '1'), setStore(s))} />
  if (!localStorage.getItem(TT_KEY(store.id)) && !store.tiktok) {
    return <TikTokStep store={store} setup={setup!} notice={notice} onDone={() => (localStorage.setItem(TT_KEY(store.id), '1'), setStore({ ...store }))} />
  }
  return <Studio store={store} setStore={setStore} setup={setup!} notice={notice} clearNotice={() => setNotice(null)} reload={load} />
}

/* ----------------------------------------------------------- start --- */

function TikTokMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z" />
    </svg>
  )
}

function useHandleCheck(handle: string) {
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null)
  useEffect(() => {
    const local = handle ? handleProblem(handle) : 'Choose a handle.'
    if (local) return setState({ ok: false, msg: local })
    setState(null)
    const t = window.setTimeout(() => {
      sellerApi
        .handle(handle)
        .then((r) => setState({ ok: r.available, msg: r.available ? 'Available' : (r.problem ?? 'Taken') }))
        .catch(() => setState({ ok: false, msg: 'Couldn’t check right now' }))
    }, 300)
    return () => window.clearTimeout(t)
  }, [handle])
  return state
}

/**
 * The first screen: Connect TikTok (optional), then pick your link. The same
 * card shows server problems (not connected, down, signed out) with the
 * right action, so the layout never changes.
 */
function StartCard({
  setup,
  onCreated,
  problem = null,
  retrying = false,
  onRetry,
}: {
  setup: SellerSetup | null
  onCreated: (s: StoreView, skipTikTok: boolean) => void
  problem?: SellerError | null
  retrying?: boolean
  onRetry?: () => void
}) {
  const [legacy] = useState(readLegacyDraft)
  const [mode, setMode] = useState<null | 'tiktok' | 'manual'>(null)
  const [ttOff, setTtOff] = useState(false)
  const [name, setName] = useState(legacy?.name ?? '')
  const [handle, setHandle] = useState(legacy?.handle ? toHandle(legacy.handle) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const check = useHandleCheck(mode ? handle : '')

  const start = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { store } = await sellerApi.create(name.trim(), handle)
      const ready = legacy ? await importLegacy(store) : store
      if (mode === 'tiktok') {
        try {
          window.location.href = (await sellerApi.tiktok(returnPath())).url
          return
        } catch {
          /* fall through to the studio; TikTok can be connected later */
        }
      }
      onCreated(ready, mode === 'manual')
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  const connect = () => {
    if (problem) return
    if (setup?.tiktok) setMode('tiktok')
    else setTtOff(true)
  }

  return (
    <Solo>
      <div className="ss-start">
        <div className="ss-start-top">
          <span className="ss-start-brand"><Store className="h-4 w-4" /> Seller</span>
          <span className="ss-start-fee">{PLATFORM_FEE_PERCENT}% platform fee</span>
        </div>
        <div className="ss-start-card">
          <span className="ss-start-icon"><Store className="h-7 w-7" strokeWidth={1.8} /></span>
          <h2>Start your store</h2>
          {!mode ? (
            <>
              <p>Connect TikTok to create your store in 2 minutes.</p>
              <button type="button" className="ss-tt" onClick={connect} disabled={Boolean(problem)}>
                <TikTokMark /> Connect TikTok
              </button>
              <ol className="ss-start-steps" aria-label="What happens next">
                <li><b>1</b> Connect TikTok</li>
                <li><b>2</b> Pick your link</li>
                <li><b>3</b> Add a product</li>
              </ol>
              {problem ? (
                <div className="ss-start-err" role="alert">
                  {problem.status === 401 ? 'You’re signed out.' : problem.status === -1 ? 'Seller Studio isn’t connected yet.' : 'Can’t reach the Desknoty server.'}
                  <small>{problem.message}</small>
                  {problem.status === 401 ? (
                    <a href="/app/signin">Sign in</a>
                  ) : (
                    <button type="button" onClick={onRetry} disabled={retrying}>{retrying ? 'Trying…' : 'Try again'}</button>
                  )}
                </div>
              ) : ttOff ? (
                <div className="ss-start-err" role="alert">
                  TikTok connection isn’t available.
                  <small>TikTok login isn’t switched on for Desknoty yet.</small>
                  <button type="button" onClick={() => setMode('manual')}>Continue without TikTok</button>
                </div>
              ) : (
                <button type="button" className="ss-start-skip" onClick={() => setMode('manual')}>Continue without TikTok</button>
              )}
            </>
          ) : (
            <>
              <p>{mode === 'tiktok' ? 'Pick your link, then connect TikTok.' : 'Pick your link. You can connect TikTok later.'}</p>
              <form
                className="ss-start-manual"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (check?.ok && name.trim()) void start()
                }}
              >
                <input className="ss-input ss-input-light" placeholder="Store name" aria-label="Store name" maxLength={60} value={name} onChange={(e) => (setName(e.target.value), !handle && setHandle(toHandle(e.target.value)))} />
                <div className="ss-affix ss-affix-light">
                  <span>/store/</span>
                  <input className="ss-input ss-input-light" placeholder="yourname" aria-label="Store handle" maxLength={30} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                </div>
                <span className={cn('ss-start-check', check?.ok ? 'ok' : 'no')} aria-live="polite">{check ? `● ${check.msg}` : 'Checking…'}</span>
                <button type="submit" className="ss-tt" disabled={!check?.ok || !name.trim() || busy}>
                  {busy ? 'Creating…' : mode === 'tiktok' ? <><TikTokMark /> Continue to TikTok</> : 'Start your store'}
                </button>
              </form>
              {legacy && <p className="ss-start-note">We found a store draft saved in this browser. It will be imported into your new store.</p>}
              {err && <div className="ss-start-err" role="alert">{err}</div>}
              <ol className="ss-start-steps" aria-label="What happens next">
                <li><b>1</b> Connect TikTok</li>
                <li><b>2</b> Pick your link</li>
                <li><b>3</b> Add a product</li>
              </ol>
            </>
          )}
        </div>
      </div>
    </Solo>
  )
}

/** Copies a draft from the old browser-only studio into the new server store. */
async function importLegacy(store: StoreView): Promise<StoreView> {
  const legacy = readLegacyDraft()
  if (!legacy) return store
  const upload = async (u: string | null) => {
    if (!u?.startsWith('data:image/')) return null
    const blob = await dataUrlToBlob(u)
    return blob ? (await sellerApi.uploadMedia(blob).catch(() => null))?.id ?? null : null
  }
  let current = store
  const ids: string[] = []
  for (const p of legacy.products) {
    const priceMinor = Math.round(Number(p.price || 0) * 100)
    const r = await sellerApi
      .addProduct({ title: p.title.slice(0, 80), description: p.short ?? '', priceMinor, currency: (p.currency || 'gbp').toLowerCase(), cover: await upload(p.cover) })
      .catch(() => null)
    if (r) {
      ids.push(r.product.id)
      current = r.store
    }
  }
  const page: Page = {
    ...current.draft,
    name: legacy.name || current.draft.name,
    bio: legacy.bio,
    avatar: await upload(legacy.avatar),
    theme: legacy.theme as Page['theme'],
    socials: legacy.socials,
    blocks: current.draft.blocks.map((b) => (b.type === 'grid' ? { ...b, data: { ...b.data, productIds: ids } } : b)),
  }
  const saved = await sellerApi.saveDraft(page).catch(() => null)
  forgetLegacyDraft()
  return saved?.store ?? current
}

function TikTokStep({ store, setup, notice, onDone }: { store: StoreView; setup: SellerSetup; notice: string | null; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(notice)
  return (
    <Solo>
      <div className="ss-start">
        <div className="ss-start-card">
          <span className="ss-start-icon"><TikTokMark /></span>
          <h2>Connect TikTok</h2>
          <p>Optional. Connecting shows your TikTok name and photo on your store. You can build and publish without it.</p>
          <button
            type="button"
            className="ss-tt"
            disabled={!setup.tiktok}
            onClick={() =>
              void sellerApi
                .tiktok(returnPath())
                .then((r) => (window.location.href = r.url))
                .catch((e: Error) => setErr(e.message))
            }
          >
            <TikTokMark /> Connect TikTok
          </button>
          {!setup.tiktok && <p className="ss-start-note">TikTok login isn’t switched on for this Desknoty server yet.</p>}
          {err && <div className="ss-start-err" role="alert">{err}</div>}
          <button type="button" className="ss-start-skip" onClick={onDone}>
            Continue without TikTok
          </button>
          <p className="ss-start-note">Your store: <b>{store.url}</b></p>
        </div>
      </div>
    </Solo>
  )
}

/* ---------------------------------------------------------- studio --- */

function Studio({
  store,
  setStore,
  setup,
  notice,
  clearNotice,
  reload,
}: {
  store: StoreView
  setStore: (s: StoreView) => void
  setup: SellerSetup
  notice: string | null
  clearNotice: () => void
  reload: (refresh?: boolean) => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>('page')
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile')
  const [page, setPage] = useState<Page>(store.draft)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const dirty = useRef(false)

  // Autosave the draft page, debounced.
  useEffect(() => {
    if (!dirty.current) return
    setSaving('saving')
    const t = window.setTimeout(() => {
      sellerApi
        .saveDraft(page)
        .then((r) => {
          dirty.current = false
          setStore(r.store)
          setSaving('saved')
        })
        .catch((e: Error) => (setSaving('error'), setErr(e.message)))
    }, 700)
    return () => window.clearTimeout(t)
  }, [page, setStore])
  const edit = (next: Page) => {
    dirty.current = true
    setPage(next)
  }

  const publish = async () => {
    setPublishing(true)
    setErr(null)
    try {
      if (dirty.current) {
        await sellerApi.saveDraft(page)
        dirty.current = false
      }
      const r = await sellerApi.publish()
      setStore(r.store)
    } catch (e) {
      setErr((e as Error).message)
    }
    setPublishing(false)
  }

  const productsForPreview = store.products.filter((p) => p.title.trim())
  const status = !store.publishedAt ? 'Not published yet' : store.unpublishedChanges || saving === 'saving' || dirty.current ? 'Unpublished changes' : 'Live'

  return (
    <div className="ss">
      <section className="ss-editor" aria-label="Store builder">
        <header className="ss-head">
          <p className="ss-kicker">Seller · Digital products</p>
          <div className="ss-titlebar">
            <h1>{page.name || store.handle}</h1>
            <div className="ss-publish">
              <span className={cn('ss-live', status === 'Live' && 'on')} aria-live="polite">
                ● {status}
                {saving === 'saving' ? ' · saving…' : saving === 'error' ? ' · not saved' : ''}
              </span>
              <button type="button" className="ss-primary ss-primary-sm" onClick={() => void publish()} disabled={publishing}>
                {publishing ? 'Publishing…' : store.publishedAt ? 'Publish changes' : 'Publish'}
              </button>
            </div>
          </div>
          <p className="ss-lede">
            Desknoty takes a {PLATFORM_FEE_PERCENT}% platform fee. Stripe’s card processing fees are separate and are charged by Stripe.
          </p>
          {(notice || err) && (
            <div className="ss-note" role="status">
              {err ?? notice}{' '}
              <button type="button" className="underline" onClick={() => (setErr(null), clearNotice())}>Dismiss</button>
            </div>
          )}
          <nav className="ss-tabs" role="tablist" aria-label="Seller Studio">
            {(
              [
                ['page', 'Page'],
                ['products', `Products (${store.products.length})`],
                ['payouts', 'Payouts'],
                ['link', 'Bio link'],
                ['orders', 'Orders'],
              ] as Array<[Tab, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
        </header>

        {tab === 'page' && <PageEditor page={page} onChange={edit} products={store.products} />}
        {tab === 'products' && <ProductsEditor store={store} setStore={setStore} />}
        {tab === 'payouts' && <PayoutsPanel store={store} setup={setup} reload={reload} />}
        {tab === 'link' && <LinkPanel store={store} setStore={setStore} />}
        {tab === 'orders' && <OrdersPanel />}
      </section>

      <aside className="ss-preview" aria-label="Draft preview">
        <div className="ss-preview-bar">
          <div className="ss-seg" role="tablist" aria-label="Preview size">
            <button type="button" role="tab" aria-selected={view === 'mobile'} onClick={() => setView('mobile')}>
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
            <button type="button" role="tab" aria-selected={view === 'desktop'} onClick={() => setView('desktop')}>
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
          </div>
          {store.publishedAt && (
            <a className="ss-ghost" href={`/store/${store.handle}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
          )}
        </div>
        <div className={cn('ss-device', view === 'desktop' && 'ss-device-desk')}>
          {view === 'mobile' && <span className="ss-island" aria-hidden="true" />}
          <div className="ss-screen">
            <div className="ss-addr">Draft · {store.url.replace(/^https?:\/\//, '')}</div>
            <StorePage page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} />
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ---------------------------------------------------- page editor --- */

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="ss-field">
      <span className="ss-label">{label}</span>
      {children}
      {hint && <span className="ss-hint">{hint}</span>}
    </label>
  )
}

function useUpload() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (file: File | undefined, done: (id: string) => void) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('Choose an image file.')
    if (file.size > 5 * 1024 * 1024) return setErr('Images can be up to 5 MB.')
    setBusy(true)
    setErr(null)
    try {
      done((await sellerApi.uploadMedia(file)).id)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return { busy, err, run }
}

function ImagePicker({ value, onChange, label }: { value: string | null; onChange: (id: string | null) => void; label: string }) {
  const up = useUpload()
  const src = mediaUrl(value)
  return (
    <div className="ss-row">
      <span className="ss-cover" style={src ? { backgroundImage: `url(${src})` } : undefined} />
      <label className="ss-ghost cursor-pointer">
        <ImagePlus className="h-3.5 w-3.5" /> {up.busy ? 'Uploading…' : label}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => void up.run(e.target.files?.[0], onChange)} />
      </label>
      {value && (
        <button type="button" className="ss-ghost" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
      {up.err && <span className="ss-hint text-[#b42318]">{up.err}</span>}
    </div>
  )
}

function PageEditor({ page, onChange, products }: { page: Page; onChange: (p: Page) => void; products: DraftProduct[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [inserting, setInserting] = useState<number | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const blocks = page.blocks
  const setBlocks = (b: Block[]) => onChange({ ...page, blocks: b })
  const update = (id: string, data: Record<string, unknown>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)))
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return
    const next = [...blocks]
    const [b] = next.splice(from, 1)
    next.splice(to, 0, b)
    setBlocks(next)
  }
  const insert = (at: number, type: BlockType) => {
    const b = newBlock(type)
    const next = [...blocks]
    next.splice(at, 0, b)
    setBlocks(next)
    setInserting(null)
    setOpen(b.id)
  }

  const Inserter = ({ at }: { at: number }) => (
    <div className={cn('sb-ins', over === at && dragId && 'sb-ins-drop')}
      onDragOver={(e) => (e.preventDefault(), setOver(at))}
      onDragLeave={() => setOver((o) => (o === at ? null : o))}
      onDrop={(e) => {
        e.preventDefault()
        const from = blocks.findIndex((b) => b.id === dragId)
        if (from >= 0) move(from, from < at ? at - 1 : at)
        setDragId(null)
        setOver(null)
      }}
    >
      {inserting === at ? (
        <div className="sb-menu" role="menu" aria-label="Add a block">
          {BLOCKS.map((t) => (
            <button key={t.type} type="button" role="menuitem" onClick={() => insert(at, t.type)}>
              <b>{t.label}</b>
              <small>{t.hint}</small>
            </button>
          ))}
          <button type="button" className="sb-menu-x" onClick={() => setInserting(null)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="sb-ins-btn" aria-label={at === 0 ? 'Add a block at the top' : at === blocks.length ? 'Add a block at the bottom' : `Add a block between ${blockLabel(blocks[at - 1].type)} and ${blockLabel(blocks[at].type)}`} onClick={() => setInserting(at)}>
          <Plus className="h-3.5 w-3.5" /> Add block
        </button>
      )}
    </div>
  )

  return (
    <div className="ss-stack">
      <ThemeEditor page={page} onChange={onChange} />
      <div className="sb-list" aria-label="Page sections">
        <Inserter at={0} />
        {blocks.map((b, i) => (
          <div key={b.id}>
            <div
              className={cn('sb-block', b.hidden && 'sb-hidden', dragId === b.id && 'sb-dragging')}
              draggable
              onDragStart={(e) => (setDragId(b.id), e.dataTransfer.setData('text/plain', b.id), (e.dataTransfer.effectAllowed = 'move'))}
              onDragEnd={() => (setDragId(null), setOver(null))}
            >
              <div className="sb-row">
                <span className="sb-grip" aria-hidden="true" title="Drag to move"><GripVertical className="h-4 w-4" /></span>
                <button type="button" className="sb-title" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
                  <b>{blockLabel(b.type)}</b>
                  <small>{summary(b, products)}</small>
                </button>
                <div className="sb-tools">
                  <button type="button" aria-label={`Move ${blockLabel(b.type)} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Move ${blockLabel(b.type)} down`} disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Duplicate ${blockLabel(b.type)}`} onClick={() => {
                    const copy = { ...newBlock(b.type), data: structuredClone(b.data), hidden: b.hidden }
                    const next = [...blocks]
                    next.splice(i + 1, 0, copy)
                    setBlocks(next)
                  }}><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`${b.hidden ? 'Show' : 'Hide'} ${blockLabel(b.type)}`} aria-pressed={b.hidden} onClick={() => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))}>
                    {b.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" aria-label={`Delete ${blockLabel(b.type)}`} onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {open === b.id && <BlockEditor block={b} products={products} update={(d) => update(b.id, d)} />}
            </div>
            <Inserter at={i + 1} />
          </div>
        ))}
      </div>
    </div>
  )
}

function summary(b: Block, products: DraftProduct[]) {
  const d = b.data
  const title = (id: string) => products.find((p) => p.id === id)?.title || 'Untitled'
  switch (b.type) {
    case 'header': return 'Photo, name and bio'
    case 'text': return d.heading || (d.body ? String(d.body).slice(0, 40) : 'Empty')
    case 'image': return d.media ? d.caption || 'Image' : 'No image yet'
    case 'links': return `${(d.links ?? []).filter((l: { url: string }) => l.url).length} link(s)`
    case 'featured': return d.productId ? title(d.productId) : 'No product chosen'
    case 'grid': return `${(d.productIds ?? []).length} product(s)`
    case 'faq': return `${(d.items ?? []).length} question(s)`
    case 'footer': return d.text || 'Footer'
  }
}

function BlockEditor({ block, products, update }: { block: Block; products: DraftProduct[]; update: (d: Record<string, unknown>) => void }) {
  const d = block.data
  switch (block.type) {
    case 'header':
      return (
        <div className="sb-edit">
          <p className="ss-muted">Uses your photo, name and bio from “Profile &amp; theme”.</p>
          <label className="ss-check"><input type="checkbox" checked={d.showSocials !== false} onChange={(e) => update({ showSocials: e.target.checked })} /> Show social links</label>
        </div>
      )
    case 'text':
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={120} value={d.heading ?? ''} onChange={(e) => update({ heading: e.target.value })} /></Field>
          <Field label="Text" hint="Leave a blank line between paragraphs."><textarea className="ss-input" rows={4} maxLength={4000} value={d.body ?? ''} onChange={(e) => update({ body: e.target.value })} /></Field>
        </div>
      )
    case 'image':
      return (
        <div className="sb-edit">
          <ImagePicker value={d.media ?? null} onChange={(media) => update({ media })} label="Choose image" />
          <Field label="Description for screen readers"><input className="ss-input" maxLength={200} value={d.alt ?? ''} onChange={(e) => update({ alt: e.target.value })} /></Field>
          <Field label="Caption"><input className="ss-input" maxLength={200} value={d.caption ?? ''} onChange={(e) => update({ caption: e.target.value })} /></Field>
        </div>
      )
    case 'links': {
      const links: Array<{ label: string; url: string }> = d.links ?? []
      const set = (next: typeof links) => update({ links: next })
      return (
        <div className="sb-edit">
          {links.map((l, i) => (
            <div key={i} className="sb-pair">
              <input className="ss-input" aria-label={`Link ${i + 1} label`} placeholder="Label" maxLength={80} value={l.label} onChange={(e) => set(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="ss-input" aria-label={`Link ${i + 1} address`} placeholder="https://" value={l.url} onChange={(e) => set(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="ss-ghost" aria-label={`Remove link ${i + 1}`} onClick={() => set(links.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" className="ss-ghost self-start" onClick={() => set([...links, { label: '', url: '' }])}><Plus className="h-3.5 w-3.5" /> Add link</button>
        </div>
      )
    }
    case 'featured':
      return (
        <div className="sb-edit">
          <Field label="Product">
            <select className="ss-input" value={d.productId ?? ''} onChange={(e) => update({ productId: e.target.value || null })}>
              <option value="">Choose a product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title || 'Untitled product'}</option>)}
            </select>
          </Field>
          <Field label="Small label above the title"><input className="ss-input" maxLength={200} value={d.note ?? ''} onChange={(e) => update({ note: e.target.value })} placeholder="New this week" /></Field>
          {!products.length && <p className="ss-muted">Add a product in the Products tab first.</p>}
        </div>
      )
    case 'grid': {
      const ids: string[] = d.productIds ?? []
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={120} value={d.heading ?? ''} onChange={(e) => update({ heading: e.target.value })} /></Field>
          <fieldset className="sb-pick">
            <legend className="ss-label">Products in this grid</legend>
            {products.length === 0 && <p className="ss-muted">Add a product in the Products tab first.</p>}
            {products.map((p) => (
              <label key={p.id} className="ss-check">
                <input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => update({ productIds: e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id) })} />
                {p.title || 'Untitled product'} <small>{formatPrice(p.priceMinor, p.currency)}</small>
              </label>
            ))}
          </fieldset>
        </div>
      )
    }
    case 'faq': {
      const items: Array<{ q: string; a: string }> = d.items ?? []
      const set = (next: typeof items) => update({ items: next })
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={120} value={d.heading ?? ''} onChange={(e) => update({ heading: e.target.value })} /></Field>
          {items.map((x, i) => (
            <div key={i} className="sb-faq">
              <input className="ss-input" aria-label={`Question ${i + 1}`} placeholder="Question" maxLength={200} value={x.q} onChange={(e) => set(items.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} />
              <textarea className="ss-input" aria-label={`Answer ${i + 1}`} placeholder="Answer" rows={2} maxLength={1500} value={x.a} onChange={(e) => set(items.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} />
              <button type="button" className="ss-ghost self-start" onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
            </div>
          ))}
          <button type="button" className="ss-ghost self-start" onClick={() => set([...items, { q: '', a: '' }])}><Plus className="h-3.5 w-3.5" /> Add question</button>
        </div>
      )
    }
    case 'footer':
      return (
        <div className="sb-edit">
          <Field label="Footer text"><input className="ss-input" maxLength={200} value={d.text ?? ''} onChange={(e) => update({ text: e.target.value })} placeholder="© Your name" /></Field>
        </div>
      )
  }
}

function ThemeEditor({ page, onChange }: { page: Page; onChange: (p: Page) => void }) {
  const [open, setOpen] = useState(false)
  const theme = page.theme
  const setTheme = (t: Partial<Page['theme']>) => onChange({ ...page, theme: { ...theme, ...t } })
  return (
    <div className="sb-block">
      <div className="sb-row">
        <button type="button" className="sb-title" aria-expanded={open} onClick={() => setOpen(!open)}>
          <b>Profile &amp; theme</b>
          <small>{page.name || 'Name'} · {PRESETS.find((p) => p.id === theme.preset)?.label}</small>
        </button>
      </div>
      {open && (
        <div className="sb-edit">
          <ImagePicker value={page.avatar} onChange={(avatar) => onChange({ ...page, avatar })} label="Profile photo" />
          <Field label="Display name"><input className="ss-input" maxLength={60} value={page.name} onChange={(e) => onChange({ ...page, name: e.target.value })} /></Field>
          <Field label="Bio" hint={`${page.bio.length}/160`}><textarea className="ss-input" rows={2} maxLength={160} value={page.bio} onChange={(e) => onChange({ ...page, bio: e.target.value })} placeholder="What you make, in one line" /></Field>
          <div>
            <span className="ss-label">Theme</span>
            <div className="ss-presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" aria-pressed={theme.preset === p.id} onClick={() => setTheme({ preset: p.id, accent: p.accent })} className="ss-preset" style={{ '--bg': p.bg, '--ac': p.accent } as CSSProperties}>
                  <span className="ss-preset-swatch"><i /></span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ss-grid3">
            <Field label="Accent"><input type="color" className="ss-color" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} /></Field>
            <Field label="Font">
              <select className="ss-input" value={theme.font} onChange={(e) => setTheme({ font: e.target.value })}>
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Buttons">
              <select className="ss-input" value={theme.button} onChange={(e) => setTheme({ button: e.target.value as Page['theme']['button'] })}>
                {BUTTON_STYLES.map((b) => <option key={b} value={b}>{b[0].toUpperCase() + b.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Background">
            <select className="ss-input" value={theme.background} onChange={(e) => setTheme({ background: e.target.value as Page['theme']['background'] })}>
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
            </select>
          </Field>
          <div className="ss-grid2">
            {(['instagram', 'youtube', 'x', 'website'] as const).map((k) => (
              <Field key={k} label={k === 'x' ? 'X' : k === 'youtube' ? 'YouTube' : k[0].toUpperCase() + k.slice(1)}>
                <input className="ss-input" value={page.socials[k]} onChange={(e) => onChange({ ...page, socials: { ...page.socials, [k]: e.target.value } })} placeholder="https://" />
              </Field>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------- products --- */

function ProductsEditor({ store, setStore }: { store: StoreView; setStore: (s: StoreView) => void }) {
  const [editing, setEditing] = useState<string | null>(store.products[0]?.id ?? null)
  const [err, setErr] = useState<string | null>(null)
  const product = store.products.find((p) => p.id === editing)

  const add = async () => {
    try {
      const r = await sellerApi.addProduct({ title: '', priceMinor: 900, currency: 'gbp' })
      setStore(r.store)
      setEditing(r.product.id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="ss-stack">
      <div className="ss-chips">
        {store.products.map((p) => (
          <button key={p.id} type="button" aria-pressed={p.id === editing} onClick={() => setEditing(p.id)}>
            {p.title.trim() || 'Untitled product'}
            {p.published && <span className="ss-chip-live"> · live</span>}
          </button>
        ))}
        <button type="button" className="ss-chip-add" onClick={() => void add()}>+ New product</button>
      </div>
      {err && <div className="ss-note" role="alert">{err}</div>}
      {!product ? (
        <button type="button" className="ss-blank" onClick={() => void add()}>
          <Package className="h-5 w-5" /> Add your first digital product
        </button>
      ) : (
        <ProductForm key={product.id} product={product} store={store} setStore={setStore} onDeleted={() => setEditing(null)} />
      )}
    </div>
  )
}

function ProductForm({ product, store, setStore, onDeleted }: { product: DraftProduct; store: StoreView; setStore: (s: StoreView) => void; onDeleted: () => void }) {
  const [form, setForm] = useState({ title: product.title, description: product.description, price: (product.priceMinor / 100).toFixed(2), currency: product.currency })
  const [state, setState] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const first = useRef(true)

  // Save edits a moment after typing stops.
  useEffect(() => {
    if (first.current) return void (first.current = false)
    const t = window.setTimeout(() => {
      const priceMinor = Math.round(Number(form.price || 0) * 100)
      sellerApi
        .updateProduct(product.id, { title: form.title, description: form.description, priceMinor, currency: form.currency })
        .then((r) => (setStore(r.store), setState('Saved')))
        .catch((e: Error) => setState(e.message))
    }, 600)
    return () => window.clearTimeout(t)
  }, [form, product.id, setStore])

  const patch = (p: Partial<Pick<DraftProduct, 'cover' | 'listed'>>) =>
    void sellerApi.updateProduct(product.id, p).then((r) => setStore(r.store)).catch((e: Error) => setState(e.message))

  const sym = CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '£'
  const shareUrl = `${store.url}/p/${product.id}`

  return (
    <>
      <Field label="Title"><input className="ss-input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Content planner template" /></Field>
      <Field label="Description"><textarea className="ss-input" rows={4} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What buyers get, in a few lines" /></Field>
      <div className="ss-grid2">
        <Field label="Price" hint="At least 0.50">
          <div className="ss-affix ss-affix-l">
            <span>{sym}</span>
            <input className="ss-input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, '') })} />
          </div>
        </Field>
        <Field label="Currency">
          <select className="ss-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <ImagePicker value={product.cover} onChange={(cover) => patch({ cover })} label="Cover image" />
      <div className="ss-field">
        <span className="ss-label">File buyers download</span>
        <div className="ss-row">
          <span className="ss-file">{product.file ? `${product.file.name} · ${(product.file.size / 1024 / 1024).toFixed(2)} MB` : 'No file yet'}</span>
          <label className="ss-ghost cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : product.file ? 'Replace file' : 'Upload file'}
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > MAX_PRODUCT_FILE_MB * 1024 * 1024) return setState(`Files can be up to ${MAX_PRODUCT_FILE_MB} MB.`)
                setUploading(true)
                sellerApi
                  .uploadFile(product.id, f)
                  .then(() => sellerApi.store())
                  .then((r) => r.store && setStore(r.store))
                  .catch((er: SellerError) => setState(er.status === 413 ? `That file is too big. Files can be up to ${MAX_PRODUCT_FILE_MB} MB.` : er.message))
                  .finally(() => setUploading(false))
              }}
            />
          </label>
        </div>
        <span className="ss-hint">Up to {MAX_PRODUCT_FILE_MB} MB. Kept private. Buyers only get an expiring link after payment.</span>
      </div>
      <label className="ss-check">
        <input type="checkbox" checked={product.listed} onChange={(e) => patch({ listed: e.target.checked })} /> Put this product on sale when I publish
      </label>
      <div className="ss-status">
        <span>Status</span>
        <b>{product.problem ? `Draft · ${product.problem}` : product.published ? (product.changed ? 'Live · changes not published' : 'Live') : 'Ready · publish to put it on sale'}</b>
      </div>
      {product.published && (
        <div className="ss-row">
          <code className="ss-code">{shareUrl.replace(/^https?:\/\//, '')}</code>
          <button type="button" className="ss-ghost" onClick={() => void navigator.clipboard?.writeText(shareUrl).then(() => (setCopied(true), window.setTimeout(() => setCopied(false), 1500)))}>
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy product link'}
          </button>
        </div>
      )}
      {state && <p className="ss-muted" aria-live="polite">{state}</p>}
      <button
        type="button"
        className="ss-danger self-start"
        onClick={() => {
          if (!window.confirm(`Delete “${product.title || 'Untitled product'}”? Buyers who already paid keep their downloads.`)) return
          void sellerApi.deleteProduct(product.id).then((r) => (setStore(r.store), onDeleted()))
        }}
      >
        Delete product
      </button>
    </>
  )
}

/* --------------------------------------------------------- payouts --- */

const PAYOUT_COPY: Record<StoreView['payouts']['status'], { label: string; text: string; action: string }> = {
  not_connected: { label: 'Not connected', text: 'Connect a bank account through Stripe to take payments. Stripe collects your bank and identity details; Desknoty never sees them.', action: 'Connect bank account' },
  incomplete: { label: 'Setup incomplete', text: 'Stripe still needs a few details before you can take payments.', action: 'Resume setup' },
  pending: { label: 'Verification pending', text: 'Stripe is checking your details. This usually takes minutes, sometimes a few days. You can keep building meanwhile.', action: 'Check details on Stripe' },
  ready: { label: 'Ready for payouts', text: 'Buyers can pay, and Stripe pays out to your bank on its usual schedule.', action: 'Manage payouts on Stripe' },
}

function PayoutsPanel({ store, setup, reload }: { store: StoreView; setup: SellerSetup; reload: (refresh?: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const s = store.payouts.status
  const copy = PAYOUT_COPY[s]
  const go = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { url } = s === 'ready' ? await sellerApi.manage() : await sellerApi.onboard(returnPath())
      window.location.href = url
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="ss-stack">
      <p className="ss-big">Sales go straight to your Stripe account. Desknoty’s platform fee is {PLATFORM_FEE_PERCENT}%.</p>
      <p className="ss-muted">Stripe’s card processing fees are separate: Stripe deducts them from each payment before paying out.</p>
      <div className="ss-status">
        <Landmark className="h-4 w-4" />
        <span>Status</span>
        <b className={cn('ss-pay', `ss-pay-${s}`)}>{copy.label}</b>
        <button type="button" className="ss-ghost ml-auto" onClick={() => void reload(true)}>Refresh</button>
      </div>
      <p className="ss-muted">{copy.text}</p>
      {!setup.stripe ? (
        <div className="ss-note">Payouts aren’t switched on for this Desknoty server yet. You can build your page and add products now; Buy now turns on once Stripe is connected.</div>
      ) : (
        <button type="button" className="ss-primary" onClick={() => void go()} disabled={busy}>
          {busy ? 'Opening Stripe…' : copy.action} <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
      {s !== 'ready' && setup.stripe && <p className="ss-muted">Buy now stays off until Stripe says your account can take card payments.</p>}
      {err && <div className="ss-note" role="alert">{err}</div>}
    </div>
  )
}

/* -------------------------------------------------------- bio link --- */

function LinkPanel({ store, setStore }: { store: StoreView; setStore: (s: StoreView) => void }) {
  const [copied, setCopied] = useState(false)
  const [handle, setHandle] = useState(store.handle)
  const [err, setErr] = useState<string | null>(null)
  const check = useHandleCheck(handle)
  const copy = () => void navigator.clipboard?.writeText(store.url).then(() => (setCopied(true), window.setTimeout(() => setCopied(false), 1600)))
  return (
    <div className="ss-stack">
      <Field label="Your bio link">
        <div className="ss-row">
          <code className="ss-code ss-code-big">{store.url}</code>
        </div>
      </Field>
      <button type="button" className="ss-primary" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy bio link'}
      </button>
      {!store.publishedAt && <div className="ss-note">Publish your store first: until then this link shows “not published”.</div>}
      <div className="ss-howto">
        <h3>Add it to TikTok</h3>
        <ol>
          <li>Open TikTok and go to your <b>Profile</b>.</li>
          <li>Tap <b>Edit profile</b>, then <b>Website</b> (Business accounts) or <b>Links</b>.</li>
          <li>Paste the link and save.</li>
        </ol>
        <p className="ss-muted">If you don’t see a Website field, TikTok hasn’t enabled it for your account yet; switching to a Business account in TikTok’s settings usually adds it. The same link works on Instagram (Edit profile → Links), YouTube, X or anywhere else.</p>
      </div>
      <Field label="Change handle" hint={check ? <span className={check.ok ? 'text-[#2f7a1d]' : 'text-[#b42318]'}>● {handle === store.handle ? 'Your current handle' : check.msg}</span> : 'Checking…'}>
        <div className="flex gap-2">
          <div className="ss-affix">
            <span>/store/</span>
            <input className="ss-input" value={handle} maxLength={30} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          </div>
          <button
            type="button"
            className="ss-ghost shrink-0"
            disabled={!check?.ok || handle === store.handle}
            onClick={() => void sellerApi.changeHandle(handle).then((r) => (setStore(r.store), setErr(null))).catch((e: Error) => setErr(e.message))}
          >
            Save
          </button>
        </div>
      </Field>
      <p className="ss-muted">Changing your handle changes your link; the old link stops working.</p>
      {err && <div className="ss-note" role="alert">{err}</div>}
      <div className="ss-note">Custom domains and yourname.desknoty.com subdomains aren’t offered yet: they need DNS, TLS certificates and routing on Desknoty’s hosting. Your /store/{store.handle} link works everywhere today.</div>
    </div>
  )
}

/* ---------------------------------------------------------- orders --- */

function OrdersPanel() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof sellerApi.orders>>['orders'] | null>(null)
  useEffect(() => void sellerApi.orders().then((r) => setOrders(r.orders)).catch(() => setOrders([])), [])
  if (!orders) return <p className="ss-muted">Loading…</p>
  if (!orders.length) return <p className="ss-muted">No orders yet. They appear here as soon as a buyer opens checkout.</p>
  return (
    <ul className="ss-orders">
      {orders.map((o) => (
        <li key={o.id}>
          <b>{o.product}</b>
          <span>{formatPrice(o.amountMinor, o.currency)}</span>
          <span className={cn('ss-ord', `ss-ord-${o.status}`)}>{o.status}</span>
          <small>{o.buyer ?? '—'} · {new Date(o.createdAt).toLocaleString()}</small>
        </li>
      ))}
    </ul>
  )
}
