import { useEffect, useRef, type HTMLAttributes } from 'react'

/**
 * Dot matrix text, adapted for Desknoty from the "dot-text" component (21st.dev).
 * Text is rasterised into a board of dots that fade between words. Desknoty
 * additions: dots near the pointer are pushed aside and spring back, and they
 * pick up the brand colours while disturbed. Static under reduced motion.
 */

export interface DotMatrixTextProps extends HTMLAttributes<HTMLDivElement> {
  text: string | string[]
  cycleInterval?: number
  dotSize?: number
  gap?: number
  activeColor?: string
  inactiveColor?: string
  fontFamily?: string
  /** Colours dots take on while the pointer disturbs them. */
  hotColors?: string[]
}

type Dot = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; on: boolean; scale: number; target: number; delay: number; heat: number; hue: number }

export function DotMatrixText({
  text,
  cycleInterval = 3600,
  dotSize = 5,
  gap = 2,
  activeColor = '#17181a',
  inactiveColor = 'rgba(23, 24, 26, 0.07)',
  fontFamily = "'Instrument Serif', serif",
  hotColors = ['#0b6fb8', '#c8ff3d', '#3f6fe0'],
  className,
  ...props
}: DotMatrixTextProps) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const key = Array.isArray(text) ? text.join('\u0000') : text

  useEffect(() => {
    const container = box.current, canvas = cv.current
    const ctx = canvas?.getContext('2d')
    if (!container || !canvas || !ctx) return
    const off = document.createElement('canvas')
    const octx = off.getContext('2d', { willReadFrequently: true })!
    const texts = Array.isArray(text) ? text : [text]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let idx = 0, dots: Dot[] = [], cols = 0, rows = 0, raf = 0, timer = 0
    const pointer = { x: -9999, y: -9999 }
    const step = dotSize + gap

    const map = (str: string) => {
      off.width = cols; off.height = rows
      octx.clearRect(0, 0, cols, rows)
      octx.textBaseline = 'middle'; octx.textAlign = 'center'
      let size = rows * 1.05
      octx.font = `400 ${size}px ${fontFamily}`
      const w = octx.measureText(str).width
      if (w > cols * 0.96) { size *= (cols * 0.96) / (w || 1); octx.font = `400 ${size}px ${fontFamily}` }
      octx.fillStyle = '#fff'
      octx.fillText(str, cols / 2, rows * 0.52)
      const data = octx.getImageData(0, 0, cols, rows).data
      const out = new Array<boolean>(cols * rows)
      for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 110
      return out
    }

    const init = () => {
      const w = container.clientWidth, h = container.clientHeight
      if (!w || !h) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.floor(w / step); rows = Math.floor(h / step)
      const ox = (w - cols * step) / 2, oy = (h - rows * step) / 2
      const m = map(texts[idx])
      const t = performance.now()
      dots = []
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const on = m[y * cols + x]
        const hx = ox + x * step + dotSize / 2, hy = oy + y * step + dotSize / 2
        dots.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, on, scale: reduce ? (on ? 1 : 0.35) : 0.35, target: on ? 1 : 0.35, delay: t + Math.random() * 500, heat: 0, hue: Math.floor(Math.random() * hotColors.length) })
      }
      if (reduce) paint()
    }

    const swap = () => {
      idx = (idx + 1) % texts.length
      const m = map(texts[idx]), t = performance.now()
      dots.forEach((d, i) => { d.on = m[i]; d.target = d.on ? 1 : 0.35; d.delay = t + Math.random() * 450 })
    }

    const paint = () => {
      const w = container.clientWidth, h = container.clientHeight
      ctx.clearRect(0, 0, w, h)
      const r = dotSize / 2
      ctx.fillStyle = inactiveColor
      ctx.beginPath()
      for (const d of dots) if (d.scale <= 0.5 && d.heat < 0.2) { ctx.moveTo(d.x + r * d.scale, d.y); ctx.arc(d.x, d.y, r * d.scale, 0, Math.PI * 2) }
      ctx.fill()
      ctx.fillStyle = activeColor
      ctx.beginPath()
      for (const d of dots) if (d.scale > 0.5 && d.heat < 0.2) { ctx.moveTo(d.x + r * d.scale, d.y); ctx.arc(d.x, d.y, r * d.scale, 0, Math.PI * 2) }
      ctx.fill()
      for (let c = 0; c < hotColors.length; c++) {
        ctx.fillStyle = hotColors[c]
        ctx.beginPath()
        for (const d of dots) if (d.heat >= 0.2 && d.hue === c && d.scale > 0.5) { const rr = r * d.scale * (1 + d.heat * 0.4); ctx.moveTo(d.x + rr, d.y); ctx.arc(d.x, d.y, rr, 0, Math.PI * 2) }
        ctx.fill()
      }
    }

    const tick = () => {
      const t = performance.now()
      const R = 70
      for (const d of dots) {
        if (t > d.delay) d.scale += (d.target - d.scale) * 0.16
        const dx = d.x - pointer.x, dy = d.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < R && d.scale > 0.5) {
          const f = (1 - dist / R) ** 2 * 3.2
          d.vx += (dx / (dist || 1)) * f; d.vy += (dy / (dist || 1)) * f
          d.heat = Math.min(1, d.heat + 0.25)
        } else d.heat *= 0.94
        // spring home
        d.vx += (d.hx - d.x) * 0.08; d.vy += (d.hy - d.y) * 0.08
        d.vx *= 0.8; d.vy *= 0.8
        d.x += d.vx; d.y += d.vy
      }
      paint()
      raf = requestAnimationFrame(tick)
    }

    const move = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(); pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top }
    const leave = () => { pointer.x = pointer.y = -9999 }
    const ro = new ResizeObserver(init)
    ro.observe(container)
    init()
    if (!reduce) {
      window.addEventListener('pointermove', move, { passive: true })
      document.addEventListener('pointerleave', leave)
      if (texts.length > 1) timer = window.setInterval(swap, cycleInterval)
      raf = requestAnimationFrame(tick)
    }
    return () => {
      ro.disconnect(); cancelAnimationFrame(raf); clearInterval(timer)
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cycleInterval, dotSize, gap, activeColor, inactiveColor, fontFamily])

  return (
    <div ref={box} className={className} {...props}>
      <canvas ref={cv} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}

export default DotMatrixText
