import type { Vec3 } from './brain-model'

/**
 * One view of the brain, shared by the SVG poster and the HTML markers placed
 * over the canvas, so the three points sit on the same anatomy either way.
 */
export const YAW = -1.2
export const PITCH = 0.12

/** Projects to a screen space of -1..1, y up. */
export function projectBrainPoint(p: Vec3): { x: number; y: number; z: number } {
  const x1 = p.x * Math.cos(YAW) - p.z * Math.sin(YAW)
  const z1 = p.x * Math.sin(YAW) + p.z * Math.cos(YAW)
  const y2 = p.y * Math.cos(PITCH) - z1 * Math.sin(PITCH)
  const z2 = p.y * Math.sin(PITCH) + z1 * Math.cos(PITCH)
  return { x: x1, y: y2, z: z2 }
}
