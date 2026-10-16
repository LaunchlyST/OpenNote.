/**
 * Admin session for the deployment controls.
 *
 * GET     → whether this browser currently holds an admin session
 * POST    → exchange the administrator passphrase for a session cookie
 * DELETE  → drop the session
 */
import {
  authConfigured,
  clearFailures,
  clearSessionCookie,
  hasValidSession,
  isThrottled,
  issueSessionCookie,
  recordFailure,
  verifyCredentials,
} from './_lib/auth'
import { readJsonBody, type ApiRequest, type ApiResponse } from './_lib/http'

function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  noStore(res)

  if (req.method === 'GET') {
    res.status(200).json({
      authenticated: authConfigured() && hasValidSession(req),
      authConfigured: authConfigured(),
    })
    return
  }

  if (req.method === 'POST') {
    if (!authConfigured()) {
      res.status(503).json({
        error:
          'Deployment controls are not configured on the server yet. Set DEPLOY_ADMIN_PASSWORD and SESSION_SECRET in the hosting environment.',
      })
      return
    }
    if (isThrottled(req)) {
      res.status(429).json({
        error: 'Too many attempts. Wait a few minutes and try again.',
      })
      return
    }

    const { passphrase, email } = await readJsonBody(req)
    const problem = verifyCredentials(passphrase, email)
    if (problem) {
      recordFailure(req)
      res.status(401).json({ error: problem })
      return
    }

    clearFailures(req)
    issueSessionCookie(req, res)
    res.status(200).json({ authenticated: true, authConfigured: true })
    return
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(req, res)
    res.status(200).json({ authenticated: false })
    return
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  res.status(405).json({ error: 'Method not allowed.' })
}