import { useEffect, useRef } from 'react'

/**
 * The Pro dashboard's living background: a slow field of points that drift
 * like dust in light. Near the pointer they wake up, glow and link to each
 * other into a constellation; a click sends a ring outward that pushes them
 * away. With reduced motion it draws one still frame.
 */
export function ProBackdrop({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const el = ref.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number }
    let pts: P[] = []
    const seed = () => {
      const n = Math.round(Math.min(140, (w * h) / 11000))
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.8 + Math.random() * 1.6,
        hue: Math.random() < 0.55 ? 90 : 258, // Pro lime or Pro violet
      }))
    }
    const size = () => {
      w = el.clientWidth
      h = el.clientHeight
      el.width = w * dpr
      el.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }
    size()

    const mouse = { x: -9999, y: -9999 }
    const rings: Array<{ x: number; y: number; t: number }> = []
    const REACH = 150
    let raf = 0

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const ring of rings) ring.t += 1
      while (rings.length && rings[0].t > 70) rings.shift()

      for (const p of pts) {
        // a ring pushes points outward as it passes
        for (const ring of rings) {
          const dx = p.x - ring.x
          const dy = p.y - ring.y
          const d = Math.hypot(dx, dy) || 1
          const front = ring.t * 6
          if (Math.abs(d - front) < 30) {
            p.vx += (dx / d) * 0.35
            p.vy += (dy / d) * 0.35
          }
        }
        p.vx *= 0.985
        p.vy *= 0.985
        p.vx += (Math.random() - 0.5) * 0.01
        p.vy += (Math.random() - 0.5) * 0.01
        p.x = (p.x + p.vx + w) % w
        p.y = (p.y + p.vy + h) % h
      }

      // constellation lines near the pointer
      const near = pts.filter((p) => Math.hypot(p.x - mouse.x, p.y - mouse.y) < REACH)
      ctx.lineWidth = 1
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          const a = near[i]
          const b = near[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > 90) continue
          const o = (1 - d / 90) * (1 - Math.hypot(a.x - mouse.x, a.y - mouse.y) / REACH)
          ctx.strokeStyle = dark ? `rgba(196,242,122,${o * 0.55})` : `rgba(63,125,32,${o * 0.4})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      for (const p of pts) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        const wake = Math.max(0, 1 - d / REACH)
        const alpha = (dark ? 0.22 : 0.18) + wake * 0.7
        const light = dark ? 70 : 42
        ctx.fillStyle = `hsla(${p.hue}, 80%, ${light}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + wake * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const ring of rings) {
        const o = 1 - ring.t / 70
        ctx.strokeStyle = dark ? `rgba(167,139,250,${o * 0.5})` : `rgba(109,75,216,${o * 0.35})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(ring.x, ring.y, ring.t * 6, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (!still) raf = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const leave = () => {
      mouse.x = mouse.y = -9999
    }
    const click = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input, select, [role="menu"]')) return
      const r = el.getBoundingClientRect()
      rings.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: 0 })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', click)
    document.addEventListener('pointerleave', leave)
    window.addEventListener('resize', size)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', click)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', size)
    }
  }, [dark])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
}
