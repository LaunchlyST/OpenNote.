import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../../lib/id'

/**
 * Renders children at a fixed natural size and scales them to the width of
 * the container — up as well as down — so interface close-ups stay crisp and
 * proportional at every breakpoint without ever overflowing.
 */
export function FitStage({
  width,
  height,
  children,
  className,
  maxScale = 1.6,
}: {
  width: number
  height: number
  children: ReactNode
  className?: string
  maxScale?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setScale(Math.min(maxScale, w / width))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, maxScale])

  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
