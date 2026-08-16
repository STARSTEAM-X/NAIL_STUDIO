import { describe, expect, it } from 'vitest'
import { computeHull, type Pt2 } from '@/3d/geometry/hull.ts'
import { isPointInHull } from '@/3d/geometry/pointInHull.ts'
import { poissonDiskInHull } from './scatter.ts'

const HULL = computeHull([
  { x: 0.5, y: 0 }, { x: 1, y: 0.3 }, { x: 0.85, y: 1 },
  { x: 0.15, y: 1 }, { x: 0, y: 0.3 },
])

function assertValid(points: Pt2[], radius: number): void {
  for (const point of points) expect(isPointInHull(HULL, point)).toBe(true)
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      expect(Math.hypot(points[first]!.x - points[second]!.x, points[first]!.y - points[second]!.y))
        .toBeGreaterThanOrEqual(radius)
    }
  }
}

describe('poissonDiskInHull', () => {
  it('is deterministic and respects the spatial distance guarantee', () => {
    const options = { radius: 0.12, maxPoints: 20, seed: 42 }
    const first = poissonDiskInHull(HULL, options)
    expect(poissonDiskInHull(HULL, options)).toEqual(first)
    expect(first.length).toBeLessThanOrEqual(options.maxPoints)
    assertValid(first, options.radius)
  })

  it('filters candidates into a requested UV band', () => {
    const points = poissonDiskInHull(HULL, { radius: 0.08, maxPoints: 10, seed: 7, vRange: [0.75, 1] })
    expect(points.every((point) => point.y >= 0.75 && point.y <= 1)).toBe(true)
    assertValid(points, 0.08)
  })
})
