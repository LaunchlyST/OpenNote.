/** Seller Studio data: one store draft per browser (no server yet). */

/** Desknoty's cut of each sale. Sellers keep the rest, minus Stripe's fee. */
export const PLATFORM_FEE_PERCENT = 0

export interface Product {
  id: string
  type: 'download' | 'link' | 'bundle'
  title: string
  short: string
  price: string
  currency: string
  pwyw: boolean
  cover: string | null
  url: string
  thanks: string
  published: boolean
}

export type StepId = 'start' | 'tiktok' | 'link' | 'customize' | 'bank' | 'product'

export interface StoreDraft {
  /** The furthest step reached; reopening the studio continues here. */
  step: StepId
  tiktok: { connected: boolean; manual: boolean; username: string }
  link: { mode: 'free' | 'domain'; domain: string; domainStatus: 'none' | 'waiting' | 'verifying' | 'connected' }
  name: string
  handle: string
  bio: string
  avatar: string | null
  theme: {
    preset: string
    accent: string
    font: string
    button: 'rounded' | 'pill' | 'sharp'
    background: 'solid' | 'gradient'
  }
  socials: { instagram: string; youtube: string; x: string; website: string }
  payoutsEnabled: boolean
  products: Product[]
}

export const PRESETS = [
  { id: 'clean', label: 'Clean White', bg: '#ffffff', ink: '#111114', accent: '#111114' },
  { id: 'midnight', label: 'Midnight', bg: '#0f1220', ink: '#f4f4f5', accent: '#c8ff3d' },
  { id: 'sand', label: 'Sand', bg: '#f4ede2', ink: '#2b2419', accent: '#b8743a' },
  { id: 'lime', label: 'Neon Lime', bg: '#c8ff3d', ink: '#0b0b0f', accent: '#0b0b0f' },
  { id: 'pink', label: 'Soft Pink', bg: '#ffe4ee', ink: '#3b1424', accent: '#e8487a' },
  { id: 'mono', label: 'Mono', bg: '#18181b', ink: '#fafafa', accent: '#fafafa' },
]

export const FONTS = [
  { id: 'geist', label: 'Geist', css: "'Geist', system-ui, sans-serif" },
  { id: 'grotesque', label: 'Bricolage', css: "'Bricolage Grotesque', system-ui, sans-serif" },
  { id: 'serif', label: 'Instrument Serif', css: "'Instrument Serif', Georgia, serif" },
]

export const BUTTON_STYLES = ['rounded', 'pill', 'sharp'] as const

export const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
]

const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'dashboard', 'help', 'blog'])

/** Why a store handle can't be used, or null if it's fine. */
export function handleProblem(h: string): string | null {
  if (h.length < 3) return 'At least 3 characters.'
  if (h.length > 30) return 'At most 30 characters.'
  if (!/^[a-z0-9-]+$/.test(h)) return 'Only lowercase letters, numbers and hyphens.'
  if (h.startsWith('-') || h.endsWith('-')) return 'Can’t start or end with a hyphen.'
  if (RESERVED.has(h)) return 'That name is reserved.'
  return null
}

export function emptyProduct(): Product {
  return {
    id: crypto.randomUUID(),
    type: 'download',
    title: '',
    short: '',
    price: '9',
    currency: 'GBP',
    pwyw: false,
    cover: null,
    url: '',
    thanks: '',
    published: false,
  }
}

// v2: the onboarding flow starts from zero
const KEY = 'desknoty.seller.store.v2'

export function loadStore(): StoreDraft {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as StoreDraft
  } catch {
    /* fresh draft */
  }
  return {
    step: 'start',
    tiktok: { connected: false, manual: false, username: '' },
    link: { mode: 'free', domain: '', domainStatus: 'none' },
    name: '',
    handle: '',
    bio: '',
    avatar: null,
    theme: { preset: 'clean', accent: '#111114', font: 'geist', button: 'rounded', background: 'solid' },
    socials: { instagram: '', youtube: '', x: '', website: '' },
    payoutsEnabled: false,
    products: [],
  }
}

export function saveStore(s: StoreDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage full (large images) or blocked: keeps working for this visit */
  }
}

/** A TikTok username as a store handle: lowercase, hyphens for anything else. */
export function toHandle(u: string): string {
  return u.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

/** A plausible custom domain like shop.example.com. */
export function domainProblem(d: string): string | null {
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return 'Enter a domain like shop.yourname.com'
  if (d.endsWith('desknoty.com')) return 'Use your own domain here, not desknoty.com'
  return null
}

/** TikTok Login Kit needs a client key from a TikTok developer app. */
export const TIKTOK_CLIENT_KEY = (import.meta.env.VITE_TIKTOK_CLIENT_KEY ?? '').trim()
