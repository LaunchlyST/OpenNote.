import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../lib/api-base'
import { storeApi } from '../projects/seller/api'

/**
 * GitHub Pages cannot issue a dynamic redirect, so /p/<shortId> is served by
 * the SPA shell. This bootstrap asks the API where the link goes, then hands
 * the browser to the server's checked redirect endpoint (affiliate) or to the
 * normal product page. The Amazon URL never enters this bundle.
 */
export default function ShortLink({ shortId }: { shortId: string }) {
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    let alive = true
    storeApi.shortLink(shortId).then((link) => {
      if (!alive) return
      const target = link.kind === 'affiliate' ? apiUrl(link.path) : link.path
      window.location.replace(target)
    }).catch((e: Error) => {
      if (alive) setError(e.message || 'This product link isn’t available.')
    })
    return () => { alive = false }
  }, [shortId])

  return (
    <div className="ps">
      <main className="ps-main">
        <div className="ps-msg" aria-live="polite">
          <h1>{error ? 'Link unavailable' : 'Opening product…'}</h1>
          {error && <p>{error}</p>}
          {error && <a href="/">Back to Desknoty</a>}
        </div>
      </main>
    </div>
  )
}
