import { z } from 'zod'
import { hexColorSchema, type Stroke } from '@nail-studio/contracts'
import {
  bezier, blobShape, circle, clamp, dot, ellipse, fill, gradient, heartShape, leafShape, line, rng,
  sparkleShape, type Pt,
} from './geometry.ts'

/**
 * คลังลายแบบมีพารามิเตอร์ — AI เลือก "ชนิดลาย + ค่า" แล้วโค้ดตรงนี้เป็นคนแปลงเป็น stroke
 *
 * ทุก schema ใส่ค่าตั้งต้นและช่วงค่าที่ปลอดภัยไว้แล้ว (กฎจากการทดสอบบนโมเดลจริง เช่น
 * วางลายในพื้นที่ที่มองเห็น u 0.2–0.8 / v 0.05–0.95, เส้นกว้างพอให้เห็นบนจอ 3 มิติ)
 * จึงไม่มีค่าไหนที่ทำให้ได้เอกสารผิด schema หรือได้ลายที่มองไม่เห็นเลย
 */

const u = z.number().min(0).max(1)
const v = z.number().min(0).max(1)
const color = hexColorSchema
const angle = z.number().min(-360).max(360).describe('องศา — 0 = ชี้ไปทาง +u, 90 = ชี้ไปทางโคนเล็บ')

export const patternSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('french'),
    color,
    depth: z.number().min(0.08).max(0.5).default(0.25).describe('ความลึกจากปลายเล็บ (v)'),
    smile: z.number().min(-0.12).max(0.15).default(0.04).describe('ความโค้งของเส้นยิ้ม'),
    soft: z.boolean().default(false).describe('true = ไล่จางลงสู่พื้นแทนขอบคม'),
  }).describe('French tip'),
  z.object({
    type: z.literal('gradient'),
    color,
    from: z.enum(['tip', 'cuticle']).default('tip'),
    reach: z.number().min(0.1).max(1).default(0.5).describe('ไล่ไปไกลแค่ไหน (สัดส่วนความยาวเล็บ)'),
    strength: z.number().min(0.1).max(2).default(1),
  }).describe('ไล่สีนุ่ม (ombre)'),
  z.object({
    type: z.literal('glitter'),
    colors: z.array(color).min(1).max(6),
    haze: color.optional().describe('สีฟุ้งรองใต้กลิตเตอร์'),
    density: z.number().min(0.1).max(1).default(0.7),
    reach: z.number().min(0.15).max(1).default(0.55).describe('กลิตเตอร์หนาแน่นที่ปลายแล้วบางลงถึงระยะนี้'),
    size: z.number().min(0.006).max(0.03).default(0.016),
    seed: z.number().int().default(1),
  }).describe('กลิตเตอร์ไล่จากปลายเล็บ'),
  z.object({
    type: z.literal('dots'),
    color,
    size: z.number().min(0.02).max(0.1).default(0.05),
    spacing: z.number().min(0.08).max(0.25).default(0.13),
  }).describe('polka dot เต็มเล็บ'),
  z.object({
    type: z.literal('stripes'),
    color,
    count: z.number().int().min(1).max(9).default(5),
    width: z.number().min(0.01).max(0.08).default(0.026),
    direction: z.enum(['vertical', 'horizontal', 'diagonal']).default('vertical'),
    from: v.default(0).describe('ขอบเขต v เริ่ม'),
    to: v.default(1).describe('ขอบเขต v จบ'),
  }).describe('ลายเส้นขนาน'),
  z.object({
    type: z.literal('swirl_tip'),
    color,
    accent: color.optional(),
    side: z.enum(['left', 'right']).default('left'),
    depth: z.number().min(0.3).max(0.8).default(0.62),
  }).describe('โค้งสีคลุมปลายเล็บ กวาดลงมาข้างหนึ่ง'),
  z.object({
    type: z.literal('leaf'),
    color,
    vein: color.optional(),
    u: u.default(0.5), v: v.default(0.5),
    size: z.number().min(0.05).max(0.35).default(0.2),
    angle: angle.default(-70),
  }).describe('ใบไม้ (มีเส้นใบ)'),
  z.object({
    type: z.literal('flower'),
    petal: color,
    center: color,
    u: u.default(0.5), v: v.default(0.5),
    size: z.number().min(0.02).max(0.2).default(0.08),
    petals: z.number().int().min(4).max(8).default(5),
  }).describe('ดอกไม้'),
  z.object({
    type: z.literal('butterfly'),
    wing: color,
    outline: color,
    u: u.default(0.5), v: v.default(0.18),
    size: z.number().min(0.05).max(0.25).default(0.11),
    tilt: angle.default(-17),
  }).describe('ผีเสื้อ'),
  z.object({
    type: z.literal('star'),
    color,
    u: u.default(0.5), v: v.default(0.5),
    rx: z.number().min(0.05).max(0.5).default(0.42),
    ry: z.number().min(0.05).max(0.6).default(0.55),
  }).describe('ดาวสี่แฉกขอบเว้า (sparkle)'),
  z.object({
    type: z.literal('heart'),
    color,
    u: u.default(0.5), v: v.default(0.5),
    size: z.number().min(0.03).max(0.3).default(0.12),
  }).describe('หัวใจ'),
  z.object({
    type: z.literal('circle'),
    color,
    u: u.default(0.5), v: v.default(0.5),
    radius: z.number().min(0.01).max(0.4).default(0.1),
  }).describe('วงกลมทึบ'),
  z.object({
    type: z.literal('tortoise'),
    glow: color.default('#e48a22'),
    dark: color.default('#5a2206'),
    spot: color.default('#241006'),
    seed: z.number().int().default(1),
  }).describe('ลายกระดองเต่า (ใช้กับสีพื้นอำพัน)'),
  z.object({
    type: z.literal('fruit'),
    kind: z.enum(['orange', 'cherry', 'strawberry', 'lemon']),
    u: u.default(0.5), v: v.default(0.5),
    size: z.number().min(0.6).max(1.6).default(1).describe('ตัวคูณขนาด'),
  }).describe('ผลไม้'),
  z.object({
    type: z.literal('vine'),
    stem: color,
    leaf: color,
    accent: color.optional().describe('ใบสีเน้น เช่น ทอง'),
    flip: z.boolean().default(false),
  }).describe('เถาใบไม้พาดกลางเล็บ'),
  z.object({
    type: z.literal('curve'),
    color,
    // Homogeneous array input avoids tuple-style JSON Schema `items: [...]`,
    // which some MCP clients cannot turn into a callable tool. Keep the tuple
    // output for the geometry code and validate exactly two coordinates.
    points: z.array(z.array(u).length(2).pipe(z.tuple([u, v]))).min(2).max(4).describe('จุดควบคุม bezier 2–4 จุด แต่ละจุดเป็น [u, v]'),
    width: z.number().min(0.005).max(0.3).default(0.03),
  }).describe('เส้นโค้งอิสระ (แถบหนาได้ถ้า width ใหญ่)'),
])

