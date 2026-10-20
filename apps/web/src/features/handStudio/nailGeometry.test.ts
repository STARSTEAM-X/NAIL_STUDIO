import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createParametricNail, decorationSurface, nailSurface, type NailFrame } from './nailGeometry.ts'
import { createStudioScene, SHAPES } from './sceneSchema.ts'

const frame: NailFrame = { origin: new Vector3(), across: new Vector3(1, 0, 0), along: new Vector3(0, 1, 0), normal: new Vector3(0, 0, 1), width: .012, bedLength: .014, arch: .0012, joint: 4 }
describe('parametric nail shells', () => {
  it('each shape is closed, nondegenerate, outward wound and weighted to its distal bone', () => {
    for (const shape of SHAPES) for (const length of [0, .5, 1]) {
      const nail = { ...createStudioScene().hands.right.nails.index, shape, length }
      const geometry = createParametricNail(frame, nail)
      const p = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
      const index = geometry.getIndex()!
      const edges = new Map<string, number>()
      let volume = 0
      for (let cursor = 0; cursor < index.count; cursor += 3) {
        const indices = [index.getX(cursor), index.getX(cursor + 1), index.getX(cursor + 2)]
        const [a, b, c] = indices.map((i) => new Vector3().fromBufferAttribute(p, i)) as [Vector3, Vector3, Vector3]
        expect(new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length(), shape).toBeGreaterThan(1e-13)
        volume += a.dot(new Vector3().crossVectors(b, c)) / 6
        indices.forEach((start, i) => { const end = indices[(i + 1) % 3]!; const key = start < end ? `${start}:${end}` : `${end}:${start}`; edges.set(key, (edges.get(key) ?? 0) + 1) })
      }
      expect(volume, shape).toBeGreaterThan(0)
      expect([...edges.values()].every((count) => count === 2), shape).toBe(true)
      for (let cursor = 0; cursor < p.count; cursor += 1) {
        expect(Number.isFinite(p.getX(cursor) + p.getY(cursor) + p.getZ(cursor))).toBe(true)
        expect(uv.getX(cursor)).toBeGreaterThanOrEqual(0); expect(uv.getY(cursor)).toBeLessThanOrEqual(1)
        expect(geometry.getAttribute('skinIndex').getX(cursor)).toBe(4)
        expect(geometry.getAttribute('skinWeight').getX(cursor)).toBe(1)
      }
      geometry.dispose()
    }
  })
  it('locks the root while only the distal edge grows or changes shape', () => {
    const nail = createStudioScene().hands.right.nails.index
    const before = nailSurface(frame, nail, .4, 0)
    for (const shape of SHAPES) {
      const after = { ...nail, shape, length: 1, curvature: 1.4, width: 1.15 }
      expect(nailSurface(frame, after, .4, 0).distanceTo(before)).toBeLessThan(1e-12)
      expect(nailSurface(frame, after, .5, 1).y).toBeGreaterThan(nailSurface(frame, nail, .5, 1).y)
    }
  })
  it('keeps the same UV attachment on the surface through shape and length changes', () => {
    for (const shape of SHAPES) {
      const nail = { ...createStudioScene().hands.right.nails.ring, shape, length: .85 }
      const surface = decorationSurface(frame, nail, .55, .6)
      expect(surface.position.distanceTo(nailSurface(frame, nail, .55, .6))).toBe(0)
      expect(surface.normal.dot(frame.normal)).toBeGreaterThan(.8)
      expect(Math.abs(surface.normal.dot(surface.tangent))).toBeLessThan(1e-10)
    }
  })
  it('low quality reduces triangles without changing the analytic surface or anchors', () => {
    const nail = createStudioScene().hands.right.nails.index
    const low = createParametricNail(frame, nail, true), high = createParametricNail(frame, nail)
    expect(low.getIndex()!.count).toBeLessThan(high.getIndex()!.count / 2)
    expect(low.boundingBox!.max.y).toBeCloseTo(high.boundingBox!.max.y, 6)
    low.dispose(); high.dispose()
  })
})
