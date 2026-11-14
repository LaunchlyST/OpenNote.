import { memo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  H,
  HORIZON,
  W,
  alpha,
  buildRipples,
  forest,
  paintMountain,
  poly,
  ruggedRidge,
} from './lake-art'
import type { MountainArt, Pt } from './lake-art'

/**
 * The painted alpine lake behind the maintenance page.
 *
 * Seven flat layers sit at different depths inside one perspective box, so a
 * single camera push moves the canoe more than the summit. Everything is SVG,
 * which means the first frame is the finished poster: there is nothing to
 * decode, no WebGL to lose, and it stays crisp on any screen.
 *
 * The motion itself lives in `maintenance.css` (water drift, canoe bob, the
 * camera push) so `prefers-reduced-motion` and a hidden tab can pause all of it
 * in one place.
 */

const PERSPECTIVE = 900

/** Back to front; a smaller depth means nearer the camera. */
const DEPTH = {
  sky: 840,
  far: 700,
  mid: 560,
  massif: 430,
  near: 300,
  shore: 190,
  water: 110,
  canoe: 34,
} as const

function depthStyle(depth: number): CSSProperties {
  return {
    '--depth': `${depth}px`,
    '--scale': (PERSPECTIVE + depth) / PERSPECTIVE,
  } as CSSProperties
}

