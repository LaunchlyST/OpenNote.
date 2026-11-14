/**
 * The Desknoty brain, as data.
 *
 * One deterministic generator feeds both the WebGL centrepiece and the static
 * SVG fallback, so the poster and the live scene are the same object.
 *
 * The mass is a single brain-shaped surface (a sphere pushed into lobes), and
 * the strands are contour rings wrapped around it from the underside to the
 * crown, the way the folds of a cortex actually run. Nothing here touches the
 * DOM, three.js or Math.random, so it is safe to import on the server.
 */

export type Vec3 = { x: number; y: number; z: number }

export type Region = 'left' | 'right' | 'cerebellum' | 'stem'

export type Strand = {
  points: Vec3[]
  region: Region
  /** True when this strand is part of the section that lifts into fragments. */
  splits: boolean
}

export type BrainNode = {
  x: number
  y: number
  z: number
  /** Index into `strands`. */
  strand: number
  /** Position along the strand, 0..1. */
  t: number
}

export type PaperFragment = {
  x: number
  y: number
  z: number
  /** Outward direction the fragment drifts along. */
  nx: number
  ny: number
  nz: number
  rx: number
  ry: number
  rz: number
  /** Relative size, 0.8..1.3. */
  size: number
}

export type BrainModel = {
  strands: Strand[]
  nodes: BrainNode[]
  fragments: PaperFragment[]
  /** Half extents of the whole shape, for framing the camera. */
  radius: number
}

const TAU = Math.PI * 2

/* ------------------------------------------------------------------ */
/* maths                                                               */
/* ------------------------------------------------------------------ */

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const mul = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k })
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

/** Deterministic PRNG (mulberry32) so every render builds the identical brain. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A unit vector perpendicular to `v`. */
function perpendicular(v: Vec3): Vec3 {
  const up: Vec3 = Math.abs(v.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  return norm(cross(v, up))
}

/* ------------------------------------------------------------------ */
/* the mass                                                            */
/* ------------------------------------------------------------------ */

/** Lobes: a gaussian push of the surface in one direction. */
const LOBES: Array<{ dir: Vec3; width: number; amp: number }> = [
  // Temporal lobes: the lower side bulges that make a profile read as a brain.
  { dir: norm({ x: 0.72, y: -0.42, z: 0.28 }), width: 0.5, amp: 0.26 },
  { dir: norm({ x: -0.72, y: -0.42, z: 0.28 }), width: 0.5, amp: 0.26 },
  // The frontal lobe, fuller and higher than the back.
  { dir: norm({ x: 0, y: 0.28, z: 0.95 }), width: 0.62, amp: 0.14 },
  { dir: norm({ x: 0.42, y: 0.4, z: 0.8 }), width: 0.5, amp: 0.06 },
  { dir: norm({ x: -0.42, y: 0.4, z: 0.8 }), width: 0.5, amp: 0.06 },
  // The cerebellum, tucked under the back.
  { dir: norm({ x: 0, y: -0.68, z: -0.62 }), width: 0.44, amp: 0.22 },
  // The occipital lobe and the crown.
  { dir: norm({ x: 0, y: 0.25, z: -0.95 }), width: 0.55, amp: 0.04 },
  { dir: norm({ x: 0, y: 0.95, z: 0 }), width: 0.7, amp: 0.03 },
]

/** Brain proportions: wider than tall, long front to back. */
const RADII: Vec3 = { x: 0.68, y: 0.54, z: 0.9 }

/** Where a direction meets the brain surface. */
export function brainSurface(dir: Vec3): Vec3 {
  const d = norm(dir)
  let r = 1
  for (const lobe of LOBES) {
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(d, lobe.dir))))
    const falloff = Math.exp(-(angle * angle) / (lobe.width * lobe.width))
    r += lobe.amp * falloff
  }
  const p: Vec3 = { x: d.x * r * RADII.x, y: d.y * r * RADII.y, z: d.z * r * RADII.z }
  // The longitudinal fissure: a crease down the crown between hemispheres.
  if (p.y > 0.06) {
    const strength = Math.min(1, (p.y - 0.06) / 0.34)
    const crease = 0.34 * Math.exp(-((p.x / 0.075) ** 2)) * strength
    p.x *= 1 - crease
    p.y -= crease * 0.14
  }
  // Flatten the underside, the way a brain sits on the skull base.
  if (p.y < 0) p.y *= 0.86
  // Narrow the very front and back a touch, so it is not an egg.
  p.x *= 1 - 0.1 * p.z * p.z
  return { x: p.x, y: p.y + 0.06, z: p.z }
}

