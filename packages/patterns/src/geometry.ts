import type { Stroke } from '@nail-studio/contracts'

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
 * ขอบแนวนอนหดเข้าครึ่งความกว้างแปรง เพื่อให้ขอบรูปตรงกับรูปทรงที่สั่ง
 */
export function fill(poly: readonly Pt[], color: string, opts: FillOptions = {}): BrushStroke[] {
  const { brushWidth = 0.02, opacity = 1, softness = 0.05 } = opts
  const step = brushWidth * 0.45
  const radius = brushWidth / 2
  const vs = poly.map((p) => p[1])
  const strokes: BrushStroke[] = []
  for (let v = Math.min(...vs) + step / 2; v <= Math.max(...vs); v += step) {
    const xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const [u1, v1] = poly[i]!
      const [u2, v2] = poly[(i + 1) % poly.length]!
      if ((v1 <= v && v2 > v) || (v2 <= v && v1 > v)) xs.push(u1 + ((v - v1) / (v2 - v1)) * (u2 - u1))
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = xs[i]! + radius
      const b = xs[i + 1]! - radius
      const pts: Pt[] = a < b ? [[a, v], [b, v]] : [[(xs[i]! + xs[i + 1]!) / 2, v]]
      strokes.push(line(pts, color, brushWidth, { opacity, softness }))
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
