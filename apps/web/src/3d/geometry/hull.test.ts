import { describe, expect, it } from 'vitest'
import { computeHull, type Pt2 } from './hull.ts'

function area(hull: Pt2[]): number {
  let sum = 0
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

describe('computeHull', () => {
  it('returns fewer than 3 points unchanged', () => {
    expect(computeHull([])).toEqual([])
    expect(computeHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }])
    expect(computeHull([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }])
  })

  it('finds the hull of a square with one interior point', () => {
    const points: Pt2[] = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ]
    const hull = computeHull(points)
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 0.5, y: 0.5 })
  })

  it('produces a counter-clockwise winding (positive signed area)', () => {
    const points: Pt2[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]
    expect(area(computeHull(points))).toBeGreaterThan(0)
  })

  it('drops duplicate points', () => {
    const points: Pt2[] = [
      { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ]
    expect(computeHull(points)).toHaveLength(4)
  })

  it('handles all-collinear points by returning them without crashing', () => {
    const points: Pt2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
    expect(() => computeHull(points)).not.toThrow()
  })

  it('matches the known hull of an irregular nail-like point cloud', () => {
    // ทรงคล้ายเล็บ: ยาวตามแกน y แคบตามแกน x โค้งที่ปลาย
    const points: Pt2[] = [
      { x: 0.5, y: 0.05 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 },
      { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 },
      { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 },
      { x: 0.4, y: 0.95 }, { x: 0.6, y: 0.95 },
      { x: 0.5, y: 0.5 }, // interior point — ต้องไม่อยู่ใน hull
    ]
    const hull = computeHull(points)
    expect(hull).not.toContainEqual({ x: 0.5, y: 0.5 })
    expect(hull.length).toBeGreaterThanOrEqual(6)
    expect(area(hull)).toBeGreaterThan(0)
  })
})
