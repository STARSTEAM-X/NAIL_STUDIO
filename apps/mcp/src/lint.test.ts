import { describe, expect, it } from 'vitest'
import { createEmptyDocument, type DesignDocument, type Layer, type NailKey, type Stroke } from '@nail-studio/contracts'
import type { Recipe } from '@nail-studio/patterns'
import { formatFindings, lintDesign, type LintCode } from './lint.ts'

const KEY: NailKey = 'right.index'

const dot = (u: number, v: number, color = '#202020', size = 60): Stroke => ({
  kind: 'brush', brush: 'round', color, size, opacity: 1, softness: 0.05, points: [{ x: u, y: v, p: 1 }],
})

const layer = (strokes: Stroke[], visible = true): Layer => ({
  id: `l-${Math.random().toString(36).slice(2)}`, name: 'l', visible, opacity: 1, blend: 'normal', strokes,
})

function documentWith(patch: Partial<DesignDocument['nails'][NailKey]>, key: NailKey = KEY): DesignDocument {
  const document = createEmptyDocument()
  document.nails[key] = { ...document.nails[key], baseColor: '#f0e0d0', ...patch }
  return document
}

const codes = (document: DesignDocument, recipe?: Recipe, nails: NailKey[] = [KEY]): LintCode[] =>
  lintDesign(document, { nails, ...(recipe ? { recipe } : {}) }).map((finding) => finding.code)

describe('lintDesign', () => {
  it('เอกสารเปล่าไม่มีคำเตือน', () => {
    expect(lintDesign(createEmptyDocument())).toEqual([])
    expect(formatFindings([])).toBeNull()
  })

  it('OUTSIDE_NAIL: ลายชิ้นนอกเล็บ — แต่ไม่นับเกล็ดเล็ก เลเยอร์ซ่อน และยางลบ', () => {
    expect(codes(documentWith({ layers: [layer([dot(0.02, 0.5)])] }))).toContain('OUTSIDE_NAIL')
    expect(codes(documentWith({ layers: [layer([dot(0.5, 0.5)])] }))).not.toContain('OUTSIDE_NAIL')
    // เกล็ดกลิตเตอร์ขนาด 4 px ที่ตกนอกเล็บเป็นเรื่องปกติ
    expect(codes(documentWith({ layers: [layer([dot(0.02, 0.5, '#202020', 4)])] }))).not.toContain('OUTSIDE_NAIL')
    expect(codes(documentWith({ layers: [layer([dot(0.02, 0.5)], false)] }))).not.toContain('OUTSIDE_NAIL')
    const erase: Stroke = { kind: 'erase', brush: 'round', size: 60, softness: 0.05, points: [{ x: 0.02, y: 0.5, p: 1 }] }
    expect(codes(documentWith({ layers: [layer([erase])] }))).not.toContain('OUTSIDE_NAIL')
  })

  it('OUTSIDE_NAIL: ของตกแต่งนอกเล็บหรือล้นขอบ', () => {
    const decoration = (u: number) => ({ id: 'd', catalogId: 'gem-round', u, v: 0.5, rotation: 0, scale: 1 })
    const outside = lintDesign(documentWith({ decorations: [decoration(0.02)] }), { nails: [KEY] })
    expect(outside.some((f) => f.code === 'OUTSIDE_NAIL' && f.message.includes('นอกเล็บ'))).toBe(true)
    const edge = lintDesign(documentWith({ decorations: [decoration(0.22)] }), { nails: [KEY] })
    expect(edge.some((f) => f.code === 'OUTSIDE_NAIL' && f.message.includes('ล้นขอบ'))).toBe(true)
    expect(codes(documentWith({ decorations: [{ ...decoration(0.5), scale: 0.3 }] }))).not.toContain('OUTSIDE_NAIL')
  })

  it('มือซ้ายตรวจด้วย u ที่กลับแล้ว (ข้อมูลมือซ้ายเก็บแบบ mirror)', () => {
    // u = 0.98 ของมือซ้าย = u 0.02 บนผิวจริง → นอกเล็บ
    expect(codes(documentWith({ layers: [layer([dot(0.98, 0.5)])] }, 'left.index'), undefined, ['left.index'])).toContain('OUTSIDE_NAIL')
    expect(codes(documentWith({ layers: [layer([dot(0.5, 0.5)])] }, 'left.index'), undefined, ['left.index'])).not.toContain('OUTSIDE_NAIL')
  })

  it('STRETCHED: ลายชิ้นที่ปลายเล็บทรงยาวถูกยืด แต่ทรงฐานไม่', () => {
    const stretched = lintDesign(documentWith({ shape: 'stiletto', length: 'extra', layers: [layer([dot(0.5, 0.1)])] }), { nails: [KEY] })
    const finding = stretched.find((f) => f.code === 'STRETCHED')
    expect(finding?.message).toMatch(/ยืดตามแนวยาว.*×\d/)
    expect(codes(documentWith({ layers: [layer([dot(0.5, 0.4)])] }))).not.toContain('STRETCHED')
  })

  it('LOW_CONTRAST: สีที่กลืนกับพื้น', () => {
    const faint = lintDesign(documentWith({ baseColor: '#f1d4cf', layers: [layer([dot(0.5, 0.5, '#f3d7d2', 120)])] }), { nails: [KEY] })
    expect(faint.some((f) => f.code === 'LOW_CONTRAST' && f.message.includes('#f3d7d2'))).toBe(true)
    expect(codes(documentWith({ baseColor: '#f1d4cf', layers: [layer([dot(0.5, 0.5, '#202020', 120)])] }))).not.toContain('LOW_CONTRAST')
  })

  it('NEAR_LIMIT: stroke รวมเกือบเต็มเพดาน หรือเลเยอร์ใกล้เต็ม', () => {
    const many = Array.from({ length: 5 }, () => layer(Array.from({ length: 480 }, (_, i) => dot(0.3 + (i % 40) / 100, 0.3, '#202020', 4))))
    const full = lintDesign(documentWith({ layers: many }), { nails: [KEY] }).filter((f) => f.code === 'NEAR_LIMIT')
    expect(full).toHaveLength(1)
    expect(full[0]!.message).toContain('2400/3000 stroke')
    const layers = lintDesign(documentWith({ layers: Array.from({ length: 5 }, () => layer([])) }), { nails: [KEY] })
    expect(layers.some((f) => f.code === 'NEAR_LIMIT' && f.message.includes('5/6 เลเยอร์'))).toBe(true)
    expect(codes(documentWith({ layers: [layer([dot(0.5, 0.5)])] }))).not.toContain('NEAR_LIMIT')
  })

  it('DENSE_PATTERNS: ลายหนาแน่นเกิน 2 ลายในเล็บเดียว', () => {
    const recipe = (types: string[]): Recipe => ({ nails: { index: { patterns: types.map((type) => ({ type, colors: ['#ffffff'] })) } } }) as unknown as Recipe
    expect(codes(createEmptyDocument(), recipe(['glitter', 'foil', 'gold_vein']))).toContain('DENSE_PATTERNS')
    expect(codes(createEmptyDocument(), recipe(['glitter', 'foil', 'dots']))).not.toContain('DENSE_PATTERNS')
  })

  it('formatFindings ตัดที่จำนวนที่กำหนด', () => {
    const findings = Array.from({ length: 20 }, (_, i) => ({ code: 'OUTSIDE_NAIL' as const, nail: KEY, message: `m${i}` }))
    const text = formatFindings(findings, 15)!
    expect(text.split('\n')).toHaveLength(17)
    expect(text).toContain('…และอีก 5 รายการ')
  })
})
