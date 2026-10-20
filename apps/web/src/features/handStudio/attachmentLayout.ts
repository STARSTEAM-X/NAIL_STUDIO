import { MathUtils, Vector3 } from 'three'
import { nailSurface, type NailFrame } from './nailGeometry.ts'
import type { StudioDecoration, StudioNail } from './sceneSchema.ts'

interface Placement { item: StudioDecoration; u: number; v: number; scale: number }
export interface AttachmentLayout { placements: Placement[]; warnings: string[] }
function radius(item: StudioDecoration): number {
  return (item.type === 'bow' ? .00235 : item.type === 'flower' || item.type === 'sticker' ? .0019 : item.type === 'charm' ? .0016 : .0012) * item.scale
}

/**
 * Keep decoration footprints on the actual curved nail and prevent overlaps.
 * A fixed 11×9 candidate grid plus 3×3 spatial hash neighbours bounds the work
 * per item. O(D), D ≤ 12; no mesh/triangle all-pairs collision pass.
 */
export function layoutAttachments(frame: NailFrame, nail: StudioNail): AttachmentLayout {
  const placements: Placement[] = [], warnings: string[] = []
  const cellSize = .008
  const cells = new Map<string, Array<{ position: Vector3; radius: number }>>()
  for (const item of nail.decorations) {
    const candidates: Array<{ u: number; v: number; score: number }> = [{ u: item.u, v: 1 - item.v, score: -1 }]
    for (let row = 1; row <= 11; row += 1) for (let column = 1; column <= 9; column += 1) {
      const u = column / 10, v = row / 12
      candidates.push({ u, v, score: (u - item.u) ** 2 + (v - (1 - item.v)) ** 2 })
    }
    // 100 fixed candidates, independent of D. This constant-size ordering does
    // not change the O(D) bound and preserves the user's nearest valid location.
    candidates.sort((a, b) => a.score - b.score)
    let placed = false
    const footprint = radius(item)
    for (const candidate of candidates) {
      const left = nailSurface(frame, nail, 0, candidate.v), right = nailSurface(frame, nail, 1, candidate.v)
      const width = left.distanceTo(right)
      if (width < footprint * 2 + .00035) continue
      const margin = (footprint + .00018) / width
      const u = MathUtils.clamp(candidate.u, margin, 1 - margin)
      const position = nailSurface(frame, nail, u, candidate.v)
      const relative = position.clone().sub(frame.origin)
      const y = relative.dot(frame.along)
      const length = nailSurface(frame, nail, .5, 1).sub(frame.origin).dot(frame.along)
      if (y < footprint + .0003 || length - y < footprint + .0003) continue
      const x = relative.dot(frame.across), gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize)
      let intersects = false
      for (let dx = -1; dx <= 1 && !intersects; dx += 1) for (let dy = -1; dy <= 1 && !intersects; dy += 1) {
        for (const other of cells.get(`${gx + dx}:${gy + dy}`) ?? []) {
          if (position.distanceTo(other.position) < footprint + other.radius + .00025) { intersects = true; break }
        }
      }
      if (intersects) continue
      const cell = `${gx}:${gy}`
      const bucket = cells.get(cell) ?? []
      bucket.push({ position, radius: footprint }); cells.set(cell, bucket)
      placements.push({ item, u, v: candidate.v, scale: item.scale })
      if (Math.abs(u - item.u) > .015 || Math.abs(candidate.v - (1 - item.v)) > .015) warnings.push('ปรับตำแหน่งของตกแต่งให้อยู่ในขอบเล็บและไม่ซ้อนกัน')
      placed = true
      break
    }
    if (!placed) warnings.push('ของตกแต่งบางชิ้นมีพื้นที่ไม่พอ จึงซ่อนไว้ ลองลดขนาดหรือลบชิ้นที่ไม่ใช้')
  }
  return { placements, warnings: [...new Set(warnings)] }
}
