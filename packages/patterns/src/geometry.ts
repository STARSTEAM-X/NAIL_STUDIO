import { MAX_POINTS_PER_STROKE, type Stroke } from '@nail-studio/contracts'

/**
 * รูปทรงพื้นฐานสำหรับวาดลายด้วยข้อมูลล้วน — ทุกฟังก์ชันรับพิกัดเป็น UV ของผิวเล็บ
 *
 * ระบบพิกัด (ตรงกับ hand.glb หลังแก้ทิศเล็บ, schema v3):
 *   u = 0..1 แนวขวางเล็บ, v = 0 ปลายเล็บ (free edge) → v = 1 โคนเล็บ (cuticle)
 *   พื้นที่ที่มองเห็นจริงราว u 0.2–0.8, v 0.05–0.95 — ส่วนที่เลยออกไปถูกขอบเล็บตัดทิ้งเอง
 *
 * ความกว้างเส้นรับเป็นหน่วย UV แล้วแปลงเป็นพิกเซลบน texture 1024 ตามที่ schema ต้องการ
 */

export type Pt = readonly [number, number]
type BrushStroke = Extract<Stroke, { kind: 'brush' }>
export type BrushId = BrushStroke['brush']

export const TEX = 1024
const MAX_SIZE_PX = 400

const r3 = (n: number): number => Math.round(n * 1000) / 1000
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const px = (sizeUv: number): number => Math.min(MAX_SIZE_PX, Math.max(1, Math.round(sizeUv * TEX)))

/** ผสมรหัสสี #rrggbb ที่ผ่าน schema แล้ว สำหรับรายละเอียดแสง/เงา */
export function tint(hex: string, target: string, amount: number): string {
  return `#${[1, 3, 5].map((offset) => {
    const a = Number.parseInt(hex.slice(offset, offset + 2), 16)
    const b = Number.parseInt(target.slice(offset, offset + 2), 16)
    return Math.round(a + (b - a) * amount).toString(16).padStart(2, '0')
  }).join('')}`
}

/** ตัดเส้นตรงกับกรอบ UV ก่อนวาด เพื่อรักษาความชันเมื่อปลายเส้นอยู่นอก texture: O(1) */
export function clipSegment(a: Pt, b: Pt): Pt[] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let from = 0
  let to = 1
  for (const [p, q] of [[-dx, a[0]], [dx, 1 - a[0]], [-dy, a[1]], [dy, 1 - a[1]]] as const) {
    if (p === 0) { if (q < 0) return []; continue }
    const t = q / p
    if (p < 0) from = Math.max(from, t)
    else to = Math.min(to, t)
    if (from > to) return []
  }
  return [[a[0] + dx * from, a[1] + dy * from], [a[0] + dx * to, a[1] + dy * to]]
}

/** สุ่มแบบกำหนด seed — ลายเดิมต้องได้ผลเดิมทุกครั้ง (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface LineOptions {
  brush?: BrushId
  opacity?: number
  softness?: number
  pressure?: number
}

/** เส้นผ่านจุดที่กำหนด — width เป็นหน่วย UV */
export function line(points: readonly Pt[], color: string, width: number, opts: LineOptions = {}): BrushStroke {
  const { brush = 'round', opacity = 1, softness = 0.08, pressure = 1 } = opts
  return {
    kind: 'brush',
    brush,
    color,
    size: px(width),
    opacity: clamp01(opacity),
    softness: clamp01(softness),
    points: points.map(([u, v]) => ({ x: r3(clamp01(u)), y: r3(clamp01(v)), p: pressure })),
  }
}

/** แต้มกลมหนึ่งเม็ด */
export function dot(u: number, v: number, diameter: number, color: string, opts: LineOptions = {}): BrushStroke {
  return line([[u, v]], color, diameter, opts)
}

/** จุดตามเส้นโค้ง bezier — 3 จุดควบคุม (กำลังสอง) หรือ 4 จุด (กำลังสาม) */
export function bezier(ctrl: readonly Pt[], steps = 24): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (ctrl.length === 3) {
      const [a, b, c] = ctrl as [Pt, Pt, Pt]
      out.push([0, 1].map((k) => (1 - t) ** 2 * a[k]! + 2 * (1 - t) * t * b[k]! + t * t * c[k]!) as unknown as Pt)
    } else {
      const [a, b, c, d] = ctrl as [Pt, Pt, Pt, Pt]
      out.push([0, 1].map((k) => (1 - t) ** 3 * a[k]! + 3 * (1 - t) ** 2 * t * b[k]! + 3 * (1 - t) * t * t * c[k]! + t ** 3 * d[k]!) as unknown as Pt)
    }
  }
  return out
}

