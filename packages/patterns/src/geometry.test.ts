import { describe, expect, it } from 'vitest'
import type { Stroke } from '@nail-studio/contracts'
import { TEX, circle, fill, type Pt } from './geometry.ts'
import { renderPattern } from './index.ts'

type Brush = Extract<Stroke, { kind: 'brush' }>
const brushes = (strokes: Stroke[]): Brush[] => strokes.filter((s): s is Brush => s.kind === 'brush')

/**
 * ขอบล่างของพื้นที่ที่ถูกระบายในคอลัมน์ u (หน่วย px บน texture) — จำลองแต้มกลมตามเส้นแบบเดียวกับ rasterizer
 * ใช้วัดรูปทรงที่มองเห็น ไม่ผูกกับวิธีที่ fill() สร้าง stroke
 */
function lowerEdgePx(strokes: Brush[], u: number): number {
  const x = u * TEX
  let edge = -Infinity
  for (const s of strokes) {
    const r = s.size / 2
    const pts = s.points.map((p) => [p.x * TEX, p.y * TEX] as const)
    for (let i = 0; i < Math.max(1, pts.length - 1); i++) {
      const [x1, y1] = pts[i]!
      const [x2, y2] = pts[Math.min(i + 1, pts.length - 1)]!
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (r * 0.1)))
      for (let k = 0; k <= n; k++) {
        const dx = x - (x1 + ((x2 - x1) * k) / n)
        if (Math.abs(dx) <= r) edge = Math.max(edge, y1 + ((y2 - y1) * k) / n + Math.sqrt(r * r - dx * dx))
      }
    }
  }
  return edge
}

describe('fill', () => {
  const ring = circle(0.5, 0.5, 0.2)

  it('ปิดท้ายด้วยเส้นขอบที่เดินตามรูปและปิดรูป', () => {
    const strokes = brushes(fill(ring, '#123456', { brushWidth: 0.02 }))
    const outline = strokes.at(-1)!
    const row = strokes[0]!
    expect(outline.points).toHaveLength(ring.length + 1)
    expect(outline.points[0]).toEqual(outline.points.at(-1))
    expect(outline.points[0]).toMatchObject({ x: 0.7, y: 0.5 })
    expect({ color: outline.color, size: outline.size, opacity: outline.opacity, softness: outline.softness })
      .toEqual({ color: row.color, size: row.size, opacity: row.opacity, softness: row.softness })
  })

  it('ทึบไม่เต็มไม่มีเส้นขอบ เพราะสีจะสะสมเป็นวงเข้ม', () => {
    const strokes = brushes(fill(ring, '#123456', { brushWidth: 0.02, opacity: 0.55 }))
    expect(strokes.every((s) => s.points.length <= 2)).toBe(true)
  })

  it('รูปเล็กกว่าระยะแถวยังไม่หายไป', () => {
    const tiny: Pt[] = [[0.5, 0.5], [0.501, 0.5], [0.501, 0.501]]
    expect(fill(tiny, '#000000', { brushWidth: 0.05 }).length).toBeGreaterThan(0)
  })

  it('ขอบเส้นยิ้มของ french ไม่เป็นขั้นบันได', () => {
    const strokes = brushes(renderPattern({ type: 'french', color: '#ffffff', smile: 0.08 }))
    let worst = 0
    let prev = lowerEdgePx(strokes, 0.25)
    for (let u = 0.25 + 1 / TEX; u <= 0.75; u += 1 / TEX) {
      const edge = lowerEdgePx(strokes, u)
      worst = Math.max(worst, Math.abs(edge - prev))
      prev = edge
    }
    expect(worst).toBeLessThan(2)
  })
})
