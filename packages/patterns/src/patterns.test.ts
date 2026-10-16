import { describe, expect, it } from 'vitest'
import { createEmptyDocument, designDocumentSchema, MAX_STROKES_PER_LAYER } from '@nail-studio/contracts'
import {
  PATTERN_TYPES,
  PRESETS,
  addDecorations,
  buildFromRecipe,
  clearNail,
  copyNail,
  mirrorHand,
  packLayers,
  patternSchema,
  renderPattern,
  summarizeDocument,
} from './index.ts'

describe('renderPattern', () => {
  it('ทุกชนิดลายสร้าง stroke ที่ผ่าน schema ได้ด้วยค่าตั้งต้น', () => {
    const minimal: Record<string, object> = {
      french: { color: '#ffffff' },
      gradient: { color: '#a184ee' },
      glitter: { colors: ['#9a78ee', '#ffffff'] },
      dots: { color: '#4a0e1d' },
      stripes: { color: '#8091ee' },
      swirl_tip: { color: '#0e4a3b' },
      leaf: { color: '#1f6e55', vein: '#7fb89d' },
      flower: { petal: '#c2adf6', center: '#5d3aa8' },
      butterfly: { wing: '#9070e4', outline: '#5d3aa8' },
      star: { color: '#62d4c9' },
      heart: { color: '#e85d75' },
      circle: { color: '#f2862a' },
      tortoise: {},
      fruit: { kind: 'cherry' },
      vine: { stem: '#ffffff', leaf: '#ffffff' },
      curve: { color: '#62d4c9', points: [[0.2, 0.2], [0.8, 0.8]] },
    }
    expect(PATTERN_TYPES.map((p) => p.type).sort()).toEqual(Object.keys(minimal).sort())
    for (const [type, params] of Object.entries(minimal)) {
      const strokes = renderPattern({ type, ...params } as never)
      expect(strokes.length, type).toBeGreaterThan(0)
      const document = createEmptyDocument()
      document.nails['right.index'].layers = packLayers(strokes)
      expect(designDocumentSchema.safeParse(document).success, type).toBe(true)
    }
  })

  it('ปฏิเสธค่านอกช่วงพร้อมบอกเหตุผล', () => {
    expect(patternSchema.safeParse({ type: 'dots', color: 'pink' }).success).toBe(false)
    expect(patternSchema.safeParse({ type: 'french', color: '#ffffff', depth: 2 }).success).toBe(false)
    expect(() => renderPattern({ type: 'nope' } as never)).toThrow()
  })

  it('ลายเดิม seed เดิมได้ผลเดิมทุกครั้ง', () => {
    const a = renderPattern({ type: 'glitter', colors: ['#ffffff'], seed: 7 })
    const b = renderPattern({ type: 'glitter', colors: ['#ffffff'], seed: 7 })
    expect(a).toEqual(b)
  })

  it('จุดเส้นโค้งต้องมีพิกัดสองค่าที่อยู่ในช่วง 0–1 เท่านั้น', () => {
    for (const point of [[0.2], [0.2, 0.5, 0.8], [-0.1, 0.5], [0.2, 1.1], ['0.2', 0.5]]) {
      expect(patternSchema.safeParse({ type: 'curve', color: '#112233', points: [point, [0.8, 0.8]] }).success).toBe(false)
    }
    expect(renderPattern({ type: 'curve', color: '#112233', points: [[0.2, 0.3], [0.7, 0.9]] }).length).toBeGreaterThan(0)
  })
})

describe('buildFromRecipe', () => {
  it('คีย์ชื่อนิ้วใช้กับสองมือ และมือซ้ายถูกกลับซ้าย-ขวา', () => {
    const { document, changed } = buildFromRecipe({
      nails: { index: { base: '#112233', patterns: [{ type: 'circle', color: '#ff0000', u: 0.3, v: 0.5 }] } },
    })
    expect(changed).toEqual(['left.index', 'right.index'])
    const right = document.nails['right.index'].layers[0]!.strokes[0]!
    const left = document.nails['left.index'].layers[0]!.strokes[0]!
    if (right.kind !== 'brush' || left.kind !== 'brush') throw new Error('expected brush')
    expect(left.points[0]!.x).toBeCloseTo(1 - right.points[0]!.x, 3)
    expect(document.nails['left.index'].baseColor).toBe('#112233')
  })

  it('คีย์เต็มชนะคีย์ชื่อนิ้ว และนิ้วที่ไม่ระบุคงของเดิม', () => {
    const base = createEmptyDocument()
    base.nails['left.thumb'].baseColor = '#abcdef'
    const { document } = buildFromRecipe({
      nails: { ring: { base: '#111111' }, 'right.ring': { base: '#222222' } },
    }, base)
    expect(document.nails['right.ring'].baseColor).toBe('#222222')
    expect(document.nails['left.ring'].baseColor).toBe('#111111')
    expect(document.nails['left.thumb'].baseColor).toBe('#abcdef')
  })

  it('defaults เปลี่ยนทรงทุกนิ้วแต่คงลายเดิม', () => {
    const first = buildFromRecipe({ nails: { index: { patterns: [{ type: 'dots', color: '#000000' }] } } }).document
    const { document } = buildFromRecipe({ defaults: { shape: 'stiletto' } }, first)
    expect(document.nails['right.thumb'].shape).toBe('stiletto')
    expect(document.nails['right.index'].layers[0]!.strokes.length).toBe(first.nails['right.index'].layers[0]!.strokes.length)
  })

  it('preset ทุกตัวสร้างเอกสารที่ผ่าน schema', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const { document } = buildFromRecipe(preset.recipe)
      expect(designDocumentSchema.safeParse(document).success, id).toBe(true)
    }
  })

  it('ลายหนาแน่นเกิน 6 เลเยอร์ถูกปฏิเสธพร้อมข้อความ', () => {
    const many = Array.from({ length: MAX_STROKES_PER_LAYER * 7 }, () => renderPattern({ type: 'circle', color: '#000000', radius: 0.01 })[0]!)
    expect(() => packLayers(many)).toThrow(/เลเยอร์/)
  })
})

describe('edit helpers', () => {
  it('copyNail / mirrorHand / clearNail / addDecorations', () => {
    let document = buildFromRecipe({
      mirrorLeft: false,
      nails: { 'right.index': { patterns: [{ type: 'heart', color: '#e85d75', u: 0.3 }] } },
    }).document
    document = copyNail(document, 'right.index', ['right.ring'])
    expect(document.nails['right.ring'].layers).toEqual(document.nails['right.index'].layers)
    document = mirrorHand(document, 'right')
    expect(document.nails['left.ring'].layers[0]!.strokes.length).toBeGreaterThan(0)
    document = addDecorations(document, 'right.thumb', [{ id: 'g', catalogId: 'gem-round', u: 0.5, v: 0.5, rotation: 0, scale: 0.4 }])
    expect(document.nails['right.thumb'].decorations).toHaveLength(1)
    document = clearNail(document, 'right.index')
    expect(document.nails['right.index'].layers[0]!.strokes).toHaveLength(0)
    expect(summarizeDocument(document)).toContain('right.thumb')
  })
})
