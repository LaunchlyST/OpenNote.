import { useMemo } from 'react'
import { buildBrain } from './brain-model'
import { projectBrainPoint } from './brain-view'

/**
 * The brain as flat SVG, built from the same model as the WebGL scene.
 *
 * It is the poster under the canvas, so the centrepiece is on screen in the
 * first frame; and it is the finished fallback when WebGL is unavailable.
 * Under reduced motion it is the permanent centrepiece.
 */

const SIZE = 400
const CENTRE = SIZE / 2
/** The model is about 1.7 tall including the stem; 118 fills the box. */
const SCALE = 118
const Y_SHIFT = -0.18
const STEP = 3

export function BrainStill({ className }: { className?: string }) {
  const art = useMemo(() => {
    const model = buildBrain()

    const strands = model.strands.map((strand) => {
      const points: Array<{ x: number; y: number; z: number }> = []
      for (let i = 0; i < strand.points.length; i += STEP) {
        const p = projectBrainPoint(strand.points[i])
        points.push({
          x: CENTRE + p.x * SCALE,
          y: CENTRE - (p.y - Y_SHIFT) * SCALE,
          z: p.z,
        })
      }
      const depth = points.reduce((sum, p) => sum + p.z, 0) / (points.length || 1)
      const d =
        points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
        (strand.region === 'stem' ? '' : 'Z')
      return { d, depth, splits: strand.splits }
    })
    strands.sort((a, b) => a.depth - b.depth)

    const nodes = model.nodes.map((node) => {
      const p = projectBrainPoint(node)
      return {
        x: CENTRE + p.x * SCALE,
        y: CENTRE - (p.y - Y_SHIFT) * SCALE,
        z: p.z,
        splits: model.strands[node.strand].splits,
      }
    })
    nodes.sort((a, b) => a.z - b.z)

    const depths = strands.map((s) => s.depth)
    return { strands, nodes, min: Math.min(...depths), max: Math.max(...depths) }
  }, [])

  const { strands, nodes, min, max } = art
  const spread = max - min || 1

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="A translucent brain drawn in fine blue strands with small connected nodes"
    >
      <defs>
        <radialGradient id="mnt-brain-core" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#dfe8ff" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#c9d8f7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c9d8f7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={CENTRE} cy={CENTRE + 18} rx={150} ry={120} fill="url(#mnt-brain-core)" />
      <g strokeLinecap="round" fill="none">
        {strands.map((strand, i) => {
          const t = Math.min(1, Math.max(0, (strand.depth - min) / spread))
          return (
            <path
              key={i}
              d={strand.d}
              stroke={strand.splits ? '#3f6bff' : '#3d5590'}
              strokeOpacity={0.12 + t * 0.5}
              strokeWidth={0.7 + t * 1.5}
            />
          )
        })}
      </g>
      <g>
        {nodes.map((node, i) => {
          const t = Math.min(1, Math.max(0, (node.z - min) / spread))
          return (
            <circle
              key={i}
              cx={node.x.toFixed(1)}
              cy={node.y.toFixed(1)}
              r={(0.8 + t * 2).toFixed(2)}
              fill={node.splits ? '#2f5bff' : '#3b56c9'}
              fillOpacity={(0.22 + t * 0.55).toFixed(2)}
            />
          )
        })}
      </g>
    </svg>
  )
}
