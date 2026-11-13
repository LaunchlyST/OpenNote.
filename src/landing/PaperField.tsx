import { useEffect, useRef } from 'react'

/**
 * Background for the under construction page: dotted notebook paper.
 * Dots near the pointer swell into little confetti shapes in Desknoty's sticker
 * colours and settle back afterwards, leaving a soft trail. With no pointer
 * (phones) a slow wanderer does the same.
 */
const STEP = 26
const COLORS = ['#b9f53a', '#e36b62', '#f2c94c', '#3f6fe0', '#7aa35a']

export function PaperField({ reduced }: { reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0, h = 0, cols = 0, rows = 0
    let heat = new Float32Array(0)
    const size = () => {
      w = el.clientWidth; h = el.clientHeight
      el.width = w * dpr; el.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / STEP) + 1; rows = Math.ceil(h / STEP) + 1
      heat = new Float32Array(cols * rows)
    }
    size()

    const target = { x: w * 0.5, y: h * 0.45 }
    const pos = { ...target }
    let pointer = false, raf = 0
    const start = performance.now()

    const draw = (t: number) => {
      if (!pointer) {
        const s = (t - start) / 1000
        target.x = w * (0.5 + 0.34 * Math.sin(s * 0.21))
        target.y = h * (0.45 + 0.3 * Math.sin(s * 0.33 + 1.3))
      }
      pos.x += (target.x - pos.x) * 0.16
      pos.y += (target.y - pos.y) * 0.16

      ctx.clearRect(0, 0, w, h)
      const r2 = 2 * 90 * 90
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = r * cols + c
          const x = c * STEP + STEP / 2, y = r * STEP + STEP / 2
          const near = Math.exp(-((x - pos.x) ** 2 + (y - pos.y) ** 2) / r2)
          // heat rises fast and cools slowly: a trail behind the pointer
          heat[k] = Math.max(near, heat[k] * 0.965)
          const v = heat[k]
          if (v < 0.04) {
            ctx.fillStyle = 'rgba(21, 19, 11, 0.13)'
            ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill()
            continue
          }
          const color = COLORS[(r * 7 + c * 3) % COLORS.length]
          const size = 1.1 + v * 7
          const spin = ((r * 13 + c * 29) % 360) * (Math.PI / 180) + v * 1.2
          ctx.save()
          ctx.translate(x, y); ctx.rotate(spin)
          ctx.globalAlpha = 0.25 + v * 0.75
          ctx.fillStyle = color
          const shape = (r + c * 2) % 3
          ctx.beginPath()
          if (shape === 0) ctx.arc(0, 0, size, 0, Math.PI * 2)
          else if (shape === 1) ctx.roundRect(-size, -size * 0.45, size * 2, size * 0.9, size * 0.45)
          else { ctx.moveTo(0, -size); ctx.lineTo(size * 0.95, size * 0.7); ctx.lineTo(-size * 0.95, size * 0.7); ctx.closePath() }
          ctx.fill()
          ctx.restore()
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      pointer = true
      const rect = el.getBoundingClientRect()
      target.x = e.clientX - rect.left
      target.y = e.clientY - rect.top
    }
    const leave = () => (pointer = false)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    window.addEventListener('resize', size)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', size)
    }
  }, [reduced])

  return <canvas ref={canvas} aria-hidden="true" className="ae-paper" />
}