function Layer({
  depth,
  className,
  children,
}: {
  depth: number
  className: string
  children: ReactNode
}) {
  return (
    <div className={`mnt-layer ${className}`} style={depthStyle(depth)}>
      <svg
        className="mnt-art"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {children}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The massif: one dominant summit with heavy shoulders               */
/* ------------------------------------------------------------------ */

const FAR_CONTROL: Pt[] = [
  [0, 400], [138, 370], [238, 388], [338, 350], [438, 368], [538, 330], [638, 350],
  [742, 316], [842, 338], [940, 314], [1040, 340], [1140, 320], [1240, 348],
  [1340, 334], [1440, 356],
]

const MID_CONTROL: Pt[] = [
  [0, 432], [118, 408], [218, 424], [318, 390], [418, 410], [508, 374], [598, 396],
  [700, 362], [800, 388], [900, 360], [1000, 392], [1100, 370], [1200, 400],
  [1300, 382], [1440, 404],
]

const MASSIF_CONTROL: Pt[] = [
  [0, 456], [92, 436], [168, 450], [248, 412], [330, 432], [402, 390], [468, 408],
  [536, 358], [586, 372], [636, 320], [680, 336], [720, 278], [756, 300], [788, 224],
  [810, 180], [824, 146], [840, 196], [862, 248], [884, 232], [908, 288], [932, 306],
  [958, 344], [984, 328], [1016, 372], [1048, 354], [1082, 398], [1122, 380],
  [1166, 420], [1214, 404], [1262, 436], [1312, 418], [1364, 446], [1404, 432],
  [1440, 458],
]

const NEAR_CONTROL: Pt[] = [
  [0, 470], [98, 452], [188, 466], [278, 436], [368, 452], [448, 420], [520, 438],
  [600, 412], [678, 432], [758, 408], [838, 430], [918, 412], [998, 436], [1078, 418],
  [1158, 442], [1238, 424], [1318, 448], [1440, 436],
]

const MASSIF_TONE = {
  rock: '#2a517f',
  rockDeep: '#0e2340',
  lit: '#5d8bb8',
  rim: '#f5b763',
  snow: '#e4eefa',
}

const NEAR_TONE = {
  rock: '#1d3d55',
  rockDeep: '#081d2b',
  lit: '#3c6884',
  rim: '#e3a35f',
  snow: '#c3d4df',
}

const FAR_TONE = {
  rock: '#7d9dbd',
  rockDeep: '#5b7ea3',
  lit: '#b4cde2',
  rim: '#f8d7a5',
  snow: '#f0f6fc',
}

const MID_TONE = {
  rock: '#4b7099',
  rockDeep: '#31517a',
  lit: '#88a9c9',
  rim: '#f2c289',
  snow: '#e8f1fa',
}

const FAR_ART = paintMountain({
  ridge: ruggedRidge(FAR_CONTROL, 11, 9, 8),
  baseY: HORIZON + 6,
  seed: 23,
  tone: FAR_TONE,
  snowLine: 344,
  snowDepth: 58,
  brushCount: 120,
  facetCount: 10,
  rimAmount: 0.55,
})

const MID_ART = paintMountain({
  ridge: ruggedRidge(MID_CONTROL, 37, 10, 8),
  baseY: HORIZON + 4,
  seed: 59,
  tone: MID_TONE,
  snowLine: 386,
  snowDepth: 52,
  brushCount: 150,
  facetCount: 12,
  rimAmount: 0.75,
})

const MASSIF_ART = paintMountain({
  ridge: ruggedRidge(MASSIF_CONTROL, 71, 11, 9),
  baseY: HORIZON + 6,
  seed: 41,
  tone: MASSIF_TONE,
  snowLine: 334,
  snowDepth: 104,
  brushCount: 340,
  facetCount: 26,
  rimAmount: 1,
})

const NEAR_ART = paintMountain({
  ridge: ruggedRidge(NEAR_CONTROL, 97, 7, 7),
  baseY: HORIZON + 10,
  seed: 77,
  tone: NEAR_TONE,
  snowLine: 300,
  snowDepth: 22,
  brushCount: 150,
  facetCount: 14,
  rimAmount: 0.5,
})

const BACK_FOREST = forest(131, 150, -20, W + 20, 497, 20, 46)
const FRONT_FOREST = forest(311, 120, -20, W + 20, 504, 30, 74)

const HORIZON_RIPPLES = buildRipples(901, 190, 508, 892)
const WARM_RIPPLES = buildRipples(1409, 84, 600, 888, '#eab876')
const GLINTS = buildRipples(1777, 54, 514, 800, '#f8e3b6')

const SUN_X = 386
const SUN_Y = 172

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

function Range({ art, id, snowId, clipId }: { art: MountainArt; id: string; snowId: string; clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={art.silhouette} />
        </clipPath>
      </defs>
      <path d={art.silhouette} fill={`url(#${id})`} />
      <g clipPath={`url(#${clipId})`}>
        {art.facets.map((facet, i) => (
          <path key={`f${i}`} d={facet.d} fill={facet.fill} opacity={facet.opacity} />
        ))}
        {art.snow && <path d={art.snow} fill={`url(#${snowId})`} opacity={0.9} />}
        {art.ribs.map((rib, i) => (
          <path
            key={`b${i}`}
            d={rib.d}
            fill="none"
            stroke={rib.stroke}
            strokeWidth={rib.width}
            strokeLinecap="round"
            opacity={rib.opacity}
          />
        ))}
        {art.brush.map((mark, i) => (
          <path
            key={`w${i}`}
            d={mark.d}
            fill="none"
            stroke={mark.stroke}
            strokeWidth={mark.width}
            strokeLinecap="round"
            opacity={mark.opacity}
          />
        ))}
        {art.rims.map((rim, i) => (
          <path
            key={`r${i}`}
            d={rim.d}
            fill="none"
            stroke={rim.stroke}
            strokeWidth={rim.width}
            strokeLinecap="round"
            opacity={rim.opacity}
          />
        ))}
      </g>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sky                                                                 */
/* ------------------------------------------------------------------ */

function Sky() {
  return (
    <Layer depth={DEPTH.sky} className="mnt-sky">
      <defs>
        <linearGradient id="mnt-sky-g" x1="0" y1="0" x2="0.12" y2="1">
          <stop offset="0" stopColor="#0f2547" />
          <stop offset="0.26" stopColor="#1d4275" />
          <stop offset="0.52" stopColor="#3f6d9f" />
          <stop offset="0.74" stopColor="#7fa3c1" />
          <stop offset="0.88" stopColor="#d3c9b6" />
          <stop offset="0.96" stopColor="#f0d3a8" />
          <stop offset="1" stopColor="#f7dcb0" />
        </linearGradient>
        <radialGradient id="mnt-moon-halo">
          <stop offset="0" stopColor="#ffedc6" stopOpacity="0.8" />
          <stop offset="0.4" stopColor="#f8c987" stopOpacity="0.26" />
          <stop offset="1" stopColor="#f0b06a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mnt-moon-disc">
          <stop offset="0" stopColor="#fff8e4" />
          <stop offset="0.55" stopColor="#f9d79c" />
          <stop offset="1" stopColor="#e9a95a" />
        </radialGradient>
        <radialGradient id="mnt-cloud">
          <stop offset="0" stopColor="#f7e9d2" stopOpacity="0.46" />
          <stop offset="0.5" stopColor="#d8e3ec" stopOpacity="0.2" />
          <stop offset="1" stopColor="#c3d7e6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mnt-sky-wash">
          <stop offset="0" stopColor="#8ab0cd" stopOpacity="0.28" />
          <stop offset="1" stopColor="#8ab0cd" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mnt-horizon-glow">
          <stop offset="0" stopColor="#ffdda2" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#f7c489" stopOpacity="0.24" />
          <stop offset="1" stopColor="#f0b978" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mnt-cirrus" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c3d6e6" stopOpacity="0" />
          <stop offset="0.35" stopColor="#e6eef6" stopOpacity="0.4" />
          <stop offset="0.7" stopColor="#f7e7cd" stopOpacity="0.26" />
          <stop offset="1" stopColor="#c3d6e6" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#mnt-sky-g)" />

      {/* Loose washes give the sky some tooth instead of a clean gradient. */}
      <ellipse cx={210} cy={140} rx={420} ry={200} fill="url(#mnt-sky-wash)" />
      <ellipse cx={1120} cy={88} rx={520} ry={220} fill="url(#mnt-sky-wash)" opacity="0.7" />
      <ellipse cx={760} cy={330} rx={620} ry={150} fill="url(#mnt-sky-wash)" opacity="0.5" />
      <ellipse cx={640} cy={HORIZON + 6} rx={940} ry={150} fill="url(#mnt-horizon-glow)" />

      {/* The low sun the ridges are lit by. */}
      <circle cx={SUN_X} cy={SUN_Y} r={150} fill="url(#mnt-moon-halo)" />
      <circle cx={SUN_X} cy={SUN_Y} r={26} fill="url(#mnt-moon-disc)" opacity="0.95" />

      {/* Cloud banks, flattened and stacked in depth. */}
      <ellipse cx={252} cy={250} rx={340} ry={56} fill="url(#mnt-cloud)" />
      <ellipse cx={690} cy={192} rx={270} ry={40} fill="url(#mnt-cloud)" opacity="0.75" />
      <ellipse cx={1092} cy={288} rx={340} ry={48} fill="url(#mnt-cloud)" opacity="0.6" />
      <ellipse cx={836} cy={372} rx={430} ry={34} fill="url(#mnt-cloud)" opacity="0.5" />
      <ellipse cx={168} cy={392} rx={310} ry={30} fill="url(#mnt-cloud)" opacity="0.4" />
      <ellipse cx={1180} cy={176} rx={240} ry={26} fill="url(#mnt-cloud)" opacity="0.35" />

      {/* Long cirrus strokes. */}
      <path
        d="M30 148C210 128 356 146 516 136c118-8 198 4 292-2-110 18-252 12-342 22-140 16-300 14-436 22Z"
        fill="url(#mnt-cirrus)"
        opacity="0.55"
      />
      <path
        d="M712 90c140-14 260 0 388-10 92-8 168 0 252-6-120 22-240 20-350 28-110 8-210 6-290 12Z"
        fill="url(#mnt-cirrus)"
        opacity="0.36"
      />
      <path
        d="M172 326c150-12 290 0 410-8 110-6 200 2 290-4-120 20-260 16-380 24-120 8-230 4-320 10Z"
        fill="url(#mnt-cirrus)"
        opacity="0.28"
      />
      <path
        d="M520 254c110-10 210-2 306-8 76-4 132 2 196-2-84 16-176 14-256 20-84 6-166 2-246 6Z"
        fill="url(#mnt-cirrus)"
        opacity="0.22"
      />

      <g stroke="#22354c" strokeWidth="1.5" strokeLinecap="round" opacity="0.32" fill="none">
        <path d="M1040 232c8-6 14-6 20-2 6-4 12-3 18 2" />
        <path d="M1092 252c6-5 11-4 15-1 5-3 10-2 15 1" />
      </g>
    </Layer>
  )
}

/* ------------------------------------------------------------------ */
/* Ranges                                                              */
/* ------------------------------------------------------------------ */

function Far() {
  return (
    <Layer depth={DEPTH.far} className="mnt-far">
      <defs>
        <linearGradient id="mnt-g-far" x1="0.1" y1="290" x2="0.4" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#adc4d8" />
          <stop offset="0.45" stopColor="#83a2c0" />
          <stop offset="1" stopColor="#5f81a5" />
        </linearGradient>
        <linearGradient id="mnt-snow-far" x1="0" y1="290" x2="0" y2="420" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#eef5fc" />
          <stop offset="1" stopColor="#cfe0ee" />
        </linearGradient>
      </defs>
      <Range art={FAR_ART} id="mnt-g-far" snowId="mnt-snow-far" clipId="mnt-clip-far" />
    </Layer>
  )
}

function Mid() {
  return (
    <Layer depth={DEPTH.mid} className="mnt-mid">
      <defs>
        <linearGradient id="mnt-g-mid" x1="0.1" y1="320" x2="0.4" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7d9cbc" />
          <stop offset="0.5" stopColor="#557ba2" />
          <stop offset="1" stopColor="#38597e" />
        </linearGradient>
        <linearGradient id="mnt-snow-mid" x1="0" y1="320" x2="0" y2="450" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f9fcff" />
          <stop offset="0.55" stopColor="#e6eff8" />
          <stop offset="1" stopColor="#c4d6e5" />
        </linearGradient>
      </defs>
      <Range art={MID_ART} id="mnt-g-mid" snowId="mnt-snow-mid" clipId="mnt-clip-mid" />
    </Layer>
  )
}

function Massif() {
  return (
    <Layer depth={DEPTH.massif} className="mnt-massif">
      <defs>
        <linearGradient id="mnt-g-massif" x1="0.18" y1="150" x2="0.62" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5c88b7" />
          <stop offset="0.32" stopColor="#36608f" />
          <stop offset="0.68" stopColor="#1e3d66" />
          <stop offset="1" stopColor="#132a49" />
        </linearGradient>
        <linearGradient id="mnt-g-massif-ref" x1="0.18" y1="150" x2="0.62" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a5f89" />
          <stop offset="0.4" stopColor="#254668" />
          <stop offset="1" stopColor="#102741" />
        </linearGradient>
        <radialGradient id="mnt-g-sunwash" cx="0.5" cy="0.26" r="0.52">\r\n          <stop offset="0" stopColor="#ffd79a" stopOpacity="0.4" />\r\n          <stop offset="0.55" stopColor="#f2b06c" stopOpacity="0.14" />\r\n          <stop offset="1" stopColor="#f2b06c" stopOpacity="0" />\r\n        </radialGradient>\r\n        <linearGradient id="mnt-snow-massif" x1="0.3" y1="150" x2="0.6" y2="470" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.32" stopColor="#eaf2fb" />
          <stop offset="0.72" stopColor="#cbdbeb" />
          <stop offset="1" stopColor="#a9c2d8" />
        </linearGradient>
      </defs>
      <Range art={MASSIF_ART} id="mnt-g-massif" snowId="mnt-snow-massif" clipId="mnt-clip-massif" />\r\n      <path d={MASSIF_ART.silhouette} fill="url(#mnt-g-sunwash)" opacity="0.55" />
    </Layer>
  )
}

function Near() {
  return (
    <Layer depth={DEPTH.near} className="mnt-near">
      <defs>
        <linearGradient id="mnt-g-near" x1="0.12" y1="400" x2="0.5" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a4e68" />
          <stop offset="0.5" stopColor="#173349" />
          <stop offset="1" stopColor="#0b2131" />
        </linearGradient>
        <linearGradient id="mnt-snow-near" x1="0" y1="420" x2="0" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dbe7f0" />
          <stop offset="1" stopColor="#93aebe" />
        </linearGradient>
        <linearGradient id="mnt-g-near-ref" x1="0.12" y1="400" x2="0.5" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a3448" />
          <stop offset="1" stopColor="#081a26" />
        </linearGradient>
      </defs>
      <Range art={NEAR_ART} id="mnt-g-near" snowId="mnt-snow-near" clipId="mnt-clip-near" />
    </Layer>
  )
}

function Shore() {
  return (
    <Layer depth={DEPTH.shore} className="mnt-shore">
      <defs>
        <linearGradient id="mnt-g-shore" x1="0" y1="450" x2="0" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1b3c52" />
          <stop offset="1" stopColor="#071c28" />
        </linearGradient>
      </defs>
      <path
        d={poly([
          [0, 494],
          [W, 489],
          [W, HORIZON + 3],
          [0, HORIZON + 3],
        ])}
        fill="url(#mnt-g-shore)"
      />
      <path d={BACK_FOREST.trees} fill="#1a3a4f" opacity="0.9" />
      <path d={BACK_FOREST.rim} fill="none" stroke="#d0a06a" strokeWidth="1" strokeLinecap="round" opacity="0.22" />
      <path d={FRONT_FOREST.trees} fill="#081e2b" />
      <path d={FRONT_FOREST.rim} fill="none" stroke="#d99f62" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <path
        d={`M0 ${HORIZON - 1}L${W} ${HORIZON - 4}`}
        stroke={alpha('#f0c489', 0.5)}
        strokeWidth="1.2"
        opacity="0.45"
      />
    </Layer>
  )
}

/* ------------------------------------------------------------------ */
/* Water                                                               */
/* ------------------------------------------------------------------ */

function Water() {
  return (
    <Layer depth={DEPTH.water} className="mnt-water">
      <defs>
        <linearGradient id="mnt-g-water" x1="0" y1={HORIZON} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d7f9b" />
          <stop offset="0.1" stopColor="#35708e" />
          <stop offset="0.38" stopColor="#1b4a66" />
          <stop offset="0.72" stopColor="#102f47" />
          <stop offset="1" stopColor="#071b2a" />
        </linearGradient>
        <linearGradient id="mnt-g-fade" x1="0" y1={HORIZON} x2="0" y2={H + 120} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.98" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.52" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="mnt-mirror-mask">
          <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="url(#mnt-g-fade)" />
        </mask>
        <linearGradient id="mnt-g-warmveil" x1="0" y1={HORIZON} x2="0" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd9a2" stopOpacity="0.34" />
          <stop offset="0.45" stopColor="#f3b877" stopOpacity="0.12" />
          <stop offset="1" stopColor="#c98342" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mnt-g-coolveil" x1="0" y1={HORIZON} x2="0" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a9cde1" stopOpacity="0.2" />
          <stop offset="1" stopColor="#a9cde1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mnt-g-settle" x1="0" y1={HORIZON} x2="0" y2="690" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a5c76" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0d2a3d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mnt-g-neardeep" x1="0" y1={HORIZON} x2="0" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b2534" stopOpacity="0.8" />
          <stop offset="1" stopColor="#0b2534" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill="url(#mnt-g-water)" />

      {/* The range, mirrored and pressed flat by the surface. */}
      <g mask="url(#mnt-mirror-mask)">
        <g transform="matrix(1 0 0 -0.56 0 783.1)">
          <g opacity="0.62">
            <Range art={MASSIF_ART} id="mnt-g-massif-ref" snowId="mnt-snow-massif" clipId="mnt-clip-massif-ref" />
          </g>
          <g opacity="0.5">
            <Range art={NEAR_ART} id="mnt-g-near-ref" snowId="mnt-snow-near" clipId="mnt-clip-near-ref" />
          </g>
        </g>
      </g>

      {/* The dark forest standing in the water at the shoreline. */}
      <rect x="0" y={HORIZON} width={W} height="96" fill="url(#mnt-g-neardeep)" />

      {/* The water settling over the mirrored range. */}
      <rect x="0" y={HORIZON} width={W} height="200" fill="url(#mnt-g-settle)" opacity="0.55" />

      {/* Sunlight gathering on the surface, then breaking into marks. */}
      <rect x="0" y={HORIZON} width={W} height="260" fill="url(#mnt-g-warmveil)" />
      <rect x={980} y={HORIZON} width={460} height="200" fill="url(#mnt-g-coolveil)" />

      <g className="mnt-water-calm">
        {HORIZON_RIPPLES.map((line, i) => (
          <path
            key={`h${i}`}
            d={line.d}
            fill="none"
            stroke={line.stroke}
            strokeWidth={line.width}
            strokeLinecap="round"
            opacity={line.opacity}
          />
        ))}
      </g>
      <g className="mnt-water-sheen">
        {WARM_RIPPLES.map((line, i) => (
          <path
            key={`w${i}`}
            d={line.d}
            fill="none"
            stroke={line.stroke}
            strokeWidth={line.width}
            strokeLinecap="round"
            opacity={line.opacity}
          />
        ))}
        {GLINTS.map((line, i) => (
          <path
            key={`g${i}`}
            d={line.d}
            fill="none"
            stroke={line.stroke}
            strokeWidth={line.width}
            strokeLinecap="round"
            opacity={line.opacity * 0.75}
          />
        ))}
      </g>

      <path
        d={`M0 ${HORIZON + 1}L${W} ${HORIZON - 2}`}
        stroke={alpha('#dcecf6', 0.55)}
        strokeWidth="1.2"
        opacity="0.5"
      />
    </Layer>
  )
}

/* ------------------------------------------------------------------ */
/* Canoe                                                               */
/* ------------------------------------------------------------------ */

function Canoe() {
  return (
    <Layer depth={DEPTH.canoe} className="mnt-canoe">
      <defs>
        <linearGradient id="mnt-g-hull" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#f0bd7c" />
          <stop offset="0.5" stopColor="#c1853f" />
          <stop offset="1" stopColor="#7a4a22" />
        </linearGradient>
        <linearGradient id="mnt-g-wake" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d6e8f4" stopOpacity="0.6" />
          <stop offset="1" stopColor="#d6e8f4" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate(824 714) scale(1.5)">
        {/* Wake trailing back toward the horizon. */}
        <path d="M-16 6L-168 56L-112 66L-10 20Z" fill="url(#mnt-g-wake)" opacity="0.18" />
        <path d="M-24 14L-108 48L-64 54L-14 26Z" fill="url(#mnt-g-wake)" opacity="0.14" />

        <g fill="none" stroke="#bfd9e9" strokeLinecap="round">
          <ellipse cx="0" cy="26" rx="66" ry="9" opacity="0.18" strokeWidth="1.4" />
          <ellipse cx="16" cy="38" rx="98" ry="13" opacity="0.1" strokeWidth="1.2" />
          <path d="M-62 20Q-26 28 8 20" opacity="0.26" strokeWidth="1.7" />
          <path d="M-44 30Q-8 40 34 28" opacity="0.15" strokeWidth="1.3" />
        </g>

        <g className="mnt-canoe-bob">
          <ellipse cx="4" cy="24" rx="52" ry="7" fill="#e2a45c" opacity="0.22" />

          <path
            d="M-52 -4C-40 13 -19 19 0 19 19 19 40 13 52 -4 36 4 17 8 0 8-17 8-36 4-52-4Z"
            fill="url(#mnt-g-hull)"
          />
          <path
            d="M-47 -2C-35 9 -18 13 0 13 18 13 35 9 47 -2 33 4 17 6 0 6-17 6-33 4-47-2Z"
            fill="#0b2130"
            opacity="0.6"
          />
          <path d="M-50 -3C-38 11 -18 17 0 17" fill="none" stroke="#ffe0b4" strokeWidth="1.4" opacity="0.5" />

          {/* A person, paddle resting. */}
          <circle cx="-8" cy="-24" r="5" fill="#101b28" />
          <path d="M-12 -20C-16 -13 -16 -4 -14 1L4 1C5 -6 4 -15 0 -20Z" fill="#101b28" />
          <path d="M2 -15L26 1" fill="none" stroke="#13202c" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M17 -3L32 18" fill="none" stroke="#c9964f" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="30" cy="16" rx="2.8" ry="4.6" fill="#e6b476" transform="rotate(30 30 16)" />
        </g>
      </g>
    </Layer>
  )
}

/* ------------------------------------------------------------------ */

export const LakeScene = memo(function LakeScene() {
  return (
    <div className="mnt-world" aria-hidden="true">
      <div className="mnt-layers">
        <Sky />
        <Far />
        <Mid />
        <Massif />
        <Near />
        <Shore />
        <Water />
        <Canoe />
      </div>
    </div>
  )
})

export default LakeScene