export type PatternSpec = z.input<typeof patternSchema>
type Parsed<T extends z.infer<typeof patternSchema>['type']> = Extract<z.infer<typeof patternSchema>, { type: T }>

const rad = (deg: number): number => (deg * Math.PI) / 180

function leafStrokes(p: { color: string; vein?: string | undefined; u: number; v: number; size: number; angle: number }): Stroke[] {
  const a = rad(p.angle)
  const tip: Pt = [p.u + Math.cos(a) * p.size, p.v + Math.sin(a) * p.size]
  const root: Pt = [p.u - Math.cos(a) * p.size, p.v - Math.sin(a) * p.size]
  const strokes: Stroke[] = [...fill(leafShape(root, tip, p.size * 0.55), p.color, { brushWidth: 0.016 })]
  if (p.vein) {
    strokes.push(line([root, tip], p.vein, 0.012))
    for (const t of [0.3, 0.5, 0.7]) {
      const c: Pt = [root[0] + (tip[0] - root[0]) * t, root[1] + (tip[1] - root[1]) * t]
      const n: Pt = [-(tip[1] - root[1]) * 0.18, (tip[0] - root[0]) * 0.18]
      strokes.push(line([c, [c[0] + n[0], c[1] + n[1]]], p.vein, 0.008))
      strokes.push(line([c, [c[0] - n[0], c[1] - n[1]]], p.vein, 0.008))
    }
  }
  return strokes
}