export interface FillOptions {
  brushWidth?: number
  opacity?: number
  softness?: number
}

/**
 * เติมสีในรูปหลายเหลี่ยมด้วยเส้นแนวนอนเรียงกัน (scanline)
 * ปลายแถวหดเข้าครึ่งความกว้างแปรง เพื่อให้ขอบซ้าย-ขวาตรงกับรูปทรงที่สั่ง
 *
 * แถวมีขอบบน-ล่างตรง ขอบรูปที่เกือบแนวนอน (เช่นเส้นยิ้มของ french) จึงกลายเป็นขั้นบันได
 * ห่างกันทีละ step — ปิดท้ายด้วยเส้นขอบตามรูปจริงที่กว้างเท่าแปรง ซึ่งครอบทั้งมุมที่ยื่น
 * และร่องที่เว้า (ไม่เกินครึ่งแปรงทั้งคู่) ขอบที่มองเห็นจึงเรียบ แลกกับรูปขยายออกราวครึ่งแปรง
 * ไม่ใส่เส้นขอบเมื่อทึบไม่เต็ม เพราะสีจะสะสมเป็นวงเข้มกว่าเนื้อใน
 */
export function fill(poly: readonly Pt[], color: string, opts: FillOptions = {}): BrushStroke[] {
  return fillPolygons([poly], color, { ...opts, rule: 'evenodd' })
}

/** Active edge list: O(E log E + R · k log k) ไม่ตรวจขอบที่ไม่ตัดแถวซ้ำ */
export function fillPolygons(polys: readonly (readonly Pt[])[], color: string, opts: FillOptions & { rule?: 'nonzero' | 'evenodd'; maxStrokes?: number } = {}): BrushStroke[] {
  const { brushWidth = 0.02, opacity = 1, softness = 0.05, rule = 'nonzero', maxStrokes = Infinity } = opts
  if (!Number.isFinite(brushWidth) || brushWidth <= 0) throw new Error('brushWidth ต้องเป็นจำนวนบวก finite')
  if (opts.maxStrokes !== undefined && (!Number.isSafeInteger(maxStrokes) || maxStrokes < 0)) throw new Error('maxStrokes ต้องเป็นจำนวนเต็มไม่ติดลบที่ปลอดภัย')
  const step = brushWidth * 0.45
  const radius = brushWidth / 2
  type Edge = { u1: number; v1: number; u2: number; v2: number; min: number; max: number; winding: number }
  const edges: Edge[] = []
  let minV = Infinity, maxV = -Infinity
  for (const poly of polys) for (let i = 0; i < poly.length; i++) {
    const [u1, v1] = poly[i]!, [u2, v2] = poly[(i + 1) % poly.length]!
    minV = Math.min(minV, v1); maxV = Math.max(maxV, v1)
    if (v1 !== v2) edges.push({ u1, v1, u2, v2, min: Math.min(v1, v2), max: Math.max(v1, v2), winding: v2 > v1 ? 1 : -1 })
  }
  edges.sort((a, b) => a.min - b.min)
  const strokes: BrushStroke[] = []
  // ตรวจงบก่อนสร้างทั้งแถวระบายและเส้นขอบ ไม่สะสมผลเกินเพดานแล้วค่อยปฏิเสธ
  const checkLimit = (): void => {
    if (strokes.length >= maxStrokes) throw new Error(`ลายระบายใช้ stroke เกิน ${maxStrokes.toLocaleString('en-US')} — ลดจำนวนจุดหยัก/รายละเอียดของ path`)
  }
  let active: Edge[] = []
  let next = 0
  for (let v = minV + step / 2; v <= maxV; v = v + step > v ? v + step : Infinity) {
    while (next < edges.length && edges[next]!.min <= v) active.push(edges[next++]!)
    active = active.filter((e) => e.max > v)
    const hits = active.map((e) => ({ u: e.u1 + ((v - e.v1) / (e.v2 - e.v1)) * (e.u2 - e.u1), winding: e.winding }))
    hits.sort((a, b) => a.u - b.u)
    const span = (left: number, right: number): void => {
      checkLimit()
      const a = left + radius, b = right - radius
      const pts: Pt[] = a < b ? [[a, v], [b, v]] : [[(left + right) / 2, v]]
      strokes.push(line(pts, color, brushWidth, { opacity, softness }))
    }
    if (rule === 'evenodd') {
      for (let i = 0; i + 1 < hits.length; i += 2) span(hits[i]!.u, hits[i + 1]!.u)
    } else {
      let winding = 0, left = 0
      for (let i = 0; i < hits.length;) {
        const u = hits[i]!.u
        const before = winding
        do { winding += hits[i++]!.winding } while (i < hits.length && hits[i]!.u === u)
        if (before === 0 && winding !== 0) left = u
        if (before !== 0 && winding === 0) span(left, u)
      }
    }
  }
  if (opacity >= 1) for (const poly of polys) if (poly.length >= 2) {
    const closed = [...poly, poly[0]!]
    for (let i = 0; i < closed.length - 1; i += MAX_POINTS_PER_STROKE - 1) {
      checkLimit()
      strokes.push(line(closed.slice(i, i + MAX_POINTS_PER_STROKE), color, brushWidth, { opacity, softness }))
    }
  }
  return strokes
}

