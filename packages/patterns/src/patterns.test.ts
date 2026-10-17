import { describe, expect, it, vi } from 'vitest'
import * as geometry from './geometry.ts'
import { createEmptyDocument, designDocumentSchema, MAX_STROKES_PER_LAYER, type Stroke } from '@nail-studio/contracts'
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
  type PatternSpec,
} from './index.ts'

/** ขอบที่ถูกวาดรวมรัศมีแปรง — ตรวจการชนขอบโดยไม่ผูกกับจำนวน stroke */
function paintedBounds(strokes: Stroke[]) {
  const points = strokes.flatMap((s) => s.kind === 'brush'
    ? s.points.map((p) => ({ x: p.x, y: p.y, r: s.size / 2048 }))
    : [])
  return {
    left: Math.min(...points.map((p) => p.x - p.r)),
    right: Math.max(...points.map((p) => p.x + p.r)),
    top: Math.min(...points.map((p) => p.y - p.r)),
    bottom: Math.max(...points.map((p) => p.y + p.r)),
  }
}

describe('renderPattern', () => {
  it('ทุกชนิดลายสร้าง stroke ที่ผ่าน schema ได้ด้วยค่าตั้งต้น', () => {
    const minimal: Record<string, object> = {
      path: { d: 'M.3 .3 L.7 .7', stroke: '#888888' },
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
      bow: { color: '#861d35' },
      cloud: {}, rainbow: {}, constellation: {}, quilt: {},
      aura: { color: '#d985a2' },
      cat_eye: {},
      wavy_tip: { color: '#fff3cc' },
      sprinkles: { colors: ['#861d35', '#b2d4d9'] },
      checkerboard: { color: '#5d4c53' },
      smiley: { color: '#4c9ccd' },
      squiggle: { color: '#e9ac45' },
      ghost: {}, skull: {}, spiderweb: {},
      flame: { color: '#191b21' },
      bunny: {}, cat: {},
      marble: {}, foil: {}, floral_spray: {},
      gold_vein: {}, malachite: {}, glitter_line: {}, bead_line: {},
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
    for (const spec of [
      { type: 'sprinkles', colors: [], count: 100000 },
      { type: 'checkerboard', color: '#ffffff', size: 0 },
      { type: 'quilt', spacing: -1 },
      { type: 'foil', density: Infinity },
      { type: 'aura', color: 'pink', radius: 1 },
      { type: 'bow', color: '#ffffff', angle: NaN },
      { type: 'foil', points: [[0.1], [0.8, 0.9]] },
    ]) expect(patternSchema.safeParse(spec).success).toBe(false)
  })

  it('ลายใหม่ที่ค่าหนาแน่นสูงสุดยังบันทึกได้ภายในเพดานเลเยอร์', () => {
    const specs: PatternSpec[] = [
      { type: 'checkerboard', color: '#123456', size: 0.1 },
      { type: 'quilt', spacing: 0.12 },
      { type: 'foil', density: 1, width: 0.08 },
      { type: 'floral_spray', size: 0.3 },
      { type: 'bow', color: '#eeeeee', size: 0.3, style: 'silk' },
      { type: 'aura', color: '#d985a2', radius: 0.5 },
    ]
    for (const spec of specs) {
      const doc = createEmptyDocument()
      doc.nails['right.index'].layers = packLayers(renderPattern(spec))
      expect(designDocumentSchema.safeParse(doc).success, spec.type).toBe(true)
    }
  })

  it('ลายสุ่มใหม่ทำซ้ำได้ด้วย seed เดิม', () => {
    const specs: PatternSpec[] = [
      { type: 'foil', seed: 9 }, { type: 'marble', seed: 9 }, { type: 'cat_eye', seed: 9 },
      { type: 'sprinkles', colors: ['#df4c81'], seed: 9 },
    ]
    for (const spec of specs) expect(renderPattern(spec)).toEqual(renderPattern(spec))
  })

  it('ลายเดิม seed เดิมได้ผลเดิมทุกครั้ง', () => {
    const a = renderPattern({ type: 'glitter', colors: ['#ffffff'], seed: 7 })
    const b = renderPattern({ type: 'glitter', colors: ['#ffffff'], seed: 7 })
    expect(a).toEqual(b)
    expect(renderPattern({ type: 'tortoise', seed: 7 })).toEqual(renderPattern({ type: 'tortoise', seed: 7 }))
    expect(renderPattern({ type: 'tortoise', seed: 7 })).not.toEqual(renderPattern({ type: 'tortoise', seed: 8 }))
  })

  it('ลายหลักค่าเริ่มต้นมีพื้นที่ว่างรอบรูป ไม่ถูกขอบเล็บตัด', () => {
    const specs: PatternSpec[] = [
      { type: 'star', color: '#c8a24a' },
      { type: 'butterfly', wing: '#a58cce', outline: '#5f426d' },
      { type: 'flower', petal: '#e4afc0', center: '#c69a48' },
    ]
    for (const spec of specs) {
      const b = paintedBounds(renderPattern(spec))
      expect(b.left, spec.type).toBeGreaterThan(0.2)
      expect(b.right, spec.type).toBeLessThan(0.8)
      expect(b.top, spec.type).toBeGreaterThan(0.1)
      expect(b.bottom, spec.type).toBeLessThan(0.9)
    }
  })

  it('สตรอว์เบอร์รีมีขนาดสมดุลกับส้มโดยใช้ตัวคูณขนาดเดียวกัน', () => {
    const orange = paintedBounds(renderPattern({ type: 'fruit', kind: 'orange' }))
    const berry = paintedBounds(renderPattern({ type: 'fruit', kind: 'strawberry' }))
    const ratio = (berry.right - berry.left) / (orange.right - orange.left)
    expect(ratio).toBeGreaterThan(0.85)
    expect(ratio).toBeLessThan(1.3)
  })

  it('ผลไม้และรายละเอียดปรับขนาดไปด้วยกันตลอดช่วงที่รองรับ', () => {
    for (const kind of ['orange', 'cherry', 'strawberry', 'lemon'] as const) {
      const small = paintedBounds(renderPattern({ type: 'fruit', kind, size: 0.6 }))
      const large = paintedBounds(renderPattern({ type: 'fruit', kind, size: 1.6 }))
      expect((large.right - large.left) / (small.right - small.left), kind).toBeCloseTo(1.6 / 0.6, 1)
      expect((large.bottom - large.top) / (small.bottom - small.top), kind).toBeCloseTo(1.6 / 0.6, 1)
    }
  })

  it('กลิตเตอร์หนาแน่นสองลายยังเก็บได้ภายในเพดานเลเยอร์', () => {
    const spec = { type: 'glitter', colors: ['#c5a04d'], haze: '#ead6a1', density: 1, size: 0.03, reach: 1 } as const
    const strokes = renderPattern({ ...spec, colors: [...spec.colors] })
    const doc = createEmptyDocument()
    doc.nails['right.index'].layers = packLayers([...strokes, ...strokes])
    expect(designDocumentSchema.safeParse(doc).success).toBe(true)
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

describe('luxury reference patterns', () => {
  it('bounds new patterns, reproduces seeds and accepts defaults', () => {
    const cases: [PatternSpec, number][] = [
      [{ type: 'gold_vein', veins: 4, branches: 1, flakes: 1, tipCluster: 1, width: 0.03 }, 820],
      [{ type: 'malachite', bands: 12, contrast: 1 }, 120],
      [{ type: 'glitter_line', density: 1, width: 0.04 }, 330],
      [{ type: 'bead_line', size: 0.004, spacing: 1.2, curl: 1 }, 240],
    ]
    for (const [spec, limit] of cases) {
      expect(patternSchema.parse({ type: spec.type }).type).toBe(spec.type)
      expect(renderPattern({ type: spec.type } as PatternSpec).length).toBeGreaterThan(0)
      for (const seed of [0, 1, 9, -19, 2147483647]) {
        const input = { ...spec, seed }
        const strokes = renderPattern(input)
        expect(strokes, spec.type).toEqual(renderPattern(input))
        expect(strokes.length, spec.type).toBeLessThanOrEqual(limit)
        const doc = createEmptyDocument()
        doc.nails['right.index'].layers = packLayers(strokes)
        expect(designDocumentSchema.safeParse(doc).success, spec.type).toBe(true)
        for (const stroke of strokes) if (stroke.kind === 'brush') for (const point of stroke.points) {
          expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true)
          expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(1)
          expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('creates real branch junctions and keeps edge foil visible on narrow nails', () => {
    for (const seed of [0, 1, 5, 47]) for (const angle of [-360, -90, -20, 90, 180, 360]) {
      const strokes = renderPattern({ type: 'gold_vein', branches: 0.5, veins: 1, flakes: 0, angle, seed })
      const starts = new Map<string, number>()
      for (let i = 1; i < strokes.length; i += 3) {
        const stroke = strokes[i]!
        if (stroke.kind !== 'brush') continue
        const root = JSON.stringify(stroke.points[0])
        starts.set(root, (starts.get(root) ?? 0) + 1)
      }
      expect([...starts.values()].some((count) => count >= 2)).toBe(true)
      for (const side of ['left', 'right'] as const) {
        const bounds = paintedBounds(renderPattern({ type: 'gold_vein', region: 'edge', veins: 1, width: 0.03, side, tipCluster: 1, seed }))
        expect(bounds.left).toBeGreaterThanOrEqual(0.2)
        expect(bounds.right).toBeLessThanOrEqual(0.8)
      }
    }
  })

  it('handles straight, repeated and short curled paths without invalid strokes', () => {
    for (const points of [[[0.2, 0.3], [0.7, 0.8]], [[0.5, 0.5], [0.5, 0.5]], [[0.99, 0.99], [1, 1]]] as [number, number][][]) {
      for (const type of ['glitter_line', 'bead_line'] as const) {
        const doc = createEmptyDocument()
        doc.nails['right.little'].layers = packLayers(renderPattern({ type, points, curl: 1 } as PatternSpec))
        expect(designDocumentSchema.safeParse(doc).success).toBe(true)
      }
    }
  })

  it('bounds every new input and rejects malformed curves', () => {
    for (const spec of [
      { type: 'gold_vein', veins: 5 }, { type: 'gold_vein', seed: Infinity },
      { type: 'gold_vein', width: 0 }, { type: 'gold_vein', branches: 1.1 },
      { type: 'malachite', colors: ['#ffffff'] }, { type: 'malachite', bands: 13 },
      { type: 'glitter_line', points: [[0.5], [0.6, 0.4]] }, { type: 'glitter_line', density: 0 },
      { type: 'bead_line', spacing: 0 }, { type: 'bead_line', curl: 2 },
      { type: 'aura', color: '#ffffff', aspect: 3 }, { type: 'aura', color: '#ffffff', rotation: Infinity },
      { type: 'cat_eye', core: -1 }, { type: 'cat_eye', shimmer: 1.1 },
    ]) expect(patternSchema.safeParse(spec).success).toBe(false)
  })

  it('packs maximum cat-eye shimmer plus glitter and fills negative almond smiles', () => {
    const { document } = buildFromRecipe({ nails: { little: { patterns: [
      { type: 'cat_eye', shimmer: 1, core: 1 }, { type: 'glitter', colors: ['#ffffff'], density: 1 },
      { type: 'french', style: 'almond', color: '#000000', smile: -0.12 },
    ] } } })
    expect(document.nails['right.little'].layers.length).toBeLessThanOrEqual(6)
    expect(designDocumentSchema.safeParse(document).success).toBe(true)
  })
})


describe('reference renderer repair regressions', () => {
  it('changes shimmer count without switching particle style across 0.25', () => {
    for (const style of [{}, { core: 0.8 }, { glow: '#ffe4ec' }]) {
      const variants = [0.24, 0.25, 0.26].map((shimmer) => renderPattern({ type: 'cat_eye', ...style, shimmer, seed: 17 }))
      const common = Math.min(...variants.map((strokes) => strokes.length))
      expect(variants[0]!.length).toBeLessThan(variants[1]!.length)
      expect(variants[1]!.length).toBeLessThan(variants[2]!.length)
      expect(variants[0]!.slice(0, common)).toEqual(variants[1]!.slice(0, common))
      expect(variants[1]!.slice(0, common)).toEqual(variants[2]!.slice(0, common))
    }
    const legacy = renderPattern({ type: 'cat_eye' })
    const glowing = renderPattern({ type: 'cat_eye', glow: '#ffe4ec', shimmer: 0.25 })
    expect(glowing.length).toBe(legacy.length)
    expect(glowing).not.toEqual(legacy)
  })

  it('keeps aura sampling, dab sizes and brightness continuous at aspect 1', () => {
    const spec = { type: 'aura', color: '#ec6f86', radius: 0.36, strength: 0.95 } as const
    const base = renderPattern(spec)
    for (const aspect of [0.99, 0.999, 1.001, 1.01]) {
      const strokes = renderPattern({ ...spec, aspect })
      expect(strokes).toHaveLength(base.length)
      for (let i = 0; i < base.length; i++) {
        const before = base[i]!, after = strokes[i]!
        if (before.kind !== 'brush' || after.kind !== 'brush') throw new Error('expected brush')
        expect(after.size).toBe(before.size)
        expect(after.opacity).toBe(before.opacity)
        expect(Math.abs(after.points[0]!.x - before.points[0]!.x)).toBeLessThanOrEqual(0.0021)
        expect(Math.abs(after.points[0]!.y - before.points[0]!.y)).toBeLessThanOrEqual(0.0021)
      }
    }
    expect(renderPattern({ ...spec, inner: '#f39a62' }).slice(0, base.length)).toEqual(base)
    expect(renderPattern({ ...spec, inner: '#f39a62' }).length).toBeGreaterThan(base.length)
  })

  it('renders extreme vein directions in both regions and tolerates an empty clipped network', () => {
    for (const region of ['full', 'edge'] as const) for (const angle of [-180, -90, 90, 180]) {
      const strokes = renderPattern({ type: 'gold_vein', region, angle, branches: 1, flakes: 1, tipCluster: 1 })
      const doc = createEmptyDocument()
      doc.nails['right.little'].layers = packLayers(strokes)
      expect(designDocumentSchema.safeParse(doc).success).toBe(true)
    }
    const clip = vi.spyOn(geometry, 'clipSegment').mockReturnValue([])
    try {
      for (const region of ['full', 'edge'] as const) expect(renderPattern({ type: 'gold_vein', region, branches: 1 })).toEqual([])
    } finally { clip.mockRestore() }
  })
})
