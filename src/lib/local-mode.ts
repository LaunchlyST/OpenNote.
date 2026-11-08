import { API_BASE } from './api-base'

/**
 * Local mode: the app without a server.
 *
 * The static build (GitHub Pages) has no API, so accounts, projects and
 * preferences cannot be stored anywhere. This module answers the app's own
 * API requests from localStorage instead — same paths, same JSON — so the app
 * runs unchanged. Sign-up is limited to ALLOWED_EMAIL_SHA256, and the
 * password is kept as a PBKDF2 hash.
 *
 * It switches on only when the real API does not answer. Wherever a server
 * runs, every request goes to it as before. Accounts and data saved here live
 * in this browser only, and clearing site data removes them.
 */

const STORE = 'desknoty.local.v1'
const LOCAL_ID = 'local-user'

interface LocalUser {
  name: string
  email: string
  image: string | null
  createdAt: string
}

interface LocalProject {
  id: string
  workspace: 'free' | 'pro'
  name: string
  color: string
  description: string
  data: { events?: unknown[]; notes?: unknown[]; [k: string]: unknown }
  createdAt: string
  updatedAt: string
  openedAt: string | null
}

interface LocalAccount {
  email: string
  salt: string
  hash: string
}

interface LocalState {
  signedIn: boolean
  account?: LocalAccount
  user: LocalUser
  projects: LocalProject[]
  preferences: Record<string, unknown>
}

function load(): LocalState {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return JSON.parse(raw) as LocalState
  } catch {
    /* fall through to a fresh state */
  }
  return {
    signedIn: false,
    user: { name: 'You', email: 'you@desknoty.local', image: null, createdAt: new Date().toISOString() },
    projects: [],
    preferences: {},
  }
}

function save(state: LocalState) {
  try {
    localStorage.setItem(STORE, JSON.stringify(state))
  } catch {
    /* storage full or blocked: the change lasts until reload */
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const summary = (p: LocalProject) => ({
  id: p.id,
  workspace: p.workspace,
  name: p.name,
  color: p.color,
  description: p.description,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  openedAt: p.openedAt,
  eventCount: p.data.events?.length ?? 0,
  noteCount: p.data.notes?.length ?? 0,
})

function session(state: LocalState) {
  if (!state.signedIn) return null
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()
  return {
    session: { id: 'local-session', userId: LOCAL_ID, token: 'local', expiresAt, createdAt: state.user.createdAt, updatedAt: state.user.createdAt },
    user: {
      id: LOCAL_ID,
      name: state.user.name,
      email: state.user.email,
      image: state.user.image,
      emailVerified: true,
      createdAt: state.user.createdAt,
      updatedAt: state.user.createdAt,
      role: 'user',
      // the one account this device allows is the owner's: Pro on the house
      plan: 'pro',
    },
  }
}

const id = () => `prj_${crypto.randomUUID()}`

/**
 * Who may create an account on this device: SHA-256 of the allowed emails, so
 * the addresses themselves are not in the page source.
 */
const ALLOWED_EMAIL_SHA256 = ['b51200d565a693046e5c8b0947276b013806e82312429a7ad98663e057756962']

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/** PBKDF2-SHA256, so the stored password can't be read back. */
async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210_000 },
    key,
    256,
  )
  return hex(bits)
}

const authError = (status: number, code: string, message: string) => json(status, { code, message })

