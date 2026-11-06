import { lazy, Suspense, useEffect, useState } from 'react'

const GlimmerVale = lazy(() => import('./GlimmerVale'))

/**
 * OriginKit Glimmer Vale (base preset) behind the hero headline. Rendered on
 * the client only (WebGL); the dark backdrop shows first so the white
 * headline is readable before it loads. Under reduced motion the component
 * itself holds still (speed 0).
 */
export function Glimmer() {
  const [on, setOn] = useState(false)
  useEffect(() => setOn(true), [])
  return (
    <div className="lp-glimmer" aria-hidden="true">
      {on && (
        <Suspense fallback={null}>
          <GlimmerVale style={{ position: 'absolute', inset: 0 }} />
        </Suspense>
      )}
      <span className="lp-glimmer-veil" />
    </div>
  )
}
