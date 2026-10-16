/**
 * The deployment endpoint behind Admin Settings → Deploy.
 *
 * GET  → deployment status (requires an admin session)
 * POST → trigger a real deployment (requires an admin session AND the server
 *        having been explicitly switched on with `DEPLOY_ENABLED=true`)
 *
 * The hosting provider is contacted through a *deploy hook* — the provider's
 * own "rebuild and publish the latest commit" URL. The hook URL lives only in
 * the server environment, so the browser never holds a hosting credential.
 *
 * While `DEPLOY_ENABLED` is unset (the default) POST always refuses. That is
 * the switch that keeps real deployments off until they are deliberately
 * switched on.
 */
import { authConfigured, hasValidSession } from './_lib/auth'
import { publicStatus, readConfig } from './_lib/config'
import {
  readLastDeployment,
  writeLastDeployment,
  type DeploymentRecord,
} from './_lib/state'
import type { ApiRequest, ApiResponse } from './_lib/http'

/** Refuses to fire twice in a row, so a double click cannot queue two builds. */
const MIN_SECONDS_BETWEEN = 60
const HOOK_TIMEOUT_MS = 15_000

function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store')
}

async function statusPayload() {
  const config = readConfig()
  return {
    ...publicStatus(config),
    lastDeployment: await readLastDeployment(),
  }
}

async function handleStatus(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!authConfigured()) {
    res.status(503).json({
      error:
        'Deployment controls are not configured on the server yet. Set DEPLOY_ADMIN_PASSWORD and SESSION_SECRET in the hosting environment.',
      authConfigured: false,
    })
    return
  }
  if (!hasValidSession(req)) {
    res.status(401).json({ error: 'Sign in as the deployment administrator first.' })
    return
  }
  res.status(200).json(await statusPayload())
}

async function handleDeploy(req: ApiRequest, res: ApiResponse): Promise<void> {
  const config = readConfig()

  if (!authConfigured() || !hasValidSession(req)) {
    res.status(401).json({
      error: 'Sign in as the deployment administrator first.',
    })
    return
  }

  // Order matters: report the most actionable blocker first.
  if (!config.connected || !config.hookUrl) {
    res.status(409).json({
      error: `No hosting provider is connected. Set DEPLOY_HOOK_URL for ${config.providerLabel} in the server environment.`,
    })
    return
  }
  if (!config.enabled) {
    res.status(403).json({
      error:
        'Deployments are switched off. Set DEPLOY_ENABLED=true in the server environment when you are ready to publish.',
    })
    return
  }

  const last = await readLastDeployment()
  if (last) {
    const secondsSince = (Date.now() - Date.parse(last.requestedAt)) / 1000
    if (Number.isFinite(secondsSince) && secondsSince < MIN_SECONDS_BETWEEN) {
      res.status(429).json({
        error: `A deployment was already requested ${Math.ceil(MIN_SECONDS_BETWEEN - secondsSince)}s ago. Give the current build a moment to finish.`,
        lastDeployment: last,
      })
      return
    }
  }

  let response: Response
  try {
    response = await fetch(config.hookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'opennote-admin',
        requestedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    })
  } catch (error) {
    res.status(502).json({
      error: `Could not reach ${config.providerLabel}: ${
        error instanceof Error ? error.message : 'unknown network error'
      }.`,
    })
    return
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    res.status(502).json({
      error: `${config.providerLabel} rejected the deployment request (HTTP ${response.status})${detail ? `: ${detail}` : ''}.`,
    })
    return
  }

  const record: DeploymentRecord = {
    requestedAt: new Date().toISOString(),
    provider: config.provider,
    providerLabel: config.providerLabel,
    productionUrl: config.productionUrl,
    accepted: true,
  }
  await writeLastDeployment(record)

  res.status(202).json({
    ...(await statusPayload()),
    message: `${config.providerLabel} accepted the deployment and is building it now. The live site updates when the build finishes.`,
  })
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  noStore(res)

  if (req.method === 'GET') {
    await handleStatus(req, res)
    return
  }
  if (req.method === 'POST') {
    await handleDeploy(req, res)
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed.' })
}