/**
 * Painting helpers for the alpine lake on the maintenance page.
 *
 * Nothing here is a bitmap: the whole scene is paths, with fractal crests,
 * grouped brush strokes and studio segments, all derived from a fixed seed so
 * the poster is identical on every render. Grouping strokes by colour keeps the
 * node count low enough that the camera can push through seven layers smoothly.
 */

export const W = 1440
export const H = 900
export const HORIZON = 502

export type Pt = readonly [number, number]

/** Small, fast, seeded PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function poly(points: readonly Pt[], close = true) {
  const body = points.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ')
  return close ? `${body} Z` : body
}

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** `#rrggbb` + alpha, as a paint string. */
export function alpha(hex: string, a: number) {
  const [r, g, b] = channels(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** Linear mix of two `#rrggbb` colours. */
export function mix(a: string, b: string, t: number) {
  const A = channels(a)
  const B = channels(b)
  const clamped = Math.max(0, Math.min(1, t))
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * clamped).toString(16).padStart(2, '0')).join('')}`
}

/* ------------------------------------------------------------------ */
/* Ridges                                                              */
/* ------------------------------------------------------------------ */

/**
 * Subdivides a handful of control points into a serrated crest. Coarse
 * movement keeps the shape of the massif; fine movement gives the cracks and
 * buttresses that a straight polyline never has.
 */
export function ruggedRidge(control: readonly Pt[], seed: number, amp: number, steps = 7): Pt[] {
  const rand = mulberry32(seed)
  const out: Pt[] = []
  let swell = rand() * Math.PI * 2

  for (let i = 0; i < control.length - 1; i += 1) {
    const [x1, y1] = control[i]
    const [x2, y2] = control[i + 1]
    const span = Math.hypot(x2 - x1, y2 - y1)
    const coarse = amp * 2.6
    const fine = amp * 0.9

    for (let s = 0; s < steps; s += 1) {
      const t = s / steps
      swell += 0.6 + rand() * 0.5
      const wobble =
        Math.sin(swell) * coarse * (0.35 + 0.65 * Math.min(1, span / 120)) +
        (rand() - 0.5) * fine * 2
      out.push([x1 + (x2 - x1) * t + (rand() - 0.5) * 3, y1 + (y2 - y1) * t + wobble * t])
    }
  }
  out.push(control[control.length - 1])
  return out
}

/* ------------------------------------------------------------------ */
/* Mountains                                                           */
/* ------------------------------------------------------------------ */

export interface Stroke {
  /** Many short strokes packed into one path, one per colour bucket. */
  d: string
  stroke: string
  width: number
  opacity: number
}

export interface Facet {
  d: string
  fill: string
  opacity: number
}

export interface MountainTone {
  /** Body of the rock, in shadow. */
  rock: string
  /** Deepest crevasse tone. */
  rockDeep: string
  /** Sunlit rock. */
  lit: string
  /** Warm rim light along the crests. */
  rim: string
  /** Snow. */
  snow: string
}

export interface MountainArt {
  silhouette: string
  /** Snow, drawn as a single tapered cap under the crest. */
  snow: string
  facets: Facet[]
  brush: Stroke[]
  rims: Stroke[]
  ribs: Stroke[]
}

/**
 * Turns a serrated crest into a painted mountain: soft planes for the big
 * masses, a snow cap that thins out toward the snowline, hundreds of short
 * brush marks, and warm light gathered on the faces turned toward the sun.
 */
export function paintMountain(opts: {
  ridge: readonly Pt[]
  baseY: number
  seed: number
  tone: MountainTone
  snowLine: number
  snowDepth?: number
  brushCount?: number
  facetCount?: number
  rimAmount?: number
}): MountainArt {
  const { ridge, baseY, seed, tone, snowLine } = opts
  const snowDepth = opts.snowDepth ?? 96
  const brushCount = opts.brushCount ?? 260
  const facetCount = opts.facetCount ?? 18
  const rimAmount = opts.rimAmount ?? 1
  const rand = mulberry32(seed)

  /* Snow: follow the crest while it is above the snowline, thinning out with
     a low frequency drift so the lower edge never echoes the crack line. */
  const cap = ridge
    .map(([x, y], i) => {
      const above = snowLine - y
      const t = Math.max(0, Math.min(1, above / 150))
      const drift = 0.66 + 0.34 * Math.sin(i * 0.19 + seed * 0.6)
      return { x, y, depth: t * snowDepth * drift, t }
    })
    .filter((p) => p.depth > 3)

  let snow = ''
  if (cap.length > 2) {
    const top = cap.map((p) => [p.x, p.y] as Pt)
    const bottom = cap
      .map((p) => [p.x + (rand() - 0.5) * 7, p.y + p.depth] as Pt)
      .reverse()
    snow = poly([...top, ...bottom])
  }

  /* Big painterly planes: a crest segment extended down the face. */
  const facets: Facet[] = []
  for (let i = 0; i < facetCount; i += 1) {
    const idx = Math.floor(rand() * (ridge.length - 2)) + 1
    const [x1, y1] = ridge[idx]
    const [x2, y2] = ridge[Math.min(ridge.length - 1, idx + 2)]
    const height = Math.max(20, baseY - Math.min(y1, y2))
    const drop = 70 + rand() * Math.min(300, height * 1.1)
    const lean = (rand() - 0.5) * 90

    facets.push({
      d: poly([
        [x1 - 8, y1],
        [x2 + 8, y2],
        [x2 + lean + 26, y2 + drop],
        [x1 + lean - 26, y1 + drop],
      ]),
      fill: rand() > 0.45 ? tone.rockDeep : tone.lit,
      opacity: 0.03 + rand() * 0.06,
    })
  }

  /* Brushwork: short marks angled down the fall line, bucketed by colour. */
  const buckets = [
    { color: tone.rockDeep, width: 2.2, opacity: 0.16, marks: [] as string[] },
    { color: tone.rock, width: 3.4, opacity: 0.14, marks: [] as string[] },
    { color: tone.lit, width: 1.5, opacity: 0.12, marks: [] as string[] },
    { color: tone.rim, width: 1.2, opacity: 0.1, marks: [] as string[] },
  ]

  for (let i = 0; i < brushCount; i += 1) {
    const x = rand() * W
    const y = 130 + rand() * (baseY - 130)
    // Marks gather on the upper faces, where the light and rock are.
    if (rand() > 0.35 && y > baseY - 120) continue
    const len = 6 + rand() * 26
    const angle = Math.PI / 2 + (rand() - 0.5) * 0.7
    const dx = Math.cos(angle) * len
    const dy = Math.sin(angle) * len
    const bucket = buckets[Math.floor(rand() * buckets.length)]
    bucket.marks.push(`M${r1(x)} ${r1(y)}q${r1(dx * 0.4)} ${r1(dy * 0.6)} ${r1(dx)} ${r1(dy)}`)
  }

  const brush: Stroke[] = buckets
    .filter((bucket) => bucket.marks.length > 0)
    .map((bucket) => ({
      d: bucket.marks.join(''),
      stroke: bucket.color,
      width: bucket.width,
      opacity: bucket.opacity,
    }))

  /* Rim light: three passes, widest and faintest underneath. */
  const warmWide: string[] = []
  const warmMid: string[] = []
  const warmBright: string[] = []

  for (let i = 1; i < ridge.length - 1; i += 1) {
    const [x1, y1] = ridge[i - 1]
    const [x2, y2] = ridge[i]
    const [x3, y3] = ridge[i + 1]
    const rising = (y2 - y1) / (x2 - x1 || 1)
    const falling = (y3 - y2) / (x3 - x2 || 1)
    const crest = y2 < y1 && y2 < y3
    const lit = rising < 0 || falling < 0
    const height = Math.min(1, Math.max(0, (baseY - y2) / 300))
    if ((!crest && !lit) || height < 0.16) continue

    const seg = `M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`
    if (height > 0.35 || crest) warmWide.push(seg)
    if (height > 0.25) warmMid.push(seg)
    if ((lit && height > 0.3) || (crest && height > 0.55) || rand() > 0.72) warmBright.push(seg)
  }

  const rims: Stroke[] = []
  if (warmWide.length)
    rims.push({ d: warmWide.join(''), stroke: tone.rim, width: 7.5, opacity: 0.12 * rimAmount })
  if (warmMid.length)
    rims.push({ d: warmMid.join(''), stroke: tone.rim, width: 2.2, opacity: 0.4 * rimAmount })
  if (warmBright.length)
    rims.push({ d: warmBright.join(''), stroke: '#ffe0ae', width: 1, opacity: 0.62 * rimAmount })

  /* A few dark ribs read as gullies and stop the snow looking like icing. */
  const ribs: string[] = []
  for (let i = 0; i < 9; i += 1) {
    const [x, y] = ridge[Math.floor(rand() * ridge.length)]
    if (y > snowLine - 20) continue
    const len = 30 + rand() * 90
    ribs.push(`M${r1(x)} ${r1(y)}q${r1((rand() - 0.5) * 16)} ${r1(len * 0.6)} ${r1((rand() - 0.5) * 20)} ${r1(len)}`)
  }

  return {
    silhouette: `${poly(ridge, false)} L${r1(ridge[ridge.length - 1][0])} ${baseY} L${r1(ridge[0][0])} ${baseY} Z`,
    snow,
    facets,
    brush,
    rims,
    ribs: ribs.length ? [{ d: ribs.join(''), stroke: tone.rockDeep, width: 5, opacity: 0.2 }] : [],
  }
}

/* ------------------------------------------------------------------ */
/* Forest                                                              */
/* ------------------------------------------------------------------ */

export interface Forest {
  trees: string
  rim: string
}

/**
 * A dense conifer band. Trees are packed into one path so a shoreline of two
 * hundred firs costs two nodes instead of two hundred.
 */
export function forest(
  seed: number,
  count: number,
  fromX: number,
  toX: number,
  baseY: number,
  minH: number,
  maxH: number,
): Forest {
  const rand = mulberry32(seed)
  const trees: string[] = []
  const rim: string[] = []

  for (let i = 0; i < count; i += 1) {
    const x = fromX + ((toX - fromX) * (i + rand() * 1.1)) / count
    const h = minH + Math.pow(rand(), 1.5) * (maxH - minH)
    const w = h * (0.4 + rand() * 0.2)
    const y = baseY + (rand() - 0.5) * 9
    const p = (fx: number, fy: number) => `${r1(x + w * fx)} ${r1(y - h * fy)}`

    trees.push(
      `M${p(0, 1)}L${p(0.16, 0.64)}L${p(0.07, 0.64)}L${p(0.3, 0.4)}L${p(0.12, 0.4)}` +
        `L${p(0.5, 0.02)}L${p(-0.5, 0.02)}L${p(-0.12, 0.4)}L${p(-0.3, 0.4)}` +
        `L${p(-0.07, 0.64)}L${p(-0.16, 0.64)}Z`,
    )

    if (h > (minH + maxH) * 0.5) {
      rim.push(`M${p(0, 0.98)}L${p(-0.34, 0.36)}L${p(-0.16, 0.06)}`)
    }
  }

  return { trees: trees.join(''), rim: rim.join('') }
}

/* ------------------------------------------------------------------ */
/* Water                                                               */
/* ------------------------------------------------------------------ */

export interface Ripple {
  d: string
  width: number
  opacity: number
  stroke: string
}

/** Horizontal brush marks, longer as they come toward the viewer. */
export function buildRipples(
  seed: number,
  count: number,
  yFrom: number,
  yTo: number,
  color?: string,
): Ripple[] {
  const rand = mulberry32(seed)
  const out: Ripple[] = []
  const span = yTo - yFrom

  for (let i = 0; i < count; i += 1) {
    const t = i / count
    const y = yFrom + span * Math.pow(t, 0.8) + (rand() - 0.5) * 16
    const reach = (y - yFrom) / (span || 1)
    const len = 24 + reach * (170 + rand() * 300)
    const x = rand() * (W - len)
    const lift = (rand() - 0.5) * 5
    const tone = color ?? mix('#89b0cc', '#d3e6f1', rand() * 0.7)

    out.push({
      d: `M${r1(x)} ${r1(y)}q${r1(len * 0.42)} ${r1(lift - 2)} ${r1(len)} ${r1(lift)}`,
      width: 0.6 + rand() * 1.8 + reach * 1.6,
      opacity: 0.05 + rand() * 0.12 + reach * 0.07,
      stroke: tone,
    })
  }
  return out
}
