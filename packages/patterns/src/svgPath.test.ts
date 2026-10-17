import { describe, expect, it } from 'vitest'
import { rng, type Pt } from './geometry.ts'
import { PathSyntaxError, flattenSvgPath, parseSvgPath } from './svgPath.ts'

const points = (d: string, tolerance = 0.001) => flattenSvgPath(d, tolerance)[0]!.points
const end = (d: string) => points(d).at(-1)

describe('SVG path', () => {
  it('ทุกคำสั่ง absolute/relative และปิดรูปกลับมาจุดเริ่ม', () => {
    const cases: [string, Pt][] = [
      ['M1 2 3 4', [3, 4]], ['m1 2 3 4', [4, 6]],
      ['M1 2 L3 4', [3, 4]], ['M1 2 l3 4', [4, 6]],
      ['M1 2 H3 V4', [3, 4]], ['M1 2 h3 v4', [4, 6]],
      ['M1 2 C2 3 4 5 6 7', [6, 7]], ['M1 2 c2 3 4 5 6 7', [7, 9]],
      ['M1 2 S4 5 6 7', [6, 7]], ['M1 2 s4 5 6 7', [7, 9]],
      ['M1 2 Q4 5 6 7', [6, 7]], ['M1 2 q4 5 6 7', [7, 9]],
      ['M1 2 T6 7', [6, 7]], ['M1 2 t6 7', [7, 9]],
      ['M1 2 A5 3 35 1 0 6 7', [6, 7]], ['M1 2 a5 3 35 0 1 6 7', [7, 9]],
      ['M1 2 L3 4 Z', [1, 2]], ['m1 2 l3 4 z', [1, 2]],
    ]
    for (const [d, expected] of cases) expect(end(d), d).toEqual(expected)
    const subs = flattenSvgPath('M1 2 L3 4 Z l1 1 M8 9 L9 9', .01)
    expect(subs.map((s) => s.closed)).toEqual([true, false, false])
    expect(subs[1]!.points).toEqual([[1, 2], [2, 3]])
  })

  it('ตัวเลข SVG, comma, พารามิเตอร์ซ้ำ, M หลายคู่ และ arc flags ติดกัน', () => {
    expect(parseSvgPath('M-.5e-2,1-2 .5.5 .6 L1 2 3 4').map((c) => [c.type, c.values])).toEqual([
      ['M', [-.005, 1]], ['L', [-2, .5]], ['L', [.5, .6]], ['L', [1, 2]], ['L', [3, 4]],
    ])
    expect(parseSvgPath('M0 0 a1 1 0 011 1')[1]!.values).toEqual([1, 1, 0, 0, 1, 1, 1])
    expect(points('M0 0 L0 0 1 1 1 1')).toEqual([[0, 0], [1, 1]])
    expect(flattenSvgPath('', .001)).toEqual([])
  })

  it('S/T สะท้อน control เฉพาะชนิดเดิม รวม relative และ reset หลัง L/Z', () => {
    expect(points('M0 0 C0 1 1 1 1 0 S2 -1 2 0')).toEqual(points('M0 0 C0 1 1 1 1 0 C1 -1 2 -1 2 0'))
    expect(points('M0 0 Q1 1 2 0 t2 0')).toEqual(points('M0 0 Q1 1 2 0 Q3 -1 4 0'))
    expect(points('M0 0 L1 1 S2 2 3 3')).toEqual(points('M0 0 L1 1 C1 1 2 2 3 3'))
    expect(points('M0 0 L1 1 T3 3')).toEqual(points('M0 0 L1 1 Q1 1 3 3'))
  })

  it('arc ครึ่งวงกลม ขยายรัศมี และ sweep/large arc อยู่ถูกฝั่ง', () => {
    for (const radius of [.5, .1]) {
      const pts = points(`M0 .5 A${radius} ${radius} 0 0 1 1 .5`)
      for (const [x, y] of pts) expect(Math.abs(Math.hypot(x - .5, y - .5) - .5)).toBeLessThanOrEqual(.001)
      expect(Math.min(...pts.map((p) => p[1]))).toBeLessThan(.01)
    }
    expect(Math.max(...points('M0 .5 A.5 .5 0 0 0 1 .5').map((p) => p[1]))).toBeGreaterThan(.99)
    expect(points('M0 0 A0 1 0 0 1 1 1')).toEqual([[0, 0], [1, 1]])
    expect(points('M0 0 A1 1 0 0 1 0 0')).toEqual([[0, 0]])
  })

  it('cubic 50 เส้น seed คงที่คลาดจากเส้นจริงไม่เกิน tolerance', () => {
    const rand = rng(7823), tolerance = .001
    const dist = (p: Pt, a: Pt, b: Pt): number => {
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy) || 0))
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    }
    for (let i = 0; i < 50; i++) {
      const ctrl = Array.from({ length: 4 }, (): Pt => [rand(), rand()])
      const poly = points(`M${ctrl[0]!.join(' ')} C${ctrl.slice(1).flat().join(' ')}`, tolerance)
      for (let j = 0; j < 100; j++) {
        const t = (j + .5) / 100
        const p = [0, 1].map((k) => (1 - t) ** 3 * ctrl[0]![k]! + 3 * (1 - t) ** 2 * t * ctrl[1]![k]! + 3 * (1 - t) * t * t * ctrl[2]![k]! + t ** 3 * ctrl[3]![k]!) as unknown as Pt
        expect(Math.min(...poly.slice(1).map((b, k) => dist(p, poly[k]!, b)))).toBeLessThanOrEqual(tolerance)
      }
    }
  })

  it('ปฏิเสธ syntax, nonfinite, flags และข้อมูลเกินเพดานพร้อมตำแหน่ง', () => {
    for (const d of ['M 0 0 C 1', 'X 1 2', 'M NaN 0', 'M1e999 0', 'M0 0 A1 1 0 2 0 1 1', 'M,0 0', 'M0 0,', 'M0 0,,1 1', 'L1 1', 'M0 0 A-1 1 0 0 1 1 1']) {
      expect(() => parseSvgPath(d), d).toThrow(PathSyntaxError)
      expect(() => parseSvgPath(d), d).toThrow(/ตำแหน่ง \d+/)
    }
    expect(() => flattenSvgPath('M0 0 '+Array.from({ length: 6 }, () => 'C1 1 -1 1 0 0').join(' '), 1e-20)).toThrow(/4,000/)
    expect(() => parseSvgPath(' '.repeat(8001))).toThrow(/8,000/)
    expect(() => flattenSvgPath('M0 0', 0)).toThrow(/tolerance/)
  })
})
