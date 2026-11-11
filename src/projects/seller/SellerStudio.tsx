import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
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
  AtSign,
  Globe,
  Upload,
  Banknote,
} from 'lucide-react'
import { cn } from '../../lib/id'
import { StorePage, storeStyle } from './StorePage'
import { useSellerSave, flushSellerEdits, trackSellerWork } from './use-seller-save'
import { SellerError, dataUrlToBlob, sellerApi } from './api'
import type { Earnings } from './api'
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
import type { Block, BlockType, DraftProduct, Page, PayMethod, PaymentSettings, SellerSetup, StoreView } from './model'

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
/**
 * "Continue without TikTok" lasts for this visit only (sessionStorage): until
 * TikTok is connected, each new visit opens on the Connect TikTok screen.
 */
const skipTT = {
  get: (id: string) => { try { return sessionStorage.getItem(TT_KEY(id)) === '1' } catch { return false } },
  set: (id: string) => { try { sessionStorage.setItem(TT_KEY(id), '1') } catch { /* storage blocked */ } },
  clear: (id: string) => { try { sessionStorage.removeItem(TT_KEY(id)); localStorage.removeItem(TT_KEY(id)) } catch { /* storage blocked */ } },
}

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
  if (!store) return <StartCard setup={setup} onCreated={(s) => setStore(s)} />
  if (!store.tiktok && !skipTT.get(store.id)) {
    return <TikTokStep store={store} setup={setup!} notice={notice} onSkip={() => (skipTT.set(store.id), setStore({ ...store }))} />
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
    setMode(setup?.tiktok ? 'tiktok' : 'manual')
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
              ) : null}
            </>
          ) : (
            <>
              <p>{mode === 'tiktok' ? 'Pick your link, then connect TikTok.' : 'Pick your link. Next, you’ll connect your TikTok account.'}</p>
              <form
                className="ss-start-manual"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (check?.ok && name.trim()) void start()
                }}
              >
                <input className="ss-input ss-input-light" placeholder="Store name" aria-label="Store name" maxLength={60} value={name} onChange={(e) => (setName(e.target.value), !handle && setHandle(toHandle(e.target.value)))} />
                <div className="ss-affix ss-affix-light">
                  <span>desknoty.com/</span>
                  <input className="ss-input ss-input-light" placeholder="yourname" aria-label="Store handle" maxLength={30} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                </div>
                <span className={cn('ss-start-check', check?.ok ? 'ok' : 'no')} aria-live="polite">{check ? `● ${check.msg}` : 'Checking…'}</span>
                <button type="submit" className="ss-tt" disabled={!check?.ok || !name.trim() || busy}>
                  {busy ? 'Creating…' : <><TikTokMark /> Continue to TikTok</>}
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
    if (!blob) throw new Error('Could not read a legacy image. The original draft is preserved.')
    return (await sellerApi.uploadMedia(blob)).id
  }
  let current = store
  const ids: string[] = []
  const checkpointKey = `desknoty.seller.import.${store.id}`
  const checkpoint: Record<string, string> = JSON.parse(localStorage.getItem(checkpointKey) ?? '{}')
  for (const [index, p] of legacy.products.entries()) {
    if (checkpoint[index]) { ids.push(checkpoint[index]); continue }
    const priceMinor = Math.round(Number(p.price || 0) * 100)
    const r = await sellerApi
      .addProduct({ title: p.title.slice(0, 80), description: p.short ?? '', priceMinor, currency: (p.currency || 'gbp').toLowerCase(), cover: await upload(p.cover) })
    if (r) {
      checkpoint[index] = r.product.id
      localStorage.setItem(checkpointKey, JSON.stringify(checkpoint))
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
  const saved = await sellerApi.saveDraft(page, current.revision)
  forgetLegacyDraft()
  localStorage.removeItem(checkpointKey)
  return saved.store
}

function TikTokStep({ store, setup, notice, onSkip }: { store: StoreView; setup: SellerSetup; notice: string | null; onSkip: () => void }) {
  const [err, setErr] = useState<string | null>(notice)
  const [unreachable, setUnreachable] = useState(false)
  return (
    <Solo>
      <div className="ss-start">
        <div className="ss-start-card ss-ttcard">
          <span className="ss-ttcard-icon"><TikTokMark /></span>
          <h2>Connect your TikTok</h2>
          <p>Your store uses your TikTok name, photo and username, so buyers know it’s really you.</p>
          <TikTokBioConnect onUnreachable={() => setUnreachable(true)} />
          {setup.tiktok && (
            <button
              type="button"
              className="ss-start-skip"
              onClick={() =>
                void sellerApi
                  .tiktok(returnPath())
                  .then((r) => (window.location.href = r.url))
                  .catch((e: Error) => setErr(e.message))
              }
            >
              Log in with TikTok instead
            </button>
          )}
          {err && <div className="ss-start-err" role="alert">{err}</div>}
          {unreachable && (
            <button type="button" className="ss-start-skip" onClick={onSkip}>TikTok isn’t responding. Skip for now</button>
          )}
          <p className="ss-start-note">Your store: <b>{store.url.replace(/^https?:\/\//, '')}</b></p>
        </div>
      </div>
    </Solo>
  )
}

/**
 * Connect TikTok by bio code: 1) enter your username, 2) put the code in your
 * TikTok bio, 3) verify. Desknoty then copies your TikTok name, photo and
 * username onto your store. You can remove the code from your bio afterwards.
 */
function TikTokBioConnect({ onUnreachable }: { onUnreachable: () => void }) {
  const [step, setStep] = useState<'name' | 'code' | 'done'>('name')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
      if ((e as { status?: number }).status === 502) onUnreachable()
    }
    setBusy(false)
  }
  const stepNo = step === 'name' ? 0 : step === 'code' ? 1 : 2
  const steps = (
    <ol className="ss-ttsteps" aria-label="Steps">
      {['Username', 'Bio code', 'Verify'].map((t, i) => (
        <li key={t} className={cn(i < stepNo && 'done', i === stepNo && 'on')}><b>{i < stepNo ? '✓' : i + 1}</b>{t}</li>
      ))}
    </ol>
  )
  if (step === 'done') return <div className="ss-tt-ok" role="status">TikTok connected. Opening your studio…</div>
  return (
    <div className="ss-ttflow">
      {steps}
      {step === 'name' ? (
        <form className="ss-ttflow-row" onSubmit={(e) => (e.preventDefault(), void run(async () => { const r = await sellerApi.tiktokCode(username); setUsername(r.username); setCode(r.code); setStep('code') }))}>
          <label className="ss-ttfield">
            <span>Your TikTok username</span>
            <div className="ss-ttinput"><span>@</span><input value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))} autoComplete="off" placeholder="yourname" /></div>
          </label>
          <button type="submit" className="ss-tt" disabled={busy || username.trim().length < 2}><TikTokMark /> {busy ? 'Getting your code…' : 'Connect TikTok'}</button>
        </form>
      ) : (
        <div className="ss-ttflow-row">
          <p className="ss-ttflow-step"><b>1.</b> Copy this code:</p>
          <div className="ss-ttcode">
            <code>{code}</code>
            <button type="button" className="ss-ghost" onClick={() => void navigator.clipboard?.writeText(code).then(() => (setCopied(true), window.setTimeout(() => setCopied(false), 1500)))}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="ss-ttflow-step"><b>2.</b> On TikTok go to <b>Profile → Edit profile → Bio</b>, paste it anywhere in your bio and save.</p>
          <p className="ss-ttflow-step"><b>3.</b> Come back and press Verify. You can delete the code from your bio afterwards.</p>
          <button type="button" className="ss-tt" disabled={busy} onClick={() => void run(async () => { await sellerApi.tiktokVerify(); setStep('done'); window.setTimeout(() => window.location.reload(), 900) })}>
            <TikTokMark /> {busy ? 'Checking your bio…' : `Verify @${username}`}
          </button>
          <button type="button" className="ss-start-skip" onClick={() => (setStep('name'), setCode(''), setErr(null))}>Use a different username</button>
        </div>
      )}
      {err && <div className="ss-start-err" role="alert">{err}</div>}
    </div>
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
  const [picked, setPicked] = useState<string | null>(null)
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile')
  const [publishing, setPublishing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pageSave = useSellerSave(`desknoty.seller.recovery.${store.id}.page`, store.draft, store.revision, async (value, revision) => {
    const r = await sellerApi.saveDraft(value, revision)
    setStore(r.store)
    return r.store.revision
  })
  const full = pageSave.value
  // Style 1 is the editable store. Swiping inside the phone shows Style 2, a "coming soon" preview.
  const page: Page = full
  const [slide, setSlide] = useState<0 | 1>(0)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [toast, setToast] = useState(false)
  // Undo / redo over the draft (every change still autosaves as the draft only).
  const hist = useRef<{ past: Page[]; future: Page[] }>({ past: [], future: [] })
  const [, rerender] = useState(0)
  const edit = (p: Page) => {
    hist.current.past.push(full)
    if (hist.current.past.length > 60) hist.current.past.shift()
    hist.current.future = []
    rerender((n) => n + 1)
    pageSave.edit({ ...p, style2: full.style2, use: full.use })
  }
  const undo = () => {
    const prev = hist.current.past.pop()
    if (!prev) return
    hist.current.future.push(full)
    rerender((n) => n + 1)
    pageSave.edit(prev)
  }
  const redo = () => {
    const next = hist.current.future.pop()
    if (!next) return
    hist.current.past.push(full)
    rerender((n) => n + 1)
    pageSave.edit(next)
  }
  const undoRef = useRef({ undo, redo })
  undoRef.current = { undo, redo }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      if (e.shiftKey) undoRef.current.redo()
      else undoRef.current.undo()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const openEditor = useCallback((id: string | null, el?: HTMLElement) => {
    setPicked(id)
    setAnchor(id && el ? el.getBoundingClientRect() : null)
  }, [])
  const closeEditor = useCallback(() => openEditor(null), [openEditor])

  // Drag a section inside the phone preview: a drop line shows where it will land.
  const slideRef = useRef<HTMLDivElement>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const grab = (id: string, e: ReactPointerEvent) => {
    const scroller = slideRef.current
    const el = scroller?.querySelector<HTMLElement>(`.sp-pick[data-id="${id}"]`)
    if (!scroller || !el) return
    e.preventDefault()
    closeEditor()
    const startY = e.clientY
    const startScroll = scroller.scrollTop
    const others = [...scroller.querySelectorAll<HTMLElement>('.sp-pick[data-id]')].filter((x) => x !== el)
    let target = -1
    el.classList.add('sp-dragging')
    const moveAt = (y: number) => {
      const box = scroller.getBoundingClientRect()
      if (y < box.top + 40) scroller.scrollTop -= 8
      if (y > box.bottom - 40) scroller.scrollTop += 8
      el.style.transform = `translateY(${y - startY + scroller.scrollTop - startScroll}px)`
      let idx = others.findIndex((o) => { const r = o.getBoundingClientRect(); return y < r.top + r.height / 2 })
      if (idx < 0) idx = others.length
      target = idx
      const ref = others[idx] ?? others[others.length - 1]
      if (!ref) return setDropAt(null)
      const r = ref.getBoundingClientRect()
      setDropAt((idx < others.length ? r.top - 6 : r.bottom + 6) - box.top + scroller.scrollTop)
    }
    const move = (ev: PointerEvent) => moveAt(ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.classList.remove('sp-dragging')
      el.style.transform = ''
      setDropAt(null)
      if (target < 0) return
      const order = others.map((o) => o.dataset.id!)
      order.splice(target, 0, id)
      // put the shown sections in their new order; hidden ones and the pinned ends stay where they are
      const shown = new Set(order)
      const queue = [...order]
      const byId = new Map(page.blocks.map((b) => [b.id, b]))
      const next = pinEnds(page.blocks).map((b) => (shown.has(b.id) ? byId.get(queue.shift()!)! : b))
      if (next.map((b) => b.id).join() !== pinEnds(page.blocks).map((b) => b.id).join()) edit({ ...page, blocks: next })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Swipe inside the phone: left for Style 2, right back to Style 1.
  const swipe = useRef<{ x: number; y: number; dx: number; on: boolean } | null>(null)
  const [dx, setDx] = useState(0)
  const swiped = useRef(false)
  const saving = pageSave.state === 'Saved' ? 'saved' : pageSave.state === 'Saving…' || pageSave.state === 'Unsaved changes' ? 'saving' : 'error'
  const navigate = async (id: Tab) => {
    try { await flushSellerEdits(); setTab(id) } catch (e) { setErr((e as Error).message) }
  }

  const publish = async () => {
    setPublishing(true)
    setErr(null)
    try {
      if (slide !== 0) throw new Error('Style 2 is coming soon and can’t be published.')
      await flushSellerEdits()
      const r = await sellerApi.publish()
      setStore(r.store)
      setToast(true)
      window.setTimeout(() => setToast(false), 2600)
    } catch (e) {
      setErr((e as Error).message)
    }
    setPublishing(false)
  }

  const productsForPreview = store.products.filter((p) => p.title.trim())
  const status = !store.publishedAt ? 'Not published yet' : store.unpublishedChanges || saving === 'saving' || pageSave.dirty ? 'Unpublished changes' : 'Live'

  return (
    <div className="ss">
      <section className={cn('ss-editor', slide !== 0 && 'ss-editor-soon')} aria-label="Store builder" inert={slide !== 0 ? true : undefined}>
        {/* One navbar at the very top; scrolls sideways in one row on phones */}
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
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => void navigate(id)}>
              {label}
            </button>
          ))}
        </nav>

        {/* The store header: name and status on the left, Publish always top-right, fees once */}
        {tab === 'payouts' && (notice || err) && (
          <div className="ss-note" role="status">
            {err ?? notice}{' '}
            <button type="button" className="underline" onClick={() => (setErr(null), clearNotice())}>Dismiss</button>
          </div>
        )}
        {/* On Payouts the Earnings card takes this box's place */}
        {tab !== 'payouts' && <header className="ss-head ss-storebox">
          <div className="ss-storebox-top">
            <div className="ss-storebox-name">
              <h1>{page.name || store.handle}</h1>
              <span className={cn('ss-live', status === 'Live' && 'on')} aria-live="polite">
                ● {status}
              </span>
              <span className="ss-draftstate" aria-live="polite">{saving === 'saving' || pageSave.dirty ? 'Saving draft…' : saving === 'error' ? 'Draft not saved' : 'Draft saved'}</span>
            </div>
            <button type="button" className="ss-primary ss-primary-sm" onClick={() => void publish()} disabled={publishing || slide !== 0} title={slide !== 0 ? 'Style 2 is coming soon: publishing is off' : undefined}>
              {slide !== 0 ? 'Style 2 · Coming soon' : publishing ? 'Publishing…' : store.publishedAt ? 'Publish changes' : 'Publish'}
            </button>
          </div>
          <p className="ss-lede">Desknoty platform fee: {PLATFORM_FEE_PERCENT}%. Payment providers may charge their own fees.</p>
          {(notice || err) && (
            <div className="ss-note" role="status">
              {err ?? notice}{' '}
              <button type="button" className="underline" onClick={() => (setErr(null), clearNotice())}>Dismiss</button>
            </div>
          )}
        </header>}

        {saving === 'error' && <p className="ss-s2note" role="alert">Your draft couldn’t be saved. <button type="button" className="underline" onClick={() => void pageSave.flush().catch(() => {})}>Retry save</button></p>}
        {readLegacyDraft() && <button type="button" onClick={() => void flushSellerEdits().then(() => importLegacy(store)).then(() => window.location.reload()).catch((e: Error) => setErr(e.message))}>Resume importing browser draft (original kept until complete)</button>}
        {tab === 'page' && <>
          <div className="ss-undo">
            <button type="button" onClick={undo} disabled={!hist.current.past.length} aria-label="Undo"><span aria-hidden="true">↶</span> Undo</button>
            <button type="button" onClick={redo} disabled={!hist.current.future.length} aria-label="Redo"><span aria-hidden="true">↷</span> Redo</button>
            <span>Changes save as a draft. Visitors see them only after you publish.</span>
          </div>
          <PageEditor page={page} onChange={edit} products={store.products} open={picked} setOpen={openEditor} />
          {picked && <FloatingEditor key={picked} page={page} onChange={edit} products={store.products} id={picked} anchor={anchor} onClose={closeEditor} />}
        </>}
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
            <div className="ss-livebox">
              <a href={`/${store.handle}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> View live
              </a>
            </div>
          )}
        </div>
        <div className={cn('ss-device', view === 'desktop' && 'ss-device-desk')}>
          {view === 'mobile' && <span className="ss-island" aria-hidden="true" />}
          <div
            className="ss-screen ss-slides"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('.sp-grip, .ss-pills')) return
              swipe.current = { x: e.clientX, y: e.clientY, dx: 0, on: false }
              swiped.current = false
            }}
            onPointerMove={(e) => {
              const sw = swipe.current
              if (!sw) return
              const ddx = e.clientX - sw.x
              if (!sw.on && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(e.clientY - sw.y) * 1.3) sw.on = true
              if (sw.on) (sw.dx = ddx, setDx(ddx))
            }}
            onPointerUp={() => {
              const sw = swipe.current
              swipe.current = null
              if (!sw?.on) return
              swiped.current = true
              if (sw.dx < -50 && slide === 0) (setSlide(1), closeEditor())
              if (sw.dx > 50 && slide === 1) setSlide(0)
              setDx(0)
            }}
            onPointerCancel={() => ((swipe.current = null), setDx(0))}
            onClickCapture={(e) => { if (swiped.current) (e.stopPropagation(), e.preventDefault(), (swiped.current = false)) }}
          >
            <div className={cn('ss-track', dx !== 0 && 'ss-track-drag')} style={{ transform: `translateX(calc(${slide * -50}% + ${slide === 0 ? Math.min(0, dx) : Math.max(0, dx)}px))` }}>
              {/* Style 1: the whole phone screen takes the store's colours, top strip included */}
              <div className="ss-slide" ref={slideRef} style={storeStyle(page)} aria-hidden={slide !== 0}>
                <div className="ss-addr">Draft · {store.url.replace(/^https?:\/\//, '')}</div>
                <StorePage page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} picked={tab === 'page' ? picked : null} onGrab={tab === 'page' ? grab : undefined} onPick={(id, el) => (setTab('page'), openEditor(id, el))} />
                {dropAt !== null && <div className="ss-dropline" style={{ top: dropAt }} aria-hidden="true" />}
              </div>
              <div className="ss-slide ss-slide-empty" aria-label="Style 2 (empty, coming soon)" aria-hidden={slide !== 1} />
            </div>
            <div className="ss-pills" role="tablist" aria-label="Store style">
              <button type="button" role="tab" aria-selected={slide === 0} onClick={() => setSlide(0)}>Style 1</button>
              <button type="button" role="tab" aria-selected={slide === 1} onClick={() => (setSlide(1), closeEditor())}>Style 2</button>
            </div>
          </div>
        </div>
        <DesignChat />
        {toast && (
          <div className="ss-toast" role="status">
            <span><Check className="h-4 w-4" /></span> Published successfully · your store is live
          </div>
        )}
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
      await trackSellerWork(sellerApi.uploadMedia(file).then(r => done(r.id)))
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

/** Design assistant: a quiet, disabled message box until the AI is ready. */
function DesignChat() {
  return (
    <section className="ss-chatsoon" aria-label="AI design assistant (coming soon)">
      <input disabled placeholder="Describe a change to your store…" aria-label="Message the design assistant (coming soon)" />
      <span className="ss-chatsoon-tag">AI · Coming soon</span>
    </section>
  )
}

const BLOCK_ICON: Record<BlockType, string> = { header: '◉', hero: '✦', text: 'T', image: '▣', links: '↗', featured: '★', grid: '▦', faq: '?', footer: '▁' }

function PageEditor({ page, onChange, products, open, setOpen }: { page: Page; onChange: (p: Page) => void; products: DraftProduct[]; open: string | null; setOpen: (id: string | null, el?: HTMLElement) => void }) {
  const [inserting, setInserting] = useState<number | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const blocks = pinEnds(page.blocks)
  const setBlocks = (b: Block[]) => onChange({ ...page, blocks: pinEnds(b) })
  const [landed, setLanded] = useState<string | null>(null)
  useEffect(() => {
    if (!landed) return
    const t = window.setTimeout(() => setLanded(null), 1300)
    return () => window.clearTimeout(t)
  }, [landed])
  const move = (from: number, to: number) => {
    // the profile header stays first and the footer last: sections move between them
    const last = blocks.length - 2
    if (to < 1 || to > last || from === to) return
    const next = [...blocks]
    const [b] = next.splice(from, 1)
    next.splice(to, 0, b)
    setBlocks(next)
    setLanded(b.id)
  }
  const insert = (at: number, type: BlockType) => {
    const b = newBlock(type)
    const next = [...blocks]
    next.splice(at, 0, b)
    setBlocks(next)
    setInserting(null)
    window.setTimeout(() => setOpen(b.id, document.querySelector<HTMLElement>(`[data-block="${b.id}"]`) ?? undefined), 30)
  }

  const dragFrom = dragId ? blocks.findIndex((b) => b.id === dragId) : -1
  const Inserter = ({ at }: { at: number }) => {
    if (dragId) {
      if (at === dragFrom || at === dragFrom + 1) return <div className="sb-ins" aria-hidden="true" />
      return (
        <div
          className={cn('sb-ins sb-slot', over === at && 'sb-slot-on')}
          onDragOver={(e) => (e.preventDefault(), setOver(at))}
          onDragLeave={() => setOver((o) => (o === at ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragFrom >= 0) move(dragFrom, dragFrom < at ? at - 1 : at)
            setDragId(null)
            setOver(null)
          }}
        >
          {over === at ? 'Drop here' : 'Move here'}
        </div>
      )
    }
    return (
      <div className="sb-ins">
        {inserting === at ? (
          <div className="sb-menu" role="menu" aria-label="Add a block">
            {BLOCKS.filter((t) => t.type !== 'footer' && t.type !== 'header' && t.type !== 'hero').map((t) => (
              <button key={t.type} type="button" role="menuitem" onClick={() => insert(at, t.type)}>
                <span className="sb-ico" aria-hidden="true">{BLOCK_ICON[t.type]}</span>
                <span><b>{t.label}</b><small>{t.hint}</small></span>
              </button>
            ))}
            <button type="button" className="sb-menu-x" onClick={() => setInserting(null)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="sb-ins-btn" aria-label={at >= blocks.length - 1 ? 'Add a block at the bottom' : `Add a block between ${blockLabel(blocks[at - 1].type)} and ${blockLabel(blocks[at].type)}`} onClick={() => setInserting(at)}>
            <Plus className="h-3.5 w-3.5" /> Add block
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="ss-stack">
      <ThemeEditor page={page} onChange={onChange} />
      <div className="sb-list" aria-label="Page sections">
        {blocks.map((b, i) =>
          b.type === 'header' ? (
            <Inserter key={b.id} at={1} />
          ) : b.type === 'footer' ? (
            <div key={b.id} className={cn('sb-block sb-pinned', open === b.id && 'sb-open')} data-pinned={b.id} data-block={b.id}>
              <div className="sb-row">
                <span className="sb-ico" aria-hidden="true">{BLOCK_ICON.footer}</span>
                <button type="button" className="sb-title" onClick={(e) => setOpen(b.id, e.currentTarget.closest('.sb-block') as HTMLElement)}>
                  <b>{blockLabel(b.type)}</b>
                  <small>Always at the bottom · {summary(b, products)}</small>
                </button>
              </div>
            </div>
          ) : (
            <div key={b.id}>
              <div
                data-block={b.id}
                className={cn('sb-block', open === b.id && 'sb-open', b.hidden && 'sb-hidden', dragId === b.id && 'sb-dragging', landed === b.id && 'sb-landed')}
                draggable
                onDragStart={(e) => (setDragId(b.id), e.dataTransfer.setData('text/plain', b.id), (e.dataTransfer.effectAllowed = 'move'))}
                onDragEnd={() => (setDragId(null), setOver(null))}
              >
                <div className="sb-row">
                  <span className="sb-grip" aria-hidden="true" title="Drag to move"><GripVertical className="h-4 w-4" /></span>
                  <span className="sb-ico" aria-hidden="true">{BLOCK_ICON[b.type]}</span>
                  <button type="button" className="sb-title" onClick={(e) => setOpen(b.id, e.currentTarget.closest('.sb-block') as HTMLElement)}>
                    <b>{blockLabel(b.type)}</b>
                    <small>{summary(b, products)}</small>
                  </button>
                  <div className="sb-tools">
                    <button type="button" aria-label={`Move ${blockLabel(b.type)} up`} disabled={i <= 1} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Move ${blockLabel(b.type)} down`} disabled={i >= blocks.length - 2} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`${b.hidden ? 'Show' : 'Hide'} ${blockLabel(b.type)}`} aria-pressed={b.hidden} onClick={() => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))}>
                      {b.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <Inserter at={i + 1} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}

