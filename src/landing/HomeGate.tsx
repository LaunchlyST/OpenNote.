import { Suspense, lazy, useEffect, useState } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { ComingSoon } from './ComingSoon'
import { LaunchPage } from './LaunchPage'

const NewHome = lazy(() => import('./NewHome'))
const SoonPage = lazy(() => import('./SoonPage'))
const AeroPage = lazy(() => import('./AeroPage'))
const MaintenancePage = lazy(() => import('./MaintenancePage'))

/**
 * Gate for `/`. The launch mode is set by an administrator (Settings → Launch)
 * and read from the server:
 *
 * - construction → the animated Coming soon / Under construction page
 * - waitlist     → the original waitlist page (unchanged)
 * - beta         → waitlist page, but people with a redeemed launch link go in
 * - soon         → the Coming soon / Under construction page with Join the waitlist (sign-ups stay closed)
 * - launched     → the new homepage with Start free (sign-ups open)
 */
export function HomeGate() {
  const { navigate } = useRouter()
  const [mode, setMode] = useState<'construction' | 'waitlist' | 'soon' | 'home' | null>(null)

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
      if (m === 'launched') return setMode('home')
      if (m === 'soon') return setMode('soon')
      if (m === 'beta' && access?.unlocked) return navigate('/landing', { replace: true })
      setMode(m === 'construction' ? 'construction' : 'waitlist')
    })
    return () => {
      alive = false
    }
  }, [navigate])

  // desknoty.com/?preview=coming-soon shows the Coming soon page whatever the mode (view only)
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'coming-soon') return <LaunchPage mode="construction" />
  // ?preview=maintenance: the new maintenance page, preview only until approved
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'maintenance') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b1d2e' }} />}><MaintenancePage /></Suspense>
  // ?preview=aero: the Frutiger Aero under construction page, preview only until approved
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'aero') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a84c9' }} />}><AeroPage /></Suspense>
  // desknoty.com/?preview=soon shows the new Coming soon page whatever the mode (view only)
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'soon') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#131209' }} />}><SoonPage /></Suspense>
  if (!mode) return <div style={{ minHeight: '100vh', background: '#030a06' }} />
  if (mode === 'soon') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a84c9' }} />}><AeroPage /></Suspense>
  if (mode === 'home') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}><NewHome mode="open" /></Suspense>
  // Under construction now shows the maintenance page (the older treatments stay
  // available at ?preview=aero, ?preview=soon and ?preview=coming-soon).
  if (mode === 'construction') return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b1d2e' }} />}><MaintenancePage /></Suspense>
  return <ComingSoon />
}
