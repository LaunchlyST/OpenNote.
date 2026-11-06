import { useEffect } from 'react'
import { apiUrl } from '../lib/api-base'
import { useRouter } from '../router'
import { ComingSoon } from './ComingSoon'

/**
 * Gate for `/`.
 *
 * The Coming Soon (waitlist) page is the default. Once the site moves into
 * beta, waitlist members who redeemed their launch link skip it and go
 * straight to the landing page; everyone else still sees it. Once beta ends
 * (fully launched), the waitlist page is gone for everyone.
 */
export function HomeGate() {
  const { navigate } = useRouter()

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      fetch(apiUrl('/api/launch/status')).then((r) => (r.ok ? r.json() : { mode: 'waitlist' })),
      fetch(apiUrl('/api/early-access/status'), { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : { unlocked: false },
      ),
    ]).then((results) => {
      if (!alive) return
      const launch = results[0].status === 'fulfilled' ? results[0].value : { mode: 'waitlist' }
      const access = results[1].status === 'fulfilled' ? results[1].value : { unlocked: false }
      const mode = launch?.mode
      const unlocked = Boolean(access?.unlocked)
      if (mode === 'launched' || (mode === 'beta' && unlocked)) {
        navigate('/landing', { replace: true })
      }
    })
    return () => {
      alive = false
    }
  }, [navigate])

  return <ComingSoon />
}
