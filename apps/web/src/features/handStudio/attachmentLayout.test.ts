import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { layoutAttachments } from './attachmentLayout.ts'
import { nailSurface, type NailFrame } from './nailGeometry.ts'
import { createStudioScene } from './sceneSchema.ts'

const frame: NailFrame = { origin: new Vector3(), across: new Vector3(1, 0, 0), along: new Vector3(0, 1, 0), normal: new Vector3(0, 0, 1), width: .012, bedLength: .014, arch: .0012, joint: 4 }
describe('surface attachment layout', () => {
  it('retains an unobstructed location and is deterministic across save/load', () => {
    const nail = createStudioScene().hands.right.nails.ring
    nail.decorations.push({ id: 'gem', type: 'diamond', u: .5, v: .45, scale: 1, rotation: 0, color: '#ffffff' })
    const result = layoutAttachments(frame, nail)
    expect(result.warnings).toHaveLength(0)
    expect(result.placements[0]!.u).toBe(.5)
    expect(result.placements[0]!.v).toBe(.55)
    expect(layoutAttachments(frame, JSON.parse(JSON.stringify(nail)))).toEqual(result)
  })
  it('separates overlapping gems, preserving their dimensions', () => {
    const nail = createStudioScene().hands.right.nails.ring
    nail.decorations = Array.from({ length: 6 }, (_, index) => ({ id: String(index), type: 'diamond', u: .5, v: .5, scale: 1, rotation: 0, color: '#ffffff' }))
    const result = layoutAttachments(frame, nail)
    expect(result.placements).toHaveLength(6)
    const points = result.placements.map((p) => nailSurface(frame, nail, p.u, p.v))
    for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) expect(points[i]!.distanceTo(points[j]!)).toBeGreaterThan(.0024)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
  it('moves an oversized bow away from a narrow stiletto tip instead of letting it float', () => {
    const nail = createStudioScene().hands.right.nails.ring
    nail.shape = 'stiletto'
    nail.decorations.push({ id: 'bow', type: 'bow', u: .88, v: .12, scale: 1.4, rotation: 45, color: '#ffffff' })
    const { placements } = layoutAttachments(frame, nail)
    expect(placements).toHaveLength(1)
    const placement = placements[0]!
    expect(nailSurface(frame, nail, 0, placement.v).distanceTo(nailSurface(frame, nail, 1, placement.v))).toBeGreaterThan(.00235 * 1.4 * 2)
  })
})
