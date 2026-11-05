import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check, Copy, ExternalLink, Globe, ImagePlus, Landmark, Lock, Monitor, Package, Smartphone, Store } from 'lucide-react'
import { cn } from '../../lib/id'
import { StorePage } from './StorePage'
import {
  BUTTON_STYLES,
  CURRENCIES,
  FONTS,
  PLATFORM_FEE_PERCENT,
  PRESETS,
  TIKTOK_CLIENT_KEY,
  domainProblem,
  emptyProduct,
  handleProblem,
  loadStore,
  saveStore,
  toHandle,
} from './model'
import type { Product, StepId, StoreDraft } from './model'

/**
 * Seller Studio. Starts from zero: an empty "Start your store" card, then
 * Connect TikTok → store link → customise → bank → first product. Progress
 * is saved, so coming back continues on the same step.
 *
 * Drafts live in this browser. TikTok login, Stripe, domain checks and
 * public store pages need a running server and the provider accounts;
 * until those exist, those steps say so plainly.
 */

const FLOW: Array<{ id: Exclude<StepId, 'start'>; title: string }> = [
  { id: 'tiktok', title: 'Connect TikTok' },
  { id: 'link', title: 'Choose your store link' },
  { id: 'customize', title: 'Customise your page' },
  { id: 'bank', title: 'Connect your bank' },
  { id: 'product', title: 'Add your first product' },
]
const order = (id: StepId) => (id === 'start' ? -1 : FLOW.findIndex((s) => s.id === id))

