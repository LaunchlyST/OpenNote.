import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const GlimmerVale = lazy(() => import('./GlimmerVale'))

/**
 * OriginKit Glimmer Vale (base preset) behind the hero headline. Client only
 * (WebGL). The gradient backdrop matches the scene's sky, so the white
 * headline reads before it loads and there is never a blank frame. The scene
 * is only mounted while the hero is near the viewport, so its render loop
 * doesn't run while you use the rest of the page. Under reduced motion the
 * component itself holds still (speed 0).
 */
export function Glimmer() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true)
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '200px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="lp-glimmer" aria-hidden="true">
      {near && (
        <Suspense fallback={null}>
          <GlimmerVale style={{ position: 'absolute', inset: 0 }} />
        </Suspense>
      )}
      <span className="lp-glimmer-veil" />
    </div>
  )
}
