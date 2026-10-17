import { buildFromRecipe, patternSchema } from './index.ts'
import { designDocumentSchema } from '@nail-studio/contracts'
import { describe, expect, it } from 'vitest'
import type { Stroke } from '@nail-studio/contracts'
import { TEX, circle, clipSegment, fill, fillPolygons, type Pt } from './geometry.ts'
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

describe('clipSegment', () => {
  it('ตัดเฉพาะส่วนที่อยู่นอก UV โดยคงความชันของเส้นเดิม', () => {
    expect(clipSegment([-1, -0.5], [2, 1])).toEqual([[0, 0], [1, 0.5]])
    expect(clipSegment([-1, 2], [-0.5, 3])).toEqual([])
    expect(clipSegment([0.5, -2], [0.5, 2])).toEqual([[0.5, 0], [0.5, 1]])
  })
})


describe('fillPolygons / path', () => {

  it('maxStrokes นับทั้ง scanline และเส้นขอบ และไม่จำกัดเมื่อไม่ได้ระบุ', () => {
    const poly: Pt[] = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]
    const full = fillPolygons([poly], '#000000')
    expect(fillPolygons([poly], '#000000', { maxStrokes: full.length })).toEqual(full)
    expect(() => fillPolygons([poly], '#000000', { maxStrokes: full.length - 1 })).toThrow(/ลายระบายใช้ stroke เกิน/)
    // รูปแนวนอนสร้างเฉพาะเส้นขอบ: งบศูนย์ต้องหยุดก่อนสร้างเส้นแรก
    expect(() => fillPolygons([[[0.2, 0.5], [0.8, 0.5]]], '#000000', { maxStrokes: 0 })).toThrow(/stroke เกิน 0/)
    expect(fillPolygons([], '#000000', { maxStrokes: 0 })).toEqual([])
    for (const maxStrokes of [-1, 0.5, NaN, Infinity]) {
      expect(() => fillPolygons([poly], '#000000', { maxStrokes })).toThrow(/maxStrokes/)
    }
  })

  it('หยุด zigzag ก่อนสร้างเกิน 3,000 stroke โดยไม่อิงเวลา', () => {
    const d = 'M' + Array.from({ length: 1000 }, (_, i) => [i, i % 2 ? 9 : 1]).flat().join(' ') + 'Z'
    expect(d.length).toBeLessThanOrEqual(8000)
    // นับ object ที่ถูกสร้างจริงผ่าน push แทน spy line ซึ่ง fillPolygons เรียกภายในโมดูลเดียวกัน
    const created = new Set<unknown>()
    const push = Array.prototype.push
    Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
      for (const item of items) if (typeof item === 'object' && item !== null && 'kind' in item && item.kind === 'brush') created.add(item)
      return push.apply(this, items)
    }
    try {
      expect(() => renderPattern({ type: 'path', d, viewBox: [0, 0, 1000, 10], fill: '#000000' }))
        .toThrow('ลายระบายใช้ stroke เกิน 3,000 — ลดจำนวนจุดหยัก/รายละเอียดของ path')
    } finally { Array.prototype.push = push }
    expect(created.size).toBe(3000)
  })

  it('fill พอดี 3,000 ผ่าน แต่รวมเส้นขอบแล้วเกินเพดานหยุดก่อนสร้างเพิ่ม', () => {
    const d = Array.from({ length: 15 }, (_, i) => {
      const x = 300 + i * 4.5
      return `M${x} 0 H${x + 4} V1000 H${x} Z`
    }).join(' ')
    const spec = { type: 'path', d, viewBox: [0, 0, 1000, 1000], fill: '#000000' } as const
    expect(renderPattern({ ...spec, viewBox: [...spec.viewBox] })).toHaveLength(3000)
    const created = new Set<unknown>()
    const push = Array.prototype.push
    Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
      for (const item of items) if (typeof item === 'object' && item !== null && 'kind' in item && item.kind === 'brush') created.add(item)
      return push.apply(this, items)
    }
    try {
      expect(() => renderPattern({ ...spec, viewBox: [...spec.viewBox], stroke: '#ffffff' })).toThrow(/ลาย path ใช้ stroke รวมเกิน 3,000/)
    } finally { Array.prototype.push = push }
    expect(created.size).toBe(3000)
  })

  it('donut ใช้ evenodd/nonzero ตามทิศ winding ของวงใน', () => {
    const outer = circle(.5, .5, .4), inner = circle(.5, .5, .2)
    for (const rule of ['evenodd', 'nonzero'] as const) for (const reverse of [false, true]) {
      const strokes = fillPolygons([outer, reverse ? [...inner].reverse() : inner], '#000000', { brushWidth: .004, rule })
      const middle = strokes.filter((s) => s.points.length <= 2 && Math.abs(s.points[0]!.y - .5) < .002)
      const crossesCenter = middle.some((s) => s.points[0]!.x < .5 && s.points.at(-1)!.x > .5)
      expect(crossesCenter, `${rule}/${reverse}`).toBe(rule === 'nonzero' && !reverse)
    }
    expect(fillPolygons([], '#000000')).toEqual([])
  })

  it('viewBox/region, strokeWidth และ opacity แปลงถูกต้อง', () => {
    const strokes = brushes(renderPattern({ type: 'path', d: 'M10 20 H110 V220 H10 Z', viewBox: [10, 20, 100, 200],
      region: { u0: .2, v0: .1, u1: .8, v1: .9 }, stroke: '#123456', strokeWidth: 2, opacity: .3 }))
    expect(strokes).toHaveLength(1)
    expect(strokes[0]!.points.map((p) => [p.x, p.y])).toEqual([[.2, .1], [.8, .1], [.8, .9], [.2, .9], [.2, .1]])
    expect(strokes[0]!.size).toBe(10)
    expect(strokes[0]!.opacity).toBe(.3)
    const both = brushes(renderPattern({ type: 'path', d: 'M.3 .2 H.7 V.8 H.3 Z', fill: '#000000', stroke: '#ffffff', opacity: .2 }))
    expect(both.filter((s) => s.color === '#000000').every((s) => s.opacity === 1)).toBe(true)
    expect(both.at(-1)!.opacity).toBe(.2)
    expect(brushes(renderPattern({ type: 'path', d: 'M0 0 H100', viewBox: [0, 0, 100, 100], stroke: '#000000' }))[0]!.size).toBe(10)
  })

  it('เติมรูปเปิดได้แต่ stroke เปิด, path ว่างไม่เกิดเม็ดสี และแปรงเล็กกับรูปเล็ก', () => {
    const strokes = brushes(renderPattern({ type: 'path', d: 'M.3 .3 L.7 .3 .5 .7', fill: '#000000', stroke: '#ffffff' }))
    expect(strokes.length).toBeGreaterThan(1)
    expect(strokes.at(-1)!.points).toHaveLength(3)
    for (const d of ['', 'M.5 .5', 'M.5 .5 Z']) expect(renderPattern({ type: 'path', d, fill: '#000000', stroke: '#ffffff' })).toEqual([])
    const small = brushes(renderPattern({ type: 'path', d: 'M.5 .5 h.02 v.02 h-.02 Z', fill: '#000000' }))
    expect(small[0]!.size).toBe(4)
    const tiny = brushes(renderPattern({ type: 'path', d: 'M.5 .5 h.003 v.003 h-.003 Z', fill: '#000000' }))
    expect(tiny).toHaveLength(1)
    expect(tiny[0]!.points).toHaveLength(1)
  })

  it('จำกัดแถว 200 สำหรับรูปสูงเต็มเล็บและแบ่ง outline ที่ยาวเกินเพดาน', () => {
    const tall = brushes(renderPattern({ type: 'path', d: 'M.49 0 H.51 V1 H.49 Z', fill: '#000000' }))
    const rows = new Set(tall.filter((s) => s.points.length <= 2).map((s) => s.points[0]!.y))
    expect(rows.size).toBe(200)
    const d = 'M0 0 H' + Array.from({ length: 2100 }, (_, i) => i % 2).join(' ') + ' Z'
    const doc = buildFromRecipe({ nails: { index: { patterns: [{ type: 'path', d, stroke: '#000000' }] } } }).document
    expect(designDocumentSchema.safeParse(doc).success).toBe(true)
    const strokes = brushes(doc.nails['right.index'].layers.flatMap((l) => l.strokes))
    expect(strokes.length).toBeGreaterThan(1)
    expect(strokes[0]!.points.at(-1)).toEqual(strokes[1]!.points[0])
    // เส้นขอบของ fillPolygons ต้องแบ่งด้วยเช่นกัน
    const outline = fillPolygons([Array.from({ length: 2100 }, (_, i): Pt => [i / 2100, .5])], '#000000')
    expect(outline.every((s) => s.points.length <= 2000)).toBe(true)
  })

  it('ปฏิเสธสีที่หายไป viewBox/region ผิด และตัวเลข nonfinite', () => {
    for (const spec of [
      {}, { viewBox: [0, 0, 0, 1], fill: '#000000' }, { viewBox: [0, 0, 1, -1], fill: '#000000' },
      { region: { u0: .8, v0: 0, u1: .2, v1: 1 }, fill: '#000000' },
      { fill: '#000000', opacity: 2 }, { stroke: '#000000', strokeWidth: 0 },
      { fill: '#000000', viewBox: [0, 0, Infinity, 1] }, { fill: '#000000', d: ' '.repeat(8001) },
    ]) expect(patternSchema.safeParse({ type: 'path', d: 'M0 0 L1 1', ...spec }).success).toBe(false)
    expect(() => renderPattern({ type: 'path', d: '' })).toThrow(/fill หรือ stroke/)
  })
})
