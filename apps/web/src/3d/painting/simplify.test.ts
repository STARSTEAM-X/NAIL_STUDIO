import { describe, expect, it } from 'vitest'
import type { Point } from '@nail-studio/contracts'
import { simplifyPath } from './simplify.ts'

function line(count: number, jitter = 0): Point[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index / (count - 1),
    y: 0.5 + (index % 2 === 0 ? jitter : -jitter),
    p: 0.5,
  }))
}

describe('simplifyPath', () => {
  it('เส้นสั้นกว่า 3 จุดคืนสำเนาที่เท่ากันแต่ไม่ใช่อาร์เรย์เดิม', () => {
    const points = line(2)
    const result = simplifyPath(points)
    expect(result).toEqual(points)
    // ต้องเป็นอาร์เรย์ใหม่ ไม่งั้นผู้เรียกที่แก้ผลลัพธ์จะไปแก้ของเดิมด้วย
    expect(result).not.toBe(points)
  })

  it('เส้นตรงยาวเหลือแค่หัวกับท้าย', () => {
    expect(simplifyPath(line(200))).toHaveLength(2)
  })

  it('เก็บหัวและท้ายไว้เสมอ', () => {
    const points = line(50, 0.05)
    const result = simplifyPath(points)
    expect(result[0]).toEqual(points[0])
    expect(result.at(-1)).toEqual(points.at(-1))
  })

  it('จุดที่เบี่ยงเกิน tolerance ไม่ถูกตัดทิ้ง', () => {
    const points: Point[] = [
      { x: 0, y: 0.5, p: 0.5 },
      { x: 0.5, y: 0.9, p: 0.5 },
      { x: 1, y: 0.5, p: 0.5 },
    ]
    expect(simplifyPath(points, 0.004)).toHaveLength(3)
  })

  it('รักษาลำดับเดิมของจุดที่เหลือ', () => {
    const points = line(80, 0.02)
    const result = simplifyPath(points)
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index]!.x).toBeGreaterThan(result[index - 1]!.x)
    }
  })

  it('จังหวะกดหนักกลางเส้นตรงไม่ถูกตัดทิ้ง', () => {
    // เป็นเหตุผลทั้งหมดที่ deviation ต้องถ่วงน้ำหนักด้วยแรงกด ไม่ใช่ระยะทางล้วน
    // ถ้าตัดจุดนี้ เส้นที่ผู้ใช้กดหนักตรงกลางจะกลายเป็นเส้นหนาเท่ากันตลอด
    const points: Point[] = [
      { x: 0, y: 0.5, p: 0 },
      { x: 0.5, y: 0.5, p: 1 },
      { x: 1, y: 0.5, p: 0 },
    ]
    expect(simplifyPath(points, 0.004)).toHaveLength(3)
  })

  it('จุดซ้ำที่ตำแหน่งเดียวกันไม่ทำให้พัง', () => {
    const same: Point[] = Array.from({ length: 20 }, () => ({ x: 0.4, y: 0.4, p: 0.5 }))
    expect(simplifyPath(same)).toHaveLength(2)
  })
})
