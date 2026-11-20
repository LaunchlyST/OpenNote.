import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  Monitor,
  Star,
  Share2,
  Film,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Lock,
  Minus,
  MoreHorizontal,
  PanelBottom,
  Search,
  ShoppingBag,
  Sparkles,
  Type,
  User,
  Video,
  X as CloseIcon,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Landmark,
  Package,
  Plus,
  Smartphone,
  Store,
  Trash2,
  Tag,
  ChevronDown,
  ChevronLeft,
  AtSign,
  Globe,
  Upload,
} from 'lucide-react'
import { cn } from '../../lib/id'
import { BuyRow, StorePage, storeStyle } from './StorePage'
import { CardAppearance, CouponsPanel, CoverEditor, FaqEditor, GalleryEditor, LinesEditor, OfferSchedule, ProductPicker, SampleEditor, SellerReviews } from './ProductEditorParts'
import { Style2Page } from './Style2'
import { FontPicker, ProductPartPanel } from './ProductPartPanel'
import type { PartDraft } from './ProductPartPanel'
import { bankIcon } from './bank-icons'
import { useSellerSave, flushSellerEdits, trackSellerWork } from './use-seller-save'
import { SellerError, dataUrlToBlob, sellerApi } from './api'
import type { Earnings } from './api'
import {
  AMAZON_CTA_PRESETS,
  AMAZON_LINK_ERROR,
  BUTTON_STYLES,
  CURRENCIES,
  DEFAULT_AFFILIATE_DISCLOSURE,
  DEFAULT_AMAZON_CTA,
  DEFAULT_EXTRAS,
  MAX_PRODUCT_BLOCKS_PER_PAGE,
  MAX_PRODUCT_SLIDES,
  MAX_STORE_PAGES,
  amazonUrlCheck,
  findProductBlockPage,
  forgetLegacyDraft,
  formatPrice,
  handleProblem,
  insertAt,
  isFreeProduct,
  isProductBlock,
  mediaUrl,
  newBlock,
  newSlide,
  pageLabel,
  parsePriceInput,
  primaryProductId,
  productBlockCount,
  productTypeOf,
  readLegacyDraft,
  slidesOf,
  storePages,
  toHandle,
  withPageBlocks,
  withExtras,
  FONTS,
  PLATFORM_FEE_PERCENT,
  PRESETS,
  blockLabel,
  fontById,
} from './model'

/** Largest product file a seller can upload (Supabase Free allows 50 MB per file). */
const MAX_PRODUCT_FILE_MB = 50
import type { Block, BlockType, CardPart, DraftProduct, PaymentType, ProductExtras, ProductType, Page, PayMethod, PaymentSettings, ProductSlide, SavedBank, SellerSetup, ShopProduct, StoreView } from './model'

/** Copy text even when the async Clipboard API is blocked, denied or missing. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* the fallback below works on http and older browsers too */ }
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.left = '-9999px'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    field.remove()
    return ok
  } catch { return false }
}

/**
 * Seller Studio: Start your store → optional Connect TikTok → build the page,
 * add products, connect payouts, publish, copy the bio link.
 *
 * Everything is saved on the Desknoty server, on the signed-in account. The
 * draft stays private until Publish; the live store keeps serving the last
 * published version meanwhile.
 */

type Tab = 'page' | 'products' | 'payouts' | 'link' | 'orders'