function smallLeaf(cu: number, cv: number, ang: number, len: number, col: string): Stroke[] {
  return fill(leafShape([cu, cv], [cu + Math.cos(ang) * len, cv + Math.sin(ang) * len], len * 0.32), col, { brushWidth: 0.01 })
}

const RENDER: { [K in z.infer<typeof patternSchema>['type']]: (p: Parsed<K>) => Stroke[] } = {
  french: (p) => {
    if (p.soft) {
      return [
        ...gradient(0, p.depth * 1.6, p.color, { strength: 1.6, steps: 20, solidUntil: 0.35 }),
        ...gradient(0, p.depth * 0.7, p.color, { strength: 1.2, steps: 8 }),
      ]
    }
    const edge = bezier([[0, p.depth], [0.5, p.depth + p.smile * 2], [1, p.depth]], 20)
    return fill([...edge, [1, 0], [0, 0]], p.color, { brushWidth: 0.025 })
  },
  gradient: (p) => (p.from === 'tip'
    ? gradient(0, p.reach, p.color, { strength: p.strength, steps: 18, solidUntil: 0.1 })
    : gradient(1, 1 - p.reach, p.color, { strength: p.strength, steps: 18, solidUntil: 0.1 })),
  glitter: (p) => {
    const rand = rng(p.seed)
    const strokes: Stroke[] = []
    if (p.haze) {
      strokes.push(...gradient(0, p.reach * 0.9, p.haze, { strength: 1.1, steps: 18, solidUntil: 0.12 }))
    }
    const target = Math.round(120 + p.density * 360)
    let guard = 0
    let placed = 0
    while (placed < target && guard++ < target * 20) {
      const vv = 0.02 + rand() * p.reach
      if (rand() > Math.pow(1 - vv / (p.reach + 0.02), 1.3)) continue
      const d = p.size * (0.6 + rand() * 1.0)
      strokes.push(dot(0.15 + rand() * 0.7, vv, d, p.colors[Math.floor(rand() * p.colors.length)]!, { softness: 0.2, opacity: 0.75 + rand() * 0.25 }))
      placed++
    }
    return strokes
  },
  dots: (p) => {
    const out: Stroke[] = []
    for (let row = 0, vv = 0.12; vv < 0.92; vv += p.spacing * 0.85, row++) {
      for (let uu = 0.2 + (row % 2) * (p.spacing / 2); uu < 0.82; uu += p.spacing) {
        if (((uu - 0.5) / 0.34) ** 2 + ((vv - 0.5) / 0.46) ** 2 < 1) out.push(dot(uu, vv, p.size, p.color, { softness: 0.04 }))
      }
    }
    return out
  },
  stripes: (p) => Array.from({ length: p.count }, (_, i) => {
    const t = p.count === 1 ? 0.5 : i / (p.count - 1)
    if (p.direction === 'vertical') {
      const uu = 0.22 + t * 0.56
      return line([[uu, p.from + 0.02], [uu + 0.02, p.to]], p.color, p.width)
    }
    if (p.direction === 'horizontal') {
      const vv = p.from + 0.05 + t * (p.to - p.from - 0.1)
      return line([[0.05, vv], [0.95, vv]], p.color, p.width)
    }
    const off = -0.5 + t
    return line([[0.0 + off, p.to], [1.0 + off, p.from]], p.color, p.width)
  }),
  swirl_tip: (p) => {
    const m = (pt: Pt): Pt => (p.side === 'right' ? [1 - pt[0], pt[1]] : pt)
    const inner = bezier(([[0.95, 0.12], [0.6, 0.2], [0.3, 0.28], [0.12, p.depth]] as Pt[]).map(m), 28)
    const crescent: Pt[] = [...inner, ...([[0, p.depth], [0, 0], [1, 0], [1, 0.12]] as Pt[]).map(m)]
    const strokes: Stroke[] = [...fill(crescent, p.color, { brushWidth: 0.02 })]
    if (p.accent) strokes.push(line(bezier(([[0.9, 0.2], [0.6, 0.3], [0.36, 0.36], [0.2, p.depth + 0.04]] as Pt[]).map(m), 28), p.accent, 0.016))
    return strokes
  },
  leaf: (p) => leafStrokes(p),
  flower: (p) => [
    ...Array.from({ length: p.petals }, (_, i) => {
      const a = (i / p.petals) * Math.PI * 2
      return fill(circle(p.u + Math.cos(a) * p.size * 0.55, p.v + Math.sin(a) * p.size * 0.55, p.size * 0.45), p.petal, { brushWidth: 0.008 })
    }).flat(),
    dot(p.u, p.v, p.size * 0.5, p.center),
  ],
  butterfly: (p) => {
    const tilt = rad(p.tilt)
    const at = (du: number, dv: number): Pt => [
      p.u + (du * Math.cos(tilt) - dv * Math.sin(tilt)) * p.size,
      p.v + (du * Math.sin(tilt) + dv * Math.cos(tilt)) * p.size,
    ]
    const strokes: Stroke[] = []
    const wings: [number, number, number, number, number][] = [
      [-0.55, -0.35, 0.55, 0.42, -0.5], [0.55, -0.35, 0.55, 0.42, 0.5],
      [-0.42, 0.38, 0.38, 0.3, 0.6], [0.42, 0.38, 0.38, 0.3, -0.6],
    ]
    for (const [du, dv, ru, rv, rot] of wings) {
      const [eu, ev] = at(du, dv)
      const shape = ellipse(eu, ev, ru * p.size, rv * p.size, rot + tilt)
      strokes.push(...fill(shape, p.wing, { brushWidth: 0.008 }))
      strokes.push(line([...shape, shape[0]!], p.outline, 0.009, { softness: 0.05 }))
      strokes.push(line([at(0, dv * 0.3), at(du * 0.75, dv)], p.outline, 0.005))
    }
    strokes.push(line([at(0, -0.6), at(0, 0.65)], p.outline, 0.02))
    strokes.push(line(bezier([at(0, -0.6), at(-0.15, -0.95), at(-0.35, -1.05)], 8), p.outline, 0.005))
    strokes.push(line(bezier([at(0, -0.6), at(0.15, -0.95), at(0.35, -1.05)], 8), p.outline, 0.005))
    return strokes
  },
  star: (p) => fill(sparkleShape(p.u, p.v, p.rx, p.ry), p.color, { brushWidth: 0.014 }),
  heart: (p) => fill(heartShape(p.u, p.v, p.size), p.color, { brushWidth: 0.012 }),
  circle: (p) => fill(circle(p.u, p.v, p.radius), p.color, { brushWidth: clamp(p.radius / 5, 0.008, 0.02) }),
  tortoise: (p) => {
    const rand = rng(p.seed)
    const at = (): Pt => [0.22 + rand() * 0.56, 0.08 + rand() * 0.84]
    const out: Stroke[] = []
    for (let i = 0; i < 6; i++) { const [uu, vv] = at(); out.push(dot(uu, vv, 0.3, p.glow, { brush: 'airbrush', opacity: 0.55, softness: 0.95 })) }
    for (let i = 0; i < 7; i++) { const [uu, vv] = at(); out.push(...fill(blobShape(uu, vv, 0.06 + rand() * 0.05, rand), p.dark, { brushWidth: 0.03, opacity: 0.55, softness: 0.8 })) }
    for (let i = 0; i < 12; i++) { const [uu, vv] = at(); out.push(...fill(blobShape(uu, vv, 0.022 + rand() * 0.03, rand), p.spot, { brushWidth: 0.012, softness: 0.35 })) }
    for (let i = 0; i < 10; i++) { const [uu, vv] = at(); out.push(dot(uu, vv, 0.012 + rand() * 0.012, p.spot, { softness: 0.3 })) }
    return out
  },
  fruit: (p) => {
    const s = p.size
    const at = (du: number, dv: number): Pt => [p.u + du * s, p.v + dv * s]
    const GREEN = '#4f9a4a'
    switch (p.kind) {
      case 'orange': return [
        ...fill(circle(...at(0, 0), 0.13 * s), '#f2862a', { brushWidth: 0.02 }),
        dot(...at(-0.05, -0.05), 0.05 * s, '#f8b25c', { brush: 'airbrush', opacity: 0.7, softness: 0.9 }),
        line(bezier([at(0, -0.13), at(0.05, -0.23), at(0.11, -0.28)]), GREEN, 0.012),
        ...smallLeaf(...at(0.1, -0.26), -0.6, 0.08 * s, GREEN), ...smallLeaf(...at(0.05, -0.22), -2.4, 0.07 * s, GREEN),
      ]
      case 'cherry': return [
        line(bezier([at(-0.1, 0.05), at(-0.05, -0.15), at(0.06, -0.25)]), '#3e6b2c', 0.012),
        line(bezier([at(0.12, 0.07), at(0.1, -0.13), at(0.06, -0.25)]), '#3e6b2c', 0.012),
        ...fill(circle(...at(-0.1, 0.1), 0.075 * s), '#e3313b', { brushWidth: 0.016 }),
        ...fill(circle(...at(0.12, 0.12), 0.075 * s), '#e3313b', { brushWidth: 0.016 }),
        dot(...at(-0.12, 0.07), 0.025 * s, '#ffffff', { opacity: 0.8 }), dot(...at(0.1, 0.09), 0.025 * s, '#ffffff', { opacity: 0.8 }),
        ...smallLeaf(...at(0.06, -0.25), -0.3, 0.09 * s, GREEN),
      ]
      case 'strawberry': return [
        ...fill([...bezier([at(-0.08, -0.03), at(0, 0.16), at(0.08, -0.03)], 16), ...bezier([at(0.08, -0.03), at(0, -0.1), at(-0.08, -0.03)], 10).slice(1)], '#e3313b', { brushWidth: 0.014 }),
        ...([[-0.03, 0.01], [0.03, 0.01], [0, 0.05], [-0.02, 0.08], [0.02, 0.08]] as const).map(([du, dv]) => dot(...at(du, dv), 0.01, '#fbe7a6')),
        ...smallLeaf(...at(0, -0.04), -2.0, 0.05 * s, GREEN), ...smallLeaf(...at(0, -0.04), -1.1, 0.05 * s, GREEN),
      ]
      case 'lemon': return [
        ...fill(ellipse(...at(0, 0), 0.15 * s, 0.09 * s, -0.35), '#f6d84b', { brushWidth: 0.016 }),
        line([at(-0.07, -0.02), at(0.1, -0.07)], '#fff3a8', 0.012),
        ...smallLeaf(...at(0.12, -0.09), -1.0, 0.07 * s, GREEN),
      ]
    }
  },
  vine: (p) => {
    const f = (pt: Pt): Pt => (p.flip ? [1 - pt[0], pt[1]] : pt)
    const stem = bezier(([[0.3, 0.82], [0.36, 0.6], [0.6, 0.52], [0.66, 0.3]] as Pt[]).map(f))
    const leaves = ([[0.32, 0.7, -2.4], [0.45, 0.58, 0.6], [0.58, 0.52, -2.2], [0.67, 0.38, 0.9]] as const).flatMap(([uu, vv, a]) => {
      const [cu, cv] = f([uu, vv])
      return smallLeaf(cu, cv, p.flip ? Math.PI - a : a, 0.13, p.leaf).map((s) => s)
    })
    const accent = p.accent
      ? ([[0.5, 0.72, -0.6], [0.4, 0.45, 2.6]] as const).flatMap(([uu, vv, a]) => {
        const [cu, cv] = f([uu, vv])
        return smallLeaf(cu, cv, p.flip ? Math.PI - a : a, 0.11, p.accent!)
      })
      : []
    return [line(stem, p.stem, 0.018), ...leaves, ...accent]
  },
  curve: (p) => [line(p.points.length === 2 ? p.points : bezier(p.points, 28), p.color, p.width)],
}

/** แปลงลายหนึ่งชิ้นเป็น stroke — ค่าที่ขาดจะเติมค่าตั้งต้น ค่าที่ผิดจะ throw พร้อมเหตุผล */
export function renderPattern(spec: PatternSpec): Stroke[] {
  const parsed = patternSchema.parse(spec)
  return (RENDER[parsed.type] as (p: typeof parsed) => Stroke[])(parsed)
}

export const PATTERN_TYPES = patternSchema.options.map((option) => ({
  type: option.shape.type.value,
  description: option.description ?? '',
}))
