/**
 * Liveness probe for the deployment API — public, and reveals nothing but
 * whether the endpoints are mounted.
 */
import type { ApiRequest, ApiResponse } from './_lib/http'

export default function handler(_req: ApiRequest, res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, service: 'opennote-deploy' })
}