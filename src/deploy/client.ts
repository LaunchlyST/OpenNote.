/**
 * Browser side of Admin Settings → Deploy.
 *
 * This module holds no credentials and none can ever reach it: it only talks
 * to the same-origin `/api` functions in `api/`, which read the hosting
 * provider's deploy hook and the admin passphrase out of the server
 * environment. Everything that comes back has already been stripped of
 * secrets by the server.
 */

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')

function endpoint(path: string): string {
  return `${BASE}/api/${path}`
}

export class DeployApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DeployApiError'
    this.status = status
  }
}

/**
 * Signals that the deploy API is not mounted — a static host serving the
 * built site without the serverless functions, or a preview running `vite`
 * on its own. Worth distinguishing, because the fix is configuration rather
 * than a wrong passphrase.
 */
export class DeployApiUnavailableError extends Error {
  constructor() {
    super(
      'The deployment API is not available at this address. Run the site with its /api functions (e.g. `vercel dev`) or deploy it to a host that runs them.',
    )
    this.name = 'DeployApiUnavailableError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(endpoint(path), {
      credentials: 'include',
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch {
    throw new DeployApiUnavailableError()
  }

  // A static host without the functions usually answers with index.html.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new DeployApiUnavailableError()
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new DeployApiError('The server sent a response we could not read.', res.status)
  }

  const body = (payload ?? {}) as Record<string, unknown>
  if (!res.ok) {
    const message =
      typeof body.error === 'string' && body.error
        ? body.error
        : `The server refused the request (HTTP ${res.status}).`
    throw new DeployApiError(message, res.status)
  }

  return body as T
}

export interface PublicStatus {
  /** One of vercel | cloudflare-pages | netlify | custom. */
  provider: string
  providerLabel: string
  /** Whether a deploy hook is configured on the server. */
  connected: boolean
  /** Whether the server is willing to publish. */
  enabled: boolean
  productionUrl: string | null
  authConfigured: boolean
  /** Everything still missing before a first deployment, in plain English. */
  missing: string[]
  /** Whether a deployment can actually be triggered right now. */
  ready: boolean
}

export interface DeploymentRecord {
  requestedAt: string
  provider: string
  providerLabel: string
  productionUrl: string | null
  accepted: boolean
}

export interface DeployStatus extends PublicStatus {
  lastDeployment: DeploymentRecord | null
}

export interface SessionInfo {
  authenticated: boolean
  authConfigured: boolean
}

export interface DeployResult extends DeployStatus {
  message?: string
}

export function getSession(): Promise<SessionInfo> {
  return request<SessionInfo>('session')
}

export function startSession(passphrase: string, email?: string): Promise<SessionInfo> {
  return request<SessionInfo>('session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passphrase, email }),
  })
}

export function endSession(): Promise<SessionInfo> {
  return request<SessionInfo>('session', { method: 'DELETE' })
}

export function getDeployStatus(): Promise<DeployStatus> {
  return request<DeployStatus>('deploy')
}

export function requestDeployment(): Promise<DeployResult> {
  return request<DeployResult>('deploy', { method: 'POST' })
}