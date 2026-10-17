import { describe, expect, it } from 'vitest'
import { DENSE_PATTERN_TYPES, PATTERN_TYPES, patternSchema, renderPattern, type PatternSpec } from './patterns.ts'

/** เกณฑ์ของ "ลายหนาแน่น" — ต้องตรงกับคอมเมนต์ของ DENSE_PATTERN_TYPES */
const DENSE_MIN_STROKES = 150

/** ฟิลด์บังคับที่ไม่มีค่าเริ่มต้นและเดาจากชนิดไม่ได้ */
const OVERRIDES: Record<string, Record<string, unknown>> = {
  curve: { points: [[0.3, 0.3], [0.7, 0.7]] },
}

type SchemaDef = { type: string; values?: unknown[]; entries?: Record<string, unknown> }

/**
 * spec ขั้นต่ำของแต่ละชนิด: เติมเฉพาะฟิลด์บังคับ (สี/ชุดสี/ตัวเลือกแรกของ enum)
 * ส่วนที่เหลือใช้ค่าเริ่มต้นของ schema — คือจำนวน stroke "ตามค่าเริ่มต้น" จริง
 */
function minimalSpec(option: (typeof patternSchema.options)[number]): PatternSpec {
  const spec: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(option.shape)) {
    const def = (schema as unknown as { _zod: { def: SchemaDef } })._zod.def
    if (def.type === 'optional' || def.type === 'default' || def.type === 'prefault') continue
    if (key === 'type') spec.type = def.values![0]
    else if (def.type === 'string') spec[key] = '#888888'
    else if (def.type === 'array') spec[key] = ['#888888']
    else if (def.type === 'enum') spec[key] = Object.values(def.entries!)[0]
  }
  return { ...spec, ...OVERRIDES[spec.type as string] } as PatternSpec
}

describe('DENSE_PATTERN_TYPES', () => {
  it('ตรงกับจำนวน stroke ที่วัดจริงเมื่อใช้ค่าเริ่มต้น', () => {
    const measured = patternSchema.options
      .map(minimalSpec)
      .filter((spec) => renderPattern(spec).length >= DENSE_MIN_STROKES)
      .map((spec) => spec.type)
      .sort()
    expect(measured).toEqual([...DENSE_PATTERN_TYPES].sort())
  })

  it('PATTERN_TYPES บอกแฟล็ก dense ครบทุกชนิด', () => {
    for (const entry of PATTERN_TYPES) expect(entry.dense).toBe(DENSE_PATTERN_TYPES.has(entry.type))
  })
})
