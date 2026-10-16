import { describe, expect, it } from 'vitest'
import {
  DESIGN_SCHEMA_VERSION,
  createEmptyDocument,
  designDocumentSchema,
  migrateDesignDocument,
} from './design.ts'

/**
 * เอกสาร v2 ถูกวาดบน hand.glb รุ่นที่ทรง/UV ของเล็บโป้ง ชี้ กลาง กลับหัว
 * (pipeline เดาปลายเล็บจากฝั่งที่แคบกว่า) — v3 คือหลังแก้ให้ใช้ทิศจากกระดูกนิ้ว
 * บนสามนิ้วนั้น u เท่าเดิม แต่ v ใหม่ = 1 − v เดิม (วัดจากไฟล์ GLB ทั้งสองรุ่นแล้ว)
 */
function v2DocumentWithArt() {
  const document = createEmptyDocument() as unknown as Record<string, unknown> & {
    nails: Record<string, { layers: { strokes: unknown[] }[]; decorations: unknown[] }>
  }
  document.schemaVersion = 2
  for (const key of ['right.index', 'left.ring']) {
    document.nails[key]!.layers[0]!.strokes = [
      {
        kind: 'brush', brush: 'liner', color: '#d4af37', size: 10, opacity: 1, softness: 0.1,
        points: [{ x: 0.2, y: 0.1, p: 0.5 }, { x: 0.8, y: 0.25, p: 1 }],
      },
      { kind: 'fill', color: '#ffffff' },
    ]
    document.nails[key]!.decorations = [
      { id: 'gem', catalogId: 'gem-round', u: 0.3, v: 0.2, rotation: 0.7, scale: 0.4 },
    ]
  }
  return document
}

describe('migrateDesignDocument v2 → v3', () => {
  it('พลิก v ของ stroke และ decoration บนนิ้วโป้ง ชี้ กลาง', () => {
    const result = designDocumentSchema.parse(v2DocumentWithArt())
    const nail = result.nails['right.index']
    const stroke = nail.layers[0]!.strokes[0]!
    expect(stroke.kind).toBe('brush')
    if (stroke.kind !== 'brush') return
    expect(stroke.points[0]).toEqual({ x: 0.2, y: 0.9, p: 0.5 })
    expect(stroke.points[1]!.x).toBe(0.8)
    expect(stroke.points[1]!.y).toBeCloseTo(0.75)
    // rotation วัดจากแกน +u ซึ่งไม่เปลี่ยน จึงต้องคงเดิม
    expect(nail.decorations[0]).toMatchObject({ u: 0.3, v: 0.8, rotation: 0.7 })
  })

  it('ไม่แตะนิ้วนางและนิ้วก้อย', () => {
    const result = designDocumentSchema.parse(v2DocumentWithArt())
    const nail = result.nails['left.ring']
    const stroke = nail.layers[0]!.strokes[0]!
    if (stroke.kind !== 'brush') throw new Error('expected brush')
    expect(stroke.points[0]).toEqual({ x: 0.2, y: 0.1, p: 0.5 })
    expect(nail.decorations[0]).toMatchObject({ u: 0.3, v: 0.2 })
  })

  it('ได้เอกสารเวอร์ชันปัจจุบัน และไม่แก้ก้อนต้นฉบับ', () => {
    const source = v2DocumentWithArt()
    const result = designDocumentSchema.parse(source)
    expect(result.schemaVersion).toBe(DESIGN_SCHEMA_VERSION)
    expect(DESIGN_SCHEMA_VERSION).toBe(3)
    expect(source.schemaVersion).toBe(2)
    const original = source.nails['right.index']!.layers[0]!.strokes[0] as { points: { y: number }[] }
    expect(original.points[0]!.y).toBe(0.1)
  })

  it('เอกสาร v3 ผ่านไปโดยไม่ถูกพลิกซ้ำ', () => {
    const migrated = designDocumentSchema.parse(v2DocumentWithArt())
    const again = designDocumentSchema.parse(migrated)
    expect(again).toEqual(migrated)
  })

  it('ข้อมูลที่ผิดรูปแบบไม่ทำให้ migrate ล้ม แต่ schema ยังปฏิเสธ', () => {
    expect(() => migrateDesignDocument({ schemaVersion: 2, nails: {} })).not.toThrow()
    expect(() => migrateDesignDocument(null)).not.toThrow()
    expect(designDocumentSchema.safeParse({ schemaVersion: 2, nails: {} }).success).toBe(false)
  })
})
