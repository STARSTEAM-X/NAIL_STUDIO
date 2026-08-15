import { describe, expect, it } from 'vitest'
import { computeHull, type Pt2 } from './hull.ts'
import { isPointInHull } from './pointInHull.ts'

const SQUARE: Pt2[] = computeHull([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }])

describe('isPointInHull', () => {
  it('returns false for a hull with fewer than 3 points', () => {
    expect(isPointInHull([], { x: 0, y: 0 })).toBe(false)
    expect(isPointInHull([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0 })).toBe(false)
  })

  it('finds the center of a square inside', () => {
    expect(isPointInHull(SQUARE, { x: 1, y: 1 })).toBe(true)
  })

  it('finds a point clearly outside', () => {
    expect(isPointInHull(SQUARE, { x: 5, y: 5 })).toBe(false)
    expect(isPointInHull(SQUARE, { x: -1, y: 1 })).toBe(false)
  })

  it('treats a vertex as inside', () => {
    expect(isPointInHull(SQUARE, { x: 0, y: 0 })).toBe(true)
  })

  it('treats a point on an edge as inside', () => {
    expect(isPointInHull(SQUARE, { x: 1, y: 0 })).toBe(true)
  })

  it('agrees with brute-force ray casting on a nail-like irregular hull', () => {
    const points: Pt2[] = [
      { x: 0.5, y: 0.05 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 },
      { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 },
      { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 },
      { x: 0.4, y: 0.95 }, { x: 0.6, y: 0.95 },
    ]
    const hull = computeHull(points)

    function bruteForceInside(poly: Pt2[], point: Pt2): boolean {
      // ray casting มาตรฐาน — ใช้เป็น oracle เทียบผลกับ binary search
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i]!
        const b = poly[j]!
        const crosses = (a.y > point.y) !== (b.y > point.y)
          && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        if (crosses) inside = !inside
      }
      return inside
    }

    const samples: Pt2[] = [
      { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.1 }, { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }, { x: 0.5, y: 0.02 },
    ]
    for (const sample of samples) {
      expect(isPointInHull(hull, sample)).toBe(bruteForceInside(hull, sample))
    }
  })
})
