/**
 * State for the Deploy page.
 *
 * Everything here is a thin wrapper over `api/` — the browser never decides
 * whether a deployment is allowed, it only asks the server and shows the
 * answer. A 401 from the server is treated as "show the sign-in card" rather
 * than as an error, because it is the normal state for a signed-out browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DeployApiError,
  endSession,
  getDeployStatus,
  getSession,
  requestDeployment,
  startSession,
  type DeployStatus,
  type SessionInfo,
} from './client'

export type DeployPhase = 'idle' | 'signing-in' | 'deploying' | 'done'

export interface UseDeployResult {
  /** False until the first check has finished. */
  loading: boolean
  session: SessionInfo | null
  status: DeployStatus | null
  phase: DeployPhase
  /** Ordered progress log shown under the Deploy button. */
  steps: string[]
  error: string | null
  /** The deploy API could not be reached at all. */
  unavailable: boolean
  canDeploy: boolean
  signIn: (passphrase: string, email?: string) => Promise<boolean>
  signOut: () => Promise<void>
  deploy: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof DeployApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function useDeploy(email?: string): UseDeployResult {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [status, setStatus] = useState<DeployStatus | null>(null)
  const [phase, setPhase] = useState<DeployPhase>('idle')
  const [steps, setSteps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // Guards against setting state after the section unmounts mid-request.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loadStatus = useCallback(async () => {
    const next = await getDeployStatus()
    if (alive.current) setStatus(next)
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    setUnavailable(false)
    try {
      const info = await getSession()
      if (!alive.current) return
      setSession(info)
      if (info.authenticated && info.authConfigured) {
        await loadStatus()
      } else {
        setStatus(null)
      }
    } catch (err) {
      if (!alive.current) return
      setUnavailable(err instanceof Error && err.name === 'DeployApiUnavailableError')
      setError(messageOf(err, 'Could not reach the deployment service.'))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [loadStatus])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    async (passphrase: string, accountEmail?: string) => {
      setPhase('signing-in')
      setError(null)
      setSteps(['Checking the administrator passphrase…'])
      try {
        const info = await startSession(passphrase, accountEmail ?? email)
        if (!alive.current) return false
        setSession(info)
        await loadStatus()
        setSteps([])
        setPhase('idle')
        return true
      } catch (err) {
        if (!alive.current) return false
        setUnavailable(err instanceof Error && err.name === 'DeployApiUnavailableError')
        setError(messageOf(err, 'Could not sign in.'))
        setSteps([])
        setPhase('idle')
        return false
      }
    },
    [email, loadStatus],
  )

  const signOut = useCallback(async () => {
    setError(null)
    try {
      await endSession()
      if (!alive.current) return
      setSession(null)
      setStatus(null)
      setSteps([])
      setPhase('idle')
    } catch (err) {
      if (alive.current) setError(messageOf(err, 'Could not sign out.'))
    }
  }, [])

  const deploy = useCallback(async () => {
    setPhase('deploying')
    setError(null)
    setSteps([
      'Sending an authenticated deployment request to the server…',
      'Asking the hosting provider to rebuild the site…',
    ])
    try {
      const result = await requestDeployment()
      if (!alive.current) return
      setStatus(result)
      setSteps((prev) => [
        ...prev,
        result.message ?? 'The hosting provider accepted the deployment.',
      ])
      setPhase('done')
    } catch (err) {
      if (!alive.current) return
      setError(messageOf(err, 'The deployment could not be started.'))
      setSteps([])
      setPhase('idle')
      // A 401 means the session expired; re-read it so the card flips back.
      if (err instanceof DeployApiError && err.status === 401) {
        try {
          const info = await getSession()
          if (alive.current) setSession(info)
        } catch {
          /* leave the previous session state in place */
        }
      }
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const canDeploy =
    Boolean(session?.authenticated) &&
    Boolean(status?.ready) &&
    phase !== 'deploying' &&
    phase !== 'signing-in'

  return {
    loading,
    session,
    status,
    phase,
    steps,
    error,
    unavailable,
    canDeploy,
    signIn,
    signOut,
    deploy,
    refresh,
    clearError,
  }
}