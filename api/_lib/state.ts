/**
 * Where the last deployment was recorded.
 *
 * Serverless instances are ephemeral, so the record is kept in Upstash Redis
 * when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are configured,
 * and in memory otherwise. The in-memory fallback survives across requests on
 * a warm instance but is lost when the platform recycles it — it degrades the
 * "last deployment" row rather than breaking anything.
 */

const KEY = 'opennote:deploy:last'

export interface DeploymentRecord {
  /** When the hosting provider accepted the deployment request. */
  requestedAt: string
  provider: string
  providerLabel: string
  /** Production URL as reported at the time of the request. */
  productionUrl: string | null
  /** Whether the provider returned an accepted/queued response. */
  accepted: boolean
}

let memory: DeploymentRecord | null = null

function env(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : null
}

function redisUrl(): string | null {
  const url = env('UPSTASH_REDIS_REST_URL')
  const token = env('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? `${url.replace(/\/+$/, '')}/${token}` : null
}

export async function readLastDeployment(): Promise<DeploymentRecord | null> {
  const base = redisUrl()
  if (!base) return memory

  try {
    const res = await fetch(`${base}/get/${KEY}`, { method: 'GET' })
    if (!res.ok) return memory
    const payload: unknown = await res.json()
    const raw = (payload as { result?: unknown } | null)?.result
    if (typeof raw !== 'string' || raw === '') return null
    return JSON.parse(raw) as DeploymentRecord
  } catch {
    return memory
  }
}

export async function writeLastDeployment(record: DeploymentRecord): Promise<void> {
  memory = record

  const base = redisUrl()
  if (!base) return

  try {
    await fetch(`${base}/set/${KEY}/${encodeURIComponent(JSON.stringify(record))}`, {
      method: 'POST',
    })
  } catch {
    /* the memory copy above is still there for this instance */
  }
}