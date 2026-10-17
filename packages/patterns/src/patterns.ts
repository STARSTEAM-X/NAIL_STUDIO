import { z } from 'zod'
import { hexColorSchema, type Stroke } from '@nail-studio/contracts'
import {
  bezier, blobShape, circle, clamp, dot, ellipse, fill, gradient, heartShape, leafShape, line, rng,
  sparkleShape, tint, type Pt,
} from './geometry.ts'
import { referencePatternSchemas, referenceRenderers, renderGlitterPath } from './referencePatterns.ts'

/**
 * คลังลายแบบมีพารามิเตอร์ — AI เลือก "ชนิดลาย + ค่า" แล้วโค้ดตรงนี้เป็นคนแปลงเป็น stroke
 *
 * ค่าตั้งต้นเว้นพื้นที่รอบลายหลัก และช่วงค่าจำกัดต้นทุนการสร้าง stroke
 * พื้นที่มองเห็นราว u 0.2–0.8 / v 0.05–0.95; ผู้ใช้ยังวางรูปชิดขอบเพื่อให้ตัดขอบได้
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
    soft: z.boolean().default(false).describe('ไล่จางสำหรับ classic ที่ไม่มี border/outlineOnly'),
    style: z.enum(['classic', 'diagonal', 'chevron', 'reverse', 'almond', 'swoop']).default('classic'),
    side: z.enum(['left', 'right']).default('left'),
    outlineOnly: z.boolean().default(false).describe('วาดเฉพาะเส้นยิ้ม เหมาะกับ double French'),
    border: color.optional(),
    borderStyle: z.enum(['solid', 'glitter']).default('solid'),
    borderWidth: z.number().min(0.003).max(0.04).default(0.008),
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
    coverage: z.enum(['tip', 'full']).default('tip'),
  }).describe('กลิตเตอร์ไล่จากปลายเล็บ'),
  z.object({
    type: z.literal('dots'),
    color,
    size: z.number().min(0.008).max(0.1).default(0.035),
    spacing: z.number().min(0.08).max(0.25).default(0.13),
    from: v.default(0),
    to: v.default(1),
  }).describe('polka dot เต็มเล็บ'),
  z.object({
    type: z.literal('stripes'),
    color,
    count: z.number().int().min(1).max(9).default(5),
    width: z.number().min(0.01).max(0.08).default(0.018),
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
    size: z.number().min(0.02).max(0.2).default(0.13),
    petals: z.number().int().min(4).max(8).default(5),
    style: z.enum(['filled', 'outline']).default('filled'),
  }).describe('ดอกไม้'),
  z.object({
    type: z.literal('butterfly'),
    wing: color,
    outline: color,
    u: u.default(0.5), v: v.default(0.5),
    size: z.number().min(0.05).max(0.25).default(0.16),
    tilt: angle.default(-17),
  }).describe('ผีเสื้อ'),
  z.object({
    type: z.literal('star'),
    color,
    u: u.default(0.5), v: v.default(0.5),
    rx: z.number().min(0.01).max(0.5).default(0.13),
    ry: z.number().min(0.01).max(0.6).default(0.2),
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
    color: color.optional().describe('สีผลไม้ เช่น เชอร์รีเงิน'),
    stem: color.optional(),
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
  ...referencePatternSchemas,
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
    const at = (t: number): Pt => [root[0] + (tip[0] - root[0]) * t, root[1] + (tip[1] - root[1]) * t]
    const width = clamp(p.size * 0.035, 0.002, 0.008)
    strokes.push(line([at(0.08), at(0.94)], p.vein, width))
    for (const t of [0.3, 0.5, 0.7]) {
      const c = at(t)
      const end = at(t + 0.16)
      const spread = Math.sin(Math.PI * t) * 0.2
      const n: Pt = [-(tip[1] - root[1]) * spread, (tip[0] - root[0]) * spread]
      for (const sign of [-1, 1]) strokes.push(line(bezier([
        c, at(t + 0.1), [end[0] + sign * n[0], end[1] + sign * n[1]],
      ], 8), p.vein, width * 0.65, { opacity: 0.8 }))
    }
  }
  return strokes
}

function smallLeaf(cu: number, cv: number, ang: number, len: number, col: string): Stroke[] {
  return fill(leafShape([cu, cv], [cu + Math.cos(ang) * len, cv + Math.sin(ang) * len], len * 0.32), col, { brushWidth: 0.01 })
}

const RENDER: { [K in z.infer<typeof patternSchema>['type']]: (p: Parsed<K>) => Stroke[] } = {
  french: (p) => {
    if (p.soft && p.style === 'classic' && !p.outlineOnly && !p.border) {
      return [
        ...gradient(0, p.depth * 1.6, p.color, { strength: 1.6, steps: 20, solidUntil: 0.35 }),
        ...gradient(0, p.depth * 0.7, p.color, { strength: 1.2, steps: 8 }),
      ]
    }
    let edge: Pt[] = bezier([[0, p.depth], [0.5, p.depth + p.smile * 2], [1, p.depth]], 32)
    if (p.style === 'almond') edge = Array.from({ length: 65 }, (_, i): Pt => {
      const u = i / 64
      return [u, p.depth + p.smile * 3 * Math.sqrt(Math.max(0, 1 - ((u - 0.5) / 0.32) ** 2))]
    })
    if (p.style === 'swoop') edge = bezier([[0, p.depth * 0.1], [0.3, p.depth * 0.12], [0.6, p.depth * 1.8], [1, p.depth * 1.8]], 64)
    if (p.style === 'diagonal') edge = [[0, p.depth * 0.15], [1, p.depth * 1.8]]
    if (p.style === 'chevron') edge = [[0, p.depth * 0.15], [0.5, p.depth * 1.35], [1, p.depth * 0.15]]
    if (p.side === 'right') edge = edge.map(([x, y]): Pt => [1 - x, y]).reverse()
    if (p.style === 'reverse') edge = edge.map(([x, y]): Pt => [x, 1 - y])
    const end = p.style === 'reverse' ? 1 : 0
    const strokes: Stroke[] = p.outlineOnly
      ? [line(edge, p.color, p.borderWidth)]
      : fill([...edge, [1, end], [0, end]], p.color, { brushWidth: 0.016 })
    if (p.border) strokes.push(...(p.borderStyle === 'glitter' ? renderGlitterPath(edge, p.border, p.borderWidth, 0.9, false) : [line(edge, p.border, p.borderWidth)]))
    return strokes
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
      const vv = 0.02 + rand() * (p.coverage === 'full' ? 0.96 : p.reach)
      if (p.coverage === 'tip' && rand() > Math.pow(1 - vv / (p.reach + 0.02), 1.3)) continue
      const d = p.size * (0.25 + rand() ** 2 * 1.4)
      const uu = 0.15 + rand() * 0.7
      const col = p.colors[Math.floor(rand() * p.colors.length)]!
      // แต้มละเอียดสลับเกล็ดสั้น แทนเม็ดกลมขนาดใกล้กันทั้งหมด
      if (placed % 5 === 0) {
        const a = rand() * Math.PI
        strokes.push(line([[uu, vv], [uu + Math.cos(a) * d, vv + Math.sin(a) * d]], col, d * 0.45, { softness: 0.05 }))
      } else {
        strokes.push(dot(uu, vv, d, col, { softness: 0.12, opacity: 0.65 + rand() * 0.35 }))
      }
      if (placed % 60 === 0) {
        strokes.push(...fill(sparkleShape(uu, vv, p.size * 1.1, p.size * 1.7, 24), tint(col, '#ffffff', 0.65), { brushWidth: 0.002 }))
      }
      placed++
    }
    return strokes
  },
  dots: (p) => {
    const out: Stroke[] = []
    for (let row = 0, vv = 0.12; vv < 0.92; vv += p.spacing * 0.85, row++) {
      for (let uu = 0.2 + (row % 2) * (p.spacing / 2); uu < 0.82; uu += p.spacing) {
        if (vv >= p.from && vv <= p.to && ((uu - 0.5) / 0.34) ** 2 + ((vv - 0.5) / 0.46) ** 2 < 1) out.push(dot(uu, vv, p.size, p.color, { softness: 0.04 }))
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
  flower: (p) => {
    if (p.style === 'outline') {
      const petal = Array.from({ length: 121 }, (_, i): Pt => {
        const a = i / 120 * Math.PI * 2
        const period = Math.PI * 2 / p.petals
        const delta = ((a + Math.PI / 2 + period / 2) % period + period) % period - period / 2
        const r = p.size * (0.58 * Math.cos(delta) + Math.sqrt(Math.max(0, 0.44 ** 2 - (0.58 * Math.sin(delta)) ** 2)))
        return [p.u + Math.cos(a) * r, p.v + Math.sin(a) * r]
      })
      return [line(petal, p.petal, clamp(p.size * 0.085, 0.003, 0.012)), dot(p.u, p.v, p.size * 0.24, p.center)]
    }
    const out: Stroke[] = []
    const width = clamp(p.size * 0.055, 0.002, 0.01)
    for (let i = 0; i < p.petals; i++) {
      const a = (i / p.petals) * Math.PI * 2 - Math.PI / 2
      const at = (r: number): Pt => [p.u + Math.cos(a) * p.size * r, p.v + Math.sin(a) * p.size * r]
      out.push(...fill(ellipse(...at(0.52), p.size * 0.53, p.size * 0.3, a), p.petal, { brushWidth: width }))
      out.push(line(bezier([at(0.22), at(0.5), at(0.8)], 8), tint(p.petal, '#ffffff', 0.4), width * 0.75))
    }
    out.push(dot(p.u, p.v, p.size * 0.42, p.center))
    out.push(dot(p.u - p.size * 0.06, p.v - p.size * 0.06, p.size * 0.12, tint(p.center, '#ffffff', 0.6)))
    return out
  },
  butterfly: (p) => {
    const tilt = rad(p.tilt)
    const at = (du: number, dv: number): Pt => [
      p.u + (du * Math.cos(tilt) - dv * Math.sin(tilt)) * p.size,
      p.v + (du * Math.sin(tilt) + dv * Math.cos(tilt)) * p.size,
    ]
    const strokes: Stroke[] = []
    const width = p.size * 0.04
    for (const side of [-1, 1]) {
      const upper = [
        ...bezier([at(0, -0.12), at(side * 0.38, -0.85), at(side * 1.02, -1), at(side * 1.04, -0.58)], 14),
        ...bezier([at(side * 1.04, -0.58), at(side * 1.12, -0.2), at(side * 0.56, 0.16), at(0, 0.1)], 14).slice(1),
      ]
      const lower = [
        ...bezier([at(0, 0.02), at(side * 0.82, -0.02), at(side * 0.85, 0.48), at(side * 0.48, 0.65)], 12),
        ...bezier([at(side * 0.48, 0.65), at(side * 0.2, 0.8), at(side * 0.12, 0.45), at(0, 0.02)], 12).slice(1),
      ]
      for (const shape of [lower, upper]) {
        strokes.push(...fill(shape, p.wing, { brushWidth: width }))
        const root = at(0, 0)
        const inset = shape.map(([x, y]): Pt => [root[0] + (x - root[0]) * 0.73, root[1] + (y - root[1]) * 0.73])
        strokes.push(...fill(inset, tint(p.wing, '#ffffff', 0.35), { brushWidth: width }))
        strokes.push(line([...shape, shape[0]!], p.outline, width, { softness: 0.05 }))
      }
      strokes.push(line(bezier([at(0, 0), at(side * 0.35, -0.25), at(side * 0.8, -0.58)], 12), p.outline, width * 0.65))
      strokes.push(line([at(0, 0.08), at(side * 0.43, 0.44)], p.outline, width * 0.65))
      strokes.push(dot(...at(side * 0.8, -0.62), p.size * 0.07, tint(p.wing, '#ffffff', 0.8)))
    }
    strokes.push(line([at(0, -0.45), at(0, 0.55)], p.outline, p.size * 0.09))
    strokes.push(dot(...at(0, -0.5), p.size * 0.14, p.outline))
    for (const side of [-1, 1]) strokes.push(line(bezier([at(0, -0.5), at(side * 0.12, -0.85), at(side * 0.3, -0.9)], 8), p.outline, width * 0.65))
    return strokes
  },
  star: (p) => fill(sparkleShape(p.u, p.v, p.rx, p.ry), p.color, { brushWidth: clamp(Math.min(p.rx, p.ry) * 0.05, 0.003, 0.014) }),
  heart: (p) => fill(heartShape(p.u, p.v, p.size), p.color, { brushWidth: 0.012 }),
  circle: (p) => fill(circle(p.u, p.v, p.radius), p.color, { brushWidth: clamp(p.radius / 5, 0.008, 0.02) }),
  tortoise: (p) => {
    const rand = rng(p.seed)
    const out: Stroke[] = []
    // ปื้นอำพันโปร่งซ้อนกัน แล้วรวมจุดเข้มเป็นกลุ่ม แทนจุดดำกระจายแบบลายเสือ
    for (let i = 0; i < 8; i++) {
      out.push(dot(0.2 + rand() * 0.6, 0.06 + rand() * 0.88, 0.25 + rand() * 0.14, p.glow, { brush: 'airbrush', opacity: 0.65, softness: 0.95 }))
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const uu = 0.3 + col * 0.35 + (rand() - 0.5) * 0.16
        const vv = 0.17 + row * 0.31 + (rand() - 0.5) * 0.16
        const radius = 0.085 + rand() * 0.035
        out.push(dot(uu, vv, radius * 3.4, p.dark, { brush: 'airbrush', opacity: 0.48, softness: 0.95 }))
        out.push(...fill(blobShape(uu, vv, radius, rand, 24), p.dark, { brushWidth: 0.026, opacity: 0.18, softness: 0.95 }))
        for (let i = 0; i < 3; i++) {
          const a = rand() * Math.PI * 2
          const offset = radius * (0.25 + rand() * 0.35)
          out.push(dot(uu + Math.cos(a) * offset, vv + Math.sin(a) * offset, radius * (0.5 + rand() * 0.5), p.spot, { opacity: 0.6, softness: 0.7 }))
        }
      }
    }
    return out
  },
  fruit: (p) => {
    const s = p.size
    const at = (du: number, dv: number): Pt => [p.u + du * s, p.v + dv * s]
    const GREEN = '#4f9a4a'
    switch (p.kind) {
      case 'orange': return [
        ...fill(circle(...at(0, 0.02), 0.13 * s), p.color ?? '#ed882b', { brushWidth: 0.014 * s }),
        dot(...at(-0.035, -0.025), 0.12 * s, p.color ? tint(p.color, '#ffffff', 0.5) : '#ffc570', { opacity: 0.65, softness: 0.95 }),
        line(bezier([at(0, -0.11), at(0, -0.17), at(0.035, -0.2)]), p.stem ?? '#527344', 0.008 * s),
        ...smallLeaf(...at(0.01, -0.16), -0.35, 0.1 * s, GREEN),
        line(bezier([at(0.02, -0.16), at(0.055, -0.18), at(0.085, -0.185)], 8), '#9fb965', 0.004 * s),
      ]
      case 'cherry': return [
        line(bezier([at(-0.1, 0.05), at(-0.05, -0.15), at(0.06, -0.25)]), p.stem ?? '#527344', 0.008 * s),
        line(bezier([at(0.12, 0.07), at(0.1, -0.13), at(0.06, -0.25)]), p.stem ?? '#527344', 0.008 * s),
        ...fill(circle(...at(-0.1, 0.1), 0.075 * s), p.color ?? '#b72e48', { brushWidth: 0.012 * s }),
        ...fill(circle(...at(0.12, 0.12), 0.075 * s), p.color ?? '#c8374e', { brushWidth: 0.012 * s }),
        dot(...at(-0.12, 0.08), 0.07 * s, p.color ? tint(p.color, '#ffffff', 0.65) : '#f57e88', { opacity: 0.7, softness: 0.95 }),
        dot(...at(0.1, 0.1), 0.07 * s, p.color ? tint(p.color, '#ffffff', 0.65) : '#f57e88', { opacity: 0.7, softness: 0.95 }),
        dot(...at(-0.125, 0.07), 0.015 * s, '#fff3df'), dot(...at(0.095, 0.09), 0.015 * s, '#fff3df'),
        ...smallLeaf(...at(0.06, -0.25), -0.3, 0.09 * s, GREEN),
      ]
      case 'strawberry': {
        const body = [
          ...bezier([at(0, -0.09), at(-0.15, -0.16), at(-0.18, -0.02), at(-0.1, 0.1)], 14),
          ...bezier([at(-0.1, 0.1), at(-0.03, 0.21), at(0, 0.23), at(0.1, 0.1)], 14).slice(1),
          ...bezier([at(0.1, 0.1), at(0.18, -0.02), at(0.15, -0.16), at(0, -0.09)], 14).slice(1),
        ]
        return [
          ...fill(body, p.color ?? '#d94a58', { brushWidth: 0.01 * s }),
          dot(...at(-0.045, -0.025), 0.15 * s, p.color ? tint(p.color, '#ffffff', 0.5) : '#f88487', { opacity: 0.65, softness: 0.95 }),
          ...([[-0.08, -0.035], [0, -0.03], [0.08, -0.035], [-0.055, 0.035], [0.04, 0.04], [-0.02, 0.1], [0.035, 0.105]] as const)
            .map(([du, dv]) => line([at(du, dv), at(du - 0.003, dv + 0.012)], '#ffe1a0', 0.007 * s)),
          ...[-2.8, -2.05, -1.2, -0.35].flatMap((a) => smallLeaf(...at(0, -0.09), a, 0.075 * s, GREEN)),
        ]
      }
      case 'lemon': return [
        ...fill(ellipse(...at(0, 0), 0.15 * s, 0.09 * s, -0.35), p.color ?? '#eccb45', { brushWidth: 0.012 * s }),
        dot(...at(-0.03, -0.025), 0.12 * s, p.color ? tint(p.color, '#ffffff', 0.6) : '#fff0a0', { opacity: 0.65, softness: 0.95 }),
        line(bezier([at(-0.075, -0.015), at(-0.01, -0.06), at(0.06, -0.06)], 12), '#fff5bf', 0.006 * s),
        ...smallLeaf(...at(0.12, -0.09), -1.0, 0.07 * s, GREEN),
      ]
    }
  },
  vine: (p) => {
    const f = (pt: Pt): Pt => (p.flip ? [1 - pt[0], pt[1]] : pt)
    const stem = bezier([[0.3, 0.84], [0.4, 0.63], [0.6, 0.5], [0.64, 0.24]], 40)
    const out: Stroke[] = [line(stem.map(f), p.stem, 0.01)]
    // จุดโคนใบมาจากเส้นก้านเดียวกับที่วาด จึงไม่ลอยแม้ flip หรือใส่ accent
    for (const [index, a, len, accent] of [
      [6, -2.5, 0.14, false], [12, -0.25, 0.15, false], [19, -2.6, 0.14, false],
      [26, -0.3, 0.13, false], [33, -2.5, 0.11, false],
      [9, -0.35, 0.1, true], [23, -2.5, 0.1, true],
    ] as const) {
      const col = accent ? p.accent : p.leaf
      if (!col) continue
      const root = stem[index]!
      const tip: Pt = [root[0] + Math.cos(a) * len, root[1] + Math.sin(a) * len]
      out.push(...fill(leafShape(root, tip, len * 0.23).map(f), col, { brushWidth: 0.006 }))
      const mid: Pt = [root[0] + (tip[0] - root[0]) * 0.8, root[1] + (tip[1] - root[1]) * 0.8]
      out.push(line([f(root), f(mid)], tint(col, '#ffffff', 0.3), 0.0025))
    }
    return out
  },
  curve: (p) => [line(p.points.length === 2 ? p.points : bezier(p.points, 28), p.color, p.width)],
  ...referenceRenderers,
}

/** แปลงลายหนึ่งชิ้นเป็น stroke — ค่าที่ขาดจะเติมค่าตั้งต้น ค่าที่ผิดจะ throw พร้อมเหตุผล */
export function renderPattern(spec: PatternSpec): Stroke[] {
  const parsed = patternSchema.parse(spec)
  return (RENDER[parsed.type] as (p: typeof parsed) => Stroke[])(parsed)
}

/**
 * ลายที่ใช้ stroke มาก (≥ 150 เมื่อใช้ค่าเริ่มต้น) — lint เตือนเมื่อเล็บเดียวใช้เกิน 2 ลาย
 * เพราะกินเพดาน 6 เลเยอร์ × 500 stroke เร็ว; patterns.test.ts วัดจำนวนจริงเทียบกับชุดนี้
 */
export const DENSE_PATTERN_TYPES: ReadonlySet<string> = new Set([
  'ghost', 'bead_line', 'flower', 'skull', 'constellation', 'cat_eye', 'glitter_line', 'butterfly',
  'checkerboard', 'bunny', 'flame', 'gold_vein', 'foil', 'glitter', 'floral_spray',
])

export const PATTERN_TYPES = patternSchema.options.map((option) => ({
  type: option.shape.type.value,
  description: option.description ?? '',
  dense: DENSE_PATTERN_TYPES.has(option.shape.type.value),
}))