/** Outward normal, by finite difference on the surface. */
function surfaceNormal(dir: Vec3): Vec3 {
  const d = norm(dir)
  const a = perpendicular(d)
  const b = cross(d, a)
  const e = 0.004
  const p0 = brainSurface(d)
  const p1 = brainSurface(norm(add(d, mul(a, e))))
  const p2 = brainSurface(norm(add(d, mul(b, e))))
  return norm(cross(add(p1, mul(p0, -1)), add(p2, mul(p0, -1))))
}

/* ------------------------------------------------------------------ */
/* strands                                                             */
/* ------------------------------------------------------------------ */

/**
 * One gyrus: a line that wanders from the front of the brain to the back,
 * following the surface. Direction-space spherical coordinates keep it wrapped
 * around the mass, and the lateral drift plus ripple stop it looking like a
 * line of longitude.
 */
function gyrus(random: () => number): Vec3[] {
  const azimuth = random() * TAU
  const drift = (random() - 0.5) * 1.5
  const wiggle = 0.16 + random() * 0.24
  const phase = random() * TAU
  const ripple = 0.007 + random() * 0.009
  const start = 0.34 + random() * 0.22
  const end = Math.PI - (0.34 + random() * 0.22)
  const steps = 88
  const points: Vec3[] = []

  for (let i = 0; i < steps; i += 1) {
    const u = i / (steps - 1)
    const phi = start + (end - start) * u
    const theta = azimuth + drift * (u - 0.5) + Math.sin(u * Math.PI * 2 + phase) * wiggle
    const dir = norm({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta) * 1.06,
      z: Math.cos(phi),
    })
    const p = brainSurface(dir)
    const out = surfaceNormal(dir)
    const wave = Math.sin(9 * u * Math.PI + phase) * 0.6 + Math.sin(15 * u * Math.PI + phase * 2) * 0.4
    points.push(add(p, mul(out, wave * ripple)))
  }
  return points
}

/** A hoop around an axis, crossing the gyri so the surface reads as a net. */
function hoop(normal: Vec3, random: () => number, samples: number): Vec3[] {
  const n = norm(normal)
  const u = perpendicular(n)
  const v = cross(n, u)
  const phase = random() * TAU
  const ripple = 0.007 + random() * 0.008
  const points: Vec3[] = []
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * TAU
    const dir = norm(add(mul(u, Math.cos(t)), mul(v, Math.sin(t))))
    const p = brainSurface(dir)
    const out = surfaceNormal(dir)
    points.push(add(p, mul(out, ripple * Math.sin(5 * t + phase))))
  }
  return points
}

