/**
 * Browser client for the deployment API.
 *
 * The app already has a signed-in Better Auth session, so this sends no
 * credentials of its own and holds none. Hosting credentials live only in the
 * server's environment; everything returned here has already been stripped of
 * secrets by `server/deploy.ts`.
 *
 * Requests go to `/api/deploy`, which the Vite dev server proxies to the
 * Express server in production and development alike.
 */

export class DeployApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DeployApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch {
    throw new DeployApiError(
      'Could not reach the Desknoty server. Is `npm run dev` running?',
      0,
    )
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const message =
      typeof body.error === 'string' && body.error
        ? body.error
        : `The server refused the request (HTTP ${res.status}).`
    throw new DeployApiError(message, res.status)
  }
  return body as T
}

export interface DeploymentRecord {
  requestedAt: string
  provider: string
  providerLabel: string
  productionUrl: string | null
  accepted: boolean
}

export interface DeployStatus {
  provider: string
  providerLabel: string
  /** Whether a deploy hook is configured on the server. */
  connected: boolean
  /** Whether the server is willing to publish. */
  enabled: boolean
  productionUrl: string | null
  /** Everything still missing before a first deployment, in plain English. */
  missing: string[]
  /** Whether a deployment can actually be triggered right now. */
  ready: boolean
  lastDeployment: DeploymentRecord | null
}

export interface DeployResult extends DeployStatus {
  message?: string
}

export function getDeployStatus(): Promise<DeployStatus> {
  return request<DeployStatus>('/api/deploy')
}

export function requestDeployment(): Promise<DeployResult> {
  return request<DeployResult>('/api/deploy', { method: 'POST' })
}