export function circle(cu: number, cv: number, r: number, n = 36): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cu + Math.cos(a) * r, cv + Math.sin(a) * r] as const
  })
}

export function ellipse(cu: number, cv: number, ru: number, rv: number, rot = 0, n = 40): Pt[] {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * ru
    const y = Math.sin(a) * rv
    return [cu + x * c - y * s, cv + x * s + y * c] as const
  })
}

/** ใบไม้ทรงเลนส์ จากจุดโคน a ถึงปลาย b ป่องออกด้านละ bulge */
export function leafShape(a: Pt, b: Pt, bulge: number, n = 16): Pt[] {
  const du = b[0] - a[0]
  const dv = b[1] - a[1]
  const len = Math.hypot(du, dv) || 1
  const nu = -dv / len
  const nv = du / len
  const side = (sign: number): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const w = Math.sin(Math.PI * t) * bulge * sign
    return [a[0] + du * t + nu * w, a[1] + dv * t + nv * w] as const
  })
  return [...side(1), ...side(-1).reverse().slice(1, -1)]
}

/** ดาวสี่แฉกขอบเว้า (astroid) */
export function sparkleShape(cu: number, cv: number, ru: number, rv: number, n = 64): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cu + ru * Math.cos(a) ** 3, cv + rv * Math.sin(a) ** 3] as const
  })
}

/** หัวใจ (สมการ parametric มาตรฐาน) — ปลายแหลมชี้ไปทางโคนเล็บ */
export function heartShape(cu: number, cv: number, size: number, n = 48): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [cu + (x / 17) * size, cv - (y / 17) * size] as const
  })
}

/** ก้อนรูปทรงไม่สม่ำเสมอ (ลายกระดองเต่า) */
export function blobShape(cu: number, cv: number, r: number, rand: () => number, n = 14): Pt[] {
  const k = Array.from({ length: n }, () => 0.6 + rand() * 0.7)
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const rr = (r * (k[i]! + k[(i + 1) % n]!)) / 2
    return [cu + Math.cos(a) * rr * 0.85, cv + Math.sin(a) * rr] as const
  })
}

const smooth = (x: number): number => x * x * (3 - 2 * x)

export interface GradientOptions {
  strength?: number
  steps?: number
  /** สัดส่วนช่วงต้นที่ทึบเต็มก่อนเริ่มจาง (0–1) */
  solidUntil?: number
}

/**
 * ไล่สีนุ่มต่อเนื่องจาก v0 (เข้มสุด) ไป v1 (จางหาย) ด้วยแถบ airbrush บาง ๆ หลายแถบ
 * ความทึบลดลงแบบ smoothstep — แต้ม airbrush ซ้อนกันราว 3 ชั้นต่อเส้น จึงใช้ทึบต่อเส้นต่ำ
 */
export function gradient(v0: number, v1: number, color: string, opts: GradientOptions = {}): BrushStroke[] {
  const { strength = 1, steps = 14, solidUntil = 0 } = opts
  const span = v1 - v0
  const width = (Math.abs(span) / steps) * 2.6
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const fade = t <= solidUntil ? 1 : 1 - smooth((t - solidUntil) / Math.max(1e-6, 1 - solidUntil))
    return line([[0.02, v0 + span * t], [0.98, v0 + span * t]], color, width, {
      brush: 'airbrush',
      softness: 0.95,
      opacity: Math.max(0.01, Math.min(1, 0.42 * strength * fade)),
    })
  })
}
