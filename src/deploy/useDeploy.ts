/**
 * State for the Deploy panel.
 *
 * A thin wrapper over `server/deploy.ts` — the browser never decides whether
 * a deployment is allowed, it asks the server and shows the answer. A 401 or
 * 403 from the server is the normal state for a non-administrator, so it is
 * reported as `forbidden` rather than as an error.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DeployApiError,
  getDeployStatus,
  requestDeployment,
  type DeployStatus,
} from './client'

export interface UseDeployResult {
  /** False until the first check has finished. */
  loading: boolean
  status: DeployStatus | null
  /** The server refused because this account may not deploy. */
  forbidden: boolean
  deploying: boolean
  /** Ordered progress log shown under the button. */
  steps: string[]
  error: string | null
  canDeploy: boolean
  deploy: () => Promise<void>
  refresh: () => Promise<void>
}

export function useDeploy(): UseDeployResult {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<DeployStatus | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Avoids setting state after the panel unmounts mid-request.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await getDeployStatus()
      if (!alive.current) return
      setStatus(next)
      setForbidden(false)
    } catch (err) {
      if (!alive.current) return
      setStatus(null)
      const denied = err instanceof DeployApiError && (err.status === 401 || err.status === 403)
      setForbidden(denied)
      if (!denied) {
        setError(err instanceof Error ? err.message : 'Could not reach the deployment service.')
      }
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const deploy = useCallback(async () => {
    setDeploying(true)
    setError(null)
    setSteps([
      'Sending an authenticated request to the Desknoty server…',
      `Asking ${status?.providerLabel ?? 'the host'} to rebuild the site…`,
    ])
    try {
      const result = await requestDeployment()
      if (!alive.current) return
      setStatus(result)
      setSteps((prev) => [...prev, result.message ?? 'The host accepted the deployment.'])
    } catch (err) {
      if (!alive.current) return
      setError(err instanceof Error ? err.message : 'The deployment could not be started.')
      setSteps([])
      const denied = err instanceof DeployApiError && (err.status === 401 || err.status === 403)
      if (denied) {
        setForbidden(true)
        setStatus(null)
      }
    } finally {
      if (alive.current) setDeploying(false)
    }
  }, [status?.providerLabel])

  return {
    loading,
    status,
    forbidden,
    deploying,
    steps,
    error,
    canDeploy: Boolean(status?.ready) && !deploying,
    deploy,
    refresh: load,
  }
}