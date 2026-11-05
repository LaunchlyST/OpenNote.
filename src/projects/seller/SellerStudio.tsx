import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Check, Copy, ExternalLink, ImagePlus, Landmark, Lock, Monitor, Package, Smartphone, Store } from 'lucide-react'
import { cn } from '../../lib/id'
import { useAuth } from '../../auth'
import { StorePage } from './StorePage'
import {
  BUTTON_STYLES,
  CURRENCIES,
  FONTS,
  PLATFORM_FEE_PERCENT,
  PRESETS,
  emptyProduct,
  handleProblem,
  loadStore,
  saveStore,
} from './model'
import type { Product, StoreDraft } from './model'

/**
 * Seller Studio: a creator storefront builder with a live phone preview.
 *
 * Everything here is a draft saved in this browser. Taking money, TikTok
 * login, receipts and public handle.desknoty.com pages need a running
 * server plus Stripe, TikTok and Resend accounts; until those exist the
 * steps that depend on them say so instead of pretending to work.
 */

type StepId = 'profile' | 'customize' | 'bank' | 'product'
const STEPS: Array<{ id: StepId; title: string }> = [
  { id: 'profile', title: 'Your profile' },
  { id: 'customize', title: 'Name & customise your page' },
  { id: 'bank', title: 'Connect your bank' },
  { id: 'product', title: 'Add your digital product' },
]

export function SellerStudio() {
  const { user } = useAuth()
  const [store, setStore] = useState<StoreDraft>(() => loadStore(user?.fullName ?? '', user?.avatar ?? null))
  const [step, setStep] = useState<StepId>(store.name ? 'customize' : 'profile')
  const [view, setView] = useState<'mobile' | 'desktop'>('mobile')
  const [copied, setCopied] = useState(false)
  useEffect(() => saveStore(store), [store])

  const patch = (p: Partial<StoreDraft>) => setStore((s) => ({ ...s, ...p }))
  const done: Record<StepId, boolean> = {
    profile: Boolean(store.name.trim()),
    customize: Boolean(store.handle) && !handleProblem(store.handle),
    bank: store.payoutsEnabled,
    product: store.products.some((p) => p.title.trim()),
  }
  const link = store.handle ? `${store.handle}.desknoty.com` : 'yourname.desknoty.com'

  return (
    <div className="ss">
      <section className="ss-editor" aria-label="Store builder">
        <header className="ss-head">
          <p className="ss-kicker">Seller · Digital products</p>
          <h1>Your store</h1>
          <p className="ss-lede">
            Sell downloads and templates from one link. Desknoty takes {PLATFORM_FEE_PERCENT}% of every sale.
          </p>
        </header>

        <ol className="ss-steps">
          {STEPS.map((s, i) => {
            const open = s.id === step
            return (
              <li key={s.id} className={cn('ss-step', open && 'ss-step-open', done[s.id] && 'ss-step-done')}>
                <button type="button" className="ss-step-head" onClick={() => setStep(s.id)} aria-expanded={open}>
                  <span className="ss-dot" aria-hidden="true">
                    {done[s.id] ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="ss-step-title">{s.title}</span>
                  <span className="ss-step-state">{done[s.id] ? 'Done' : open ? 'In progress' : ''}</span>
                </button>
                {open && (
                  <div className="ss-step-body">
                    {s.id === 'profile' && <ProfileStep store={store} patch={patch} next={() => setStep('customize')} />}
                    {s.id === 'customize' && <CustomizeStep store={store} patch={patch} next={() => setStep('bank')} />}
                    {s.id === 'bank' && <BankStep store={store} next={() => setStep('product')} />}
                    {s.id === 'product' && <ProductStep store={store} setStore={setStore} />}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>

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
            {store.name.trim() ? (
              <StorePage store={store} />
            ) : (
              <div className="ss-empty">
                <Store className="h-6 w-6" />
                <p>Add your name to start your store</p>
                <button type="button" onClick={() => setStep('profile')}>
                  Set up profile
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="ss-url">{link}</p>
      </aside>
    </div>
  )
}

/* -------------------------------------------------------------- steps --- */

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

function ProfileStep({ store, patch, next }: { store: StoreDraft; patch: (p: Partial<StoreDraft>) => void; next: () => void }) {
  return (
    <div className="ss-stack">
      <div className="ss-note">
        <b>Continue with TikTok</b> is coming: it needs a TikTok developer app linked to Desknoty. For now, add your details by hand.
      </div>
      <button type="button" className="ss-tiktok" disabled title="Needs a TikTok developer app">
        <span aria-hidden="true">♪</span> Continue with TikTok
        <Lock className="ml-auto h-3.5 w-3.5" />
      </button>
      <Field label="Display name">
        <input className="ss-input" value={store.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Matas Studio" />
      </Field>
      <div className="ss-row">
        <span className="ss-avatar" style={store.avatar ? { backgroundImage: `url(${store.avatar})` } : undefined}>
          {!store.avatar && (store.name.trim().charAt(0).toUpperCase() || '?')}
        </span>
        <label className="ss-ghost cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" /> Upload photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0], (avatar) => patch({ avatar }))} />
        </label>
      </div>
      <button type="button" className="ss-primary" disabled={!store.name.trim()} onClick={next}>
        Continue
      </button>
    </div>
  )
}

function CustomizeStep({ store, patch, next }: { store: StoreDraft; patch: (p: Partial<StoreDraft>) => void; next: () => void }) {
  const problem = store.handle ? handleProblem(store.handle) : null
  const theme = store.theme
  const setTheme = (t: Partial<StoreDraft['theme']>) => patch({ theme: { ...theme, ...t } })
  return (
    <div className="ss-stack">
      <Field
        label="Store link"
        hint={problem ? <span className="text-[#ff8a80]">{problem}</span> : store.handle ? `✓ ${store.handle}.desknoty.com is free to claim` : '3–30 characters: letters, numbers and hyphens'}
      >
        <div className="ss-affix">
          <input
            className="ss-input"
            value={store.handle}
            maxLength={30}
            onChange={(e) => patch({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder="yourname"
          />
          <span>.desknoty.com</span>
        </div>
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
              style={{ '--bg': p.bg, '--ink': p.ink, '--ac': p.accent } as CSSProperties}
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
      <button type="button" className="ss-primary" disabled={!store.handle || Boolean(problem)} onClick={next}>
        Continue
      </button>
    </div>
  )
}

function BankStep({ store, next }: { store: StoreDraft; next: () => void }) {
  return (
    <div className="ss-stack">
      <p className="ss-big">
        Get 100% of every sale sent straight to your bank. Desknoty takes {PLATFORM_FEE_PERCENT}%.
      </p>
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
        Connecting a bank needs a Stripe account with Connect switched on and Desknoty’s server online. Until then you can
        build and draft products; publishing unlocks once payouts are active.
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
  const update = (id: string, p: Partial<Product>) =>
    setStore((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  const add = () => {
    const p = emptyProduct()
    setStore((s) => ({ ...s, products: [...s.products, p] }))
    setEditing(p.id)
  }
  const symbol = useMemo(() => CURRENCIES.find((c) => c.code === product?.currency)?.symbol ?? '£', [product?.currency])

  return (
    <div className="ss-stack">
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
            <div className="ss-note">
              File uploads (up to 2 GB, kept private) need Desknoty’s file storage, which comes with the server. Your product
              is saved as a draft until then.
            </div>
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