/** Where the "add a product" picker should put the product the owner picks. */
export type AddReq = { kind: 'block' } | { kind: 'slide'; blockId: string; slideIndex: number } | { kind: 'below'; blockId: string }

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
    const bank = q.get('bank')
    if (bank)
      setNotice(
        bank === 'verified' ? 'Bank account verified ✓ You can now choose it under Payouts → Your Bank Accounts.'
          : bank === 'cancelled' ? 'Bank verification was cancelled. Nothing changed.'
          : bank === 'mismatch' ? 'Your bank didn’t list that sort code and account number, so it wasn’t verified. Check the details (Edit) and try again with the bank that holds this account.'
          : bank === 'wrong-account' ? 'You were signed in to a different Desknoty account. Sign in to the right one and verify again.'
          : 'Bank verification didn’t finish. Please try again.',
      )
    if (stripe || tiktok || bank) {
      q.delete('stripe')
      q.delete('tiktok')
      q.delete('bank')
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
            <button type="button" className="ss-ghost" onClick={() => void copyToClipboard(code).then((ok) => { if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1500) } })}>{copied ? 'Copied' : 'Copy'}</button>
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
  const [openProduct, setOpenProduct] = useState<string | null>(null)
  // A product opened from a carousel returns there; one opened from the Products
  // tab keeps the ordinary product-list back link.
  const [fromCarousel, setFromCarousel] = useState(false)
  // Leaving the Products tab returns it to the plain product list next time.
  useEffect(() => { if (tab !== 'products') setOpenProduct(null) }, [tab])
  /** Click-to-edit: which product card part is open in the Page tab. */
  const [editPart, setEditPart] = useState<{ productId: string; part: CardPart } | null>(null)
  // Text typed straight into the selected title/description on the phone card;
  // the open part panel applies it to its save queue (the one source of truth).
  const [inlineText, setInlineText] = useState<{ productId: string; field: 'title' | 'desc'; value: string; n: number } | null>(null)
  /** Unsaved change from that panel, so the phone shows it before the save lands. */
  const [partPreview, setPartPreview] = useState<({ id: string } & PartDraft) | null>(null)
  /** Store pages the owner hid in the phone preview (Page 2 and Page 3). */
  const [hiddenPages, setHiddenPages] = useState<number[]>([])
  /** The add-block popup, and separately the add-product picker. Never the same state. */
  const [addReq, setAddReq] = useState<AddReq | null>(null)
  const [pickReq, setPickReq] = useState<Extract<AddReq, { kind: 'slide' } | { kind: 'below' }> | null>(null)
  const requestAdd = (req: AddReq) => {
    if (req.kind === 'block') { setAddReq(req); return }
    // A click on a placeholder beyond the saved slides creates exactly one new
    // empty slide first, then opens the picker for that slide. Clicking the
    // button on a slide that already exists just fills that slide.
    if (req.kind === 'slide' && req.slideIndex >= slidesForBlock(req.blockId).length) {
      const next: typeof req = { ...req, slideIndex: slidesForBlock(req.blockId).length }
      addEmptySlide(next.blockId, next.slideIndex)
      pendingAdd.current = next
      setPickReq(next)
      return
    }
    pendingAdd.current = req
    setPickReq(req)
  }
  function slidesForBlock(blockId: string): ProductSlide[] {
    const pg = storePages(page).findIndex((p) => p.blocks.some((b) => b.id === blockId))
    if (pg < 0) return []
    const b = blocksOf(page, pg).find((x) => x.id === blockId)
    return b ? slidesOf(b) : []
  }
  /** Append one empty slide and make it the active slide in both editor and preview. */
  function addEmptySlide(blockId: string, slideIndex: number) {
    const from = storePages(page).findIndex((pg) => pg.blocks.some((b) => b.id === blockId))
    const base = blocksOf(page, from)
    const bi = base.findIndex((b) => b.id === blockId)
    const b = bi >= 0 ? base[bi] : null
    if (!b || b.type !== 'featured') return
    const slides = slidesOf(b)
    if (slides.length >= MAX_PRODUCT_SLIDES) return
    const nextSlides = [...slides]
    nextSlides.splice(Math.min(slideIndex, nextSlides.length), 0, newSlide('digital'))
    const next = [...base]
    next[bi] = { ...b, data: { ...b.data, slides: nextSlides, productId: primaryProductId(nextSlides) } }
    edit(withPageBlocks(page, from, cleanFor(from, next)))
    setPageIndex(from)
    setActiveSlideBlock(blockId)
    setActiveSlide(Math.min(slideIndex, nextSlides.length - 1))
  }
  /** Which slide of the focused product block is selected, for phone/preview sync. */
  const [activeSlide, setActiveSlide] = useState(0)
  const [activeSlideBlock, setActiveSlideBlock] = useState<string | null>(null)
  useEffect(() => {
    if (!editPart || !activeSlideBlock) return
    const block = allBlocks(page).find((b) => b.id === activeSlideBlock)
    if (!block || block.type !== 'featured') return
    const slides = slidesOf(block)
    const slide = slides[activeSlide]
    if (!slide || slide.kind !== 'digital' || !slide.productId) return
    if (slide.productId !== editPart.productId) {
      setEditPart({ productId: slide.productId, part: editPart.part })
    }
  }, [activeSlide, activeSlideBlock])
  const closePart = useCallback(() => { setEditPart(null); setPartPreview(null) }, [])
  // Clicking outside the selected card and its settings panel deselects it.
  useEffect(() => {
    if (!editPart) return
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !t.isConnected) return
      if (t.closest('.sp-card, .pe-part, .ss-preview, .ss-modal, .ab, [role="dialog"], [role="menu"], .pg-bar, .ss-tabs')) return
      setEditPart(null)
      setPartPreview(null)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [editPart])
  /** Double-tapping a page tab hides that page; the add-page button brings a page back. */
  const toggleHiddenPage = useCallback((i: number) => {
    // Home (0) is never hidden.
    if (i <= 0) return
    setHiddenPages((h) => (h.includes(i) ? h.filter((x) => x !== i) : [...h, i]))
  }, [])
  /** Where the product picker should place the product it chooses: a slide, a new block below, or a brand-new block. */
  type PendingAdd = { kind: 'slide'; blockId: string; slideIndex: number } | { kind: 'below'; blockId: string } | { kind: 'newBlock'; pageIndex: number; blockIndex: number }
  const pendingAdd = useRef<PendingAdd | null>(null)
  /** The picker chose a product: place it where the owner asked for it. */
  const onPickProduct = (productId: string) => {
    const p = pendingAdd.current
    pendingAdd.current = null
    if (!p) return
    if (p.kind === 'newBlock') {
      const blockId = addProductToNewBlock(p.pageIndex, p.blockIndex, productId)
      if (!blockId) return
      setPicked(blockId)
      setActiveSlideBlock(blockId)
      setActiveSlide(0)
      setFromCarousel(false)
      setTab('page')
      setEditPart(null)
      return
    }
    if (p.kind === 'slide') {
      void addProductToSlide(p.blockId, p.slideIndex, productId)
      // Stay in the block editor: the chosen product must appear in this slide
      // immediately, with the carousel and the left-hand editor still in sync.
      setPicked(p.blockId)
      setActiveSlideBlock(p.blockId)
      setActiveSlide(p.slideIndex)
      setFromCarousel(false)
      setTab('page')
      setEditPart(null)
    } else if (p.kind === 'below') {
      void addProductBlockBelow(p.blockId, productId)
    }
  }
  const view = 'mobile' as 'mobile' | 'desktop'
  // the phone preview can sit on the left or the right of the editor (remembered per browser)
  const [publishing, setPublishing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pageSave = useSellerSave(`desknoty.seller.recovery.${store.id}.page`, store.draft, store.revision, async (value, revision, token) => {
    const r = await sellerApi.saveDraft(value, revision, token)
    setStore(r.store)
    return r.store.revision
  }, async () => {
    // The server's own page, used to settle a clash without losing the newer edit.
    const r = await sellerApi.store(true)
    if (!r?.store) throw new Error('The store could not be reloaded.')
    setStore(r.store)
    return { value: r.store.draft, revision: r.store.revision }
  })
  const full = pageSave.value
  /**
   * Page-builder slides and the product library share one type. Changing a
   * digital slide to Affiliate (or picking a product for a digital slide) also
   * updates that product, so the storefront, checkout and editor never disagree.
   * All other product settings stay untouched.
   */
  const setSlideProductType = (productId: string, next: ProductType, amazonUrl?: string) => {
    const p = store.products.find((x) => x.id === productId)
    if (!p) return
    const x = withExtras(p.extras)
    if (productTypeOf(x) === next) return
    if (!confirmProductTypeChange(p.published, next)) return
    const input = amazonUrl || x.affiliate?.input || x.affiliate?.url || ''
    const checked = input ? amazonUrlCheck(input) : null
    if (next === 'affiliate' && input && !checked?.ok) return setErr(AMAZON_LINK_ERROR)
    const extras: ProductExtras = {
      ...x,
      productType: next,
      affiliate: {
        ...x.affiliate,
        input,
        url: checked?.ok ? checked.url : x.affiliate?.url || '',
        cta: x.affiliate?.cta || DEFAULT_AMAZON_CTA,
        disclosure: x.affiliate?.disclosure || DEFAULT_AFFILIATE_DISCLOSURE,
      },
    }
    void sellerApi.updateProduct(p.id, { extras }, p.revision)
      .then((r) => { setStore(r.store); setErr(null) })
      .catch((e: Error) => setErr(e.message))
  }
  // Style 1 is the editable store. Swiping inside the phone shows Style 2, a "coming soon" preview.
  const page: Page = full
  // Opening a different block follows it, but coming back to the same block (or
  // closing the editor) never snaps the carousel back to slide 1.
  useEffect(() => {
    if (!picked || activeSlideBlock === picked) return
    const slides = slidesForBlock(picked)
    setActiveSlideBlock(picked)
    setActiveSlide((i) => Math.min(i, Math.max(0, slides.length - 1)))
  }, [picked, activeSlideBlock, page])
  const [slide, setSlide] = useState<0 | 1>(full.use === 2 ? 1 : 0)
  // Which store page the editor and the phone are on (Home = 0, then Page 2/Page 3).
  const [pageIndex, setPageIndex] = useState(0)
  const styleBar = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [toast, setToast] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  const share = async () => {
    // Always copy the store's website URL. The native share sheet made "Share"
    // open a panel instead of filling the clipboard, so pasting did nothing.
    const url = store.url || `${window.location.origin}/${store.handle}`
    const ok = await copyToClipboard(url)
    if (ok) {
      setShared(true)
      setShareFailed(false)
      window.setTimeout(() => setShared(false), 1600)
    } else {
      setShareFailed(true)
      window.setTimeout(() => setShareFailed(false), 4000)
    }
  }
  // Undo / redo over the draft (every change still autosaves as the draft only).
  // The chosen style is not part of an edit: undoing a change must never swap
  // the store's style, so `use` and `style2` are always taken from the current page.
  const hist = useRef<{ past: Page[]; future: Page[] }>({ past: [], future: [] })
  const [, rerender] = useState(0)
  const keepStyle = (p: Page): Page => ({ ...p, style2: full.style2, use: full.use })
  const edit = (p: Page) => {
    hist.current.past.push(full)
    if (hist.current.past.length > 60) hist.current.past.shift()
    hist.current.future = []
    rerender((n) => n + 1)
    pageSave.edit(keepStyle(p))
  }
  const undo = () => {
    const prev = hist.current.past.pop()
    if (!prev) return
    hist.current.future.push(full)
    rerender((n) => n + 1)
    pageSave.edit(keepStyle(prev))
  }
  const redo = () => {
    const next = hist.current.future.pop()
    if (!next) return
    hist.current.past.push(full)
    rerender((n) => n + 1)
    pageSave.edit(keepStyle(next))
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

  // The blocks of a page, in the shape the editor shows them (Home pins the
  // profile first and the footer last; Page 2/3 hold content only).
  const blocksOf = useCallback((p: Page, i: number) => (i === 0 ? pinEnds(p.blocks) : (storePages(p)[i]?.blocks ?? [])), [])
  const safePageIndex = Math.min(pageIndex, storePages(page).length - 1)
  const cleanFor = (i: number, next: Block[]) => (i === 0 ? pinEnds(next) : next.filter((b) => b.type !== 'header' && b.type !== 'footer'))
  /** Write one page's blocks without touching the others. */
  const setBlocksOn = (i: number, next: Block[]) => edit(withPageBlocks(page, i, cleanFor(i, next)))

  /**
   * Place a product block on the page with room: the current page first, then
   * Page 2, then Page 3. A fourth product block on a page creates the next page
   * rather than piling up, and a carousel is one block however many slides it has.
   */
  const placeProductBlock = (nb: Block, at?: number, from = safePageIndex) => {
    const found = findProductBlockPage(page, from)
    if (!found) {
      setErr(`All ${MAX_STORE_PAGES} pages already hold ${MAX_PRODUCT_BLOCKS_PER_PAGE} product blocks each. Delete one to add another.`)
      return
    }
    const base = blocksOf(found.page, found.pageIndex)
    const want = at === undefined || found.pageIndex !== from ? (found.pageIndex === 0 ? base.length - 1 : base.length) : at
    const next = insertAt(base, nb, want)
    edit(withPageBlocks(found.page, found.pageIndex, cleanFor(found.pageIndex, next)))
    setPageIndex(found.pageIndex)
    window.setTimeout(() => {
      const el = slideRef.current?.querySelector<HTMLElement>(`.sp-pick[data-id="${nb.id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      openEditor(nb.id, el ?? undefined)
    }, 140)
  }

  /**
   * Create a product block only once a product has been chosen. Previously the
   * picker pre-created an empty block, and cancelling left it behind as empty space.
   */
  function addProductToNewBlock(pageIndex: number, blockIndex: number, productId: string): string | null {
    const blocks = blocksOf(page, pageIndex)
    const productBlocks = blocks.filter((b) => b.type === 'featured' || b.type === 'grid')
    if (productBlocks[blockIndex]) return productBlocks[blockIndex].id
    if (productBlockCount(blocks) >= MAX_PRODUCT_BLOCKS_PER_PAGE) {
      setErr(`${pageLabel(pageIndex)} already has ${MAX_PRODUCT_BLOCKS_PER_PAGE} product blocks. Move one away first.`)
      return null
    }
    const base = newBlock('featured')
    const nb = { ...base, data: { ...base.data, productId, slides: [{ ...newSlide('digital', productId) }] } } as Block
    const lastProductIdx = blocks.reduce((acc, b, i) => (b.type === 'featured' || b.type === 'grid') ? i : acc, -1)
    const insertAtIdx = lastProductIdx >= 0 ? lastProductIdx + 1 : (pageIndex === 0 ? Math.max(0, blocks.length - 1) : blocks.length)
    const next = insertAt(blocks, nb, insertAtIdx)
    edit(withPageBlocks(page, pageIndex, cleanFor(pageIndex, next)))
    setPageIndex(pageIndex)
    return nb.id
  }
  const requestAddSlot = (pageIndex: number, blockIndex: number) => {
    const blocks = blocksOf(page, pageIndex)
    const productBlocks = blocks.filter((b) => b.type === 'featured' || b.type === 'grid')
    const existing = productBlocks[blockIndex]
    if (existing) {
      const slides = slidesOf(existing)
      const req = { kind: 'slide' as const, blockId: existing.id, slideIndex: slides.length }
      pendingAdd.current = req
      requestAdd(req)
      return
    }
    // Don't write an empty block before the picker is answered: cancel must leave no trace.
    pendingAdd.current = { kind: 'newBlock', pageIndex, blockIndex }
    setPickReq({ kind: 'slide', blockId: '', slideIndex: 0 })
  }
  /** requestAddSlot, addressed by block id — the phone preview only knows the block. */
  const requestAddSlotForBlock = (blockId: string) => {
    const pageIndex = storePages(page).findIndex((pg) => pg.blocks.some((b) => b.id === blockId))
    if (pageIndex < 0) return
    const blockIndex = blocksOf(page, pageIndex).findIndex((b) => b.id === blockId)
    if (blockIndex < 0) return
    requestAddSlot(pageIndex, blockIndex)
  }
  const removePlacement = (pageIndex: number, blockId: string, slideIndex: number) => {
    const blocks = blocksOf(page, pageIndex)
    const bi = blocks.findIndex((b) => b.id === blockId)
    if (bi < 0) return
    const b = blocks[bi]
    if (b.type !== 'featured') return
    const slides = slidesOf(b)
    const nextSlides = slides.filter((_, i) => i !== slideIndex)
    const next = [...blocks]
    if (nextSlides.length === 0) {
      next.splice(bi, 1)
    } else {
      next[bi] = { ...b, data: { ...b.data, slides: nextSlides, productId: primaryProductId(nextSlides) } }
    }
    edit(withPageBlocks(page, pageIndex, cleanFor(pageIndex, next)))
    setPageIndex(pageIndex)
  }
  const addProductToSlide = (blockId: string, slideIndex: number, productId: string) => {
    const from = storePages(page).findIndex((pg) => pg.blocks.some((b) => b.id === blockId))
    const base = blocksOf(page, from)
    const bi = base.findIndex((b) => b.id === blockId)
    const b = bi >= 0 ? base[bi] : null
    if (!b || b.type !== 'featured') return
    const slides = slidesOf(b)
    if (slideIndex >= slides.length && slides.length >= MAX_PRODUCT_SLIDES) return
    const nextSlides = slideIndex < slides.length
      ? slides.map((s, i) => (i === slideIndex ? { ...newSlide('digital', productId), id: s.id } : s))
      : [...slides, { ...newSlide('digital', productId) }]
    const next = [...base]
    next[bi] = { ...b, data: { ...b.data, slides: nextSlides, productId: primaryProductId(nextSlides) } }
    edit(withPageBlocks(page, from, cleanFor(from, next)))
    setPageIndex(from)
  }

  /** Add a new, independent product block directly below the product block `blockId`. */
  const addProductBlockBelow = (blockId: string, productId: string) => {
    const nb = { ...newBlock('featured'), data: { ...newBlock('featured').data, productId } } as Block
    const from = storePages(page).findIndex((pg) => pg.blocks.some((b) => b.id === blockId))
    const base = blocksOf(page, from)
    const bi = base.findIndex((b) => b.id === blockId)
    if (bi < 0) return
    if (isProductBlock(base[bi]) && productBlockCount(blocksOf(page, from)) >= MAX_PRODUCT_BLOCKS_PER_PAGE) {
      setErr(`${pageLabel(from)} already has ${MAX_PRODUCT_BLOCKS_PER_PAGE} product blocks. Move one away first.`)
      return
    }
    const next = insertAt(base, nb, bi + 1)
    edit(withPageBlocks(page, from, cleanFor(from, next)))
    setPageIndex(from)
    window.setTimeout(() => {
      const el = slideRef.current?.querySelector<HTMLElement>(`.sp-pick[data-id="${nb.id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      openEditor(nb.id, el ?? undefined)
    }, 120)
  }
  // Drag a new section (or a product) from the editor into the phone; a click adds it without dragging.
  const dragNewBlock = (e: ReactPointerEvent, make: () => Block) => {
    if (e.button !== 0) return
    e.preventDefault()
    closeEditor()
    const x0 = e.clientX, y0 = e.clientY
    let moved = false
    let target: number | null = null
    let others: HTMLElement[] = []
    const ghost = document.createElement('div')
    ghost.className = 'et-ghost'
    ghost.textContent = blockLabel(make().type)
    const place = (x: number, y: number) => {
      ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`
      const scroller = slideRef.current
      if (!scroller) return
      const box = scroller.getBoundingClientRect()
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) { target = null; setDropAt(null); return }
      if (y < box.top + 40) scroller.scrollTop -= 8
      if (y > box.bottom - 40) scroller.scrollTop += 8
      others = [...scroller.querySelectorAll<HTMLElement>('.sp-pick[data-id]')]
      let idx = others.findIndex((o) => { const r = o.getBoundingClientRect(); return y < r.top + r.height / 2 })
      if (idx < 0) idx = others.length
      target = idx
      const ref = others[idx] ?? others[others.length - 1]
      if (!ref) {
        const head = scroller.querySelector('.sp-head')?.getBoundingClientRect()
        setDropAt((head ? head.bottom + 6 : box.top + 120) - box.top + scroller.scrollTop)
        return
      }
      const rr = ref.getBoundingClientRect()
      setDropAt((idx < others.length ? rr.top - 6 : rr.bottom + 6) - box.top + scroller.scrollTop)
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      if (!moved) { moved = true; document.body.appendChild(ghost) }
      place(ev.clientX, ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      ghost.remove()
      setDropAt(null)
      if (moved && target === null) return
      const nb = make()
      const all = blocksOf(page, safePageIndex)
      let at = safePageIndex === 0 ? all.length - 1 : all.length
      if (moved && target !== null && others[target]) at = all.findIndex((b) => b.id === others[target!].dataset.id)
      else if (moved && target !== null && others.length) at = all.findIndex((b) => b.id === others[others.length - 1].dataset.id) + 1
      if (isProductBlock(nb)) {
        placeProductBlock(nb, Math.max(safePageIndex === 0 ? 1 : 0, at))
        return
      }
      setBlocksOn(safePageIndex, insertAt(all, nb, at))
      window.setTimeout(() => {
        const el = slideRef.current?.querySelector<HTMLElement>(`.sp-pick[data-id="${nb.id}"]`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        openEditor(nb.id, el ?? undefined)
      }, 80)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const startInsert = (type: BlockType, e: ReactPointerEvent, data?: Record<string, unknown>) =>
    dragNewBlock(e, () => (data ? { ...newBlock(type), data: { ...newBlock(type).data, ...data } } : newBlock(type)))

  // Add a block at the bottom of the page on screen (above the footer on Home) and open its editor
  const addBlock = (type: BlockType, data?: Record<string, unknown>) => {
    const nb = data ? { ...newBlock(type), data: { ...newBlock(type).data, ...data } } : newBlock(type)
    if (isProductBlock(nb)) return placeProductBlock(nb)
    const all = blocksOf(page, safePageIndex)
    const at = safePageIndex === 0 ? all.length - 1 : all.length
    setBlocksOn(safePageIndex, insertAt(all, nb, at))
    window.setTimeout(() => {
      const el = slideRef.current?.querySelector<HTMLElement>(`.sp-pick[data-id="${nb.id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      openEditor(nb.id, el ?? undefined)
    }, 120)
  }

  /** Move a block to another page (order is kept; product limits still apply). */
  const moveBlockToPage = (id: string, to: number) => {
    const from = storePages(page).findIndex((pg) => pg.blocks.some((b) => b.id === id))
    if (from < 0 || from === to) return
    const block = blocksOf(page, from).find((b) => b.id === id)
    if (!block) return
    if (isProductBlock(block) && productBlockCount(blocksOf(page, to)) >= MAX_PRODUCT_BLOCKS_PER_PAGE) {
      setErr(`${pageLabel(to)} already has ${MAX_PRODUCT_BLOCKS_PER_PAGE} product blocks. Move one away first.`)
      return
    }
    let next = withPageBlocks(page, from, cleanFor(from, blocksOf(page, from).filter((b) => b.id !== id)))
    const targetBase = blocksOf(next, to)
    next = withPageBlocks(next, to, insertAt(targetBase, block, to === 0 ? 1 : 0))
    edit(next)
    setPageIndex(to)
  }
  // Digital product from the Add block popup: create it (image, title, headline, price, file) with the existing product API
  const createProduct = async (f: NewProduct) => {
    const cover = f.cover ? (await sellerApi.uploadMedia(f.cover)).id : null
    const made = await sellerApi.addProduct({ title: f.title.trim(), description: f.headline.trim(), priceMinor: f.priceMinor, currency: f.currency, cover })
    if (f.file) await sellerApi.uploadFile(made.product.id, f.file)
    await reload(true)
    return made.product.id
  }

  // Affiliate product from the Add product popup: a draft already set to Affiliate.
  const createAffiliateProduct = async () => {
    await flushSellerEdits()
    const made = await sellerApi.addProduct({ title: '', priceMinor: 0, currency: 'gbp' })
    const x = withExtras(made.product.extras)
    await sellerApi.updateProduct(made.product.id, { extras: { ...x, productType: 'affiliate', affiliate: { ...x.affiliate, cta: x.affiliate?.cta || DEFAULT_AMAZON_CTA, disclosure: x.affiliate?.disclosure || DEFAULT_AFFILIATE_DISCLOSURE } } }, made.product.revision)
    await reload(true)
    return made.product.id
  }

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
      const base = blocksOf(page, safePageIndex)
      const byId = new Map(base.map((b) => [b.id, b]))
      const next = base.map((b) => (shown.has(b.id) ? byId.get(queue.shift()!)! : b))
      if (next.map((b) => b.id).join() !== base.map((b) => b.id).join()) setBlocksOn(safePageIndex, next)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const saving = pageSave.state === 'Saved' ? 'saved' : pageSave.state === 'Saving…' || pageSave.state === 'Unsaved changes' ? 'saving' : 'error'
  const navigate = async (id: Tab) => {
    try { await flushSellerEdits(); closePart(); setTab(id) } catch (e) { setErr((e as Error).message) }
  }

  const publish = async () => {
    setPublishing(true)
    setErr(null)
    try {
      // A paid product with no valid price must never be published as Free.
      // The editor's unfinished price never reaches the server, so this also
      // catches products left invalid by an older build.
      const unpaid = store.products.find((p) => p.listed && !p.archived && !isFreeProduct(p) && p.priceMinor <= 0)
      if (unpaid) throw new Error(`“${unpaid.title || 'Untitled product'}” is paid but has no price. Enter a price above 0 or switch it to free before publishing.`)
      // Publishing from a style puts that style live (same content, its own layout).
      const use = slide === 1 ? 2 : 1
      if ((full.use ?? 1) !== use) pageSave.edit({ ...full, use })
      // save this editor's draft (with the chosen style) before anything else
      await pageSave.flush()
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

  // Untitled drafts still show in the phone (as "Untitled product"), so a product
  // just added to a swipe appears in its slide straight away.
  const productsForPreview = store.products.filter((p) => !p.archived).map((p) => ({ ...p, title: p.title?.trim() ? p.title : 'Untitled product' })).map((p) => {
    // an open part panel shows its change straight away, before the save returns
    const live = partPreview?.id === p.id ? partPreview : null
    const ex = withExtras(live ? live.extras : p.extras)
    return {
      ...p,
      ...(live ? { title: live.title, description: live.description, cover: live.cover, ...(typeof live.priceMinor === 'number' ? { priceMinor: live.priceMinor } : null) } : null),
      ...ex,
      // The phone preview follows the seller's explicit choice. Older data
      // without it falls back to the saved (last valid) price.
      paymentType: p.paymentType ?? (p.priceMinor === 0 ? 'free' : 'paid'),
      offer: p.offer,
      fileType: p.file ? (p.file.name.split('.').pop() ?? '').toUpperCase() || null : null,
      bundle: ex.bundle.length ? { items: ex.bundle.map((id) => ({ id, title: store.products.find((q) => q.id === id)?.title ?? '' })), available: ex.bundle.length >= 2 } : null,
    }
  })
  const status = !store.publishedAt ? 'Not published yet' : store.unpublishedChanges || saving === 'saving' || pageSave.dirty ? 'Unpublished changes' : 'Live'

  return (
    <div className="ss">
      <section className="ss-editor" aria-label="Store builder">
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
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => (id === 'products' && setOpenProduct(null), setFromCarousel(false), void navigate(id))}>
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
            <button type="button" className="ss-primary ss-primary-sm" onClick={() => void publish()} disabled={publishing}>
              {publishing ? 'Publishing…' : `Publish ${slide === 1 ? 'Style 2' : store.publishedAt ? 'changes' : ''}`.trim()}
            </button>
          </div>
          <p className="ss-lede">Desknoty platform fee: {PLATFORM_FEE_PERCENT}%. Payment providers may charge their own fees.</p>
          {!store.payouts.checkoutReady && (
            <p className="ss-needbank" role="status">
              Buyers can’t pay yet. <button type="button" onClick={() => void navigate('payouts')}>Add a bank account in Payouts</button>
            </p>
          )}
          {(notice || err) && (
            <div className="ss-note" role="status">
              {err ?? notice}{' '}
              <button type="button" className="underline" onClick={() => (setErr(null), clearNotice())}>Dismiss</button>
            </div>
          )}
        </header>}

        <div className="ss-soonwrap">
        {saving === 'error' && (
          <p className="ss-s2note" role="alert">
            Your draft couldn’t be saved.{' '}
            {pageSave.conflict ? 'This page changed somewhere else, so it was not overwritten. Your edits are still here. ' : ''}
            <button type="button" className="underline" onClick={() => void pageSave.flush().catch(() => {})}>Retry save</button>
            {pageSave.conflict && <>{' '}<button type="button" className="underline" onClick={() => void pageSave.discard().catch((e: Error) => setErr(e.message))}>Take the newer version</button></>}
          </p>
        )}
        {readLegacyDraft() && <button type="button" onClick={() => void flushSellerEdits().then(() => importLegacy(store)).then(() => window.location.reload()).catch((e: Error) => setErr(e.message))}>Resume importing browser draft (original kept until complete)</button>}
        {/* Style 2 reuses the same page + products data, so the Page and Products editors stay live for both styles. */}
        {tab === 'page' && <>
          <div className="ss-undo">
            <button type="button" onClick={undo} disabled={!hist.current.past.length} aria-label="Undo"><span aria-hidden="true">↶</span> Undo</button>
            <button type="button" onClick={redo} disabled={!hist.current.future.length} aria-label="Redo"><span aria-hidden="true">↷</span> Redo</button>
            <span>Changes save as a draft. Visitors see them only after you publish.</span>
          </div>
          <PageEditor
            onOpenProduct={(pid) => { setEditPart(null); setFromCarousel(true); setOpenProduct(pid); setTab('products') }}
            onSetProductType={setSlideProductType}
            page={page}
            pageIndex={safePageIndex}
            onChange={edit}
            products={store.products}
            open={picked}
            setOpen={openEditor}
            onMoveBlock={moveBlockToPage}
            onRequestAdd={requestAdd}
            onAddEmptySlide={(blockId, slideIndex) => { addEmptySlide(blockId, slideIndex); setPicked(blockId); setTab('page') }}
            activeSlideBlock={activeSlideBlock}
            activeSlide={activeSlide}
            onActiveSlideChange={(i) => { setActiveSlideBlock(picked); setActiveSlide(Math.max(0, Math.min(MAX_PRODUCT_SLIDES - 1, i))) }}
          />
          {picked && allBlocks(page).find((x) => x.id === picked)?.type !== 'featured' && <FloatingEditor key={picked} page={page} pageIndex={safePageIndex} onChange={edit} products={store.products} id={picked} anchor={anchor} onClose={closeEditor} />}
        </>}
        {/* Add block: the only way to open the block library popup. */}
        {addReq && (
          <AddBlockDialog
            products={store.products}
            onClose={() => setAddReq(null)}
            onAdd={(t, d) => (setAddReq(null), t === 'banner' ? openEditor(BANNER_ID, document.querySelector<HTMLElement>(`[data-pinned="${BANNER_ID}"]`) ?? undefined) : addBlock(t, d))}
            onDragStart={(t, e, d) => { setAddReq(null); startInsert(t, e, d) }}
            createProduct={createProduct}
          />
        )}
        {/* Add product: its own picker, with no block library in sight. */}
        {pickReq && (
          <AddProductDialog
            products={store.products}
            onClose={() => { setPickReq(null); pendingAdd.current = null }}
            onPickExisting={(productId) => { setPickReq(null); onPickProduct(productId) }}
            createProduct={(f) => createProduct(f).then((id) => { setPickReq(null); onPickProduct(id) })}
            createAffiliate={() => createAffiliateProduct().then((id) => { setPickReq(null); onPickProduct(id) })}
          />
        )}
        {tab === 'products' && (
          <ProductsEditor
            inlineText={inlineText}
            store={store}
            setStore={setStore}
            open={openProduct}
            setOpen={setOpenProduct}
            focus={editPart}
            onFocus={setEditPart}
            onPreview={(id, value) => setPartPreview({ id, ...value })}
            onAddSlot={requestAddSlot}
            onAddSlideAt={(blockId, slideIndex) => requestAdd({ kind: 'slide', blockId, slideIndex })}
            onRemoveSlide={removePlacement}
            onPlaceNew={(blockId, slideIndex, productId) => {
              pendingAdd.current = { kind: 'slide', blockId, slideIndex }
              onPickProduct(productId)
            }}
            backToCarousel={fromCarousel}
            onBackToCarousel={() => { setFromCarousel(false); setOpenProduct(null); setTab('page') }}
          />
        )}
        {tab === 'payouts' && <PayoutsPanel store={store} setup={setup} reload={reload} />}
        {tab === 'link' && <LinkPanel store={store} setStore={setStore} />}
        {tab === 'orders' && <OrdersPanel />}
        </div>
        {/* Style switch: pinned to the bottom middle of this panel */}
        {(tab === 'page' || tab === 'products') && (
          <div className="ss-stylebar" ref={styleBar}>
            <div className="ss-stylepick" role="tablist" aria-label="Store style">
              <button type="button" role="tab" aria-selected={slide === 0} onClick={() => setSlide(0)}>Style 1</button>
              <button type="button" role="tab" aria-selected={slide === 1} onClick={() => (setSlide(1), closeEditor())}>Style 2</button>
            </div>
          </div>
        )}
      </section>

      <aside className="ss-preview" aria-label="Draft preview">
        {/* toolbar: undo/redo, save state, preview, share, publish */}
        <div className="pv-bar">
          <span className={cn('pv-saved', (saving === 'saving' || pageSave.dirty) && 'busy', saving === 'error' && 'err')} aria-live="polite">
            <i />{saving === 'saving' || pageSave.dirty ? 'Saving…' : saving === 'error' ? 'Not saved' : 'Saved ✓'}
          </span>
          <button type="button" className="pv-btn" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" /> Preview</button>
          <button type="button" className="pv-btn" title={`Copy ${store.url || `${window.location.origin}/${store.handle}`}`} onClick={() => void share()}><Share2 className="h-4 w-4" /> {shared ? 'Link copied' : shareFailed ? 'Copy failed' : 'Share'}</button>
          <button type="button" className="pv-btn pv-publish" onClick={() => void publish()} disabled={publishing}><Globe className="h-4 w-4" /> {publishing ? 'Publishing…' : 'Publish'}</button>
        </div>
        <div
          className={cn('ss-device', view === 'desktop' && 'ss-device-desk')}
        >
          {view === 'mobile' && <span className="ss-island" aria-hidden="true" />}
          <div
            className="ss-screen ss-slides"
            onPointerDown={(e) => {
              // Swiping inside the phone no longer switches style: use the
              // Style 1 / Style 2 buttons. Swipes stay for product carousels.
              if (e.button === 0) return
              // (old swipe: left for Style 2, right back to Style 1)
              // A product carousel owns its own horizontal drag, so leave it alone.
              if (e.button !== 0 || (e.target as HTMLElement).closest('.sp-grip, .sp-track, .sp-carousel, .sp-car-nav, .sp-slide-empty, input, textarea, select')) return
              const scr = e.currentTarget
              const track = scr.querySelector<HTMLElement>('.ss-track')!
              const x0 = e.clientX, y0 = e.clientY
              let on = false
              const mv = (ev: PointerEvent) => {
                const dx = ev.clientX - x0, dy = ev.clientY - y0
                if (!on && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) { on = true; scr.setPointerCapture(ev.pointerId); track.style.transition = 'none' }
                if (on) track.style.transform = `translateX(calc(${slide * -50}% + ${dx}px))`
              }
              const up = (ev: PointerEvent) => {
                scr.removeEventListener('pointermove', mv)
                scr.removeEventListener('pointerup', up)
                scr.removeEventListener('pointercancel', up)
                if (!on) return
                track.style.transition = ''
                track.style.transform = ''
                const dx = ev.clientX - x0
                if (dx < -60 && slide === 0) (setSlide(1), closeEditor())
                else if (dx > 60 && slide === 1) setSlide(0)
                // a swipe is not a click on a section
                const stop = (ce: MouseEvent) => (ce.stopPropagation(), ce.preventDefault())
                scr.addEventListener('click', stop, { capture: true, once: true })
                setTimeout(() => scr.removeEventListener('click', stop, { capture: true }), 50)
              }
              scr.addEventListener('pointermove', mv)
              scr.addEventListener('pointerup', up)
              scr.addEventListener('pointercancel', up)
            }}
          >
            <div className="ss-track" style={{ transform: `translateX(${slide * -50}%)` }}>
              {/* Style 1: the whole phone screen takes the store's colours, top strip included */}
              <div className="ss-slide" ref={slideRef} style={storeStyle(page)} aria-hidden={slide !== 0}>
                <div className="ss-addr">Draft · {store.url.replace(/^https?:\/\//, '')}</div>
                <StorePage page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} pageIndex={safePageIndex} onPageChange={setPageIndex} picked={tab === 'page' ? picked : null} onGrab={tab === 'page' ? grab : undefined} onAddSlide={(id) => tab === 'page' ? openEditor(id, slideRef.current?.querySelector<HTMLElement>(`.sp-pick[data-id="${id}"]`) ?? undefined) : requestAddSlotForBlock(id)} onAddSlideProduct={(blockId, slideIndex) => requestAdd({ kind: 'slide', blockId, slideIndex })} activeSlideBlock={activeSlideBlock} activeSlide={activeSlide} onSlideChange={(blockId, i) => { setActiveSlideBlock(blockId); setActiveSlide(Math.max(0, Math.min(MAX_PRODUCT_SLIDES - 1, i))) }} editCard={editPart ? { productId: editPart.productId ?? null, part: editPart.part ?? null } : { productId: null, part: null }} onCardText={(productId, field, value) => setInlineText({ productId, field, value, n: Date.now() + Math.random() })} hiddenPages={hiddenPages} onHide={(i) => toggleHiddenPage(i)} onPick={(id, el, pid, _part) => {
                  // Clicking a product in the owner's preview:
                  //  - one of its elements (image, title, description, button) opens
                  //    just that element's settings, in place;
                  //  - the card's own background opens the product's full editor.
                  if (pid) {
                    // One selection (product + part) drives both the outline in
                    // the phone and the panel. A click on an element opens only
                    // that element's settings; the card itself opens the card
                    // settings. The full editor opens only from "Edit full product".
                    setPicked(id)
                    setActiveSlideBlock(id)
                    setFromCarousel(true)
                    setOpenProduct(pid)
                    setEditPart({ productId: pid, part: _part ?? 'card' })
                    setTab('products')
                    return
                  }
                  setEditPart(null)
                  setPartPreview(null)
                  setTab('page'); openEditor(id, el)
                }} />
                {dropAt !== null && <div className="ss-dropline" style={{ top: dropAt }} aria-hidden="true" />}
              </div>
              <div className="ss-slide" aria-label="Style 2 preview" aria-hidden={slide !== 1}>
                <Style2Page page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} hiddenPages={hiddenPages} />
              </div>
            </div>
          </div>
        </div>
        <p className="pv-caption"><Link2 className="h-3.5 w-3.5" /> {store.publishedAt ? 'Live preview' : 'Draft preview'} · <a href={`/${store.handle}`} target="_blank" rel="noreferrer">{store.url.replace(/^https?:\/\//, '')}</a></p>
        {previewOpen && (
          <PreviewModal onClose={() => setPreviewOpen(false)} url={store.url} published={Boolean(store.publishedAt)} onPublish={() => void publish().then(() => setPreviewOpen(false))}>
            {slide === 1 ? (
              <Style2Page page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} />
            ) : (
              <div style={storeStyle(page)} className="pv-page"><StorePage page={page} products={productsForPreview} handle={store.handle} checkoutReady={store.payouts.checkoutReady} /></div>
            )}
          </PreviewModal>
        )}
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

const BLOCK_ICON: Record<BlockType, string> = { header: '◉', hero: '✦', text: 'T', image: '▣', links: '↗', featured: '★', grid: '▦', faq: '?', tiktok: '▶', email: '✉', divider: '—', footer: '▁' }
/** Icon tiles for the block list and the Add block popup (colour per kind). */
const TILE: Record<string, { icon: ReactNode; bg: string; fg: string }> = {
  header: { icon: <User className="h-4 w-4" />, bg: '#111114', fg: '#fff' },
  banner: { icon: <Film className="h-4 w-4" />, bg: '#e0e7ff', fg: '#4338ca' },
  links: { icon: <Link2 className="h-4 w-4" />, bg: '#bbf7d0', fg: '#166534' },
  tiktok: { icon: <Video className="h-4 w-4" />, bg: '#111114', fg: '#fff' },
  image: { icon: <ImageIcon className="h-4 w-4" />, bg: '#f4f4f5', fg: '#27272a' },
  text: { icon: <Type className="h-4 w-4" />, bg: '#fde68a', fg: '#78350f' },
  email: { icon: <AtSign className="h-4 w-4" />, bg: '#fef3c7', fg: '#92400e' },
  featured: { icon: <ShoppingBag className="h-4 w-4" />, bg: '#fce7f3', fg: '#9d174d' },
  grid: { icon: <LayoutGrid className="h-4 w-4" />, bg: '#ede9fe', fg: '#5b21b6' },
  faq: { icon: <HelpCircle className="h-4 w-4" />, bg: '#e0f2fe', fg: '#075985' },
  hero: { icon: <Sparkles className="h-4 w-4" />, bg: '#fae8ff', fg: '#86198f' },
  divider: { icon: <Minus className="h-4 w-4" />, bg: '#f4f4f5', fg: '#52525b' },
  footer: { icon: <PanelBottom className="h-4 w-4" />, bg: '#f4f4f5', fg: '#52525b' },
}
const Tile = ({ kind, big }: { kind: string; big?: boolean }) => {
  const t = TILE[kind] ?? TILE.text
  return <span className={big ? 'ab-tile ab-tile-big' : 'ab-tile'} style={{ background: t.bg, color: t.fg }} aria-hidden="true">{t.icon}</span>
}
type CatalogItem = { kind: BlockType | 'banner'; name: string; text: string }
const CATALOG: Record<string, CatalogItem[]> = {
  'Quick add': [
    { kind: 'links', name: 'Links', text: 'Buttons to anywhere' },
    { kind: 'featured', name: 'Digital product', text: 'Sell a file: image, price, title' },
    { kind: 'tiktok', name: 'Videos', text: 'Your TikTok videos' },
    { kind: 'image', name: 'Images', text: 'A picture with a caption' },
    { kind: 'text', name: 'Text', text: 'A heading and words' },
    { kind: 'email', name: 'Contact', text: 'An email button' },
  ],
  Content: [
    { kind: 'links', name: 'Links', text: 'Buttons to anywhere' },
    { kind: 'tiktok', name: 'Videos', text: 'TikTok videos, tap to play' },
    { kind: 'image', name: 'Images', text: 'A picture with a caption' },
    { kind: 'text', name: 'Text & layout', text: 'A heading and a paragraph' },
    { kind: 'hero', name: 'Welcome intro', text: 'Welcome text and a square image' },
  ],
  Sell: [
    { kind: 'featured', name: 'Digital product', text: 'Create a product and show it big' },
    { kind: 'grid', name: 'Product collection', text: 'A grid of your products' },
  ],
  Grow: [
    { kind: 'email', name: 'Contact', text: 'Visitors email you in one tap' },
  ],
  Design: [
    { kind: 'banner', name: 'Banner', text: 'Image or video behind your profile' },
    { kind: 'divider', name: 'Divider', text: 'A line or space' },
    { kind: 'faq', name: 'FAQ', text: 'Questions and answers' },
  ],
}
export const BANNER_ID = '__banner__'

/** Preview: the whole draft page in a popup, phone or desktop width, before publishing. */
function PreviewModal({ children, onClose, onPublish, url, published }: { children: ReactNode; onClose: () => void; onPublish: () => void; url: string; published: boolean }) {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div className="pvm-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pvm" role="dialog" aria-modal="true" aria-label="Preview your page">
        <header className="pvm-head">
          <b>Preview</b>
          <span className="pvm-url">{url.replace(/^https?:\/\//, '')}{published ? '' : ' · not published yet'}</span>
          <div className="ss-seg pvm-seg" role="tablist" aria-label="Preview size">
            <button type="button" role="tab" aria-selected={!wide} onClick={() => setWide(false)}><Smartphone className="h-3.5 w-3.5" /> Phone</button>
            <button type="button" role="tab" aria-selected={wide} onClick={() => setWide(true)}><Monitor className="h-3.5 w-3.5" /> Desktop</button>
          </div>
          {published
            ? <a className="pv-btn pv-publish" href={url} target="_blank" rel="noreferrer"><Globe className="h-4 w-4" /> Visit website</a>
            : <button type="button" className="pv-btn pv-publish" onClick={onPublish}><Globe className="h-4 w-4" /> Publish</button>}
          <button type="button" className="ab-x" onClick={onClose} aria-label="Close preview"><CloseIcon className="h-4 w-4" /></button>
        </header>
        <div className="pvm-stage">
          <div className={wide ? 'pvm-frame pvm-wide' : 'pvm-frame'}>{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

type BlockMenuItem = { label: string; onSelect: () => void; disabled?: boolean; hint?: string; danger?: boolean }

/** Block deletion is a page-only change; say so, and say how to get it back. */
function confirmBlockDelete(name: string) {
  return window.confirm(`Delete ${name} from this page? The product stays in your product library, and you can Undo this before publishing.`)
}

/**
 * The block's three-dot menu. It is portaled to the body and positioned from the
 * clicked button: a tall, expanded Digital product block can no longer push the
 * menu off screen, and no parent with `overflow: hidden` can clip it.
 */
function BlockMenu({ anchor, items, onClose }: { anchor: HTMLElement; items: BlockMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current
      if (!el || !anchor) return
      const r = anchor.getBoundingClientRect()
      const w = el.offsetWidth
      const h = el.offsetHeight
      const pad = 8
      const gap = 6
      // Prefer below the button, flip above when there isn't room, and clamp as
      // a last resort for very short viewports.
      let top = r.bottom + gap
      if (h + gap + pad > window.innerHeight - r.bottom) top = r.top - h - gap
      if (top < pad) top = Math.max(pad, Math.min(r.top, window.innerHeight - h - pad))
      const left = Math.max(pad, Math.min(r.right - w, window.innerWidth - w - pad))
      setPos({ left, top, maxHeight: Math.min(420, window.innerHeight - pad * 2) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor, items.length])

  useEffect(() => {
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.bl-menu, .bl-more')) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="bl-menu bl-menu-portal" role="menu" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          title={it.disabled ? it.hint : undefined}
          className={cn(it.danger && 'bl-del')}
          onClick={() => { onClose(); it.onSelect() }}
        >{it.label}</button>
      ))}
    </div>,
    document.body,
  )
}

function PageEditor({ page, pageIndex, onChange, products, open, setOpen, onMoveBlock, onOpenProduct, onSetProductType, onRequestAdd, onAddEmptySlide, activeSlideBlock, activeSlide, onActiveSlideChange }: { onOpenProduct?: (id: string) => void; onSetProductType?: (id: string, type: ProductType, amazonUrl?: string) => void; page: Page; pageIndex: number; onChange: (p: Page) => void; products: DraftProduct[]; open: string | null; setOpen: (id: string | null, el?: HTMLElement) => void; onMoveBlock: (id: string, to: number) => void; onRequestAdd: (req: AddReq) => void; onAddEmptySlide?: (blockId: string, slideIndex: number) => void; activeSlideBlock?: string | null; activeSlide?: number; onActiveSlideChange?: (i: number) => void }) {
  const pages = storePages(page)
  const isHome = pageIndex === 0
  // Home keeps its pinned profile and footer; Page 2/3 hold content only.
  const blocks = isHome ? pinEnds(page.blocks) : (pages[pageIndex]?.blocks ?? [])
  const first = isHome ? 1 : 0
  const last = isHome ? blocks.length - 2 : blocks.length - 1
  const setBlocks = (b: Block[]) => onChange(withPageBlocks(page, pageIndex, isHome ? pinEnds(b) : b.filter((x) => x.type !== 'header' && x.type !== 'footer')))
  // One menu at a time, anchored to the button that opened it. The menu itself
  // owns outside-click / Escape dismissal and viewport-aware placement.
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const move = (from: number, to: number) => {
    if (to < first || to > last || from === to) return
    const next = [...blocks]
    const [b] = next.splice(from, 1)
    next.splice(to, 0, b)
    setBlocks(next)
  }
  const duplicate = (b: Block) => {
    const i = blocks.findIndex((x) => x.id === b.id)
    const copy = { ...newBlock(b.type), data: structuredClone(b.data), hidden: b.hidden, look: b.look }
    const next = [...blocks]
    next.splice(i + 1, 0, copy)
    setBlocks(next)
  }
  const openEditor = (id: string, el?: HTMLElement) => {
    // a Digital product opens right under its row (click again to close); other blocks use the pop-up editor
    if (blocks.find((x) => x.id === id)?.type === 'featured' && open === id) return setOpen(null)
    setOpen(id, el ?? (document.querySelector(`[data-block="${id}"] .bl-main`) as HTMLElement) ?? undefined)
  }
  const openRow = (id: string) => (e: React.MouseEvent<HTMLElement>) => openEditor(id, e.currentTarget.closest('.bl-card') as HTMLElement)
  /**
   * Remove one block from this page's draft only. The product library is never
   * touched, and the change goes through `setBlocks` so Undo restores it.
   */
  const deleteBlock = (b: Block, i: number) => {
    const name = `Block ${i + 1} — ${blockLabel(b.type)}`
    if (!confirmBlockDelete(name)) return
    if (open === b.id) setOpen(null)
    setMenu(null)
    setBlocks(blocks.filter((x) => x.id !== b.id))
  }
  return (
    <div className="ss-stack">
      {/* Add a block to the current page. Page switching happens in the phone preview. */}
      <div className="pg-addrow">
        <button type="button" className="bl-add" onClick={() => onRequestAdd({ kind: 'block' })}><Plus className="h-4 w-4" /> Add block</button>
      </div>
      <ul className="bl-list" aria-label={`${pageLabel(pageIndex)} blocks`}>
        {isHome && (
          <>
            <li className="bl-card bl-locked">
              <span className="bl-grip bl-grip-off" aria-hidden="true" />
              <Tile kind="header" />
              <span className="bl-name"><b>Header</b><small>Your TikTok photo, name and username</small></span>
              <span className="bl-lock" title="Always at the top"><Lock className="h-3.5 w-3.5" /></span>
            </li>
            <li className={cn('bl-card', open === BANNER_ID && 'on')} data-pinned={BANNER_ID}>
              <span className="bl-grip bl-grip-off" aria-hidden="true" />
              <button type="button" className="bl-main" onClick={openRow(BANNER_ID)}>
                <Tile kind="banner" />
                <span className="bl-name"><b>Banner</b><small>{page.banner ? (page.banner.kind === 'video' ? 'Video' : 'Image') : 'Add an image or video'}</small></span>
              </button>
            </li>
          </>
        )}
        {blocks.map((b, i) => {
          if (b.type === 'header') return null
          const pinned = b.type === 'footer'
          return (
            <li
              key={b.id}
              data-block={b.id}
              data-pinned={pinned ? b.id : undefined}
              className={cn('bl-card', open === b.id && 'on', b.hidden && 'bl-hidden', dragId === b.id && 'bl-dragging', overId === b.id && dragId !== b.id && 'bl-over')}
              draggable={!pinned}
              onDragStart={(e) => (setDragId(b.id), e.dataTransfer.setData('text/plain', b.id), (e.dataTransfer.effectAllowed = 'move'))}
              onDragEnd={() => (setDragId(null), setOverId(null))}
              onDragOver={(e) => { if (dragId && !pinned) { e.preventDefault(); setOverId(b.id) } }}
              onDrop={(e) => { e.preventDefault(); const from = blocks.findIndex((x) => x.id === dragId); if (from >= 0) move(from, i); setDragId(null); setOverId(null) }}
            >
              <span className={cn('bl-grip', pinned && 'bl-grip-off')} aria-hidden="true" title={pinned ? undefined : 'Drag to reorder'}>{pinned ? null : <><i /><i /><i /><i /><i /><i /></>}</span>
              <button type="button" className="bl-main" onClick={openRow(b.id)}>
                <Tile kind={b.type} />
                <span className="bl-name"><b>{blockLabel(b.type)}</b><small>{summary(b, products)}</small></span>
              </button>
              {!pinned && (
                <>
                  <span className="sr-only">
                    <button type="button" aria-label={`Move ${blockLabel(b.type)} up`} disabled={i <= first} onClick={() => move(i, i - 1)} />
                    <button type="button" aria-label={`Move ${blockLabel(b.type)} down`} disabled={i >= last} onClick={() => move(i, i + 1)} />
                  </span>
                  <button type="button" className="bl-more" aria-label={`More for ${blockLabel(b.type)}`} aria-expanded={menu?.id === b.id} onClick={(e) => { const btn = e.currentTarget; setMenu((m) => (m?.id === b.id ? null : { id: b.id, anchor: btn })) }}><MoreHorizontal className="h-4 w-4" /></button>
                  <button type="button" className="bl-eye" aria-label={`${b.hidden ? 'Show' : 'Hide'} ${blockLabel(b.type)}`} aria-pressed={b.hidden} onClick={() => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))}>
                    {b.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {open === b.id && b.type === 'featured' && (
                    <div className="bl-inline" role="region" aria-label="Edit Digital product">
                      <BlockEditor block={b} products={products} onOpenProduct={onOpenProduct} onSetProductType={onSetProductType} update={(d) => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, ...d } } : x)))} onAddBelow={(id) => onRequestAdd({ kind: 'below', blockId: id })} onAddSlide={(id, i) => onRequestAdd({ kind: 'slide', blockId: id, slideIndex: i })} onAddEmptySlide={onAddEmptySlide} activeSlide={activeSlideBlock === b.id ? activeSlide : undefined} onActiveSlideChange={onActiveSlideChange} />
                    </div>
                  )}
                  {menu?.id === b.id && (
                    <BlockMenu
                      anchor={menu.anchor}
                      onClose={() => setMenu(null)}
                      items={[
                        { label: 'Edit block', onSelect: () => openEditor(b.id) },
                        { label: 'Duplicate block', onSelect: () => duplicate(b) },
                        { label: 'Move up', disabled: i <= first, hint: i <= first ? 'This block is already first on the page.' : undefined, onSelect: () => move(i, i - 1) },
                        { label: 'Move down', disabled: i >= last, hint: i >= last ? 'This block is already last on the page.' : undefined, onSelect: () => move(i, i + 1) },
                        { label: b.hidden ? 'Show block' : 'Hide block', onSelect: () => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x))) },
                        ...pages.filter((pg) => pg.index !== pageIndex).map((pg) => ({ label: `Move to ${pageLabel(pg.index)}`, onSelect: () => onMoveBlock(b.id, pg.index) })),
                        { label: 'Delete block', danger: true, onSelect: () => deleteBlock(b, i) },
                      ]}
                    />
                  )}
                </>
              )}
            </li>
          )
        })}
        {!isHome && !blocks.length && <li className="bl-locked"><span className="bl-name"><b>This page is empty</b><small>Add a block below, or drag a product into the phone.</small></span></li>}
      </ul>
      <ThemeEditor page={page} onChange={onChange} />
    </div>
  )
}

