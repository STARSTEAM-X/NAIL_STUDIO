import { describe, expect, it } from 'vitest'
import {
  NAIL_KEYS,
  createEmptyDocument,
  designDocumentSchema,
  handSettingsSchema,
} from './design.ts'
import type { HandSettings } from './design.ts'

describe('DesignDocument', () => {
  it('มีคีย์เล็บครบ 10 นิ้ว ไม่ซ้ำกัน', () => {
    expect(NAIL_KEYS).toHaveLength(10)
    expect(new Set(NAIL_KEYS).size).toBe(10)
    expect(NAIL_KEYS).toContain('right.index')
    expect(NAIL_KEYS).toContain('left.thumb')
  })

  it('เอกสารเปล่าผ่าน schema ของตัวเอง', () => {
    const result = designDocumentSchema.safeParse(createEmptyDocument())
    expect(result.success).toBe(true)
  })

  it('เอกสารเปล่าเป็นคนละก้อนกันทุกครั้ง (ไม่แชร์อ้างอิง)', () => {
    const a = createEmptyDocument()
    const b = createEmptyDocument()
    a.nails['right.index'].baseColor = '#ff0000'
    expect(b.nails['right.index'].baseColor).toBe('#ffffff')
    // เล็บแต่ละนิ้วในเอกสารเดียวกันก็ต้องไม่แชร์กันด้วย
    expect(a.nails['left.thumb'].baseColor).toBe('#ffffff')
  })

  it('ปฏิเสธเอกสารที่ขาดเล็บบางนิ้ว', () => {
    const document = createEmptyDocument() as Record<string, unknown>
    const nails = { ...(document.nails as Record<string, unknown>) }
    delete nails['right.little']
    const result = designDocumentSchema.safeParse({ ...document, nails })
    expect(result.success).toBe(false)
  })

  it('ปฏิเสธรหัสสีที่ไม่ใช่ #rrggbb', () => {
    const document = createEmptyDocument()
    document.hand.skinTone = 'chocolate' as never
    expect(designDocumentSchema.safeParse(document).success).toBe(false)
  })

  it('ปฏิเสธพิกัด UV ที่หลุดออกนอกช่วง 0..1', () => {
    const document = createEmptyDocument()
    document.nails['right.index'].layers[0]!.strokes.push({
      kind: 'brush',
      brush: 'round',
      color: '#000000',
      size: 60,
      opacity: 1,
      softness: 0.3,
      points: [{ x: 1.4, y: 0.5, p: 0.8 }],
    })
    expect(designDocumentSchema.safeParse(document).success).toBe(false)
  })

  it('ปฏิเสธเลเยอร์เกินเพดาน 6 ชั้น', () => {
    const document = createEmptyDocument()
    const nail = document.nails['right.index']
    for (let index = 0; index < 6; index += 1) {
      nail.layers.push({
        id: `extra-${index}`,
        name: `เลเยอร์ ${index + 2}`,
        visible: true,
        opacity: 1,
        blend: 'normal',
        strokes: [],
      })
    }
    expect(designDocumentSchema.safeParse(document).success).toBe(false)
  })

  it('รับ round-trip ผ่าน JSON โดยไม่เพี้ยน', () => {
    const original = createEmptyDocument()
    const restored = designDocumentSchema.parse(JSON.parse(JSON.stringify(original)))
    expect(restored).toEqual(original)
  })
})

describe('HandSettings', () => {
  it('อนุมานชนิดตรงกับ schema', () => {
    const settings: HandSettings = {
      skinTone: '#e8bfa0',
      proportions: { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 },
    }
    expect(handSettingsSchema.safeParse(settings).success).toBe(true)
  })
})