/** The editing panel for one section: floats above everything, never moves the layout. */
function FloatingEditor({ page, onChange, products, id, anchor, onClose }: { page: Page; onChange: (p: Page) => void; products: DraftProduct[]; id: string; anchor: DOMRect | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const blocks = pinEnds(page.blocks)
  const i = blocks.findIndex((b) => b.id === id)
  const b = blocks[i]
  useEffect(() => {
    // a press anywhere outside closes it; edits are already in the draft, so nothing is lost
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (ref.current?.contains(t) || t.closest('.sp-pick, .sb-title, .sb-menu')) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => (document.removeEventListener('pointerdown', down), document.removeEventListener('keydown', key))
  }, [onClose])
  if (!b) return null
  const pinned = b.type === 'footer'
  const setBlocks = (next: Block[]) => onChange({ ...page, blocks: pinEnds(next) })
  const update = (d: Record<string, unknown>) => setBlocks(blocks.map((x) => (x.id === id ? { ...x, data: { ...x.data, ...d } } : x)))
  const look = b.look ?? {}
  const setLook = (l: Partial<NonNullable<Block['look']>>) => {
    const next = { ...look, ...l }
    for (const k of Object.keys(next) as Array<keyof typeof next>) if (!next[k]) delete next[k]
    setBlocks(blocks.map((x) => (x.id === id ? { ...x, look: Object.keys(next).length ? next : undefined } : x)))
  }
  // place it beside the clicked element, inside the window; on phones it's a bottom sheet
  const W = 340
  const phone = window.innerWidth < 760
  const style: CSSProperties = phone || !anchor
    ? {}
    : {
        left: Math.max(12, anchor.left - W - 18 < 12 ? Math.min(anchor.right + 18, window.innerWidth - W - 12) : anchor.left - W - 18),
        top: Math.min(Math.max(12, anchor.top - 10), window.innerHeight - 420),
      }
  return (
    <div ref={ref} className={cn('fe', phone && 'fe-sheet')} style={style} role="dialog" aria-label={`Edit ${blockLabel(b.type)}`}>
      <header className="fe-head">
        <span className="sb-ico" aria-hidden="true">{BLOCK_ICON[b.type]}</span>
        <b>{blockLabel(b.type)}</b>
        <button type="button" className="fe-x" aria-label="Close" onClick={onClose}>✕</button>
      </header>
      <div className="fe-body">
        <BlockEditor block={b} products={products} update={update} />
        <div className="fe-look">
          <span className="ss-label">Style</span>
          <div className="fe-seg" role="group" aria-label="Alignment">
            {(['left', 'center', 'right'] as const).map((a) => <button key={a} type="button" aria-pressed={(look.align ?? '') === a} onClick={() => setLook({ align: look.align === a ? undefined : a })}>{a === 'left' ? '⟸' : a === 'center' ? '≡' : '⟹'}</button>)}
          </div>
          <div className="fe-seg" role="group" aria-label="Size">
            {(['s', 'm', 'l', 'xl'] as const).map((z) => <button key={z} type="button" aria-pressed={(look.size ?? 'm') === z} onClick={() => setLook({ size: z === 'm' ? undefined : z })}>{z.toUpperCase()}</button>)}
          </div>
          <div className="fe-seg" role="group" aria-label="Spacing">
            {(['tight', 'normal', 'roomy'] as const).map((z) => <button key={z} type="button" aria-pressed={(look.space ?? 'normal') === z} onClick={() => setLook({ space: z === 'normal' ? undefined : z })}>{z}</button>)}
          </div>
          <div className="fe-row">
            <label className="fe-color">Text colour <input type="color" value={look.color ?? '#111114'} onChange={(e) => setLook({ color: e.target.value })} aria-label="Text colour" /></label>
            {look.color && <button type="button" className="fe-link" onClick={() => setLook({ color: undefined })}>Reset</button>}
            <select className="ss-input fe-font" aria-label="Font" value={look.font ?? ''} onChange={(e) => setLook({ font: (e.target.value || undefined) as NonNullable<Block['look']>['font'] })}>
              <option value="">Theme font</option>
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </div>
      {!pinned && (
        <footer className="fe-foot">
          <button type="button" onClick={() => {
            const copy = { ...newBlock(b.type), data: structuredClone(b.data), hidden: b.hidden, look: b.look }
            const next = [...blocks]
            next.splice(i + 1, 0, copy)
            setBlocks(next)
          }}><Copy className="h-3.5 w-3.5" /> Duplicate</button>
          <button type="button" className="fe-del" onClick={() => (setBlocks(blocks.filter((x) => x.id !== id)), onClose())}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </footer>
      )}
    </div>
  )
}

/** Exactly one profile header, always first, and one footer, always last; both always shown. */
function pinEnds(blocks: Block[]): Block[] {
  const head = blocks.find((b) => b.type === 'header') ?? newBlock('header')
  const foot = blocks.find((b) => b.type === 'footer') ?? newBlock('footer')
  return [{ ...head, hidden: false }, ...blocks.filter((b) => b.type !== 'footer' && b.type !== 'header'), { ...foot, hidden: false }]
}

function summary(b: Block, products: DraftProduct[]) {
  const d = b.data
  const title = (id: string) => products.find((p) => p.id === id)?.title || 'Untitled'
  switch (b.type) {
    case 'header': return 'Photo, name and bio'
    case 'hero': return d.eyebrow || d.title || 'Welcome intro'
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
    case 'hero':
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={80} value={d.eyebrow ?? ''} onChange={(e) => update({ eyebrow: e.target.value })} placeholder="Welcome to my store 👋" /></Field>
          <Field label="Name under the heading" hint="Empty shows your @username."><input className="ss-input" maxLength={120} value={d.title ?? ''} onChange={(e) => update({ title: e.target.value })} /></Field>
          <Field label="What you sell"><textarea className="ss-input" rows={3} maxLength={600} value={d.body ?? ''} onChange={(e) => update({ body: e.target.value })} placeholder="Discover digital products designed to help you create, learn, and grow." /></Field>
          <Field label="Button text" hint="Scrolls to your products. Empty hides it."><input className="ss-input" maxLength={40} value={d.button ?? ''} onChange={(e) => update({ button: e.target.value })} /></Field>
          <ImagePicker value={d.media ?? null} onChange={(media) => update({ media })} label="Square image on the right" />
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
          {ids.length > 1 && (
            <div className="sb-order" aria-label="Order of product cards">
              <span className="ss-label">Card order</span>
              {ids.map((id, k) => (
                <div key={id} className="sb-order-row">
                  <span>{products.find((p) => p.id === id)?.title || 'Untitled product'}</span>
                  <button type="button" aria-label="Move card up" disabled={k === 0} onClick={() => { const n = [...ids]; [n[k - 1], n[k]] = [n[k], n[k - 1]]; update({ productIds: n }) }}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move card down" disabled={k === ids.length - 1} onClick={() => { const n = [...ids]; [n[k + 1], n[k]] = [n[k], n[k + 1]]; update({ productIds: n }) }}><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
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
          <b>Theme</b>
          <small>Colours, font and buttons · {PRESETS.find((p) => p.id === theme.preset)?.label}</small>
        </button>
      </div>
      {open && (
        <div className="sb-edit">
          <p className="ss-muted">Your photo, name and username come from your TikTok account. Change them on TikTok.</p>
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
      await flushSellerEdits()
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
          <button key={p.id} type="button" aria-pressed={p.id === editing} onClick={() => void flushSellerEdits().then(() => setEditing(p.id)).catch((e: Error) => setErr(e.message))}>
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
  const [state, setState] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const saved = useSellerSave(`desknoty.seller.recovery.${store.id}.${product.id}`, { title: product.title, description: product.description, price: (product.priceMinor / 100).toFixed(2), currency: product.currency, cover: product.cover, listed: product.listed }, product.revision, async (value, revision) => {
    const r = await sellerApi.updateProduct(product.id, { ...value, priceMinor: Math.round(Number(value.price || 0) * 100) }, revision)
    setStore(r.store)
    return r.product.revision
  })
  const form = saved.value
  const setForm = saved.edit
  const patch = (p: Partial<Pick<DraftProduct, 'cover' | 'listed'>>) => saved.edit({ ...form, ...p })

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
      <ImagePicker value={form.cover} onChange={(cover) => patch({ cover })} label="Cover image" />
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
                trackSellerWork(sellerApi
                  .uploadFile(product.id, f)
                  .then(() => sellerApi.store())
                  .then((r) => r.store && setStore(r.store)))
                  .catch((er: SellerError) => setState(er.status === 413 ? `That file is too big. Files can be up to ${MAX_PRODUCT_FILE_MB} MB.` : er.message))
                  .finally(() => setUploading(false))
              }}
            />
          </label>
        </div>
        <span className="ss-hint">Up to {MAX_PRODUCT_FILE_MB} MB. Kept private. Buyers only get an expiring link after payment.</span>
      </div>
      <label className="ss-check">
        <input type="checkbox" checked={form.listed} onChange={(e) => patch({ listed: e.target.checked })} /> Put this product on sale when I publish
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
      <p className="ss-muted" aria-live="polite">{state ?? saved.state} <button type="button" onClick={() => void saved.flush().catch(() => {})}>Retry save</button></p>
      <button
        type="button"
        className="ss-danger self-start"
        onClick={() => {
          if (!window.confirm(`Delete “${product.title || 'Untitled product'}”? Buyers who already paid keep their downloads.`)) return
          void flushSellerEdits().then(() => sellerApi.deleteProduct(product.id)).then((r) => (setStore(r.store), onDeleted()))
        }}
      >
        Delete product
      </button>
    </>
  )
}

/* --------------------------------------------------------- payouts --- */

const PAYOUT_COPY: Record<StoreView['payouts']['status'], { label: string; text: string; action: string }> = {
  not_connected: { label: 'Not connected', text: 'Connect a bank account through Stripe to take payments. Stripe collects your bank and identity details; Desknoty never sees them.', action: 'Connect Stripe' },
  incomplete: { label: 'Setup incomplete', text: 'Stripe still needs a few details before you can take payments.', action: 'Resume setup' },
  pending: { label: 'Verification pending', text: 'Stripe is checking your details. This usually takes minutes, sometimes a few days. You can keep building meanwhile.', action: 'Check details on Stripe' },
  ready: { label: 'Ready for payouts', text: 'Buyers can pay, and Stripe pays out to your bank on its usual schedule.', action: 'Manage payouts on Stripe' },
}

/** Earnings at a glance, and a button to send the Stripe balance to the seller's bank. */
function EarningsCard({ ready }: { ready: boolean }) {
  const [data, setData] = useState<Earnings | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const load = useCallback(() => sellerApi.earnings().then(setData).catch((e: Error) => setErr(e.message)), [])
  useEffect(() => { void load() }, [load])
  const main = data?.totals[0]
  const cur = main?.currency ?? data?.balance?.available[0]?.currency ?? 'gbp'
  const avail = data?.balance?.available.find((x) => x.currency === cur)?.amountMinor ?? 0
  const pending = data?.balance?.pending.find((x) => x.currency === cur)?.amountMinor ?? 0
  const withdraw = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { payout } = await sellerApi.withdraw(cur)
      setSent(`${formatPrice(payout.amountMinor, payout.currency)} is on its way to your bank · arrives ${new Date(payout.arrival).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`)
      await load()
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <section className="ss-earn" aria-label="Earnings">
      <div className="ss-earn-top">
        <span className="ss-earn-label">Total earned</span>
        <b className="ss-earn-big">{data ? formatPrice(main?.totalMinor ?? 0, cur) : '…'}</b>
        <span className="ss-earn-sub">{main ? `${main.sales} sale${main.sales === 1 ? '' : 's'} · ${formatPrice(main.monthMinor, cur)} this month` : 'No sales yet. Your first one will show here.'}</span>
      </div>
      <div className="ss-earn-grid">
        <div><span>Ready to withdraw</span><b>{data?.balance ? formatPrice(avail, cur) : '—'}</b></div>
        <div><span>On the way from Stripe</span><b>{data?.balance ? formatPrice(pending, cur) : '—'}</b></div>
        <div><span>Paid by bank transfer</span><b>{formatPrice(main?.byMethod.bank ?? 0, cur)}</b></div>
      </div>
      {ready ? (
        <div className="ss-earn-act">
          <button type="button" className="ss-primary ss-primary-sm" disabled={busy || !data?.withdrawals || avail <= 0} onClick={() => void withdraw()}>
            {busy ? 'Sending…' : `Withdraw ${data?.balance && avail > 0 ? formatPrice(avail, cur) + ' ' : ''}to bank`}
          </button>
          <small>{!data?.withdrawals ? 'Stripe pays your balance out to your bank automatically.' : avail > 0 ? 'Goes to the bank account you added in Stripe. Usually 1–3 working days.' : 'New card sales become available to withdraw after a few days.'}</small>
        </div>
      ) : (
        <p className="ss-earn-note">Finish Stripe setup below to withdraw card earnings to your bank.</p>
      )}
      {sent && <p className="ss-earn-ok" role="status">✓ {sent}</p>}
      {err && <p className="ss-earn-err" role="alert">{err}</p>}
      {data?.balance?.payouts.length ? (
        <ul className="ss-earn-list" aria-label="Recent withdrawals">
          {data.balance.payouts.map((p) => (
            <li key={p.id}><span>{new Date(p.arrival).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><b>{formatPrice(p.amountMinor, p.currency)}</b><em>{p.status === 'paid' ? 'Arrived' : p.status === 'failed' ? 'Failed' : 'On the way'}</em></li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function PayoutsPanel({ store, setup, reload }: { store: StoreView; setup: SellerSetup; reload: (refresh?: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentSettings>(() => store.payouts.payments ?? EMPTY_PAYMENTS)
  const [methods, setMethods] = useState<PayMethod[]>(() => store.payouts.methods ?? [])
  const [bankOpen, setBankOpen] = useState(false)
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
  const saved = (v: StoreView) => {
    setPayments(v.payouts.payments ?? payments)
    setMethods(v.payouts.methods ?? [])
  }
  const bank = payments.bank
  const bankSet = bankComplete(payments)
  return (
    <div className="ss-stack">
      <EarningsCard ready={s === 'ready'} />
      {/* Stripe: status, refresh and the one action, together */}
      <section className="ss-paycard" aria-label="Card payments with Stripe">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><Landmark className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Card payments · Stripe</h3>
            <p className="ss-muted">{copy.text}</p>
          </div>
          <b className={cn('ss-pay', `ss-pay-${s}`)}>{copy.label}</b>
        </div>
        {!setup.stripe ? (
          <div className="ss-note">Stripe isn’t switched on for this Desknoty server yet.</div>
        ) : (
          <div className="ss-paycard-actions">
            <button type="button" className="ss-primary" onClick={() => void go()} disabled={busy}>
              {busy ? 'Opening Stripe…' : copy.action} <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="ss-ghost" onClick={() => void reload(true)}>Refresh</button>
          </div>
        )}
        {err && <div className="ss-note" role="alert">{err}</div>}
      </section>

      {/* Bank transfer: fields stay in the dialog until the seller asks for them */}
      <section className="ss-paycard" aria-label="Bank transfer">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><Banknote className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Bank transfer</h3>
            <p className="ss-muted">
              {bankSet
                ? `${bank.bankName || bank.accountName} · Account ending in ${last4(payments)}`
                : 'Buyers pay straight into your bank. You confirm each payment in Orders.'}
            </p>
          </div>
          <b className={cn('ss-pay', methods.includes('bank') ? 'ss-pay-ready' : 'ss-pay-not_connected')}>{methods.includes('bank') ? 'On' : bankSet ? 'Off' : 'Not set up'}</b>
        </div>
        <div className="ss-paycard-actions">
          <button type="button" className={bankSet ? 'ss-ghost' : 'ss-primary'} onClick={() => setBankOpen(true)}>
            {bankSet ? 'Edit bank details' : 'Connect bank account'}
          </button>
        </div>
      </section>

      {bankOpen && <BankDialog payments={payments} onClose={() => setBankOpen(false)} onSaved={(v) => (saved(v), setBankOpen(false))} />}
    </div>
  )
}

const EMPTY_PAYMENTS: PaymentSettings = {
  stripe: { enabled: true },
  paypal: { enabled: false, email: '' },
  bank: { enabled: false, bankName: '', accountName: '', sortCode: '', accountNumber: '', iban: '', bic: '', instructions: '' },
}
const bankComplete = (p: PaymentSettings) => Boolean(p.bank.accountName && ((p.bank.sortCode && p.bank.accountNumber) || p.bank.iban))

/**
 * Bank colours for the account preview only (the rest of the dialog keeps Desknoty's look).
 * Each pairs a background with a text colour chosen to keep the bank name readable.
 */
const BANKS: Array<{ name: string; bg: string; fg: string }> = [
  { name: 'Revolut', bg: 'linear-gradient(135deg, #191c1f 0%, #0666eb 100%)', fg: '#ffffff' },
  { name: 'Monzo', bg: 'linear-gradient(135deg, #14233c 0%, #ff4f40 100%)', fg: '#ffffff' },
  { name: 'Starling Bank', bg: 'linear-gradient(135deg, #2e1a6d 0%, #7433ff 100%)', fg: '#ffffff' },
  { name: 'Barclays', bg: 'linear-gradient(135deg, #00395d 0%, #00aeef 100%)', fg: '#ffffff' },
  { name: 'HSBC', bg: 'linear-gradient(135deg, #8b000b 0%, #db0011 100%)', fg: '#ffffff' },
  { name: 'Lloyds Bank', bg: 'linear-gradient(135deg, #024731 0%, #11b67a 100%)', fg: '#ffffff' },
  { name: 'NatWest', bg: 'linear-gradient(135deg, #2b0c3f 0%, #5a287d 100%)', fg: '#ffffff' },
  { name: 'Santander', bg: 'linear-gradient(135deg, #a50000 0%, #ec0000 100%)', fg: '#ffffff' },
  { name: 'Halifax', bg: 'linear-gradient(135deg, #0a3f8c 0%, #005eb8 100%)', fg: '#ffffff' },
  { name: 'Nationwide', bg: 'linear-gradient(135deg, #12164f 0%, #1a1f71 100%)', fg: '#ffffff' },
  { name: 'Wise', bg: 'linear-gradient(135deg, #9fe870 0%, #c8f5a8 100%)', fg: '#163300' },
]
const NEUTRAL = { bg: 'linear-gradient(135deg, #1d1d1b 0%, #3a3a36 100%)', fg: '#ffffff' } // before a bank is chosen
const CUSTOM = { bg: 'linear-gradient(135deg, #f1f0ec 0%, #dcdbd5 100%)', fg: '#191919' } // "Other bank"
const OTHER = '__other__'
const bankTheme = (name: string) => (!name ? NEUTRAL : BANKS.find((b) => b.name === name) ?? CUSTOM)
const formatSort = (v: string) => v.replace(/\D/g, '').slice(0, 6).replace(/^(\d{2})(\d{1,2})?(\d{1,2})?$/, (_m, a, b2, c) => [a, b2, c].filter(Boolean).join('-'))
const last4 = (p: PaymentSettings) => (p.bank.accountNumber ? p.bank.accountNumber.slice(-4) : p.bank.iban.slice(-4))

/** Bank details for receiving transfers (never card details). Saved through the existing validation. */
function BankDialog({ payments, onClose, onSaved }: { payments: PaymentSettings; onClose: () => void; onSaved: (s: StoreView) => void }) {
  // First connection: accepting transfers is on by default; editing keeps the seller's choice.
  const [b, setB] = useState(() => ({ ...payments.bank, enabled: bankComplete(payments) ? payments.bank.enabled : true }))
  const known = BANKS.some((x) => x.name === b.bankName)
  const [choice, setChoice] = useState(() => (!payments.bank.bankName ? '' : known ? payments.bank.bankName : OTHER))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const panel = useRef<HTMLFormElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLSelectElement>('select')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const set = (patch: Partial<typeof b>) => setB({ ...b, ...patch })
  const pick = (v: string) => {
    setChoice(v)
    set({ bankName: v === OTHER ? '' : v })
  }
  const save = async () => {
    if (!b.bankName.trim()) return setErr(choice === OTHER ? 'Enter your bank’s name.' : 'Choose your bank.')
    setSaving(true)
    setErr(null)
    try {
      onSaved((await sellerApi.savePayments({ bank: b })).store)
    } catch (e) {
      setErr((e as Error).message)
      setSaving(false)
    }
  }
  const theme = bankTheme(choice === OTHER ? (b.bankName ? '__custom__' : '') : b.bankName)
  const digits = b.accountNumber.replace(/\D/g, '')
  const shownNumber = digits ? `•••• ${digits.slice(-4)}` : b.iban ? `IBAN •••• ${b.iban.replace(/\s/g, '').slice(-4)}` : '•••• ••••'
  return (
    <div className="ss-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form ref={panel} className="ss-modal" role="dialog" aria-modal="true" aria-labelledby="bank-dialog-title" onSubmit={(e) => (e.preventDefault(), void save())}>
        {/* live account preview: the only place with bank colours */}
        <div className="ss-bankart" aria-hidden="true">
          <div className="ss-bankcard" style={{ background: theme.bg, color: theme.fg }}>
            <span className="ss-bankcard-brand">{b.bankName || 'Desknoty · Bank account'}</span>
            <span className="ss-bankcard-name">{b.accountName || 'Account holder'}</span>
            <span className="ss-bankcard-row">
              <span>{shownNumber}</span>
              <span>{formatSort(b.sortCode) || '00-00-00'}</span>
            </span>
          </div>
        </div>
        <div className="ss-modal-body">
          <h2 id="bank-dialog-title">Connect bank account</h2>
          <p className="ss-muted">Where buyers send bank transfers. Only buyers who choose bank transfer see these details.</p>
          <label className="ss-mfield">
            <span>Bank name<i aria-hidden="true">*</i></span>
            <select className="ss-input" value={choice} onChange={(e) => pick(e.target.value)}>
              <option value="">Choose your bank</option>
              {BANKS.map((x) => (
                <option key={x.name} value={x.name}>{x.name}</option>
              ))}
              <option value={OTHER}>Other bank</option>
            </select>
          </label>
          {choice === OTHER && (
            <label className="ss-mfield">
              <span>Your bank’s name<i aria-hidden="true">*</i></span>
              <input className="ss-input" maxLength={60} value={b.bankName} onChange={(e) => set({ bankName: e.target.value })} />
            </label>
          )}
          <label className="ss-mfield">
            <span>Account holder name<i aria-hidden="true">*</i></span>
            <input className="ss-input" required autoComplete="name" value={b.accountName} onChange={(e) => set({ accountName: e.target.value })} />
          </label>
          <div className="ss-mgrid">
            <label className="ss-mfield">
              <span>Sort code</span>
              <input className="ss-input" inputMode="numeric" placeholder="12-34-56" value={b.sortCode} onChange={(e) => set({ sortCode: formatSort(e.target.value) })} />
            </label>
            <label className="ss-mfield">
              <span>Account number</span>
              <input className="ss-input" inputMode="numeric" placeholder="12345678" value={b.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
            </label>
          </div>
          <div className="ss-mgrid">
            <label className="ss-mfield">
              <span>IBAN <small>(optional)</small></span>
              <input className="ss-input" value={b.iban} onChange={(e) => set({ iban: e.target.value })} />
            </label>
            <label className="ss-mfield">
              <span>BIC / SWIFT <small>(optional)</small></span>
              <input className="ss-input" value={b.bic} onChange={(e) => set({ bic: e.target.value })} />
            </label>
          </div>
          <label className="ss-row">
            <input type="checkbox" checked={b.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span>Accept bank transfers at checkout</span>
          </label>
          {err && <div className="ss-note" role="alert">{err}</div>}
        </div>
        <div className="ss-modal-foot">
          <button type="button" className="ss-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ss-primary" disabled={saving}>{saving ? 'Saving…' : 'Save bank details'}</button>
        </div>
      </form>
    </div>
  )
}

/* -------------------------------------------------------- bio link --- */

function LinkPanel({ store, setStore }: { store: StoreView; setStore: (s: StoreView) => void }) {
  const [copied, setCopied] = useState(false)
  const [handle, setHandle] = useState(store.handle)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const check = useHandleCheck(handle)
  const short = store.url.replace(/^https?:\/\//, '')
  const copy = () => void navigator.clipboard?.writeText(store.url).then(() => (setCopied(true), window.setTimeout(() => setCopied(false), 1600)))
  const save = () =>
    void sellerApi
      .changeHandle(handle)
      .then((r) => (setStore(r.store), setErr(null), setSaved(true), window.setTimeout(() => setSaved(false), 1800)))
      .catch((e: Error) => setErr(e.message))
  return (
    <div className="ss-stack">
      {/* the link itself: copy it or open it */}
      <section className="ss-paycard" aria-label="Your bio link">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><Globe className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Your bio link</h3>
            <p className="ss-linkurl">{short}</p>
          </div>
          <b className={cn('ss-pay', store.publishedAt ? 'ss-pay-ready' : 'ss-pay-incomplete')}>{store.publishedAt ? 'Live' : 'Not published'}</b>
        </div>
        {!store.publishedAt && <p className="ss-muted">Publish your store first: until then this link shows “not published”.</p>}
        <div className="ss-paycard-actions">
          <button type="button" className="ss-primary" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
          </button>
          <a className="ss-ghost" href={`/${store.handle}`} target="_blank" rel="noreferrer">
            Open <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* change the handle */}
      <section className="ss-paycard" aria-label="Change handle">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><AtSign className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Your handle</h3>
            <p className="ss-muted">Changing it changes your link. Past buyers’ receipt links keep working.</p>
          </div>
        </div>
        <div className="ss-affix">
          <span>desknoty.com/</span>
          <input className="ss-input" aria-label="Handle" value={handle} maxLength={30} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        </div>
        <div className="ss-paycard-actions">
          <span className={cn('text-[12.5px]', check?.ok ? 'text-[#2f7a1d]' : 'text-[#b42318]')}>
            {handle === store.handle ? 'Your current handle' : check ? `● ${check.msg}` : 'Checking…'}
          </span>
          <button type="button" className="ss-ghost ml-auto" disabled={!check?.ok || handle === store.handle} onClick={save}>
            {saved ? 'Saved' : 'Save handle'}
          </button>
        </div>
        {err && <div className="ss-note" role="alert">{err}</div>}
      </section>

      {/* where to paste it */}
      <section className="ss-paycard" aria-label="Add it to your profiles">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><Smartphone className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Add it to your profiles</h3>
            <p className="ss-muted">Paste the link where your followers look.</p>
          </div>
        </div>
        <ol className="ss-steps">
          <li><b>TikTok:</b> Profile → Edit profile → Website (Business account) or Links.</li>
          <li><b>Instagram:</b> Edit profile → Links → Add external link.</li>
          <li><b>YouTube, X and others:</b> the same link works anywhere.</li>
        </ol>
      </section>

      {/* TikTok: connect any time (also after "Continue without TikTok") */}
      <section className="ss-paycard" aria-label="TikTok">
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><TikTokMark /></span>
          <div className="min-w-0">
            <h3>TikTok</h3>
            <p className="ss-muted">{store.tiktok ? `Connected as @${store.tiktok.username || store.tiktok.displayName}` : 'Connect to put your TikTok name, photo and username on your store.'}</p>
          </div>
          <b className={cn('ss-pay', store.tiktok ? 'ss-pay-ready' : 'ss-pay-not_connected')}>{store.tiktok ? 'Connected' : 'Not connected'}</b>
        </div>
        <div className="ss-paycard-actions">
          {store.tiktok ? (
            <button type="button" className="ss-ghost" onClick={() => void sellerApi.tiktokDisconnect().then((r) => setStore(r.store)).catch((e: Error) => setErr(e.message))}>Disconnect</button>
          ) : (
            <button type="button" className="ss-primary" onClick={() => (skipTT.clear(store.id), window.location.reload())}>Connect TikTok</button>
          )}
        </div>
      </section>

      <StartOver store={store} />
    </div>
  )
}

/** Delete this store and set it up again from the start (only while it has no orders). */
function StartOver({ store }: { store: StoreView }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    setErr(null)
    try {
      await sellerApi.startOver(typed)
      skipTT.clear(store.id)
      window.location.reload()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <section className="ss-paycard" aria-label="Start over">
      <div className="ss-paycard-head">
        <span className="ss-paycard-icon"><Trash2 className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h3>Start over</h3>
          <p className="ss-muted">Delete this store and set it up again from the start. Only possible while it has no orders.</p>
        </div>
      </div>
      {!open ? (
        <div className="ss-paycard-actions">
          <button type="button" className="ss-ghost" onClick={() => setOpen(true)}>Start over…</button>
        </div>
      ) : (
        <>
          <label className="ss-mfield">
            <span>Type <b>{store.handle}</b> to confirm. Your page, products and payout link for this store are deleted.</span>
            <input className="ss-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="ss-paycard-actions">
            <button type="button" className="ss-ghost" onClick={() => (setOpen(false), setTyped(''))}>Cancel</button>
            <button type="button" className="ss-dark" disabled={busy || typed !== store.handle} onClick={() => void go()}>{busy ? 'Deleting…' : 'Delete store and start over'}</button>
          </div>
          {err && <div className="ss-note" role="alert">{err}</div>}
        </>
      )}
    </section>
  )
}

/* ---------------------------------------------------------- orders --- */

function OrdersPanel() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof sellerApi.orders>>['orders'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async (offset = 0) => {
    setBusy(true); setError(null)
    try { const r = await sellerApi.orders(offset); setOrders(old => offset ? [...(old ?? []), ...r.orders] : r.orders); setNext(r.nextOffset) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  // Bank transfers: the seller checks their bank, then confirms (sends the receipt and unlocks the download).
  const act = async (id: string, what: 'confirm' | 'cancel') => {
    if (what === 'confirm' && !window.confirm('Only confirm once the money is in your bank account. The buyer gets the download straight away.')) return
    try {
      const r = what === 'confirm' ? await sellerApi.confirmOrder(id) : await sellerApi.cancelOrder(id)
      setOrders((old) => old?.map((o) => (o.id === id ? { ...o, status: r.order.status } : o)) ?? null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (error) return <div role="alert">Could not load orders: {error} <button onClick={() => void load(orders?.length ?? 0)}>Retry</button></div>
  if (!orders) return <p className="ss-muted">Loading…</p>
  if (!orders.length) return <p className="ss-muted">No orders yet. They appear here as soon as a buyer opens checkout.</p>
  return (
    <div><ul className="ss-orders">
      {orders.map((o) => (
        <li key={o.id}>
          <b>{o.product}</b>
          <span>{formatPrice(o.amountMinor, o.currency)}</span>
          <span className={cn('ss-ord', `ss-ord-${o.status}`)}>{o.status}</span>
          <small>
            {({ stripe: 'Card', paypal: 'PayPal', bank: 'Bank transfer' } as Record<string, string>)[o.method ?? 'stripe']}
            {o.reference ? ` · ref ${o.reference}` : ''}
            {o.method === 'bank' && o.status === 'pending' && o.buyerClaimedAt ? ' · buyer says it’s sent' : ''}
            {' · '}{o.buyer ?? '—'} · {new Date(o.createdAt).toLocaleString()}
          </small>
          {o.method === 'bank' && o.status === 'pending' && (
            <span className="ss-row">
              <button type="button" className="ss-ghost" onClick={() => void act(o.id, 'confirm')}>Payment received</button>
              <button type="button" className="ss-ghost" onClick={() => void act(o.id, 'cancel')}>Cancel order</button>
            </span>
          )}
        </li>
      ))}
    </ul>{next !== null && <button disabled={busy} onClick={() => void load(next)}>{busy ? 'Loading…' : 'Load more orders'}</button>}</div>
  )
}