export type NewProduct = { title: string; headline: string; priceMinor: number; currency: string; cover: File | null; file: File | null }

/** The Add block popup: search, categories, quick add, recommended; Digital product opens a small creator. */
function AddBlockDialog({ products, onClose, onAdd, onDragStart, createProduct }: { products: DraftProduct[]; onClose: () => void; onAdd: (t: BlockType | 'banner', d?: Record<string, unknown>) => void; onDragStart: (t: BlockType, e: ReactPointerEvent, d?: Record<string, unknown>) => void; createProduct: (f: NewProduct) => Promise<string> }) {
  const [cat, setCat] = useState('Quick add')
  const [q, setQ] = useState('')
  const [making, setMaking] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const all = Object.values(CATALOG).flat().filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i)
  const list = q.trim() ? all.filter((x) => `${x.name} ${x.text}`.toLowerCase().includes(q.trim().toLowerCase())) : CATALOG[cat]
  const pick = (it: CatalogItem) => (it.kind === 'featured' ? setMaking(true) : onAdd(it.kind))
  // pointer-drag an item straight out of the popup onto the phone
  const drag = (it: CatalogItem) => (e: ReactPointerEvent) => {
    if (it.kind === 'banner' || it.kind === 'featured' || e.button !== 0) return
    const x0 = e.clientX, y0 = e.clientY
    const mv = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return
      window.removeEventListener('pointermove', mv)
      onDragStart(it.kind as BlockType, { ...e, clientX: ev.clientX, clientY: ev.clientY, button: 0, preventDefault: () => {} } as unknown as ReactPointerEvent)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mv), { once: true })
  }
  return (
    <div className="ab-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ab" role="dialog" aria-modal="true" aria-label="Add a block">
        <header className="ab-head"><h2>{making ? 'New digital product' : 'Add a block'}</h2><button type="button" className="ab-x" onClick={onClose} aria-label="Close"><CloseIcon className="h-4 w-4" /></button></header>
        {making ? (
          <ProductMaker products={products} onBack={() => setMaking(false)} onPickExisting={(id) => { setMaking(false); onAdd('featured', { productId: id }) }} createProduct={async (f) => { const id = await createProduct(f); setMaking(false); onAdd('featured', { productId: id }) }} />
        ) : (
          <div className="ab-body">
            <nav className="ab-nav" aria-label="Block categories">
              <label className="ab-search"><Search className="h-4 w-4" /><input placeholder="Search blocks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search blocks" /></label>
              {Object.keys(CATALOG).map((c) => (
                <button key={c} type="button" className={cn('ab-cat', !q && cat === c && 'on')} onClick={() => (setQ(''), setCat(c))}>
                  <Tile kind={CATALOG[c][0].kind} /> <span>{c}</span>
                </button>
              ))}
            </nav>
            <section className="ab-main">
              {!q && cat === 'Quick add' && (
                <>
                  <div className="ab-quick">
                    {CATALOG['Quick add'].map((it) => (
                      <button key={it.name} type="button" className="ab-q" onClick={() => pick(it)} onPointerDown={drag(it)}><Tile kind={it.kind} big /><span>{it.name}</span></button>
                    ))}
                  </div>
                  <h3 className="ab-sub">Recommended</h3>
                  <div className="ab-recs">
                    <article className="ab-rec">
                      <div className="ab-rec-art ab-rec-product" aria-hidden="true"><span /><b>£29.99</b><i>Buy now</i></div>
                      <footer><Tile kind="featured" /><b>Digital product</b><button type="button" onClick={() => setMaking(true)}>Add</button></footer>
                    </article>
                    <article className="ab-rec">
                      <div className="ab-rec-art ab-rec-video" aria-hidden="true"><span>▶</span><span>▶</span></div>
                      <footer><Tile kind="tiktok" /><b>TikTok videos</b><button type="button" onClick={() => onAdd('tiktok')}>Add</button></footer>
                    </article>
                  </div>
                </>
              )}
              {(q || cat !== 'Quick add') && (
                <div className="ab-grid">
                  {list.length === 0 && <p className="ss-muted">No blocks match “{q}”.</p>}
                  {list.map((it) => (
                    <button key={it.name} type="button" className="ab-item" onClick={() => pick(it)} onPointerDown={drag(it)}>
                      <Tile kind={it.kind} big />
                      <span><b>{it.name}</b><small>{it.text}</small></span>
                    </button>
                  ))}
                </div>
              )}
              <p className="ab-tip">Tip: click to add at the bottom, or drag a block straight onto the phone.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/** The add-product picker: choose an existing product or make a new one.
    Deliberately its own dialog — the block library must not appear here. */
function AddProductDialog({ products, onClose, onPickExisting, createProduct, createAffiliate }: { products: DraftProduct[]; onClose: () => void; onPickExisting: (productId: string) => void; createProduct: (f: NewProduct) => Promise<void>; createAffiliate?: () => Promise<void> }) {
  const [making, setMaking] = useState(false)
  // First step: choose Digital or Affiliate.
  const [kind, setKind] = useState<'digital' | null>(createAffiliate ? null : 'digital')
  const [busy, setBusy] = useState(false)
  const [kindErr, setKindErr] = useState<string | null>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const available = products.filter((p) => !p.archived)
  return (
    <div className="ab-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ab ab-slim" role="dialog" aria-modal="true" aria-label="Add a product">
        <header className="ab-head">
          <h2>{!kind ? 'What are you adding?' : making ? 'New digital product' : 'Add a product'}</h2>
          <button type="button" className="ab-x" onClick={onClose} aria-label="Close"><CloseIcon className="h-4 w-4" /></button>
        </header>
        {!kind ? (
          <div className="ab-body ab-body-pick">
            <section className="ab-main">
              <div className="ab-grid ab-grid-pick">
                <button type="button" className="ab-item" disabled={busy} onClick={() => setKind('digital')}>
                  <span className="ab-thumb"><Package className="h-5 w-5" /></span>
                  <span><b>Digital product</b><small>Sell a file buyers download</small></span>
                </button>
                <button type="button" className="ab-item" disabled={busy} onClick={() => { setBusy(true); setKindErr(null); createAffiliate!().catch((e: Error) => { setKindErr(e.message); setBusy(false) }) }}>
                  <span className="ab-thumb"><Globe className="h-5 w-5" /></span>
                  <span><b>{busy ? 'Creating…' : 'Affiliate'}</b><small>Link to a product on Amazon</small></span>
                </button>
              </div>
              {kindErr && <p className="ss-note" role="alert">{kindErr}</p>}
            </section>
          </div>
        ) : making ? (
          <ProductMaker products={products} onBack={() => setMaking(false)} onPickExisting={onPickExisting} createProduct={createProduct} />
        ) : (
          <div className="ab-body ab-body-pick">
            <section className="ab-main">
              <div className="ab-grid ab-grid-pick">
                {available.map((p) => (
                  <button key={p.id} type="button" className="ab-item" onClick={() => onPickExisting(p.id)}>
                    <span className="ab-thumb">{p.cover ? <img src={mediaUrl(p.cover) ?? ''} alt="" /> : <Package className="h-5 w-5" />}</span>
                    <span><b>{p.title.trim() || 'Untitled product'}</b><small>{p.priceMinor === 0 ? 'Free' : formatPrice(p.priceMinor, p.currency)}</small></span>
                  </button>
                ))}
                {available.length === 0 && <p className="ss-muted">No products yet — create your first one.</p>}
              </div>
              <button type="button" className="ss-ghost" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={() => setMaking(true)}>
                <Plus className="h-3.5 w-3.5" /> New product
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/** Create a digital product (image, title, headline, price, file) and add it to the page, or pick an existing one. */
function ProductMaker({ products, onBack, onPickExisting, createProduct }: { products: DraftProduct[]; onBack: () => void; onPickExisting: (id: string) => void; createProduct: (f: NewProduct) => Promise<void> }) {
  const [f, setF] = useState<NewProduct>({ title: '', headline: '', priceMinor: 0, currency: 'gbp', cover: null, file: null })
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const coverUrl = f.cover ? URL.createObjectURL(f.cover) : null
  const valid = f.title.trim() && f.file && /^\d+(\.\d{1,2})?$/.test(price.trim())
  const save = async () => {
    setBusy(true)
    setErr(null)
    try { await createProduct({ ...f, priceMinor: Math.round(Number(price) * 100) }) } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  return (
    <div className="pm">
      <div className="pm-form">
        <label className="pm-cover">
          {coverUrl ? <img src={coverUrl} alt="" /> : <span><ImagePlus className="h-5 w-5" /> Add image</span>}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" aria-label="Product image" onChange={(e) => setF({ ...f, cover: e.target.files?.[0] ?? null })} />
        </label>
        <div className="pm-fields">
          <Field label="Title"><input className="ss-input" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Notion content planner" /></Field>
          <Field label="Main headline"><input className="ss-input" maxLength={200} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="Plan a month of posts in one hour" /></Field>
          <Field label="Price (£)" hint="0 makes it free."><input className="ss-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="9.99" /></Field>
          <Field label="File buyers get">
            <label className="ss-ghost cursor-pointer self-start"><Upload className="h-3.5 w-3.5" /> {f.file ? f.file.name : 'Upload PDF, ZIP…'}<input type="file" className="sr-only" aria-label="Product file" onChange={(e) => setF({ ...f, file: e.target.files?.[0] ?? null })} /></label>
          </Field>
        </div>
      </div>
      {err && <p className="ss-note" role="alert">{err}</p>}
      <div className="pm-foot">
        <button type="button" className="ss-ghost" onClick={onBack}>Back</button>
        <button type="button" className="ss-primary" disabled={!valid || busy} onClick={() => void save()}>{busy ? 'Creating…' : 'Create and add to page'}</button>
      </div>
      {products.length > 0 && (
        <div className="pm-existing">
          <h3 className="ab-sub">Or add one you already have</h3>
          {products.map((p) => (
            <button key={p.id} type="button" className="pm-row" onClick={() => onPickExisting(p.id)}>
              <span className="pm-thumb" style={p.cover ? { backgroundImage: `url(${mediaUrl(p.cover)})` } : undefined} />
              <b>{p.title || 'Untitled product'}</b>
              <small>{p.priceMinor === 0 ? 'Free' : formatPrice(p.priceMinor, p.currency)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Banner behind the profile: upload an image or a short video (it plays once when tapped). */
function BannerEditor({ page, onChange }: { page: Page; onChange: (p: Page) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const b = page.banner
  const src = b ? mediaUrl(b.media) : null
  const pick = async (file?: File) => {
    if (!file) return
    const video = file.type.startsWith('video/')
    if (!video && !file.type.startsWith('image/')) return setErr('Choose an image or a video.')
    if (file.size > (video ? 15 : 5) * 1024 * 1024) return setErr(video ? 'Videos can be up to 15 MB.' : 'Images can be up to 5 MB.')
    setBusy(true)
    setErr(null)
    try {
      const { id } = await sellerApi.uploadMedia(file)
      onChange({ ...page, banner: { media: id, kind: video ? 'video' : 'image' } })
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <div className="sb-edit et-banner">
      <div className="et-banner-preview">
        {src ? (b!.kind === 'video' ? <video src={src} muted playsInline controls /> : <img src={src} alt="" />) : <span>No banner yet</span>}
      </div>
      <p className="ss-muted">Shown behind your profile photo. When someone taps it, a video plays once and stops; an image does a short zoom.</p>
      <div className="ss-row">
        <label className="ss-ghost cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" /> {busy ? 'Uploading…' : b ? 'Replace' : 'Upload image or video'}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Banner image or video" />
        </label>
        {b && <button type="button" className="ss-ghost" onClick={() => onChange({ ...page, banner: null })}>Remove</button>}
      </div>
      {err && <span className="ss-hint text-[#b42318]">{err}</span>}
    </div>
  )
}

/** The editing panel for one section: floats above everything, never moves the layout. */
function FloatingEditor({ page, pageIndex, onChange, products, id, anchor, onClose }: { page: Page; pageIndex: number; onChange: (p: Page) => void; products: DraftProduct[]; id: string; anchor: DOMRect | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pickingFont, setPickingFont] = useState(false)
  const safe = Math.min(pageIndex, storePages(page).length - 1)
  const blocks = safe === 0 ? pinEnds(page.blocks) : (storePages(page)[safe]?.blocks ?? [])
  const i = blocks.findIndex((b) => b.id === id)
  const b = blocks[i]
  useEffect(() => {
    // a press anywhere outside closes it; edits are already in the draft, so nothing is lost
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (ref.current?.contains(t) || t.closest('.sp-pick, .sb-title, .sb-menu, .et-main, .et-tile, .bl-main, .bl-menu')) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => (document.removeEventListener('pointerdown', down), document.removeEventListener('keydown', key))
  }, [onClose])
  // place it beside the clicked element, inside the window; on phones it's a bottom sheet
  const W = 340
  const phone = window.innerWidth < 760
  const style: CSSProperties = phone || !anchor
    ? {}
    : {
        // straight above the section you clicked (below it when there's no room above)
        left: Math.min(Math.max(12, anchor.left + anchor.width / 2 - W / 2), window.innerWidth - W - 12),
        ...(anchor.top > 320
          ? { bottom: window.innerHeight - anchor.top + 10, maxHeight: Math.min(560, anchor.top - 22) }
          : { top: anchor.bottom + 10, maxHeight: Math.min(560, window.innerHeight - anchor.bottom - 22) }),
        overflowY: 'auto',
      }
  if (id === BANNER_ID)
    return (
      <div ref={ref} className={cn('fe', phone && 'fe-sheet')} style={style} role="dialog" aria-label="Edit Banner">
        <header className="fe-head"><span className="sb-ico" aria-hidden="true">🎞</span><b>Banner</b><button type="button" className="fe-x" aria-label="Close" onClick={onClose}>✕</button></header>
        <div className="fe-body"><BannerEditor page={page} onChange={onChange} /></div>
        <footer className="fe-foot">
          <button type="button" className="fe-del" onClick={() => { if (!page.banner || !confirmBlockDelete('Banner')) return; onChange({ ...page, banner: null }); onClose() }}><Trash2 className="h-3.5 w-3.5" /> Delete banner</button>
        </footer>
      </div>
    )
  if (!b) return null
  const pinned = b.type === 'footer'
  const setBlocks = (next: Block[]) => onChange(withPageBlocks(page, safe, safe === 0 ? pinEnds(next) : next.filter((x) => x.type !== 'header' && x.type !== 'footer')))
  const update = (d: Record<string, unknown>) => setBlocks(blocks.map((x) => (x.id === id ? { ...x, data: { ...x.data, ...d } } : x)))
  const look = b.look ?? {}
  const setLook = (l: Partial<NonNullable<Block['look']>>) => {
    const next = { ...look, ...l }
    for (const k of Object.keys(next) as Array<keyof typeof next>) if (!next[k]) delete next[k]
    setBlocks(blocks.map((x) => (x.id === id ? { ...x, look: Object.keys(next).length ? next : undefined } : x)))
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
            <button type="button" className="ss-input fe-font" aria-label="Font" onClick={() => setPickingFont(true)}>
              {look.font ? <span style={{ fontFamily: fontById(look.font)?.css }}>{fontById(look.font)?.label ?? 'Font'}</span> : 'Theme font'}
            </button>
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
          <button type="button" className="fe-del" onClick={() => { if (!confirmBlockDelete(`Block ${i + 1} — ${blockLabel(b.type)}`)) return; setBlocks(blocks.filter((x) => x.id !== id)); onClose() }}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </footer>
      )}
      {pickingFont && (
        <FontPicker
          value={look.font ?? ''}
          theme={fontById(page.theme.font)?.css ?? FONTS[0].css}
          onPick={(id) => { setLook({ font: (id || undefined) as NonNullable<Block['look']>['font'] }); setPickingFont(false) }}
          onClose={() => setPickingFont(false)}
        />
      )}
    </div>
  )
}

/** Every block on every store page, for finding one by id. */
function allBlocks(page: Page): Block[] {
  return storePages(page).flatMap((pg) => pg.blocks)
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
    case 'featured': {
      const slides = slidesOf(b)
      if (!slides.length) return 'Empty — drag a product in'
      if (slides.length > 1) return `${slides.length} slides (carousel)`
      const one = slides[0]
      if (one.kind === 'affiliate') return `Affiliate: ${one.affiliate.title || one.affiliate.url || 'no link yet'}`
      return one.productId ? title(one.productId) : 'No product chosen'
    }
    case 'grid': return `${(d.productIds ?? []).length} product(s)`
    case 'faq': return `${(d.items ?? []).length} question(s)`
    case 'tiktok': return `${(d.videos ?? []).length} video(s)`
    case 'email': return d.email || 'No email yet'
    case 'divider': return d.style === 'dots' ? 'Dots' : d.style === 'space' ? 'Space' : 'Line'
    case 'footer': return d.text || 'Footer'
  }
}

/**
 * Editor for a product block's slides. One slide shows on its own; two or more
 * become a carousel. Digital and affiliate settings are kept side by side, so
 * switching a slide's type never loses the product, file or cover.
 */
function SlidesEditor({ slides, products, blockId, onChange, onOpenProduct, onSetProductType, onAddSlide, onAddEmptySlide, activeSlide, onActiveSlideChange }: { slides: ProductSlide[]; products: DraftProduct[]; blockId: string; onChange: (s: ProductSlide[]) => void; onOpenProduct?: (id: string) => void; onSetProductType?: (id: string, type: ProductType, amazonUrl?: string) => void; onAddSlide?: (blockId: string, slideIndex: number) => void; onAddEmptySlide?: (blockId: string, slideIndex: number) => void; activeSlide?: number; onActiveSlideChange?: (i: number) => void }) {
  const set = (i: number, patch: Partial<ProductSlide>) => onChange(slides.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const setAff = (i: number, patch: Partial<ProductSlide['affiliate']>) => onChange(slides.map((s, j) => (j === i ? { ...s, affiliate: { ...s.affiliate, ...patch } } : s)))
  const [active, setActive] = useState(0)
  // The studio owns the active slide. Keep a local value only for callers with
  // no prop. The index can point at an empty preview slot beyond `slides`; that
  // is rendered below instead of being silently clamped away.
  const a = Math.max(0, Math.min(activeSlide ?? active, MAX_PRODUCT_SLIDES - 1))
  const setActiveIdx = (i: number) => { setActive(i); onActiveSlideChange?.(i) }
  const s = slides[a] ?? null
  const problem = s && s.kind === 'affiliate' && s.affiliate.url.trim() && !amazonUrlCheck(s.affiliate.url).ok ? AMAZON_LINK_ERROR : null
  const changeKind = (kind: ProductSlide['kind']) => {
    if (s?.kind === kind) return
    if (s?.productId) onSetProductType?.(s.productId, kind === 'affiliate' ? 'affiliate' : 'normal', kind === 'affiliate' ? s.affiliate.url : undefined)
    set(a, { kind })
  }
  return (
    <div className="sb-edit">
      <span className="ss-label">Swipe: product 1, 2 and 3</span>
      <p className="ss-muted" style={{ marginTop: 0 }}>Each slot is one product in the swipe on your phone. Tap a slot to see or change it.</p>
      <div role="tablist" aria-label="Slides" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
        {Array.from({ length: Math.max(3, slides.length) }, (_, i) => {
          const sl = slides[i]
          const name = !sl ? 'Empty' : sl.kind === 'affiliate' ? (sl.affiliate?.title?.trim() || 'Affiliate') : (products.find((x) => x.id === sl.productId)?.title?.trim() || (sl.productId ? 'Untitled product' : 'Empty'))
          return (
            <button key={sl?.id ?? `empty-${i}`} type="button" role="tab" aria-selected={i === a} className={cn('ss-ghost', i === a && 'on')} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0, borderStyle: sl ? undefined : 'dashed' }} onClick={() => setActiveIdx(i)}>
              <b style={{ fontSize: 12 }}>Product {i + 1}</b>
              <small style={{ fontSize: 11, opacity: 0.7, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</small>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {slides.length >= 3 && slides.length < MAX_PRODUCT_SLIDES && (onAddEmptySlide ?? onAddSlide) && (
          <button type="button" className="ss-ghost" onClick={() => (onAddEmptySlide ?? onAddSlide)!(blockId, slides.length)}>+ Add product slide</button>
        )}
      </div>
      {!s && (
        <div className="sld-card">
          <div className="sld-head">
            <span className="sld-num" aria-hidden="true">{a + 1}</span>
            <span className="ss-label">Product {a + 1} is empty</span>
          </div>
          <p className="ss-muted">Add a product here and it shows as product {a + 1} in the swipe.</p>
          {onAddSlide && (
            <button type="button" className="ss-ghost self-start" onClick={() => onAddSlide(blockId, a)}>+ Add product</button>
          )}
        </div>
      )}
      {s && (
        <div className="sld-card" key={s.id}>
          <div className="sld-head">
            <span className="sld-num" aria-hidden="true">{a + 1}</span>
            {s.kind === 'digital' ? (
              <span className="sld-kind-static" aria-label={`Slide ${a + 1} type`}>Digital product</span>
            ) : (
              <div className="sld-kinds" role="group" aria-label={`Slide ${a + 1} type`}>
                <button type="button" aria-pressed={false} onClick={() => changeKind('digital')}>Digital product</button>
                <button type="button" aria-pressed={true} className="on" onClick={() => changeKind('affiliate')}>Affiliate</button>
              </div>
            )}
            <button type="button" className="ss-ghost" aria-label={`Remove slide ${a + 1}`} onClick={() => { onChange(slides.filter((_, j) => j !== a)); setActive(0); onActiveSlideChange?.(0) }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {s.kind === 'digital' ? (
            <Field label="Product">
              {products.length === 0 ? (
                <p className="ss-muted">Create a product in the Products tab first.</p>
              ) : (
                <select className="ss-input" aria-label={`Product for slide ${a + 1}`} value={s.productId ?? ''} onChange={(e) => { const id = e.target.value || null; set(a, { productId: id }); if (id) onSetProductType?.(id, 'normal') }}>
                  <option value="">Choose a product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title.trim() || 'Untitled product'}</option>)}
                </select>
              )}
            </Field>
          ) : (
            <>
              <Field label="Amazon product link" hint="Amazon marketplace product pages and short links only.">
                <input className="ss-input" inputMode="url" value={s.affiliate.url} onChange={(e) => { setAff(a, { url: e.target.value }); if (s.productId) onSetProductType?.(s.productId, 'affiliate', e.target.value) }} placeholder="https://www.amazon.co.uk/dp/B0..." />
              </Field>
              {problem && <span className="sld-err" role="alert">{problem}</span>}
              <Field label="Title"><input className="ss-input" maxLength={80} value={s.affiliate.title} onChange={(e) => setAff(a, { title: e.target.value })} /></Field>
              <Field label="Description (optional)"><textarea className="ss-input" rows={2} maxLength={500} value={s.affiliate.description} onChange={(e) => setAff(a, { description: e.target.value })} /></Field>
              <Field label="Cover image"><ImagePicker value={s.affiliate.cover} onChange={(v) => setAff(a, { cover: v })} label="Upload cover" /></Field>
              <Field label="Button text" hint="Empty hides the button; the cover still opens the link.">
                <input className="ss-input" maxLength={40} value={s.affiliate.cta} onChange={(e) => setAff(a, { cta: e.target.value })} placeholder={DEFAULT_AMAZON_CTA} />
              </Field>
              <p className="sld-note">Payments and delivery are handled by the external website. Commission depends on your affiliate programme and tracking link.</p>
            </>
          )}
          {s.kind === 'digital' && s.productId && onOpenProduct && (
            <button type="button" className="ss-ghost self-start" onClick={() => onOpenProduct(s.productId!)}>Edit this product</button>
          )}
        </div>
      )}
      <p className="ss-muted">Your visitors swipe left and right between these products.</p>
    </div>
  )
}


function BlockEditor({ block, products, update, onOpenProduct, onSetProductType, onAddBelow, onAddSlide, onAddEmptySlide, activeSlide, onActiveSlideChange }: { block: Block; products: DraftProduct[]; update: (d: Record<string, unknown>) => void; onOpenProduct?: (id: string) => void; onSetProductType?: (id: string, type: ProductType, amazonUrl?: string) => void; onAddBelow?: (blockId: string) => void; onAddSlide?: (blockId: string, slideIndex: number) => void; onAddEmptySlide?: (blockId: string, slideIndex: number) => void; activeSlide?: number; onActiveSlideChange?: (i: number) => void }) {
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
    case 'tiktok': {
      const vids: string[] = d.videos ?? []
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={120} value={d.heading ?? ''} onChange={(e) => update({ heading: e.target.value })} /></Field>
          {vids.map((u, i) => (
            <div key={i} className="sb-pair">
              <input className="ss-input" aria-label={`TikTok video ${i + 1} link`} placeholder="https://www.tiktok.com/@you/video/…" value={u} onChange={(e) => update({ videos: vids.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="ss-ghost" aria-label={`Remove video ${i + 1}`} onClick={() => update({ videos: vids.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {vids.length < 6 && <button type="button" className="ss-ghost self-start" onClick={() => update({ videos: [...vids, ''] })}><Plus className="h-3.5 w-3.5" /> Add a TikTok video link</button>}
          <p className="ss-muted">Copy the link from TikTok (Share → Copy link). Up to 6 videos.</p>
        </div>
      )
    }
    case 'divider':
      return (
        <div className="sb-edit">
          <div className="fe-seg" role="group" aria-label="Divider style">
            {(['line', 'dots', 'space'] as const).map((st) => <button key={st} type="button" aria-pressed={(d.style ?? 'line') === st} onClick={() => update({ style: st })}>{st}</button>)}
          </div>
        </div>
      )
    case 'email':
      return (
        <div className="sb-edit">
          <Field label="Heading"><input className="ss-input" maxLength={120} value={d.heading ?? ''} onChange={(e) => update({ heading: e.target.value })} /></Field>
          <Field label="Your support email"><input className="ss-input" type="email" maxLength={254} value={d.email ?? ''} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" /></Field>
          <Field label="Short note"><input className="ss-input" maxLength={300} value={d.note ?? ''} onChange={(e) => update({ note: e.target.value })} /></Field>
          <Field label="Button text"><input className="ss-input" maxLength={40} value={d.button ?? ''} onChange={(e) => update({ button: e.target.value })} /></Field>
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
        <>
          {onAddBelow && (
            <button type="button" className="ss-ghost self-start" onClick={() => onAddBelow(block.id)}><Plus className="h-3.5 w-3.5" /> Add product below</button>
          )}
          <SlidesEditor
            slides={slidesOf(block)}
            products={products}
            blockId={block.id}
            onChange={(slides) => update({ slides, productId: primaryProductId(slides) })}
            onOpenProduct={onOpenProduct}
            onSetProductType={onSetProductType}
            onAddSlide={onAddSlide}
            onAddEmptySlide={onAddEmptySlide}
            activeSlide={activeSlide}
            onActiveSlideChange={onActiveSlideChange}
          />
        </>
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
  const [pickingFont, setPickingFont] = useState(false)
  const theme = page.theme
  const setTheme = (t: Partial<Page['theme']>) => onChange({ ...page, theme: { ...theme, ...t } })
  const themeFont = fontById(theme.font) ?? FONTS[0]
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
              <button type="button" className="ss-input ss-fontpick" aria-label="Store font" onClick={() => setPickingFont(true)}>
                <span style={{ fontFamily: themeFont.css }}>{themeFont.label}</span>
              </button>
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
      {pickingFont && (
        <FontPicker
          value={theme.font}
          theme={FONTS[0].css}
          onPick={(id) => { setTheme({ font: id || theme.font || 'geist' }); setPickingFont(false) }}
          onClose={() => setPickingFont(false)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------- products --- */

function ProductsEditor({ inlineText, store, setStore, open, setOpen, focus, onFocus, onPreview, onAddSlot, onAddSlideAt, onRemoveSlide, onPlaceNew, backToCarousel, onBackToCarousel }: { inlineText?: { productId: string; field: 'title' | 'desc'; value: string; n: number } | null; store: StoreView; setStore: (s: StoreView) => void; open: string | null; setOpen: (id: string | null) => void; focus?: { productId: string; part: CardPart } | null; onFocus?: (f: { productId: string; part: CardPart } | null) => void; onPreview?: (productId: string, value: PartDraft) => void; onAddSlot?: (pageIndex: number, blockIndex: number) => void; onAddSlideAt?: (blockId: string, slideIndex: number) => void; onRemoveSlide?: (pageIndex: number, blockId: string, slideIndex: number) => void; onPlaceNew?: (blockId: string, slideIndex: number, productId: string) => void; backToCarousel?: boolean; onBackToCarousel?: () => void }) {
  const [err, setErr] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  // Switching between the list and a product is a view change, so the panel
  // starts at the top instead of staying where the list was scrolled to.
  useEffect(() => {
    if (!open) return
    let node: HTMLElement | null = panel.current?.parentElement ?? null
    while (node) {
      if (node.scrollHeight > node.clientHeight + 1) { node.scrollTop = 0; break }
      node = node.parentElement
    }
  }, [open])

  // "Add Product" first asks which kind: a digital product or an affiliate link.
  const [choosing, setChoosing] = useState(false)
  const add = async (kind: ProductType = 'normal') => {
    setChoosing(false)
    try {
      await flushSellerEdits()
      let r = await sellerApi.addProduct({ title: '', priceMinor: 900, currency: 'gbp' })
      if (kind === 'affiliate') {
        const x = withExtras(r.product.extras)
        r = await sellerApi.updateProduct(r.product.id, { extras: { ...x, productType: 'affiliate', affiliate: { ...x.affiliate, cta: x.affiliate?.cta || DEFAULT_AMAZON_CTA, disclosure: x.affiliate?.disclosure || DEFAULT_AFFILIATE_DISCLOSURE } } }, r.product.revision)
      }
      setStore(r.store)
      // A product on its own is invisible on the store. Put it straight into the
      // next free slide of the first product block, so it shows in the phone at once.
      const pagesNow = storePages(r.store.draft)
      const blockWithRoom = (pagesNow[0]?.blocks ?? [])
        .filter((b) => b.type === 'featured' || b.type === 'grid')
        .find((b) => slidesOf(b).length < 3)
      if (blockWithRoom && onPlaceNew) {
        onPlaceNew(blockWithRoom.id, slidesOf(blockWithRoom).length, r.product.id)
      } else {
        setOpen(r.product.id)
      }
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const choose = (id: string | null) => { onFocus?.(null); void flushSellerEdits().then(() => setOpen(id)).catch((e: Error) => setErr(e.message)) }

  // Two mutually exclusive views: the product list, or one product's full editor.
  // Never both — the editor replaces the list instead of sitting under it.
  const selected = open ? store.products.find((p) => p.id === open) ?? null : null
  if (selected) {
    return (
      <div className="ss-stack" ref={panel}>
        <div className="pg-bar">
          {backToCarousel && onBackToCarousel ? (
            <button type="button" className="pg-back" onClick={onBackToCarousel}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to carousel
            </button>
          ) : (
            <button type="button" className="pg-back" onClick={() => choose(null)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to Products
            </button>
          )}
          <span className="pg-state">{selected.archived ? 'Archived' : selected.published ? 'Live' : 'Draft'}</span>
        </div>
        {focus?.productId === selected.id ? (
          <ProductPartPanel
            key={`${selected.id}.${focus.part}`}
            product={selected}
            store={store}
            setStore={setStore}
            part={focus.part}
            inlineText={inlineText}
            onPart={(part) => onFocus?.({ productId: selected.id, part })}
            onClose={() => { onFocus?.(null); if (backToCarousel && onBackToCarousel) onBackToCarousel(); else choose(null) }}
            onFull={() => onFocus?.(null)}
            onPreview={(value) => onPreview?.(selected.id, value)}
          />
        ) : (
          <ProductForm
            key={selected.id}
            product={selected}
            store={store}
            setStore={setStore}
            onDeleted={() => setOpen(null)}
            onEditParts={() => onFocus?.({ productId: selected.id, part: 'card' })}
          />
        )}
      </div>
    )
  }

  const pages = storePages(store.draft)
  const selIdx = 0
  const selPage = pages[0]
  const productBlocks = (selPage?.blocks ?? []).filter((b) => b.type === 'featured' || b.type === 'grid')

  const unplaced = store.products.filter((p) => !p.archived && !pages.some((pg) => pg.blocks.some((b) => (b.type === 'featured' || b.type === 'grid') && slidesOf(b).some((sl) => sl.kind === 'digital' && sl.productId === p.id))))

  return (
    <div className="ss-stack">
      <div className="pg-bar">
        <h2>Products <small>{store.products.filter((p) => !p.archived).length}</small></h2>
        <button type="button" className="pg-addbtn" onClick={() => setChoosing(true)}><Plus className="h-4 w-4" /> Add Product</button>
      </div>
      {choosing && (
        <div className="ab-back" onMouseDown={(e) => e.target === e.currentTarget && setChoosing(false)}>
          <div className="ab ab-slim" role="dialog" aria-modal="true" aria-label="Choose product type">
            <header className="ab-head">
              <h2>What are you adding?</h2>
              <button type="button" className="ab-x" onClick={() => setChoosing(false)} aria-label="Close"><CloseIcon className="h-4 w-4" /></button>
            </header>
            <div className="ab-body ab-body-pick">
              <section className="ab-main">
                <div className="ab-grid ab-grid-pick">
                  <button type="button" className="ab-item" onClick={() => void add('normal')}>
                    <span className="ab-thumb"><Package className="h-5 w-5" /></span>
                    <span><b>Digital product</b><small>Sell a file buyers download</small></span>
                  </button>
                  <button type="button" className="ab-item" onClick={() => void add('affiliate')}>
                    <span className="ab-thumb"><Globe className="h-5 w-5" /></span>
                    <span><b>Affiliate</b><small>Link to a product on Amazon</small></span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {err && <div className="ss-note" role="alert">{err}</div>}

      {/* Product blocks on the selected page. */}
      {productBlocks.map((block, bi) => {
        const slides = slidesOf(block)
        return (
          <section key={bi} className="sb-block" style={{ marginBottom: 10 }}>
            <div className="sb-row">
              <span className="sb-ico" aria-hidden="true">{bi + 1}</span>
              <span className="sb-title"><b>Product {bi + 1}</b><small>{block ? `${slides.length} slide${slides.length === 1 ? '' : 's'}` : 'Empty slot'}</small></span>
            </div>
            <div className="pg-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {[0, 1, 2].map((si) => {
                const slide = slides[si]
                const populated = !!slide && (slide.kind === 'digital' ? Boolean(slide.productId) : Boolean(slide.affiliate.url))
                if (populated) {
                  const prod = slide.kind === 'digital' ? store.products.find((p) => p.id === slide.productId) : null
                  const cover = slide.kind === 'digital' ? mediaUrl(prod?.cover) : mediaUrl(slide.affiliate.cover)
                  const title = slide.kind === 'digital' ? (prod?.title?.trim() || 'Untitled product') : (slide.affiliate.title?.trim() || 'Affiliate product')
                  const price = slide.kind === 'digital' ? (prod ? (prod.priceMinor === 0 ? 'Free' : formatPrice(prod.priceMinor, prod.currency)) : '') : 'Affiliate'
                  return (
                    <div key={slide.id} className="pg-card" style={{ cursor: 'default' }}>
                      <button type="button" className="pg-card" style={{ width: '100%', border: 0, background: 'transparent', padding: 0 }} onClick={() => slide.kind === 'digital' && slide.productId ? choose(slide.productId) : undefined} aria-label={`Edit ${title}`}>
                        <span className="pg-img" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>{!cover && <Package className="h-6 w-6" />}</span>
                        <span className="pg-name">{title}</span>
                        <span className="pg-meta">{slide.kind === 'affiliate' ? 'Affiliate' : 'Digital'} · {price}</span>
                      </button>
                      {block && (
                        <div style={{ display: 'flex', gap: 4, padding: '4px 6px 6px' }}>
                          <button type="button" className="ss-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => slide.kind === 'digital' && slide.productId ? choose(slide.productId) : undefined}>Edit</button>
                          <button type="button" className="ss-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onRemoveSlide?.(selIdx, block.id, si)}>Remove</button>
                        </div>
                      )}
                    </div>
                  )
                }
                // An empty slot keeps its own "Add product" placeholder, so the
                // block always offers its three slides (Product 3 included).
                if (slides.length === 0 && si > 0) return null
                return (
                  <button
                    key={`empty-${block.id}-${si}`}
                    type="button"
                    className="pg-card"
                    style={{ display: 'grid', placeItems: 'center', minHeight: 120, border: '1.5px dashed #d6d4cf', background: '#fafaf8' }}
                    onClick={() => (onAddSlideAt ? onAddSlideAt(block.id, si) : onAddSlot?.(0, bi))}
                    aria-label="Add product"
                  >
                    <span style={{ fontSize: 22, opacity: 0.5 }}>+</span>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>Add product</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      {productBlocks.length < MAX_PRODUCT_BLOCKS_PER_PAGE && (
        <button type="button" className="bl-add" style={{ width: '100%', marginTop: 6 }} onClick={() => onAddSlot?.(0, productBlocks.length)}><Plus className="h-4 w-4" /> Add product block</button>
      )}

      {/* Product library: unplaced products. */}
      <details className="pg-archived" open={unplaced.length > 0 && store.products.filter((p) => !p.archived).length <= 6}>
        <summary>Product library ({unplaced.length} unplaced)</summary>
        <div className="pg-grid">
          {unplaced.map((p) => {
            const cover = mediaUrl(p.cover)
            return (
              <button key={p.id} type="button" className="pg-card" onClick={() => choose(p.id)} aria-label={`Edit ${p.title.trim() || 'Untitled product'}`}>
                <span className="pg-img" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>{!cover && <Package className="h-6 w-6" />}</span>
                <span className="pg-name">{p.title.trim() || 'Untitled product'}</span>
                <span className="pg-meta">{p.priceMinor === 0 ? 'Free' : formatPrice(p.priceMinor, p.currency)}{p.published ? ' · Live' : ' · Draft'}</span>
              </button>
            )
          })}
          {unplaced.length === 0 && <p className="ss-muted" style={{ gridColumn: '1 / -1' }}>All products are placed.</p>}
        </div>
      </details>

      {store.products.some((p) => p.archived && p.id !== open) && (
        <details className="pg-archived">
          <summary>Archived ({store.products.filter((p) => p.archived).length})</summary>
          <div className="pg-grid">
            {store.products.filter((p) => p.archived && p.id !== open).map((p) => (
              <button key={p.id} type="button" className="pg-card pg-card-arch" onClick={() => choose(p.id)}>
                <span className="pg-img" style={mediaUrl(p.cover) ? { backgroundImage: `url(${mediaUrl(p.cover)})` } : undefined}>{!p.cover && <Package className="h-6 w-6" />}</span>
                <span className="pg-name">{p.title.trim() || 'Untitled product'}</span>
                <span className="pg-meta">Archived</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}


function PSection({ icon, title, sub, children, open: start = false }: { icon: ReactNode; title: string; sub?: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start)
  return (
    <section className={cn('pe-sec', open && 'on')}>
      <button type="button" className="pe-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="pe-ico" aria-hidden="true">{icon}</span>
        <span className="pe-title"><b>{title}</b>{sub && <small>{sub}</small>}</span>
        <ChevronDown className="pe-chev h-4 w-4" aria-hidden="true" />
      </button>
      <div className="pe-body"><div className="pe-inner">{children}</div></div>
    </section>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cn('pe-switch', on && 'on')} onClick={() => onChange(!on)}><i /></button>
  )
}

const BADGE_COLOURS = ['#e11d48', '#f97316', '#16a34a', '#2563eb', '#7c3aed', '#111114']
const CTA_TEXTS = ['Buy now', 'Get Instant Access', 'Download Now']

/** The editable shape of a product: the fields the seller can change. */
type ProductFormState = {
  title: string
  description: string
  /**
   * The price exactly as the seller typed it. It stays a string while editing,
   * so "" / "0" / "0." / "0.1" are never quietly turned into a price — or into
   * a payment mode — behind the seller's back.
   */
  price: string
  /** The seller's explicit choice; only the Free/Paid selector changes it. */
  paymentType: PaymentType
  currency: string
  cover: string | null
  listed: boolean
  extras: ProductExtras
}

/** The saved payment mode. Older rows only carry a price, and a saved price is a valid one. */
const paymentModeOf = (p: DraftProduct): PaymentType => (p.paymentType === 'free' ? 'free' : p.paymentType === 'paid' ? 'paid' : p.priceMinor === 0 ? 'free' : 'paid')

/** One warning for both ways in: the product editor and the page builder. */
function confirmProductTypeChange(published: boolean, next: ProductType) {
  if (!published) return true
  return window.confirm(next === 'affiliate'
    ? 'Change this published product to an Amazon affiliate product? Buyers will stop buying and downloading it here. Existing orders and download links stay valid, and your price and file are kept but hidden until you switch back.'
    : 'Change this published affiliate product to a normal product? Buyers can buy it here again once you save a price and add a file. Your Amazon settings are kept but hidden until you switch back.')
}

const productForm = (p: DraftProduct): ProductFormState => ({
  title: p.title,
  description: p.description,
  price: (p.priceMinor / 100).toFixed(2),
  paymentType: paymentModeOf(p),
  currency: p.currency,
  cover: p.cover,
  listed: p.listed,
  extras: p.extras ?? DEFAULT_EXTRAS,
})

function ProductForm({ product, store, setStore, onDeleted, onEditParts }: { product: DraftProduct; store: StoreView; setStore: (s: StoreView) => void; onDeleted: () => void; onEditParts?: () => void }) {
  const [state, setState] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [linkTest, setLinkTest] = useState<{ ok: boolean; message: string } | null>(null)
  const saved = useSellerSave(`desknoty.seller.recovery.${store.id}.${product.id}`, productForm(product), product.revision, async (value, revision, token) => {
    // The mode comes from the selector, never from the typed digits. A paid
    // product with an unfinished price is a validation error: nothing is saved,
    // so the last valid price stays on the server instead of becoming Free.
    // A recovery value written by an older build has no mode: the saved
    // product's explicit choice is the only safe one to carry forward.
    const mode: PaymentType = value.paymentType === 'free' ? 'free' : value.paymentType === 'paid' ? 'paid' : paymentModeOf(product)
    const typed = parsePriceInput(value.price)
    if (mode === 'paid' && (typed === null || typed <= 0)) {
      throw new Error(typed === null ? 'Enter a price for this paid product, or switch it to free.' : 'A paid product needs a price above 0. Switch it to free if it is free.')
    }
    const link = String(value.extras?.affiliate?.url ?? '').trim()
    if (productTypeOf(value.extras) === 'affiliate' && link && !amazonUrlCheck(link).ok) throw new Error(AMAZON_LINK_ERROR)
    const r = await sellerApi.updateProduct(product.id, { ...value, paymentType: mode, priceMinor: mode === 'free' ? 0 : (typed as number) }, revision, token)
    setStore(r.store)
    return r.product.revision
  }, async () => {
    // The server's own product, used to settle a clash without losing the newer edit.
    const r = await sellerApi.store(true)
    const p = r?.store?.products.find((x) => x.id === product.id)
    if (!r?.store || !p) throw new Error('The product could not be reloaded.')
    setStore(r.store)
    return { value: productForm(p), revision: p.revision }
  })
  const form = saved.value
  const setForm = saved.edit
  const x: ProductExtras = withExtras(form.extras)
  const ptype: ProductType = productTypeOf(x)
  const affiliate = ptype === 'affiliate'
  const linkInput = String(x.affiliate?.input ?? x.affiliate?.url ?? '')
  const linkCheck = linkInput.trim() ? amazonUrlCheck(linkInput) : null
  const linkProblem = !linkInput.trim() ? 'Add an Amazon product link before publishing.' : linkCheck?.ok ? null : AMAZON_LINK_ERROR
  const switchType = (next: ProductType) => {
    if (next === ptype) return
    if (!confirmProductTypeChange(product.published, next)) return
    setLinkTest(null)
    setX({
      productType: next,
      affiliate: {
        ...x.affiliate,
        input: x.affiliate?.input ?? x.affiliate?.url ?? '',
        cta: x.affiliate?.cta || DEFAULT_AMAZON_CTA,
        disclosure: x.affiliate?.disclosure || DEFAULT_AFFILIATE_DISCLOSURE,
      },
    })
  }
  const testLink = async () => {
    setLinkTest(null)
    try {
      const r = await sellerApi.checkAmazonUrl(linkInput)
      setLinkTest({ ok: true, message: `Valid Amazon link${r.short ? ' (destination checked)' : ''}.` })
    } catch (e) {
      setLinkTest({ ok: false, message: (e as Error).message || AMAZON_LINK_ERROR })
    }
  }
  // The server returns the card settings it actually stored. An API without Store V2 drops them,
  // so their absence means these controls can't save anything yet.
  const v2 = Boolean(product.extras && 'layout' in product.extras)
  // Stage B: the server stores the offer's timezone; an older API doesn't
  const v2b = Boolean(product.extras && 'tz' in (product.extras.offer ?? {}))
  // Stage C: the server stores bundle/related lists; an older API doesn't
  const v2c = Boolean(product.extras && 'bundle' in product.extras)
  const setX = (n: Partial<ProductExtras>) => setForm({ ...form, extras: { ...x, ...n } })
  const setOffer = (n: Partial<ProductExtras['offer']>) => setX({ offer: { ...x.offer, ...n } })

  const sym = CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '£'
  // The short id is created with the product and never changes on edit or
  // republish. Older rows without one keep their original address.
  const siteOrigin = (() => { try { return new URL(store.url).origin } catch { return store.url.replace(/\/$/, '') } })()
  const productLink = product.shortId ? `${siteOrigin}/p/${product.shortId}` : `${store.url}/p/${product.id}`
  const copyProductLink = () => void copyToClipboard(productLink).then((ok) => { if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1500) } })
  // The mode is explicit: typing 0 (or clearing the field) never flips it.
  // A recovered value from an older build has no mode; the saved product's mode
  // wins there, because its price is a valid saved price.
  const mode: PaymentType = form.paymentType === 'free' ? 'free' : form.paymentType === 'paid' ? 'paid' : paymentModeOf(product)
  const free = mode === 'free'
  const typedMinor = parsePriceInput(form.price)
  // Until a valid price is typed, keep showing/saving the last valid saved one.
  const priceMinor = typedMinor ?? product.priceMinor
  const priceError = free || (typedMinor !== null && typedMinor > 0)
    ? null
    : typedMinor === null
      ? 'Enter a price'
      : 'A paid product needs a price above 0'
  // live preview of the offer (the server works out the real price at checkout)
  // same rounding as the server: half up to the nearest penny, integers only
  const off = x.offer.kind === 'percent' ? Math.floor((priceMinor * Math.min(95, x.offer.value) + 50) / 100) : Math.min(priceMinor, x.offer.value)
  const sale = Math.max(0, priceMinor - off)
  const pct = priceMinor > 0 ? Math.round((1 - sale / priceMinor) * 100) : 0
  const offerLive = x.offer.on && !free && priceMinor > 0 && sale < priceMinor
  const badgeText = x.offer.badge === 'PERCENT' ? `${pct}% OFF` : x.offer.badge
  const vis: 'draft' | 'published' | 'hidden' = !form.listed ? 'draft' : x.hidden ? 'hidden' : 'published'
  const setVis = (v: typeof vis) => setForm({ ...form, listed: v !== 'draft', extras: { ...x, hidden: v === 'hidden' } })
  const fmt = (m: number) => formatPrice(m, form.currency)
  const cardPreview: ShopProduct = {
    ...x,
    productType: ptype,
    id: product.id,
    shortId: product.shortId,
    title: form.title.trim() || 'Untitled product',
    description: form.description,
    cover: form.cover,
    priceMinor,
    paymentType: mode,
    currency: form.currency,
    offer: offerLive ? { priceMinor: sale, percent: pct, badge: badgeText, badgeColor: x.offer.badgeColor, ends: x.offer.ends } : null,
    fileType: product.file ? (product.file.name.split('.').pop() ?? '').toUpperCase() || null : null,
    bundle: x.bundle.length ? { items: x.bundle.map((id) => ({ id, title: store.products.find((q) => q.id === id)?.title ?? '' })), available: x.bundle.length >= 2 } : null,
    sample: product.sample ?? null,
    affiliate: x.affiliate,
  }

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await flushSellerEdits(); await fn() } catch (e) { setState((e as Error).message) } setBusy(false) }

  return (
    <div className="pe">
      <div className="pe-top">
        <span className="pe-thumb" style={mediaUrl(form.cover) ? { backgroundImage: `url(${mediaUrl(form.cover)})` } : undefined}>{!form.cover && <Package className="h-5 w-5" />}</span>
        <div className="pe-topname">
          <b>{form.title.trim() || 'Untitled product'}</b>
          <span className={cn('pe-pill', `pe-pill-${product.problem ? 'warn' : vis}`)}>{product.problem ? 'Needs attention' : vis === 'draft' ? 'Draft' : vis === 'hidden' ? 'Hidden' : product.published ? (product.changed ? 'Live · unpublished changes' : 'Published') : 'Ready to publish'}</span>
        </div>
        <span className="pe-saved" aria-live="polite">{state ?? saved.state}</span>
      </div>
      {saved.conflict && (
        <p className="ss-s2note" role="alert">
          This product changed somewhere else, so it was not overwritten. Your edits are still here.{' '}
          <button type="button" className="underline" onClick={() => void saved.flush().catch(() => {})}>Try again</button>{' '}
          <button type="button" className="underline" onClick={() => void saved.discard().catch((e: Error) => setState(e.message))}>Take the newer version</button>
        </p>
      )}

      {affiliate ? (
        <div className="pe-type" role="radiogroup" aria-label="Product type">
          <button type="button" role="radio" aria-checked={false} aria-pressed={false} onClick={() => switchType('normal')}>
            <Package className="h-4 w-4" aria-hidden="true" /><span><b>Normal Product</b><small>Price, Stripe checkout and file delivery</small></span>
          </button>
          <button type="button" role="radio" aria-checked={true} aria-pressed={true} onClick={() => switchType('affiliate')}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" /><span><b>Affiliate Product</b><small>Amazon products, no Desknoty payment</small></span>
          </button>
        </div>
      ) : (
        <div className="pe-type pe-type-static" aria-label="Product type">
          <div>
            <Package className="h-4 w-4" aria-hidden="true" /><span><b>Normal Product</b><small>Price, Stripe checkout and file delivery</small></span>
          </div>
        </div>
      )}
      {product.published && <p className="ss-hint pe-type-note">Changing the type of a published product affects checkout and delivery. Existing orders and download access are never removed.</p>}

      <PSection icon={<Package className="h-4 w-4" />} title="Product details" sub={affiliate ? 'Title, description and category' : 'Title, description and category'} open>
        <Field label="Title"><input className="ss-input" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={affiliate ? 'e.g. Wireless headphones review pick' : 'e.g. Content planner template'} /></Field>
        <Field label="Description"><textarea className="ss-input" rows={4} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={affiliate ? 'Why you recommend this product' : 'What buyers get, in a few lines'} /></Field>
        <Field label="Category" hint="Shared by both product types."><input className="ss-input" maxLength={80} value={x.category} onChange={(e) => setX({ category: e.target.value })} placeholder="e.g. Stationery, Tech, Home" /></Field>
        {!affiliate && (
        <fieldset className="pe2-v2" disabled={!v2}>
          {!v2 && <p className="pe2-unavail" role="status">Not available yet: the live Desknoty API hasn’t been updated for these settings, so they can’t be saved. They’ll switch on once the API is deployed.</p>}
        <Field label="Subtitle" hint="One short line on the card, about the benefit."><input className="ss-input" maxLength={100} value={x.subtitle} onChange={(e) => setX({ subtitle: e.target.value })} placeholder="e.g. Plan a month of posts in one afternoon" /></Field>
        <div className="ss-grid2">
          <Field label="File format" hint={product.file ? `Detected: ${(product.file.name.split('.').pop() ?? '').toUpperCase()}` : undefined}><input className="ss-input" maxLength={40} value={x.format} onChange={(e) => setX({ format: e.target.value })} placeholder="e.g. PDF, Notion template" /></Field>
          <Field label="Access"><input className="ss-input" maxLength={100} value={x.access} onChange={(e) => setX({ access: e.target.value })} placeholder="e.g. Instant download, lifetime updates" /></Field>
        </div>
        <Field label="What’s included"><LinesEditor label="Included item" items={x.included} onChange={(included) => setX({ included })} placeholder="e.g. 30 caption templates" /></Field>
        <Field label="FAQ (optional)"><FaqEditor items={x.faq} onChange={(faq) => setX({ faq })} /></Field>
        {v2c && (
          <>
            <Field label="Bundle" hint="Tick 2 or more products to sell them together. Buyers get every file; a bundle needs no file of its own.">
              <ProductPicker label="Bundle contents" value={x.bundle} onChange={(bundle) => setX({ bundle })} empty="Add other products first to make a bundle." options={store.products.filter((o) => o.id !== product.id && !o.archived && !(o.extras?.bundle?.length)).map((o) => ({ id: o.id, title: o.title, note: o.file ? undefined : 'needs a file' }))} />
            </Field>
            <Field label="Related products" hint="Shown under “You might also like”.">
              <ProductPicker label="Related products" value={x.related} onChange={(related) => setX({ related: related.slice(0, 6) })} empty="Your other products will show here." options={store.products.filter((o) => o.id !== product.id && !o.archived).map((o) => ({ id: o.id, title: o.title }))} />
            </Field>
          </>
        )}
        </fieldset>
        )}
      </PSection>

      {!affiliate && (
        <PSection icon={<Upload className="h-4 w-4" />} title="Digital delivery" sub={product.file ? product.file.name : 'No file uploaded yet'} open>
          <div className="ss-field">
            <span className="ss-label">File buyers download</span>
            <div className="pe-file">
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span className="ss-file">{product.file ? `${product.file.name} · ${(product.file.size / 1024 / 1024).toFixed(2)} MB` : 'No file yet'}</span>
              <label className="ss-ghost cursor-pointer">
                {uploading ? 'Uploading…' : product.file ? 'Replace' : 'Upload'}
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
            <span className="ss-hint">Up to {MAX_PRODUCT_FILE_MB} MB. Kept private. Buyers only get expiring access after paying.</span>
          </div>
        </PSection>
      )}

      {affiliate && (
        <PSection icon={<Link2 className="h-4 w-4" />} title="Product link" sub={linkProblem ?? 'Amazon destination ready'} open>
          <Field label="Amazon product URL" hint="Amazon marketplace product pages and Amazon short links only. Associates tags are kept.">
            <input
              className="ss-input"
              aria-label="Amazon product URL"
              inputMode="url"
              value={linkInput}
              onChange={(e) => { const checked = amazonUrlCheck(e.target.value); setLinkTest(null); setX({ affiliate: { ...x.affiliate, input: e.target.value, url: checked.ok ? checked.url : '' } }) }}
              placeholder="https://www.amazon.co.uk/dp/B0..."
            />
          </Field>
          <div className="pe-row pe-aff-status">
            <span className={cn('pe-pill', linkProblem ? 'pe-pill-warn' : 'pe-pill-published')} role="status">
              {linkProblem ?? 'Valid Amazon product link'}
            </span>
            <button type="button" className="ss-ghost" disabled={!linkInput.trim() || busy} onClick={() => void testLink()}>Test link</button>
          </div>
          {linkTest && <p className="ss-hint" role="status">{linkTest.message}</p>}
          <Field label="Your Desknoty link" hint="Share this on Instagram, TikTok, WhatsApp or anywhere else. It stays the same when you edit or republish.">
            <div className="ss-row">
              <code className="ss-code">{productLink.replace(/^https?:\/\//, '')}</code>
              <button type="button" className="ss-ghost" aria-label={copied ? 'Copied' : 'Copy link'} onClick={copyProductLink}>
                <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </Field>
          <Field label="Affiliate button text" hint="Shown on your store instead of Buy now.">
            <div className="pe-chips">
              {AMAZON_CTA_PRESETS.map((t) => <button key={t} type="button" aria-pressed={(x.affiliate?.cta || DEFAULT_AMAZON_CTA) === t} onClick={() => setX({ affiliate: { ...x.affiliate, cta: t } })}>{t}</button>)}
            </div>
          </Field>
          <Field label="Or your own button text"><input className="ss-input" maxLength={40} aria-label="Affiliate button text" value={x.affiliate?.cta ?? ''} placeholder={DEFAULT_AMAZON_CTA} onChange={(e) => setX({ affiliate: { ...x.affiliate, cta: e.target.value } })} /></Field>
          <Field label="Affiliate disclosure" hint="Shown with the product on your store."><textarea className="ss-input" rows={2} value={x.affiliate?.disclosure ?? ''} onChange={(e) => setX({ affiliate: { ...x.affiliate, disclosure: e.target.value } })} placeholder={DEFAULT_AFFILIATE_DISCLOSURE} /></Field>
          <p className="ss-hint">Link checking confirms the destination only. It does not confirm stock, prices, or Amazon Associates approval. Payment and delivery happen on Amazon — no Desknoty order or download is created.</p>
        </PSection>
      )}

      <PSection icon={<ImageIcon className="h-4 w-4" />} title="Media & previews" sub={`${form.cover ? 'Cover' : 'No cover'}${x.gallery.length ? ` · ${x.gallery.length} image${x.gallery.length === 1 ? '' : 's'}` : ''}${x.video ? ' · video' : ''}`}>
        {v2 ? (
          <>
            <CoverEditor cover={form.cover} crop={x.crop} onCover={(cover) => setForm({ ...form, cover })} onCrop={(crop) => setX({ crop })} />
            <GalleryEditor gallery={x.gallery} video={x.video} onGallery={(gallery) => setX({ gallery })} onVideo={(video) => setX({ video })} />
            {v2c && <Field label="Free sample"><SampleEditor productId={product.id} sample={product.sample} onChanged={(p) => setStore({ ...store, products: store.products.map((o) => (o.id === p.id ? { ...o, sample: p.sample } : o)) })} /></Field>}
          </>
        ) : (
          <>
            <ImagePicker value={form.cover} onChange={(cover) => setForm({ ...form, cover })} label="Cover image" />
            <p className="pe2-unavail" role="status">Not available yet: the live Desknoty API hasn’t been updated for these settings, so they can’t be saved. They’ll switch on once the API is deployed.</p>
          </>
        )}
      </PSection>

      {!affiliate && (
      <PSection icon={<Link2 className="h-4 w-4" />} title="Product link" sub="Permanent shareable address" open>
        <Field label="Desknoty product URL" hint="This link opens the real product page with its images, description, price and secure checkout or download. It never redirects to Amazon.">
          <div className="ss-row">
            <code className="ss-code">{productLink.replace(/^https?:\/\//, '')}</code>
            <a className="ss-ghost" href={productLink} target="_blank" rel="noreferrer" aria-label="Preview product"><ExternalLink className="h-3.5 w-3.5" /> Preview product</a>
            <button type="button" className="ss-ghost" aria-label={copied ? 'Copied' : 'Copy link'} onClick={copyProductLink}>
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </Field>
        <p className="ss-hint">The address is created once and keeps working after edits and republishing. It starts working when your store is published.</p>
      </PSection>
      )}

      {!affiliate && (
      <PSection icon={<Tag className="h-4 w-4" />} title="Pricing & offers" sub={offerLive ? `${fmt(sale)} · ${badgeText}` : free ? 'Free' : fmt(priceMinor)} open>
        <div className="pe-row">
          <span className="pe-lbl">Free product</span>
          <Switch
            label="Free product"
            on={free}
            onChange={(on) => {
              // Only this switch changes the mode. Turning Free off with no valid
              // price starts from a normal paid price, never from a zero.
              if (on) return setForm({ ...form, paymentType: 'free' })
              const typed = parsePriceInput(form.price)
              setForm({ ...form, paymentType: 'paid', ...(typed === null || typed <= 0 ? { price: '9.00' } : {}) })
            }}
          />
        </div>
        {!free && (
          <div className="ss-grid2">
            <Field label="Regular price">
              <div className="ss-affix ss-affix-l"><span>{sym}</span><input className="ss-input" inputMode="decimal" aria-label="Price" aria-invalid={priceError ? true : undefined} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              {priceError && <span className="sld-err" role="alert">{priceError}</span>}
            </Field>
            <Field label="Currency">
              <select className="ss-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        {!free && (
          <div className={cn('pe-offer', x.offer.on && 'on')}>
            <div className="pe-row">
              <span className="pe-lbl"><Sparkles className="h-4 w-4" aria-hidden="true" /> Discount</span>
              <Switch label="Enable discount" on={x.offer.on} onChange={(on) => setOffer({ on })} />
            </div>
            {x.offer.on && (
              <>
                <div className="pe-seg" role="radiogroup" aria-label="Discount type">
                  <button type="button" role="radio" aria-checked={x.offer.kind === 'percent'} onClick={() => setOffer({ kind: 'percent', value: 20 })}>% off</button>
                  <button type="button" role="radio" aria-checked={x.offer.kind === 'amount'} onClick={() => setOffer({ kind: 'amount', value: Math.round(priceMinor / 4) })}>{sym} off</button>
                </div>
                <div className="ss-grid2">
                  <Field label={x.offer.kind === 'percent' ? 'Percent off' : 'Amount off'}>
                    <div className={cn('ss-affix', x.offer.kind === 'percent' ? 'ss-affix-r' : 'ss-affix-l')}>
                      {x.offer.kind === 'amount' && <span>{sym}</span>}
                      <input className="ss-input" inputMode="decimal" aria-label="Discount amount" value={x.offer.kind === 'percent' ? String(x.offer.value) : (x.offer.value / 100).toFixed(2)} onChange={(e) => { const v = Number(e.target.value.replace(/[^0-9.]/g, '')) || 0; setOffer({ value: x.offer.kind === 'percent' ? Math.min(95, Math.round(v)) : Math.min(priceMinor, Math.round(v * 100)) }) }} />
                      {x.offer.kind === 'percent' && <span>%</span>}
                    </div>
                  </Field>
                  <Field label="Sale price">
                    <div className="ss-affix ss-affix-l"><span>{sym}</span><input className="ss-input" inputMode="decimal" aria-label="Sale price" value={(sale / 100).toFixed(2)} onChange={(e) => { const v = Math.round((Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) * 100); setOffer({ kind: 'amount', value: Math.max(0, Math.min(priceMinor, priceMinor - v)) }) }} /></div>
                  </Field>
                </div>
                {v2b ? <OfferSchedule offer={x.offer} setOffer={setOffer} /> : (
                  <div className="ss-grid2">
                    <Field label="Starts (optional)"><input type="date" className="ss-input" value={x.offer.starts ?? ''} onChange={(e) => setOffer({ starts: e.target.value || null })} /></Field>
                    <Field label="Ends (optional)"><input type="date" className="ss-input" value={x.offer.ends ?? ''} onChange={(e) => setOffer({ ends: e.target.value || null })} /></Field>
                  </div>
                )}
                <div className="ss-field">
                  <span className="ss-label">Badge</span>
                  <div className="pe-chips">
                    {['PERCENT', 'SALE', 'Limited Offer', 'Launch Special'].map((b) => (
                      <button key={b} type="button" aria-pressed={x.offer.badge === b} onClick={() => setOffer({ badge: b })}>{b === 'PERCENT' ? `${pct}% OFF` : b}</button>
                    ))}
                  </div>
                  <div className="pe-colours" role="radiogroup" aria-label="Badge colour">
                    {BADGE_COLOURS.map((c) => <button key={c} type="button" role="radio" aria-checked={x.offer.badgeColor === c} aria-label={`Badge colour ${c}`} style={{ background: c }} onClick={() => setOffer({ badgeColor: c })} />)}
                  </div>
                </div>
              </>
            )}
            <div className="pe-preview" aria-label="How the price looks on your store">
              <span className="pe-prev-lbl">Storefront preview</span>
              <div className="pe-prev-row">
                {offerLive ? (
                  <>
                    <s>{fmt(priceMinor)}</s>
                    <b key={sale}>{fmt(sale)}</b>
                    <em key={badgeText + x.offer.badgeColor} style={{ background: x.offer.badgeColor }}>{badgeText}</em>
                  </>
                ) : <b>{fmt(priceMinor)}</b>}
              </div>
              {offerLive && <small>Buyers save {fmt(priceMinor - sale)}.{(x.offer.startsLocal || x.offer.endsLocal || x.offer.starts || x.offer.ends) ? ' Runs only inside its dates.' : ''}</small>}
            </div>
          </div>
        )}
        {!free && (
          <div className="ss-field">
            <span className="ss-label">Discount codes</span>
            <CouponsPanel currency={form.currency} products={store.products.filter((p) => !p.archived).map((p) => ({ id: p.id, title: p.title }))} />
          </div>
        )}
      </PSection>
      )}

      {!affiliate && (
        <PSection icon={<Landmark className="h-4 w-4" />} title="Checkout" sub="Stripe payments and private downloads">
          <p className="ss-hint">Buyers pay securely with Stripe. After payment they get secure, expiring access to the file above, and the order appears in your Orders tab. Checkout also needs a connected payout account in Payouts.</p>
        </PSection>
      )}

      {!affiliate && (
      <PSection icon={<LayoutGrid className="h-4 w-4" />} title="Card appearance" sub={`${v2 ? `${x.layout.charAt(0).toUpperCase()}${x.layout.slice(1)} · ` : ''}${x.cta.text || (free ? 'Get it free' : 'Buy now')}`}>
        {v2 ? <CardAppearance x={x} setX={setX} store={store} preview={cardPreview} buy={<BuyRow prod={cardPreview} page={store.draft} products={[]} handle={store.handle} small={x.layout === 'compact'} />} /> : <p className="pe2-unavail" role="status">Not available yet: the live Desknoty API hasn’t been updated for these settings, so they can’t be saved. They’ll switch on once the API is deployed.</p>}
        <span className="ss-label">Buy button</span>
        <div className="pe-chips">
          {CTA_TEXTS.map((t) => <button key={t} type="button" aria-pressed={(x.cta.text || 'Buy now') === t} onClick={() => setX({ cta: { ...x.cta, text: t === 'Buy now' ? '' : t } })}>{t}</button>)}
        </div>
        <Field label="Or your own text"><input className="ss-input" maxLength={30} value={x.cta.text} placeholder={free ? 'Get it free' : 'Buy now'} onChange={(e) => setX({ cta: { ...x.cta, text: e.target.value } })} /></Field>
        <div className="pe-colours" role="radiogroup" aria-label="Button colour">
          <button type="button" role="radio" aria-checked={!x.cta.color} aria-label="Theme colour" className="pe-theme" onClick={() => setX({ cta: { ...x.cta, color: '' } })}>A</button>
          {BADGE_COLOURS.map((c) => <button key={c} type="button" role="radio" aria-checked={x.cta.color === c} aria-label={`Button colour ${c}`} style={{ background: c }} onClick={() => setX({ cta: { ...x.cta, color: c } })} />)}
        </div>
      </PSection>
      )}

      {!affiliate && v2c && (
        <PSection icon={<Star className="h-4 w-4" />} title="Reviews" sub="From verified buyers">
          <SellerReviews handle={store.handle} productId={product.id} published={product.published} />
        </PSection>
      )}

      <PSection icon={<Globe className="h-4 w-4" />} title="Publishing" sub={vis === 'draft' ? 'Draft' : vis === 'hidden' ? (affiliate ? 'Hidden · link only' : 'Hidden · direct only') : 'Published'} open>
        <div className="pe-seg pe-seg3" role="radiogroup" aria-label="Visibility">
          <button type="button" role="radio" aria-checked={vis === 'draft'} onClick={() => setVis('draft')}>Draft</button>
          <button type="button" role="radio" aria-checked={vis === 'published'} onClick={() => setVis('published')}>Published</button>
          <button type="button" role="radio" aria-checked={vis === 'hidden'} onClick={() => setVis('hidden')}>Hidden</button>
        </div>
        <p className="ss-hint">
          {affiliate
            ? `This product sends buyers to Amazon. No price, checkout, Stripe payment or download is shown, and no Desknoty order is created. ${linkProblem || (vis === 'draft' ? 'Not shown yet; publish your page after switching to Published.' : vis === 'hidden' ? 'On sale by its own link only; not listed on your page.' : 'On sale once you press Publish on your page.')}`
            : vis === 'draft' ? 'Not on sale. Publish your page after switching to Published.' : vis === 'hidden' ? 'On sale by direct address only; not listed on your page.' : 'On sale once you press Publish on your page.'}
          {!affiliate && product.problem ? ` To sell it: ${product.problem}` : ''}
        </p>
        <div className="pe-actions">
          <button type="button" className="ss-ghost" disabled={busy} onClick={() => void saved.flush().then(() => setState('Saved ✓')).catch((e: Error) => setState(e.message))}>Save changes</button>
          <button type="button" className="ss-ghost" disabled={busy} onClick={() => void run(async () => { const r = await sellerApi.duplicateProduct(product.id); setStore(r.store) })}>Duplicate</button>
          {onEditParts && (
            <button type="button" className="ss-ghost" disabled={busy} onClick={() => onEditParts()}>
              <LayoutGrid className="h-3.5 w-3.5" /> Card look
            </button>
          )}
          <button type="button" className="ss-ghost" disabled={busy} onClick={() => void run(async () => {
            // The queue's own revision and token: the save that just flushed may
            // have moved the product on, and this is the same editor either way.
            const b = saved.base()
            const r = await sellerApi.updateProduct(product.id, { archived: !product.archived, listed: false }, b.revision, b.token)
            setStore(r.store)
            if (!product.archived) onDeleted()
          })}>{product.archived ? 'Unarchive' : 'Archive'}</button>
          <button
            type="button"
            className="ss-danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Delete “${product.title || 'Untitled product'}”? This can’t be undone. Buyers who already paid keep their downloads.`)) return
              void (async () => {
                setBusy(true)
                try {
                  try { await flushSellerEdits() } catch { /* ignore unfinished edits */ }
                  const r = await sellerApi.deleteProduct(product.id)
                  setStore(r.store)
                  onDeleted()
                } catch (e) {
                  setState((e as Error).message)
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Delete
          </button>
        </div>
      </PSection>
    </div>
  )
}

/* --------------------------------------------------------- payouts --- */

const PAYOUT_COPY: Record<StoreView['payouts']['status'], { label: string; text: string; action: string }> = {
  not_connected: { label: 'Not connected', text: 'Connect a bank account through Stripe to take payments. Stripe collects your bank and identity details; Desknoty never sees them.', action: 'Connect Stripe' },
  incomplete: { label: 'Setup incomplete', text: 'Stripe still needs a few details before you can take payments.', action: 'Resume setup' },
  pending: { label: 'Verification pending', text: 'Stripe is checking your details. This usually takes minutes, sometimes a few days. You can keep building meanwhile.', action: 'Check details on Stripe' },
  ready: { label: 'Ready for payouts', text: 'Buyers can pay, and Stripe pays out to your bank on its usual schedule.', action: 'Manage payouts on Stripe' },
}

type Bank = Earnings['banks'][number]

/** Send the Stripe balance to one of the seller's own bank accounts (chosen here). */
function WithdrawDialog({ amount, currency, banks, onClose, onSent, onAddBank }: { amount: number; currency: string; banks: Bank[]; onClose: () => void; onSent: (msg: string) => void; onAddBank?: () => void }) {
  const [pick, setPick] = useState(() => banks.find((b) => b.isDefault)?.id ?? banks[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const chosen = banks.find((b) => b.id === pick)
  const send = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { payout } = await sellerApi.withdraw(currency, pick || undefined)
      onSent(`${formatPrice(payout.amountMinor, payout.currency)} is on its way to ${chosen ? `${chosen.bankName} ••${chosen.last4}` : 'your bank'} · arrives ${new Date(payout.arrival).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="ss-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="ss-modal wl-modal" role="dialog" aria-modal="true" aria-labelledby="wd-title" onSubmit={(e) => (e.preventDefault(), void send())}>
        <div className="ss-modal-body">
          <h2 id="wd-title">Withdraw to bank</h2>
          <p className="wl-modal-amount">{formatPrice(amount, currency)}</p>
          <p className="ss-muted">Choose the bank account to send it to.</p>
          <div className="wl-pick" role="radiogroup" aria-label="Bank account">
            {banks.map((b) => (
              <label key={b.id} className={cn('wl-pickrow', pick === b.id && 'on')}>
                <input type="radio" name="bank" value={b.id} checked={pick === b.id} onChange={() => setPick(b.id)} />
                <BankMark name={b.bankName} />
                <span className="wl-pickinfo"><b>{b.bankName}</b><small>Account ending in {b.last4}{b.sortCode ? ` · ${b.sortCode}` : ''}</small></span>
                {b.isDefault && <em className="wl-tag">Default</em>}
              </label>
            ))}
          </div>
          {onAddBank && <button type="button" className="ss-ghost self-start" style={{ marginTop: 8 }} onClick={onAddBank}>+ Add another bank account</button>}
          {err && <div className="ss-note" role="alert">{err}</div>}
        </div>
        <div className="ss-modal-foot">
          <button type="button" className="ss-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ss-primary" disabled={busy || !pick}>{busy ? 'Sending…' : `Send ${formatPrice(amount, currency)}`}</button>
        </div>
      </form>
    </div>
  )
}

/** The bank's app icon (logo on its brand colour); banks without one get a coloured initial. */
function BankMark({ name }: { name: string }) {
  const icon = bankIcon(name)
  if (icon)
    return (
      <span className="wl-mark wl-mark-app" style={{ background: icon.bg, color: icon.fg }} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d={icon.path} /></svg>
      </span>
    )
  const t = bankTheme(BANKS.some((b) => b.name === name) ? name : name ? 'x' : '')
  return <span className="wl-mark" style={{ background: t.bg, color: t.fg }} aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</span>
}

type OrderRow = Awaited<ReturnType<typeof sellerApi.orders>>['orders'][number]

/**
 * "Send money to your bank": the seller picks which of their bank accounts sales
 * are sent to. Bank-transfer buyers pay straight into that account (Desknoty
 * never holds the money), so choosing an account is the whole "send".
 */
function PaidToBankDialog({ total, currency, saved, activeIndex, orders, onClose, onPick, onAdd }: { total: number; currency: string; saved: SavedBank[]; activeIndex: number; orders: OrderRow[]; onClose: () => void; onPick: (i: number) => Promise<void>; onAdd: () => void }) {
  const [pick, setPick] = useState(Math.max(0, activeIndex))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const paid = orders.filter((o) => o.status === 'paid')
  const chosen = saved[pick]
  const send = async () => {
    setBusy(true)
    if (pick !== activeIndex) await onPick(pick)
    setBusy(false)
    setDone(true)
  }
  if (done && chosen)
    return (
      <div className="ss-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ss-modal wl-modal" role="dialog" aria-modal="true" aria-labelledby="ptb-done">
          <div className="ss-modal-body wl-sent">
            <div className="wl-done-badge" aria-hidden="true">✓</div>
            <h2 id="ptb-done">Your money goes to {chosen.bankName || 'your bank'}</h2>
            <p className="ss-muted">Every sale is now sent straight to {chosen.bankName || 'your bank'} ••{chosen.accountNumber.slice(-4) || chosen.iban.slice(-4)} the moment the buyer pays.</p>
          </div>
          <div className="ss-modal-foot"><button type="button" className="ss-primary" onClick={onClose}>Done</button></div>
        </div>
      </div>
    )
  return (
    <div className="ss-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="ss-modal wl-modal" role="dialog" aria-modal="true" aria-labelledby="ptb-title" onSubmit={(e) => (e.preventDefault(), void send())}>
        <div className="ss-modal-body">
          <h2 id="ptb-title">Send money to your bank</h2>
          <p className="wl-modal-amount">{formatPrice(total, currency)}<small> sent so far</small></p>
          <p className="ss-muted">Choose the bank account your money is sent to. Buyers pay straight into it.</p>
          <div className="wl-pick" role="radiogroup" aria-label="Send money to">
            {saved.map((b, i) => (
              <label key={i} className={cn('wl-pickrow', pick === i && 'on')}>
                <input type="radio" name="sendto" checked={pick === i} onChange={() => setPick(i)} />
                <BankMark name={b.bankName} />
                <span className="wl-pickinfo"><b>{b.bankName || 'Bank account'}</b><small>{b.accountName} · ending in {b.accountNumber.slice(-4) || b.iban.slice(-4)}</small></span>
                {i === activeIndex && <em className="wl-tag">In use</em>}
              </label>
            ))}
          </div>
          <button type="button" className="wl-addnew" onClick={onAdd}>+ Add a new bank account</button>
          {paid.length > 0 && (
            <ul className="wl-paidlist" aria-label="Already sent to your bank">
              {paid.map((o) => (
                <li key={o.id}><span className="ok">✓</span><span>{o.product}<small>{new Date(o.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{o.reference ? ` · ${o.reference}` : ''}</small></span><b>{formatPrice(o.amountMinor, o.currency)}</b></li>
              ))}
            </ul>
          )}
        </div>
        <div className="ss-modal-foot">
          <button type="button" className="ss-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ss-primary" disabled={busy || !chosen}>{busy ? 'Saving…' : `Send to ${chosen?.bankName || 'this account'}`}</button>
        </div>
      </form>
    </div>
  )
}

/** Pick which saved bank account buyers pay into. */
function ChooseBankDialog({ saved, activeIndex, onPick, onClose, onAdd }: { saved: SavedBank[]; activeIndex: number; onPick: (i: number) => Promise<void>; onClose: () => void; onAdd: () => void }) {
  const [pick, setPick] = useState(Math.max(0, activeIndex))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="ss-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="ss-modal wl-modal" role="dialog" aria-modal="true" aria-labelledby="cb-title" onSubmit={(e) => { e.preventDefault(); setBusy(true); void onPick(pick).finally(() => setBusy(false)) }}>
        <div className="ss-modal-body">
          <h2 id="cb-title">Where should buyers pay?</h2>
          <p className="ss-muted">Bank transfer sales go straight into the account you choose.</p>
          <div className="wl-pick" role="radiogroup" aria-label="Bank account">
            {saved.map((b, i) => (
              <label key={i} className={cn('wl-pickrow', pick === i && 'on')}>
                <input type="radio" name="bank" checked={pick === i} onChange={() => setPick(i)} />
                <BankMark name={b.bankName} />
                <span className="wl-pickinfo"><b>{b.bankName || 'Bank account'}</b><small>{b.accountName} · ending in {b.accountNumber.slice(-4) || b.iban.slice(-4)}</small></span>
                {i === activeIndex && <em className="wl-tag">In use</em>}
              </label>
            ))}
          </div>
          <button type="button" className="wl-addnew" onClick={onAdd}>+ Add a new bank account</button>
        </div>
        <div className="ss-modal-foot">
          <button type="button" className="ss-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ss-primary" disabled={busy || pick === activeIndex}>{busy ? 'Saving…' : 'Use this account'}</button>
        </div>
      </form>
    </div>
  )
}

function PayoutsPanel({ store, setup, reload }: { store: StoreView; setup: SellerSetup; reload: (refresh?: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentSettings>(() => store.payouts.payments ?? EMPTY_PAYMENTS)
  const [methods, setMethods] = useState<PayMethod[]>(() => store.payouts.methods ?? [])
  const [bankOpen, setBankOpen] = useState<false | 'edit' | 'new'>(false)
  const [choosing, setChoosing] = useState(false)
  const [paidOpen, setPaidOpen] = useState(false)
  const [data, setData] = useState<Earnings | null>(null)
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const s = store.payouts.status
  const copy = PAYOUT_COPY[s]
  const load = useCallback(() => sellerApi.earnings().then(setData).catch((e: Error) => setErr(e.message)), [])
  useEffect(() => {
    void load()
    sellerApi.orders().then((r) => setOrders(r.orders)).catch(() => setOrders([]))
  }, [load])
  const hideOrder = async (id: string) => {
    if (!window.confirm('Delete this order from your Transaction History? Your earnings and the buyer’s download stay the same.')) return
    const before = orders
    setOrders((old) => old?.map((o) => (o.id === id ? { ...o, hidden: true } : o)) ?? null)
    try { await sellerApi.hideOrder(id) } catch (e) { setOrders(before); setErr((e as Error).message) }
  }
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
  /** Turn card payments (Stripe) on or off at checkout. */
  const useStripe = async (on: boolean) => {
    setErr(null)
    // One place the money goes: choosing Stripe turns bank transfer off, and the reverse.
    try { afterSave((await sellerApi.savePayments(on ? { stripe: { enabled: true }, bank: { enabled: false } } : { stripe: { enabled: false } })).store) } catch (e) { setErr((e as Error).message) }
  }
  const afterSave = (v: StoreView) => {
    setPayments(v.payouts.payments ?? payments)
    setMethods(v.payouts.methods ?? [])
  }
  const [bankErr, setBankErr] = useState<string | null>(null)
  const pickBank = async (i: number) => {
    setBankErr(null)
    try { afterSave((await sellerApi.useBank(i)).store) } catch (e) { setBankErr((e as Error).message) }
  }
  const removeBank = async (i: number) => {
    setBankErr(null)
    try { afterSave((await sellerApi.removeBank(i)).store) } catch (e) { setBankErr((e as Error).message) }
  }
  const saved = payments.savedBanks ?? []
  // Open Banking verification: an account is verified once the seller approved it in their bank app.
  const verifyOn = Boolean(store.payouts.bankVerify)
  const keyOf = (b: { sortCode: string; accountNumber: string }) => `${(b.sortCode || '').replace(/\D/g, '')}:${(b.accountNumber || '').replace(/\D/g, '')}`
  const isVerified = (b: { sortCode: string; accountNumber: string }) => (payments.verified ?? []).includes(keyOf(b))
  const verify = async (i: number) => {
    setBankErr(null)
    try { window.location.assign((await sellerApi.verifyBank(i, returnPath())).url) } catch (e) { setBankErr((e as Error).message) }
  }
  const isActive = (b: SavedBank) => (Boolean(b.iban) && b.iban === payments.bank.iban) || (Boolean(b.accountNumber) && b.accountNumber === payments.bank.accountNumber && b.sortCode === payments.bank.sortCode)
  // Where the money goes is one choice: Stripe (cards) or the bank box in use.
  const stripeInUse = payments.stripe.enabled && !payments.bank.enabled
  const bank = payments.bank
  const bankSet = bankComplete(payments)
  const main = data?.totals[0]
  const cur = main?.currency ?? data?.balance?.available[0]?.currency ?? 'gbp'
  const avail = data?.balance?.available.find((x) => x.currency === cur)?.amountMinor ?? 0
  const pending = data?.balance?.pending.find((x) => x.currency === cur)?.amountMinor ?? 0
  // Stripe's payout account and a saved bank-transfer account can be the same
  // bank account: show it once, labelled with both jobs.
  const sameBank = (b: { last4: string; sortCode?: string | null }, sb: { accountNumber: string; iban: string; sortCode: string }) =>
    b.last4 === (sb.accountNumber.slice(-4) || sb.iban.slice(-4)) && (!b.sortCode || !sb.sortCode || b.sortCode.replace(/\D/g, '') === sb.sortCode.replace(/\D/g, ''))
  // One name everywhere: the name the seller saved ("Revolut"), not Stripe's legal one ("REVOLUT LTD").
  const tidyBank = (n: string) => n.replace(/\b(LTD|LIMITED|PLC|UK|BANK PLC)\.?$/i, '').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Bank account'
  const banks = (data?.banks ?? []).map((b) => ({ ...b, bankName: saved.find((sb) => sameBank(b, sb))?.bankName || tidyBank(b.bankName) }))
  /** Card earnings are paid out to this Stripe bank account from now on. */
  const useStripeBank = async (id: string) => {
    try { await sellerApi.defaultBank(id); await load() } catch (e) { setErr((e as Error).message) }
  }
  // Stripe pays out on its own unless the schedule is manual; then the seller presses Withdraw.
  const manual = data?.schedule?.interval === 'manual'
  const autoText = data?.schedule && !manual ? `Paid out automatically · ${data.schedule.interval === 'daily' ? 'daily' : data.schedule.interval === 'weekly' ? 'weekly' : data.schedule.interval === 'monthly' ? 'monthly' : data.schedule.interval}` : null
  const canWithdraw = s === 'ready' && Boolean(data?.withdrawals) && avail > 0 && banks.length > 0 && (manual || !data?.schedule)
  const payouts = data?.balance?.payouts ?? []
  // Where card money is paid out: the Stripe bank chosen with "Use this account".
  const payTo = banks.find((b) => b.isDefault) ?? banks[0] ?? null
  const PAYOUT_STATUS: Record<string, string> = { paid: 'Paid', in_transit: 'On the way', pending: 'Pending', failed: 'Failed', canceled: 'Cancelled' }
  const STATUS: Record<string, string> = { paid: 'Paid', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded', disputed: 'Disputed' }

  return (
    <div className="ss-stack wl">
      <h2 className="wl-h">Your Wallet</h2>
      <div className="wl-top">
        <div className="wl-balance">
          {s !== 'ready' && bankSet ? (
            <>
              {/* bank transfer only: buyers pay straight into the seller's bank, nothing to withdraw */}
              <span className="wl-label">Paid straight to your bank</span>
              <button type="button" className="wl-big wl-bigbtn" onClick={() => setPaidOpen(true)} aria-label={`${formatPrice(main?.byMethod.bank ?? 0, cur)} paid to your bank. Show details`}>{formatPrice(main?.byMethod.bank ?? 0, cur)} <span aria-hidden="true">›</span></button>
              <small className="wl-sub">Bank transfer sales go directly to {bank.bankName || 'your bank'} ••{last4(payments)}. Nothing to withdraw: the money is already yours.</small>
              <div className="wl-balance-foot">
                <button type="button" className="wl-direct" onClick={() => setChoosing(true)} aria-label={`Buyers pay into ${bank.bankName || 'Bank'} ending ${last4(payments)}. Change account`}>
                  <BankMark name={bank.bankName} /> {bank.bankName || 'Bank'} ••{last4(payments)} <span className="wl-change">Change ▾</span>
                </button>
              </div>
            </>
          ) : (
          <>
          <span className="wl-label">Wallet balance</span>
          <b className="wl-big">{data?.balance ? formatPrice(avail, cur) : formatPrice(0, cur)}</b>
          <small className="wl-sub">{data?.balance ? [pending > 0 ? `${formatPrice(pending, cur)} on the way from Stripe` : manual ? 'Ready to withdraw' : '', autoText ?? ''].filter(Boolean).join(' · ') || 'Ready to withdraw' : s === 'ready' ? 'Loading…' : 'Card sales land here once Stripe is set up'}</small>
          <div className="wl-balance-foot">
            {s === 'ready' && banks.length === 0 ? (
              // No bank account yet: set one up first (in Stripe, which keeps the full details).
              <button type="button" className="wl-link" onClick={() => void go()}>Add bank account <span aria-hidden="true">→</span></button>
            ) : (
              <button type="button" className="wl-link" disabled={!canWithdraw} onClick={() => (setSent(null), setWithdrawing(true))} title={!canWithdraw ? (s !== 'ready' ? 'Finish Stripe setup first' : data?.schedule && !manual ? 'Stripe pays you out automatically. Set your Stripe payout schedule to Manual to withdraw yourself.' : !data?.withdrawals ? 'Withdrawals are switched off on this server' : avail <= 0 ? 'Nothing ready to withdraw yet' : undefined) : undefined}>
                Withdraw <span aria-hidden="true">→</span>
              </button>
            )}
            {s === 'ready' && (() => {
              // The account you chose under "Your Bank Accounts" is where card money goes.
              // Shows what you chose: Stripe, or the bank box that's in use.
              if (stripeInUse) return <span className="wl-link wl-dest"><span className="wl-stripe-mark" aria-hidden="true">S</span> Connected to Stripe</span>
              const inUse = saved.find((x) => isActive(x)) ?? null
              return inUse ? <span className="wl-link wl-dest"><BankMark name={inUse.bankName} /> Paid to {inUse.bankName} ••{inUse.accountNumber.slice(-4) || inUse.iban.slice(-4)}</span> : null
            })()}
          </div>
          </>
          )}
        </div>
        <div className="wl-stats">
          <div><span>Total earned</span><b>{formatPrice(main?.totalMinor ?? 0, cur)}</b>{main && main.monthMinor > 0 && <em>+{formatPrice(main.monthMinor, cur)}</em>}</div>
          <div><span>This month</span><b>{formatPrice(main?.monthMinor ?? 0, cur)}</b></div>
          <div><span>Paid by bank transfer</span><b>{formatPrice(main?.byMethod.bank ?? 0, cur)}</b></div>
        </div>
      </div>
      {sent && <p className="wl-ok" role="status">✓ {sent}</p>}

      {s === 'ready' && (
        <section className="wl-payouts" aria-label="Payout history">
          <h2 className="wl-h">Payouts</h2>
          {payouts.length === 0 ? (
            <p className="ss-muted">No payouts yet. {manual ? 'Press Withdraw when you have a balance.' : 'Stripe sends your card earnings to your chosen bank automatically.'}</p>
          ) : (
            <ul className="wl-plist">
              {payouts.map((p) => {
                const b = banks.find((x) => x.id === p.bank)
                return (
                  <li key={p.id}>
                    <span className="wl-pdate">{new Date(p.arrival).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="wl-pbank">{b ? <><BankMark name={b.bankName} /> {b.bankName} ••{b.last4}</> : 'Your bank'}</span>
                    <b className="wl-pamt">{formatPrice(p.amountMinor, p.currency)}</b>
                    <em className={cn('wl-tag', p.status === 'paid' ? 'on' : p.status === 'failed' || p.status === 'canceled' ? 'off' : '')}>{PAYOUT_STATUS[p.status] ?? p.status}</em>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
      <div className="wl-row">
        <h2 className="wl-h">Your Bank Accounts</h2>
        <button type="button" className="wl-add" onClick={() => setBankOpen(bankSet ? 'new' : 'edit')}>+ Add bank account</button>
      </div>
      <div className="wl-banks">
        {banks.filter((b) => !saved.some((sb) => sameBank(b, sb))).map((b) => (
          <article key={b.id} className="wl-bank">
            <header><BankMark name={b.bankName} /><b>{b.bankName}</b>{b.isDefault && <em className="wl-tag">Default</em>}</header>
            <dl>
              {b.holder && <><dt>Name</dt><dd>{b.holder}</dd></>}
              <dt>Account number</dt><dd>•••• {b.last4}</dd>
              {b.sortCode && <><dt>Sort code</dt><dd>{b.sortCode}</dd></>}
            </dl>
            <footer>
              <small>{b.isDefault ? 'Card payouts go here' : 'Card payouts'}</small>
              {!b.isDefault && <button type="button" className="wl-btn wl-btn-main" onClick={() => void useStripeBank(b.id)}>Use this account</button>}
            </footer>
          </article>
        ))}
        {/* the seller's own bank accounts: the one "In use" is where buyers pay */}
        {saved.map((sb, i) => {
          const twin = banks.find((b) => sameBank(b, sb))
          // In use = buyers pay into it, and (when Stripe has the same account) card payouts go there too.
          const active = isActive(sb) && payments.bank.enabled && !payments.stripe.enabled
          const choose = async () => {
            if (!isActive(sb) || !payments.bank.enabled) await pickBank(i)
            // One place the money goes: choosing a bank turns card payments (Stripe) off.
            if (payments.stripe.enabled) { try { afterSave((await sellerApi.savePayments({ stripe: { enabled: false } })).store) } catch (e) { setBankErr((e as Error).message) } }
            // Stripe pays card earnings to the same account (added to Stripe if it isn't there yet).
            if (s === 'ready' && (!twin || !twin.isDefault)) {
              try { await sellerApi.useSavedBankInStripe(i); await load() } catch (e) { setErr((e as Error).message) }
            }
          }
          return (
            <article key={`${sb.sortCode}${sb.accountNumber}${sb.iban}`} className={cn('wl-bank', active && 'wl-bank-active', !active && 'wl-bank-pick')} aria-label={`${sb.bankName || 'Bank'} ending ${sb.accountNumber.slice(-4) || sb.iban.slice(-4)}`}
              onClick={(e) => { if (!active && !(e.target as HTMLElement).closest('button') && (!verifyOn || isVerified(sb) || isActive(sb))) void choose() }}>
              <header>
                <BankMark name={sb.bankName} />
                <b>{sb.bankName || 'Bank account'}</b>
                {verifyOn && isVerified(sb) && <em className="wl-tag wl-verified" title="Proven through your bank app">Verified ✓</em>}
                {active ? <em className={cn('wl-tag', methods.includes('bank') ? 'on' : 'off')}>{methods.includes('bank') ? 'In use' : 'Off'}</em> : <button type="button" className="wl-x" aria-label={`Remove ${sb.bankName || 'this bank account'}`} onClick={() => void removeBank(i)}>✕</button>}
              </header>
              <dl>
                <dt>Name</dt><dd>{sb.accountName}</dd>
                <dt>Account number</dt><dd>•••• {sb.accountNumber.slice(-4) || sb.iban.slice(-4)}</dd>
                {sb.sortCode && <><dt>Sort code</dt><dd>{formatSort(sb.sortCode)}</dd></>}
              </dl>
              <footer>
                <small>{active ? ['Buyers pay here', twin ? 'card payouts' : ''].filter(Boolean).join(' · ') : ''}</small>
                {verifyOn && !isVerified(sb) && !isActive(sb) && !active
                  ? <button type="button" className="wl-btn wl-btn-main" onClick={() => void verify(i)}>Verify in bank app</button>
                  : active
                    ? <span className="wl-foot-acts">{verifyOn && !isVerified(sb) && <button type="button" className="wl-link" onClick={() => void verify(i)}>Verify</button>}<button type="button" className="wl-link" onClick={() => setBankOpen('edit')}>Edit</button></span>
                    : <button type="button" className="wl-btn wl-btn-main" onClick={() => void choose()}>Use this account</button>}
              </footer>
            </article>
          )
        })}
        {!saved.length && (
          <article className="wl-bank wl-bank-empty" aria-label="Bank transfer">
            <header><BankMark name="" /><b>Bank transfer</b><em className="wl-tag off">Not set up</em></header>
            <p className="ss-muted">Buyers pay straight into your bank. You confirm each payment in Orders.</p>
            <footer><small /><button type="button" className="wl-btn wl-btn-main" onClick={() => setBankOpen('edit')}>Connect bank account</button></footer>
          </article>
        )}
        {bankErr && <p className="ss-note" role="alert">{bankErr}</p>}
        {s === 'ready' && data && banks.length === 0 && (
          <article className="wl-bank wl-bank-empty">
            <header><b>No payout account yet</b></header>
            <p className="ss-muted">Add a bank account in Stripe to withdraw card earnings.</p>
          </article>
        )}
      </div>

      {/* Stripe: status, refresh and the one action, together */}
      <section className={cn('ss-paycard wl-stripe', stripeInUse && 'wl-stripe-on', !stripeInUse && s === 'ready' && 'wl-bank-pick')} aria-label="Card payments with Stripe" onClick={(e) => { if (!stripeInUse && s === 'ready' && !(e.target as HTMLElement).closest('button')) void useStripe(true) }}>
        <div className="ss-paycard-head">
          <span className="ss-paycard-icon"><Landmark className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3>Card payments · Stripe</h3>
            <p className="ss-muted">{s === 'ready' ? (payments.stripe.enabled ? `Buyers can pay by card. Their money is paid out to ${payTo ? `${payTo.bankName} ••${payTo.last4}` : 'your bank'}.` : 'Card payments are off. Press Use Stripe to let buyers pay by card.') : copy.text}</p>
          </div>
          <b className={cn('ss-pay', `ss-pay-${s}`)}>{copy.label}</b>
        </div>
        {!setup.stripe ? (
          <div className="ss-note">Stripe isn’t switched on for this Desknoty server yet.</div>
        ) : (
          <div className="ss-paycard-actions">
            {s === 'ready' ? (
              <>
                {/* Ready: the bank is chosen here in Desknoty (Use this account), not in Stripe. */}
                {/* Like the bank boxes: Use Stripe switches card payments on; In use when it is. */}
                {stripeInUse ? <em className="wl-tag on">In use</em> : <button type="button" className="ss-primary" onClick={() => void useStripe(true)}>Use Stripe</button>}
                <button type="button" className="wl-link" onClick={() => void go()} disabled={busy}>{busy ? 'Opening…' : 'Open Stripe'} <ExternalLink className="h-3 w-3" /></button>
              </>
            ) : (
              <>
                <button type="button" className="ss-primary" onClick={() => void go()} disabled={busy}>
                  {busy ? 'Opening Stripe…' : copy.action} <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="ss-ghost" onClick={() => void reload(true)}>Refresh</button>
              </>
            )}
          </div>
        )}
        {err && <div className="ss-note" role="alert">{err}</div>}
      </section>

      <h2 className="wl-h">Transaction History</h2>
      <div className="wl-table-wrap">
        <table className="wl-table">
          <thead><tr><th>Order</th><th>Product</th><th>Date</th><th>Method</th><th className="r">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {orders === null && <tr><td colSpan={6} className="wl-empty">Loading…</td></tr>}
            {orders?.filter((o) => !o.hidden).length === 0 && <tr><td colSpan={6} className="wl-empty">No sales yet. They’ll show here.</td></tr>}
            {orders?.filter((o) => !o.hidden).map((o) => (
              <tr key={o.id}>
                <td className="wl-id">{o.id.slice(-6).toUpperCase()}</td>
                <td>{o.product}</td>
                <td>{new Date(o.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td>{o.method === 'bank' ? 'Bank transfer' : o.method === 'paypal' ? 'PayPal' : 'Card'}</td>
                <td className="r">{formatPrice(o.amountMinor, o.currency)}</td>
                <td>
                  <span className="wl-status-cell">
                    <span className={cn('wl-status', `wl-status-${o.status}`)}>{STATUS[o.status] ?? o.status}</span>
                    <button type="button" className="wl-del" aria-label={`Delete order ${o.id.slice(-6).toUpperCase()} from history`} title="Delete from history" onClick={() => void hideOrder(o.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ss-muted wl-fee">Desknoty platform fee: {PLATFORM_FEE_PERCENT}%. Payment providers may charge their own fees.</p>

      {bankOpen && <BankDialog fresh={bankOpen === 'new'} payments={payments} onClose={() => setBankOpen(false)} onSaved={(v) => (afterSave(v), setBankOpen(false))} />}
      {paidOpen && (
        <PaidToBankDialog
          total={main?.byMethod.bank ?? 0}
          currency={cur}
          saved={saved}
          activeIndex={saved.findIndex(isActive)}
          orders={(orders ?? []).filter((o) => o.method === 'bank')}
          onClose={() => setPaidOpen(false)}
          onPick={pickBank}
          onAdd={() => (setPaidOpen(false), setBankOpen('new'))}
        />
      )}
      {choosing && (
        <ChooseBankDialog saved={saved} activeIndex={saved.findIndex(isActive)} onClose={() => setChoosing(false)} onAdd={() => (setChoosing(false), setBankOpen('new'))}
          onPick={async (i) => { await pickBank(i); setChoosing(false) }} />
      )}
      {withdrawing && <WithdrawDialog amount={avail} currency={cur} banks={banks} onAddBank={() => void go()} onClose={() => setWithdrawing(false)} onSent={(m) => (setSent(m), setWithdrawing(false), void load())} />}
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
function BankDialog({ payments, onClose, onSaved, fresh = false }: { payments: PaymentSettings; onClose: () => void; onSaved: (s: StoreView) => void; fresh?: boolean }) {
  // First connection or a new account: empty and on; editing keeps the seller's choice.
  const [b, setB] = useState(() => (fresh ? { ...EMPTY_PAYMENTS.bank, enabled: true } : { ...payments.bank, enabled: bankComplete(payments) ? payments.bank.enabled : true }))
  const known = BANKS.some((x) => x.name === b.bankName)
  const [choice, setChoice] = useState(() => (!b.bankName ? '' : known ? b.bankName : OTHER))
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
  const copy = () => void copyToClipboard(store.url).then((ok) => { if (ok) { setCopied(true); window.setTimeout(() => setCopied(false), 1600) } })
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
            {o.method === 'bank' && o.payerName ? ` · from ${o.payerName}${o.payerBank ? ` (${o.payerBank})` : ''}` : ''}
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
