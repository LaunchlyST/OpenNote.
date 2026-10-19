import { useEffect, useState } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { LandingPage } from './LandingPage'
import { Logo } from './components/primitives'

/**
 * Guards `/landing` behind the early-access gate.
 *
 * The verdict always comes from the server (`GET /api/early-access/status`):
 * the httpOnly access cookie can only be earned by redeeming the invite code
 * through the API, so direct navigation to `/landing` is checked by the
 * backend, not by anything the page remembers itself. Locked browsers are
 * sent back to the Coming Soon screen.
 */
export function LandingGate() {
  const [state, setState] = useState<'checking' | 'open' | 'locked'>('checking')
  const { navigate } = useRouter()

  useEffect(() => {
    let alive = true
    fetch(apiUrl('/api/early-access/status'), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((data: { unlocked?: boolean }) => {
        if (alive) setState(data.unlocked ? 'open' : 'locked')
      })
      .catch(() => {
        if (alive) setState('locked')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (state === 'locked') navigate('/', { replace: true })
  }, [state, navigate])

  if (state !== 'open') {
    return (
      <div className="grid min-h-screen place-items-center bg-lp-bg">
        <Logo />
      </div>
    )
  }
  return <LandingPage />
}