export function SellerStudio() {
  const [store, setStore] = useState<StoreDraft>(loadStore)
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile')
  const [copied, setCopied] = useState(false)
  useEffect(() => saveStore(store), [store])

  const patch = (p: Partial<StoreDraft>) => setStore((s) => ({ ...s, ...p }))
  const reach = (id: StepId) => setStore((s) => (order(id) > order(s.step) ? { ...s, step: id } : s))
  const current = store.step
  const [open, setOpen] = useState<StepId>(current)
  useEffect(() => setOpen(current), [current])

  const link =
    store.link.mode === 'domain' && store.link.domainStatus === 'connected'
      ? store.link.domain
      : `${store.handle || 'yourname'}.desknoty.com`

  return (
    <div className={cn('ss', current === 'start' && 'ss-solo')}>
      <section className="ss-editor" aria-label="Store builder">
        {current !== 'start' && (
        <header className="ss-head">
          <p className="ss-kicker">Seller · Digital products</p>
          <h1>Your store</h1>
          <p className="ss-lede">Sell downloads and templates from one link. Desknoty takes {PLATFORM_FEE_PERCENT}% of every sale.</p>
        </header>
        )}

        {current === 'start' ? (
          <StartCard
            onConnected={(t) => {
              patch({ ...t, step: 'link' })
            }}
          />
        ) : (
          <ol className="ss-steps">
            {FLOW.map((s, i) => {
              const done = order(current) > i || (s.id === 'product' && store.products.some((p) => p.title.trim()))
              const locked = order(current) < i
              const isOpen = open === s.id && !locked
              return (
                <li key={s.id} className={cn('ss-step', isOpen && 'ss-step-open', done && 'ss-step-done', locked && 'ss-step-locked')}>
                  <button
                    type="button"
                    className="ss-step-head"
                    disabled={locked}
                    onClick={() => setOpen(s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="ss-dot" aria-hidden="true">
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : locked ? <Lock className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="ss-step-title">{s.title}</span>
                    <span className="ss-step-state">{done ? 'Done' : locked ? 'Locked' : 'In progress'}</span>
                  </button>
                  {isOpen && (
                    <div className="ss-step-body">
                      {s.id === 'tiktok' && <TikTokDone store={store} />}
                      {s.id === 'link' && <LinkStep store={store} patch={patch} next={() => reach('customize')} />}
                      {s.id === 'customize' && <CustomizeStep store={store} patch={patch} next={() => reach('bank')} />}
                      {s.id === 'bank' && <BankStep store={store} next={() => reach('product')} />}
                      {s.id === 'product' && <ProductStep store={store} setStore={setStore} />}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* before TikTok is connected, the white panel covers the whole studio */}
      {current !== 'start' && (
      <aside className="ss-preview" aria-label="Live preview">
        <div className="ss-preview-bar">
          <div className="ss-seg" role="tablist" aria-label="Preview size">
            <button type="button" role="tab" aria-selected={view === 'mobile'} onClick={() => setView('mobile')}>
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
            <button type="button" role="tab" aria-selected={view === 'desktop'} onClick={() => setView('desktop')}>
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
          </div>
          <button
            type="button"
            className="ss-ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(`https://${link}`).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              })
            }}
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy store link'}
          </button>
        </div>
        <div className={cn('ss-device', view === 'desktop' && 'ss-device-desk')}>
          {view === 'mobile' && <span className="ss-island" aria-hidden="true" />}
          <div className="ss-screen">
            {order(current) >= order('link') && <div className="ss-addr">{link}</div>}
            <StorePage store={store} />
          </div>
        </div>
      </aside>
      )}
    </div>
  )
}

/* -------------------------------------------------------- step 0 / 1 --- */

function TikTokMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z" />
    </svg>
  )
}

/** The first thing a new seller sees. */
function StartCard({ onConnected }: { onConnected: (p: Partial<StoreDraft>) => void }) {
  const [error, setError] = useState(false)
  const [manual, setManual] = useState(false)
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const connect = () => {
    // TikTok Login Kit needs a TikTok developer app and Desknoty's server to
    // exchange the code; without a client key the connection cannot start.
    if (!TIKTOK_CLIENT_KEY) {
      setError(true)
      return
    }
    const state = crypto.randomUUID()
    sessionStorage.setItem('desknoty.tiktok.state', state)
    const q = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      scope: 'user.info.basic,user.info.profile',
      response_type: 'code',
      redirect_uri: `${window.location.origin}/api/tiktok/callback`,
      state,
    })
    window.location.href = `https://www.tiktok.com/v2/auth/authorize/?${q}`
  }

  return (
    <div className="ss-start">
      <div className="ss-start-top">
        <span className="ss-start-brand">
          <Store className="h-4 w-4" /> Seller
        </span>
        <span className="ss-start-fee">0% platform fee</span>
      </div>
      <div className="ss-start-card">
        <span className="ss-start-icon">
          <Store className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h2>Start your store</h2>
        <p>Connect TikTok to create your store in 2 minutes.</p>
        <button type="button" className="ss-tt" onClick={connect}>
          <TikTokMark /> Connect TikTok
        </button>
        <ol className="ss-start-steps" aria-label="What happens next">
          <li>
            <b>1</b> Connect TikTok
          </li>
          <li>
            <b>2</b> Pick your link
          </li>
          <li>
            <b>3</b> Add a product
          </li>
        </ol>
        {error && (
          <div className="ss-start-err" role="alert">
            TikTok connection failed. Try again.
            <small>TikTok login isn’t switched on for Desknoty yet.</small>
            {!manual && (
              <button type="button" onClick={() => setManual(true)}>
                Continue without TikTok
              </button>
            )}
          </div>
        )}
        {manual && (
          <form
            className="ss-start-manual"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim() || !user.trim()) return
              onConnected({ tiktok: { connected: false, manual: true, username: user.replace(/^@/, '') }, name: name.trim(), handle: toHandle(user) })
            }}
          >
            <input className="ss-input ss-input-light" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="ss-input ss-input-light" placeholder="@username" value={user} onChange={(e) => setUser(e.target.value)} />
            <button type="submit" className="ss-tt" disabled={!name.trim() || !user.trim()}>
              Continue
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function TikTokDone({ store }: { store: StoreDraft }) {
  return (
    <p className="ss-muted">
      {store.tiktok.connected ? 'Connected as ' : 'Set up by hand as '}
      <b className="text-[#111114]">@{store.tiktok.username}</b>
      {store.tiktok.manual && ' · you can connect TikTok later'}
    </p>
  )
}

/* ------------------------------------------------------------ step 2 --- */

function LinkStep({ store, patch, next }: { store: StoreDraft; patch: (p: Partial<StoreDraft>) => void; next: () => void }) {
  const l = store.link
  const setLink = (x: Partial<StoreDraft['link']>) => patch({ link: { ...l, ...x } })
  const problem = handleProblem(store.handle)
  const dProblem = l.domain ? domainProblem(l.domain) : 'Enter your domain'
  const ok = l.mode === 'free' ? !problem : l.domainStatus === 'connected'

  return (
    <div className="ss-stack">
      <div className="ss-options">
        <button type="button" className={cn('ss-opt', l.mode === 'free' && 'ss-opt-on')} onClick={() => setLink({ mode: 'free' })} aria-pressed={l.mode === 'free'}>
          <span className="ss-badge">Free</span>
          <b>Free Desknoty link</b>
          <small>yourname.desknoty.com</small>
        </button>
        <button type="button" className={cn('ss-opt', l.mode === 'domain' && 'ss-opt-on')} onClick={() => setLink({ mode: 'domain' })} aria-pressed={l.mode === 'domain'}>
          <span className="ss-badge ss-badge-pro">Pro</span>
          <b>Use your own domain</b>
          <small>e.g. shop.yourname.com</small>
        </button>
      </div>

      {l.mode === 'free' ? (
        <Field
          label="Your link"
          hint={
            problem ? (
              <span className="text-[#b42318]">● {problem === 'That name is reserved.' ? 'Taken' : problem}</span>
            ) : (
              <span className="text-[#2f7a1d]">● Available</span>
            )
          }
        >
          <div className="ss-affix">
            <input
              className="ss-input"
              value={store.handle}
              maxLength={30}
              onChange={(e) => patch({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="yourname"
              autoFocus
            />
            <span>.desknoty.com</span>
          </div>
        </Field>
      ) : (
        <>
          <Field label="Your domain" hint={l.domain && dProblem ? <span className="text-[#b42318]">{dProblem}</span> : undefined}>
            <div className="flex gap-2">
              <input
                className="ss-input"
                value={l.domain}
                onChange={(e) => setLink({ domain: e.target.value.trim().toLowerCase(), domainStatus: 'none' })}
                placeholder="shop.yourname.com"
              />
              <button type="button" className="ss-ghost shrink-0" disabled={Boolean(dProblem)} onClick={() => setLink({ domainStatus: 'waiting' })}>
                <Globe className="h-3.5 w-3.5" /> Connect domain
              </button>
            </div>
          </Field>
          {l.domainStatus !== 'none' && (
            <div className="ss-dns">
              <p>At the company you bought your domain from, add this DNS record:</p>
              <div className="ss-dns-row">
                <span>Type</span>
                <code>CNAME</code>
                <span>Name</span>
                <code>{l.domain.split('.')[0]}</code>
                <span>Value</span>
                <code>cname.vercel-dns.com</code>
                <button type="button" className="ss-ghost" onClick={() => void navigator.clipboard?.writeText('cname.vercel-dns.com')}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <span className="ss-chip-status">
                ● {l.domainStatus === 'waiting' ? 'Waiting for DNS' : l.domainStatus === 'verifying' ? 'Verifying' : 'Connected ✓'}
              </span>
              <p className="ss-muted">
                Checking DNS and connecting the domain needs Desknoty hosted on Vercel, so it stays on “Waiting for DNS” for
                now. You keep {store.handle || 'yourname'}.desknoty.com as your link meanwhile.
              </p>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="ss-primary"
        disabled={!ok && !(l.mode === 'domain' && !problem)}
        onClick={() => {
          if (l.mode === 'domain' && l.domainStatus !== 'connected') setLink({ mode: 'free' })
          next()
        }}
      >
        {l.mode === 'domain' && l.domainStatus !== 'connected' ? `Continue with ${store.handle || 'yourname'}.desknoty.com` : 'Continue'}
      </button>
    </div>
  )
}

/* --------------------------------------------------------- steps 3-5 --- */

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="ss-field">
      <span className="ss-label">{label}</span>
      {children}
      {hint && <span className="ss-hint">{hint}</span>}
    </label>
  )
}

function readImage(file: File, cb: (url: string) => void) {
  if (!file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) return
  const r = new FileReader()
  r.onload = () => typeof r.result === 'string' && cb(r.result)
  r.readAsDataURL(file)
}

function CustomizeStep({ store, patch, next }: { store: StoreDraft; patch: (p: Partial<StoreDraft>) => void; next: () => void }) {
  const theme = store.theme
  const setTheme = (t: Partial<StoreDraft['theme']>) => patch({ theme: { ...theme, ...t } })
  return (
    <div className="ss-stack">
      <div className="ss-row">
        <span className="ss-avatar" style={store.avatar ? { backgroundImage: `url(${store.avatar})` } : undefined}>
          {!store.avatar && (store.name.trim().charAt(0).toUpperCase() || '?')}
        </span>
        <label className="ss-ghost cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" /> Change photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0], (avatar) => patch({ avatar }))} />
        </label>
      </div>
      <Field label="Display name">
        <input className="ss-input" value={store.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} />
      </Field>
      <Field label="Bio" hint={`${store.bio.length}/160`}>
        <textarea className="ss-input" rows={2} maxLength={160} value={store.bio} onChange={(e) => patch({ bio: e.target.value })} placeholder="What you make, in one line" />
      </Field>
      <div>
        <span className="ss-label">Theme</span>
        <div className="ss-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={theme.preset === p.id}
              onClick={() => setTheme({ preset: p.id, accent: p.accent })}
              className="ss-preset"
              style={{ '--bg': p.bg, '--ac': p.accent } as CSSProperties}
            >
              <span className="ss-preset-swatch">
                <i />
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ss-grid3">
        <Field label="Accent">
          <input type="color" className="ss-color" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} />
        </Field>
        <Field label="Font">
          <select className="ss-input" value={theme.font} onChange={(e) => setTheme({ font: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Buttons">
          <select className="ss-input" value={theme.button} onChange={(e) => setTheme({ button: e.target.value as StoreDraft['theme']['button'] })}>
            {BUTTON_STYLES.map((b) => (
              <option key={b} value={b}>
                {b[0].toUpperCase() + b.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Background">
        <select className="ss-input" value={theme.background} onChange={(e) => setTheme({ background: e.target.value as StoreDraft['theme']['background'] })}>
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
      </Field>
      <div className="ss-grid2">
        {(['instagram', 'youtube', 'x', 'website'] as const).map((k) => (
          <Field key={k} label={k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1)}>
            <input className="ss-input" value={store.socials[k]} onChange={(e) => patch({ socials: { ...store.socials, [k]: e.target.value } })} placeholder="https://" />
          </Field>
        ))}
      </div>
      <button type="button" className="ss-primary" disabled={!store.name.trim()} onClick={next}>
        Continue
      </button>
    </div>
  )
}

function BankStep({ store, next }: { store: StoreDraft; next: () => void }) {
  return (
    <div className="ss-stack">
      <p className="ss-big">Get 100% of every sale sent straight to your bank. Desknoty takes {PLATFORM_FEE_PERCENT}%.</p>
      <p className="ss-muted">Stripe’s own card processing fee still applies.</p>
      <div className="ss-status">
        <Landmark className="h-4 w-4" />
        <span>Status</span>
        <b>{store.payoutsEnabled ? 'Payouts active' : 'Not connected'}</b>
      </div>
      <button type="button" className="ss-primary" disabled title="Needs Stripe Connect on a running server">
        Connect bank account <Lock className="h-3.5 w-3.5" />
      </button>
      <div className="ss-note">
        Connecting a bank needs a Stripe account with Connect switched on and Desknoty’s server online. You can still add
        products as drafts; publishing unlocks once payouts are active.
      </div>
      <button type="button" className="ss-ghost self-start" onClick={next}>
        Skip for now and add a product
      </button>
    </div>
  )
}

function ProductStep({ store, setStore }: { store: StoreDraft; setStore: React.Dispatch<React.SetStateAction<StoreDraft>> }) {
  const [editing, setEditing] = useState<string | null>(store.products[0]?.id ?? null)
  const product = store.products.find((p) => p.id === editing)
  const update = (id: string, p: Partial<Product>) => setStore((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const add = () => {
    const p = emptyProduct()
    setStore((s) => ({ ...s, products: [...s.products, p] }))
    setEditing(p.id)
  }
  const symbol = useMemo(() => CURRENCIES.find((c) => c.code === product?.currency)?.symbol ?? '£', [product?.currency])

  return (
    <div className="ss-stack">
      {store.products.length > 0 && (
        <div className="ss-chips">
          {store.products.map((p) => (
            <button key={p.id} type="button" aria-pressed={p.id === editing} onClick={() => setEditing(p.id)}>
              {p.title.trim() || 'Untitled product'}
            </button>
          ))}
          <button type="button" className="ss-chip-add" onClick={add}>
            + New product
          </button>
        </div>
      )}
      {!product ? (
        <button type="button" className="ss-blank" onClick={add}>
          <Package className="h-5 w-5" /> Add your first digital product
        </button>
      ) : (
        <>
          <Field label="Type">
            <select className="ss-input" value={product.type} onChange={(e) => update(product.id, { type: e.target.value as Product['type'] })}>
              <option value="download">Digital download (file)</option>
              <option value="link">Link (Notion, Canva or any URL)</option>
              <option value="bundle">Bundle</option>
            </select>
          </Field>
          <Field label="Title">
            <input className="ss-input" maxLength={80} value={product.title} onChange={(e) => update(product.id, { title: e.target.value })} placeholder="e.g. Content planner template" />
          </Field>
          <Field label="Short description">
            <input className="ss-input" maxLength={120} value={product.short} onChange={(e) => update(product.id, { short: e.target.value })} />
          </Field>
          <div className="ss-grid3">
            <Field label="Price">
              <div className="ss-affix ss-affix-l">
                <span>{symbol}</span>
                <input className="ss-input" inputMode="decimal" value={product.price} onChange={(e) => update(product.id, { price: e.target.value.replace(/[^0-9.]/g, '') })} />
              </div>
            </Field>
            <Field label="Currency">
              <select className="ss-input" value={product.currency} onChange={(e) => update(product.id, { currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pay what you want">
              <select className="ss-input" value={product.pwyw ? 'yes' : 'no'} onChange={(e) => update(product.id, { pwyw: e.target.value === 'yes' })}>
                <option value="no">Off</option>
                <option value="yes">On (price is the minimum)</option>
              </select>
            </Field>
          </div>
          {product.type === 'link' ? (
            <Field label="Link buyers get after paying">
              <input className="ss-input" value={product.url} onChange={(e) => update(product.id, { url: e.target.value })} placeholder="https://" />
            </Field>
          ) : (
            <div className="ss-note">File uploads (up to 2 GB, kept private) need Desknoty’s file storage, which comes with the server. Your product is saved as a draft until then.</div>
          )}
          <div className="ss-row">
            <span className="ss-cover" style={product.cover ? { backgroundImage: `url(${product.cover})` } : undefined} />
            <label className="ss-ghost cursor-pointer">
              <ImagePlus className="h-3.5 w-3.5" /> Cover image
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0], (cover) => update(product.id, { cover }))} />
            </label>
          </div>
          <Field label="Thank-you message">
            <input className="ss-input" value={product.thanks} onChange={(e) => update(product.id, { thanks: e.target.value })} placeholder="Thanks for your support!" />
          </Field>
          <div className="ss-status">
            <span>Visibility</span>
            <b>{store.payoutsEnabled ? (product.published ? 'Published' : 'Draft') : 'Draft · publish after payouts are active'}</b>
            <button type="button" className="ss-ghost ml-auto" disabled={!store.payoutsEnabled} onClick={() => update(product.id, { published: !product.published })}>
              {product.published ? 'Unpublish' : 'Publish'} {!store.payoutsEnabled && <Lock className="h-3 w-3" />}
            </button>
          </div>
          <button
            type="button"
            className="ss-danger self-start"
            onClick={() => {
              setStore((s) => ({ ...s, products: s.products.filter((x) => x.id !== product.id) }))
              setEditing(null)
            }}
          >
            Delete product
          </button>
        </>
      )}
      <p className="ss-muted">
        <ExternalLink className="mr-1 inline h-3 w-3" />
        Checkout, receipts and download links switch on with Stripe, Resend and the server.
      </p>
    </div>
  )
}