/** Answers one API request from local storage. */
async function handle(method: string, path: string, search: string, body: Record<string, unknown>): Promise<Response> {
  const state = load()
  const now = new Date().toISOString()

  if (path === '/api/auth-config') return json(200, { google: false, emailVerificationRequired: false, emailEnabled: false })

  // ---- auth (Better Auth's paths) ----
  if (path.startsWith('/api/auth/')) {
    const route = path.slice('/api/auth'.length)
    if (route === '/get-session') return json(200, session(state))
    if (route === '/sign-up/email') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      if (!ALLOWED_EMAIL_SHA256.includes(await sha256(email))) {
        return authError(403, 'SIGNUP_CLOSED', 'Sign-up is invite only for now. Join the waitlist instead.')
      }
      if (state.account) return authError(422, 'USER_ALREADY_EXISTS', 'An account with that email already exists.')
      if (password.length < 10) return authError(400, 'PASSWORD_TOO_SHORT', 'Your password must be at least 10 characters.')
      const salt = crypto.randomUUID()
      state.account = { email, salt, hash: await hashPassword(password, salt) }
      state.user.email = email
      state.user.name = String(body.name ?? '').trim() || email.split('@')[0]
      state.user.createdAt = now
      state.signedIn = true
      save(state)
      return json(200, { token: 'local', user: session(state)!.user })
    }
    if (route === '/sign-in/email') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const a = state.account
      if (!a || a.email !== email || (await hashPassword(String(body.password ?? ''), a.salt)) !== a.hash) {
        return authError(401, 'INVALID_EMAIL_OR_PASSWORD', 'Incorrect email or password. Please try again.')
      }
      state.signedIn = true
      save(state)
      return json(200, { token: 'local', user: session(state)!.user, redirect: false })
    }
    if (route === '/change-password') {
      const a = state.account
      if (!a || (await hashPassword(String(body.currentPassword ?? ''), a.salt)) !== a.hash) {
        return authError(400, 'INVALID_PASSWORD', 'Your current password is incorrect.')
      }
      const next = String(body.newPassword ?? '')
      if (next.length < 10) return authError(400, 'PASSWORD_TOO_SHORT', 'Your password must be at least 10 characters.')
      a.salt = crypto.randomUUID()
      a.hash = await hashPassword(next, a.salt)
      save(state)
      return json(200, { status: true })
    }
    if (route === '/sign-out') {
      state.signedIn = false
      save(state)
      return json(200, { success: true })
    }
    if (route === '/update-user') {
      if (typeof body.name === 'string' && body.name.trim()) state.user.name = body.name.trim()
      if ('image' in body) state.user.image = (body.image as string | null) ?? null
      save(state)
      return json(200, { status: true })
    }
    if (route === '/request-password-reset' || route === '/send-verification-email') {
      return json(400, { code: 'LOCAL_MODE', message: 'Email links aren’t available on this device. Your account lives in this browser.' })
    }
    return json(404, { message: 'Not available on this device.' })
  }

  if (!state.signedIn) return json(401, { error: 'Not signed in.' })

  // ---- preferences ----
  if (path === '/api/preferences') {
    if (method === 'PATCH') {
      state.preferences = { ...state.preferences, ...((body.preferences as Record<string, unknown>) ?? {}) }
      save(state)
    }
    return json(200, { preferences: state.preferences })
  }

  // ---- projects ----
  if (path === '/api/projects' || path.startsWith('/api/projects/')) {
    const parts = path.slice('/api/projects'.length).split('/').filter(Boolean).map(decodeURIComponent)
    const query = new URLSearchParams(search)
    const ws = (parts.length ? undefined : (query.get('workspace') ?? body.workspace)) as string | undefined

    if (!parts.length && method === 'GET') {
      const list = state.projects.filter((p) => p.workspace === (ws === 'pro' ? 'pro' : 'free')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return json(200, { projects: list.map(summary) })
    }
    if (!parts.length && method === 'POST') {
      const name = String(body.name ?? '').trim().slice(0, 80)
      if (!name) return json(400, { error: 'Give the project a name (up to 80 characters).' })
      const color = String(body.color ?? 'lime')
      const p: LocalProject = {
        id: id(),
        workspace: ws === 'pro' ? 'pro' : 'free',
        name,
        color,
        description: String(body.description ?? '').slice(0, 280),
        data: { events: [], calendars: [{ id: 'cal_main', name: 'My calendar', color, visible: true }], notes: [], settings: {} },
        createdAt: now,
        updatedAt: now,
        openedAt: now,
      }
      state.projects.push(p)
      save(state)
      return json(201, { project: summary(p) })
    }

    const p = state.projects.find((x) => x.id === parts[0])
    if (!p) return json(404, { error: 'Project not found.' })
    const action = parts[1]

    if (!action && method === 'GET') {
      if (new URLSearchParams(search).get('peek') === '1') return json(200, { project: summary(p), data: p.data })
      p.openedAt = now
      save(state)
      return json(200, { project: summary(p), data: p.data })
    }
    if (!action && method === 'PATCH') {
      if (typeof body.name === 'string' && body.name.trim()) p.name = body.name.trim().slice(0, 80)
      if (typeof body.color === 'string') p.color = body.color
      if (typeof body.description === 'string') p.description = body.description.slice(0, 280)
      p.updatedAt = now
      save(state)
      return json(200, { project: summary(p) })
    }
    if (!action && method === 'DELETE') {
      state.projects = state.projects.filter((x) => x !== p)
      save(state)
      return json(200, { ok: true })
    }
    if (action === 'data' && method === 'PUT') {
      if (body.data && typeof body.data === 'object') p.data = body.data as LocalProject['data']
      p.updatedAt = now
      save(state)
      return json(200, { ok: true, updatedAt: now })
    }
    if (action === 'duplicate' && method === 'POST') {
      const copy = { ...structuredClone(p), id: id(), name: `${p.name} (copy)`.slice(0, 80), createdAt: now, updatedAt: now, openedAt: null }
      state.projects.push(copy)
      save(state)
      return json(201, { project: summary(copy) })
    }
  }

  return json(404, { error: 'Not found.' })
}

/** Paths local mode answers. Everything else (waitlist, invite) goes to the network. */
const LOCAL_PATHS = /^\/api\/(auth-config|auth\/|projects|preferences)/

let decided: Promise<boolean> | null = null

/** Whether this page runs without an API (asked once, then remembered for the page). */
function shouldUseLocal(realFetch: typeof fetch): Promise<boolean> {
  decided ??= realFetch(`${API_BASE}/api/auth-config`)
    .then(async (res) => {
      const body = await res.json().catch(() => null)
      return !res.ok || body === null
    })
    .catch(() => true)
  return decided
}

/** Routes the app's API calls to local storage when no server answers. Call once, before the app renders. */
export function installLocalMode() {
  if (typeof window === 'undefined') return
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init)
    const url = new URL(req.url, window.location.origin)
    const base = API_BASE ? new URL(API_BASE).origin : window.location.origin
    if (url.origin !== base || !LOCAL_PATHS.test(url.pathname) || !(await shouldUseLocal(realFetch))) return realFetch(input, init)
    const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
    let body: Record<string, unknown> = {}
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      /* not JSON: treat as empty */
    }
    return handle(req.method, url.pathname, url.search, body)
  }
}