/** The stem: a few strands spiralling down a tapered spine at the back. */
function stemStrands(random: () => number): Vec3[][] {
  const top: Vec3 = { x: 0, y: -0.42, z: -0.46 }
  const bottom: Vec3 = { x: 0.02, y: -1.02, z: -0.56 }
  const out: Vec3[][] = []
  for (let k = 0; k < 4; k += 1) {
    const offset = (k / 4) * TAU + random() * 0.4
    const pts: Vec3[] = []
    for (let i = 0; i < 48; i += 1) {
      const u = i / 47
      const bend = Math.sin(u * Math.PI) * 0.025
      const radius = 0.075 * (1 - u * 0.55)
      const angle = offset + u * 1.5
      pts.push({
        x: top.x + (bottom.x - top.x) * u + Math.cos(angle) * radius + bend,
        y: top.y + (bottom.y - top.y) * u,
        z: top.z + (bottom.z - top.z) * u + Math.sin(angle) * radius * 0.7,
      })
    }
    out.push(pts)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */

export function buildBrain(seed = 7): BrainModel {
  const random = rng(seed)
  const strands: Strand[] = []

  // Gyri: lines wandering from the frontal pole to the occipital pole, spread
  // around the whole mass. Together they wrap the shape in folds rather than
  // crossing it at random.
  const GYRI = 30
  for (let i = 0; i < GYRI; i += 1) {
    strands.push({
      points: gyrus(random),
      region: i % 2 === 0 ? 'left' : 'right',
      splits: false,
    })
  }

  // Hoops the other way: sulci crossing the folds, and the crown's rings.
  for (let i = 0; i < 9; i += 1) {
    const normal: Vec3 = {
      x: (random() - 0.5) * 0.5,
      y: Math.cos(Math.PI * (i / 8)) * 0.55,
      z: Math.sin(Math.PI * (i / 8)) + (random() - 0.5) * 0.2,
    }
    strands.push({ points: hoop(normal, random, 132), region: 'right', splits: false })
  }

  for (const points of stemStrands(random)) {
    strands.push({ points, region: 'stem', splits: false })
  }

  // Which strands lift away: a patch on the upper front of the right
  // hemisphere. A closed contour is spread over the whole surface, so a strand
  // joins the patch when a real share of its points falls inside the region.
  const wound: Vec3 = { x: 0.42, y: 0.34, z: 0.5 }
  const inWound = (p: Vec3) => dist(p, wound) < 0.46
  for (const strand of strands) {
    const hits = strand.points.filter(inWound).length
    strand.splits = strand.region !== 'stem' && hits / strand.points.length > 0.16
  }
  // The patch should read as one section, not speckle: keep the nearest few.
  const ranked = strands
    .map((s, index) => ({ index, s, hits: s.points.filter(inWound).length }))
    .filter(({ s }) => s.splits)
    .sort((a, b) => b.hits - a.hits)
  ranked.forEach(({ index }, rank) => {
    if (rank >= 8) strands[index].splits = false
  })

  // Nodes: sparse junctions along the strands, not a dot field.
  const nodes: BrainNode[] = []
  strands.forEach((strand, strandIndex) => {
    const count = strand.region === 'stem' ? 3 : 4
    const offset = Math.floor(random() * 6)
    for (let k = 0; k < count; k += 1) {
      const pointIndex = (offset + Math.floor((k * strand.points.length) / count)) % strand.points.length
      const p = strand.points[pointIndex]
      nodes.push({ x: p.x, y: p.y, z: p.z, strand: strandIndex, t: pointIndex / strand.points.length })
    }
  })

  // Paper fragments come from the strands that lift, so they start exactly on
  // the surface they were part of.
  const fragments: PaperFragment[] = []
  const patchPoints: Vec3[] = []
  for (const s of strands) if (s.splits) for (const p of s.points) if (inWound(p)) patchPoints.push(p)
  for (let i = 0; i < 54; i += 1) {
    const p = patchPoints[Math.floor(random() * patchPoints.length)] ?? { x: 0.4, y: 0.34, z: 0.5 }
    const outward = norm({ x: p.x * 0.85 + 0.22, y: p.y * 0.6 + 0.42, z: p.z * 0.6 + 0.1 })
    fragments.push({
      x: p.x,
      y: p.y,
      z: p.z,
      nx: outward.x,
      ny: outward.y,
      nz: outward.z,
      rx: random() * TAU,
      ry: random() * TAU,
      rz: random() * TAU,
      size: 0.8 + random() * 0.5,
    })
  }

  return { strands, nodes, fragments, radius: 1.3 }
}

/**
 * Three points on the surface, used by the "See what's changing" trail.
 * They sit on the front lobe, the crown and the back, so they read as places
 * on one object rather than stickers on a canvas.
 */
export const FOCUS_POINTS: Vec3[] = [
  brainSurface(norm({ x: 0.25, y: 0.45, z: 0.85 })),
  brainSurface(norm({ x: -0.15, y: 0.95, z: -0.1 })),
  brainSurface(norm({ x: -0.55, y: -0.1, z: -0.8 })),
]

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}



