import { useEffect, useState } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { LaunchPage } from './LaunchPage'
import type { PreMode } from './LaunchPage'

/**
 * Gate for `/`. The launch mode is set by an administrator (Settings → Launch)
 * and read from the server:
 *
 * - construction → the Under construction page (Notify me joins the waitlist)
 * - waitlist     → the waitlist page
 * - beta         → waitlist page, but people with a redeemed launch link go in
 * - launched     → everyone goes straight to the landing page
 */
export function HomeGate() {
  const { navigate } = useRouter()
  const [mode, setMode] = useState<PreMode | null>(null)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      fetch(apiUrl('/api/launch/status')).then((r) => (r.ok ? r.json() : { mode: 'waitlist' })),
      fetch(apiUrl('/api/early-access/status'), { credentials: 'include' }).then((r) => (r.ok ? r.json() : { unlocked: false })),
    ]).then((results) => {
      if (!alive) return
      const launch = results[0].status === 'fulfilled' ? results[0].value : { mode: 'waitlist' }
      const access = results[1].status === 'fulfilled' ? results[1].value : { unlocked: false }
      const m = launch?.mode
      if (m === 'launched' || (m === 'beta' && access?.unlocked)) return navigate('/landing', { replace: true })
      setMode(m === 'construction' ? 'construction' : 'waitlist')
    })
    return () => {
      alive = false
    }
  }, [navigate])

  if (!mode) return <div style={{ minHeight: '100vh', background: '#030a06' }} />
  return <LaunchPage mode={mode} />
}
