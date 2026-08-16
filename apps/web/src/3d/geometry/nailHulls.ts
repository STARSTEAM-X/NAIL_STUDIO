import type { NailKey } from '@nail-studio/contracts'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { computeHull, type Pt2 } from './hull.ts'

/** Build the UV hull for every nail in a loaded hand registry. */
export function computeNailHulls(parts: HandParts): Map<NailKey, Pt2[]> {
  const hulls = new Map<NailKey, Pt2[]>()
  for (const [key, mesh] of parts.nails) {
    const uv = mesh.geometry.getAttribute('uv')
    if (!uv) continue
    const points: Pt2[] = []
    for (let index = 0; index < uv.count; index += 1) {
      points.push({ x: uv.getX(index), y: uv.getY(index) })
    }
    hulls.set(key, computeHull(points))
  }
  return hulls
}
