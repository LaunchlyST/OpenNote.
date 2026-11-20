/**
 * An original abstract "liquid" artwork in red, warm cream and near-black with
 * film grain, generated once in a canvas (no image download). Used as the
 * texture behind the Coming soon TV.
 */
let cached: HTMLCanvasElement | null = null

const RED: [number, number, number] = [222, 52, 30]
const DEEP: [number, number, number] = [176, 30, 22]
const CREAM: [number, number, number] = [236, 205, 172]
const INK: [number, number, number] = [30, 26, 27]

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export function liquidArt(w = 560, h = 760): HTMLCanvasElement {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const d = img.data
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      // Domain-warped folds: long sweeping bands that bend back on themselves.
      const wx = u + 0.22 * Math.sin(v * 4.1 + 0.6) + 0.12 * Math.sin(u * 7.3 + v * 2.2)
      const wy = v + 0.18 * Math.sin(u * 3.4 - 0.8) + 0.08 * Math.cos(v * 6.1 + u * 3.0)
      const band = Math.sin((wy * 3.2 - wx * 1.6 + 0.35 * Math.sin(wx * 5.0)) * Math.PI)
      const ink = Math.sin((wx * 2.3 + wy * 1.1 + 0.4 * Math.cos(wy * 4.0 + 1.1)) * Math.PI)
      let col = mix(RED, DEEP, smooth(-0.2, -1, band) * 0.6)
      col = mix(col, CREAM, smooth(0.62, 0.92, band) * 0.95)
      col = mix(col, INK, smooth(0.55, 0.9, ink) * smooth(0.4, -0.6, band) * 0.95)
      const g = (rnd() - 0.5) * 46
      const i = (y * w + x) * 4
      d[i] = Math.max(0, Math.min(255, col[0] + g))
      d[i + 1] = Math.max(0, Math.min(255, col[1] + g))
      d[i + 2] = Math.max(0, Math.min(255, col[2] + g))
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // A soft blur so the colours melt into each other, then grain again on top.
  const soft = document.createElement('canvas')
  soft.width = w
  soft.height = h
  const s = soft.getContext('2d')!
  s.filter = 'blur(10px)'
  s.drawImage(c, 0, 0)
  s.filter = 'none'
  const top = s.getImageData(0, 0, w, h)
  const t = top.data
  for (let i = 0; i < t.length; i += 4) {
    const g = (rnd() - 0.5) * 40
    t[i] = Math.max(0, Math.min(255, t[i] + g))
    t[i + 1] = Math.max(0, Math.min(255, t[i + 1] + g))
    t[i + 2] = Math.max(0, Math.min(255, t[i + 2] + g))
  }
  s.putImageData(top, 0, 0)
  cached = soft
  return soft
}

let cachedUrl = ''
/** The artwork as an image URL, for the still (non-WebGL) version. */
export function liquidArtUrl(): string {
  if (!cachedUrl) cachedUrl = liquidArt().toDataURL('image/jpeg', 0.82)
  return cachedUrl
}
