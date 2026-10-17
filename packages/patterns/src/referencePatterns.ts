import { z } from 'zod'
import { hexColorSchema, type Stroke } from '@nail-studio/contracts'
import { bezier, circle, clamp, clipSegment, dot, ellipse, fill, leafShape, line, rng, sparkleShape, tint, type Pt } from './geometry.ts'

const color = hexColorSchema
const uv = z.number().min(0).max(1)
const angle = z.number().min(-360).max(360)
const seed = z.number().int().min(-2147483648).max(2147483647).default(1)
const points = z.array(z.array(uv).length(2).pipe(z.tuple([uv, uv]))).min(2).max(4).default([[0.26, 0.18], [0.7, 0.45], [0.35, 0.8]])
const motif = {
  u: uv.default(0.5), v: uv.default(0.5),
  size: z.number().min(0.04).max(0.3).default(0.16),
  angle: angle.default(0),
}

/** ลายจากภาพอ้างอิง: รับพารามิเตอร์ที่มีขอบเขต แล้วสร้าง stroke ตาม schema เดิม */
export const referencePatternSchemas = [
  z.object({ type: z.literal('bow'), ...motif, color, style: z.enum(['ribbon', 'silk']).default('ribbon') }).describe('โบว์ริบบิ้นเส้นเล็ก หรือโบว์ผ้าซาติน'),
  z.object({ type: z.literal('cloud'), ...motif, color: color.default('#fffdf8') }).describe('ก้อนเมฆขอบมน'),
  z.object({ type: z.literal('rainbow'), ...motif, colors: z.array(color).min(2).max(7).default(['#dc9eaa', '#f3d48a', '#9bbfa7', '#96b6d6']) }).describe('สายรุ้งพาสเทล'),
  z.object({ type: z.literal('constellation'), color: color.default('#fff9e6'), seed: z.number().int().default(1), orbit: z.boolean().default(false) }).describe('กลุ่มดาวเส้นละเอียด หรือวงโคจร'),
  z.object({ type: z.literal('quilt'), color: color.default('#c8b28c'), spacing: z.number().min(0.12).max(0.3).default(0.22), pearls: z.boolean().default(true) }).describe('ตารางข้าวหลามตัดพร้อมหมุดมุกแบบวาด'),
  z.object({ type: z.literal('aura'), color, u: uv.default(0.5), v: uv.default(0.5), radius: z.number().min(0.08).max(0.5).default(0.28), strength: z.number().min(0.1).max(1).default(0.6), aspect: z.number().min(0.6).max(2.5).default(1), inner: color.optional(), rotation: angle.default(0) }).describe('บลัชออร่าไล่สีฟุ้งจากจุดกลาง'),
  z.object({ type: z.literal('cat_eye'), color: color.default('#dfd0b5'), angle: angle.default(-25), width: z.number().min(0.05).max(0.4).default(0.22), core: z.number().min(0).max(1).default(0), shimmer: z.number().min(0).max(1).default(0.25), glow: color.optional(), seed: z.number().int().default(1) }).describe('แถบสีและเกล็ดแม่เหล็กตาแมว ใช้คู่ผิว cat_eye ให้แสงเปลี่ยนตามมุม'),
  z.object({ type: z.literal('wavy_tip'), color, border: color.optional(), depth: z.number().min(0.1).max(0.5).default(0.28), amplitude: z.number().min(0.01).max(0.08).default(0.025), waves: z.number().int().min(1).max(5).default(3) }).describe('ปลายเล็บขอบคลื่น พร้อมเส้นขอบสีตัด'),
  z.object({ type: z.literal('sprinkles'), colors: z.array(color).min(1).max(6), count: z.number().int().min(3).max(60).default(16), from: uv.default(0), to: uv.default(0.32), seed: z.number().int().default(1) }).describe('เกล็ดน้ำตาลสีหรือขีดสั้นกระจาย'),
  z.object({ type: z.literal('checkerboard'), color, size: z.number().min(0.1).max(0.3).default(0.2), style: z.enum(['solid', 'sketch']).default('solid') }).describe('ตารางหมากรุกทึบ หรือระบายเส้นสเก็ตช์'),
  z.object({ type: z.literal('smiley'), ...motif, color, hair: z.boolean().default(false) }).describe('หน้ายิ้มวาดเส้นพร้อมผมเป็นตัวเลือก'),
  z.object({ type: z.literal('squiggle'), ...motif, color }).describe('เส้นขดสนุกแบบ doodle'),
  z.object({ type: z.literal('ghost'), ...motif, color: color.default('#fffdf5'), detail: color.default('#24212b') }).describe('ผีน้อยชายผ้าโค้งและตารี'),
  z.object({ type: z.literal('skull'), ...motif, color: color.default('#fffdf5'), detail: color.default('#24212b'), stitched: z.boolean().default(false) }).describe('หัวกะโหลก หรือหน้ายิ้มรอยเย็บ'),
  z.object({ type: z.literal('spiderweb'), color: color.default('#efeae2'), corner: z.enum(['left', 'right']).default('left') }).describe('ใยแมงมุมเส้นโค้งจากมุมเล็บ'),
  z.object({ type: z.literal('flame'), color, accent: color.optional(), height: z.number().min(0.25).max(0.8).default(0.62) }).describe('เปลวไฟปลายแหลมพริ้วจากปลายเล็บ'),
  z.object({ type: z.literal('bunny'), ...motif, color: color.default('#fffdf5'), detail: color.default('#cf9eaa'), face: z.boolean().default(true) }).describe('กระต่ายหูยาว พร้อมใบหน้าเป็นตัวเลือก'),
  z.object({ type: z.literal('cat'), ...motif, color: color.default('#fffdf5'), detail: color.default('#373038') }).describe('หน้าแมวหูแหลมและหนวด'),
  z.object({ type: z.literal('marble'), colors: z.array(color).min(2).max(4).default(['#2f7969', '#92b6a2']), vein: color.default('#abc8b2'), seed: z.number().int().default(1) }).describe('หินอ่อนโปร่งซ้อนเส้นแร่ธรรมชาติ ใช้สีพื้นเข้มหรืออ่อนตามต้องการ'),
  z.object({ type: z.literal('foil'), color: color.default('#c6a25b'), density: z.number().min(0.1).max(1).default(0.6), width: z.number().min(0.006).max(0.08).default(0.018), seed: z.number().int().default(1), points: z.array(z.array(uv).length(2).pipe(z.tuple([uv, uv]))).min(2).max(4).default([[0.26, 0.06], [0.74, 0.3], [0.25, 0.7], [0.7, 0.95]]) }).describe('ฟอยล์ทองแตกเป็นเกล็ดตามเส้นโค้ง ปรับสีและความหนาแน่นได้'),
  z.object({ type: z.literal('floral_spray'), ...motif, colors: z.array(color).min(1).max(4).default(['#eab4cc', '#c6b2e2', '#fff5e8']), stem: color.default('#7d8160'), leaf: color.default('#89986c') }).describe('ช่อดอกไม้กลีบซ้อนและกิ่งใบละเอียด'),
  z.object({ type: z.literal('gold_vein'), color: color.default('#c9a24e'), angle: angle.default(-20), veins: z.number().int().min(1).max(4).default(2), branches: uv.default(0.6), width: z.number().min(0.003).max(0.03).default(0.012), flakes: uv.default(0.6), region: z.enum(['full', 'edge']).default('full'), side: z.enum(['left', 'right']).default('left'), tipCluster: uv.default(0), seed }).describe('เครือข่ายรอยแตกทองแตกกิ่งและเกล็ดฟอยล์'),
  z.object({ type: z.literal('malachite'), colors: z.array(color).min(2).max(4).default(['#0c3b2e', '#1f6b50', '#3f9a76', '#86c9a8']), angle: angle.default(25), bands: z.number().int().min(4).max(12).default(8), contrast: z.number().min(0.2).max(1).default(0.6), seed }).describe('ชั้นควันหินมาลาไคต์ไหลวน'),
  z.object({ type: z.literal('glitter_line'), color: color.default('#d4ab52'), points, width: z.number().min(0.006).max(0.04).default(0.016), density: z.number().min(0.2).max(1).default(0.8), taper: z.boolean().default(true), seed }).describe('แถบกลิตเตอร์ละเอียดตามเส้นโค้ง'),
  z.object({ type: z.literal('bead_line'), color: color.default('#d4ab52'), points, size: z.number().min(0.004).max(0.02).default(0.008), spacing: z.number().min(1.2).max(4).default(1.6), taper: uv.default(0.5), curl: uv.default(0) }).describe('สายลูกปัดโลหะมีแสงเงาและปลายม้วน'),
] as const

type Spec = z.infer<(typeof referencePatternSchemas)[number]>
type Renderers = { [K in Spec['type']]: (p: Extract<Spec, { type: K }>) => Stroke[] }

function transform(p: { u: number; v: number; size: number; angle: number }): (x: number, y: number) => Pt {
  const a = p.angle * Math.PI / 180
  return (x, y) => [p.u + p.size * (x * Math.cos(a) - y * Math.sin(a)), p.v + p.size * (x * Math.sin(a) + y * Math.cos(a))]
}

function closed(shape: readonly Pt[]): Pt[] { return [...shape, shape[0]!] }

/** Fixed-resolution curve samples; bead traversal builds an arc-length table below. */
function curvePath(points: readonly Pt[]): Pt[] {
  return points.length === 2 ? [...points] : bezier(points, 96)
}
function along(path: readonly Pt[], t: number): { point: Pt; normal: Pt } {
  const pos = t * (path.length - 1)
  const j = Math.min(path.length - 2, Math.floor(pos))
  const a = path[j]!, b = path[j + 1]!
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return { point: [a[0] + (b[0] - a[0]) * (pos - j), a[1] + (b[1] - a[1]) * (pos - j)], normal: [-(b[1] - a[1]) / length, (b[0] - a[0]) / length] }
}

/** Also used by French so the glitter follows exactly the filled boundary. */
export function renderGlitterPath(path: readonly Pt[], color: string, width: number, density = 0.8, taper = true, seed = 1): Stroke[] {
  const rand = rng(seed)
  const out: Stroke[] = [line(path, color, width, { opacity: 0.85 })]
  const shades = [tint(color, '#69481a', 0.45), color, tint(color, '#fff8d9', 0.75)]
  const count = Math.round(80 + density * 220)
  for (let i = 0; i < count; i++) {
    const t = rand()
    const { point, normal } = along(path, t)
    const w = width * (taper ? Math.sin(Math.PI * t) ** 0.35 : 1)
    const gaussian = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(rand() * Math.PI * 2)
    const offset = clamp(gaussian, -2, 2) * w * 0.28
    const x = point[0] + normal[0] * offset, y = point[1] + normal[1] * offset
    out.push(dot(x, y, 0.003 + rand() * width * 0.35, shades[i % 3]!, { opacity: 0.7 + rand() * 0.3 }))
    if (i % 25 === 0) out.push(dot(x, y, width * 0.38, '#fff9e4'))
  }
  return out
}

/** ทุกลูปมีจำนวนตัวอย่างคงที่ หรือจำกัดด้วย schema; ต้นทุน O(จำนวน stroke ที่สร้าง) */
export const referenceRenderers: Renderers = {
  glitter_line: (p) => renderGlitterPath(curvePath(p.points), p.color, p.width, p.density, p.taper, p.seed),
  bead_line: (p) => {
    const path = curvePath(p.points)
    if (p.curl > 0) {
      const end = path[path.length - 1]!, before = path[path.length - 2]!
      const length = path.reduce((sum, point, i) => i ? sum + Math.hypot(point[0] - path[i - 1]![0], point[1] - path[i - 1]![1]) : 0, 0)
      const radius = Math.min(0.045 * p.curl, length * 0.2)
      const a = Math.atan2(end[1] - before[1], end[0] - before[0])
      for (let i = 1; i <= 32; i++) {
        const t = i / 32, turn = t * Math.PI * 2 * p.curl
        path.push([clamp(end[0] + radius * (Math.sin(a + turn) - Math.sin(a)) * (1 - t * 0.65), 0, 1), clamp(end[1] - radius * (Math.cos(a + turn) - Math.cos(a)) * (1 - t * 0.65), 0, 1)])
      }
    }
    const lengths = [0]
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]))
    const total = lengths[lengths.length - 1]!
    const count = Math.min(80, Math.floor(total / (p.size * p.spacing)) + 1)
    const out: Stroke[] = []
    let j = 0
    for (let i = 0; i < count; i++) {
      const distance = count === 1 ? 0 : i / (count - 1) * total
      while (j < path.length - 2 && lengths[j + 1]! < distance) j++
      const t = (distance - lengths[j]!) / (lengths[j + 1]! - lengths[j]! || 1)
      const a = path[j]!, b = path[j + 1]!
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t
      const size = p.size * (1 - p.taper * i / Math.max(1, count - 1) * 0.75)
      out.push(dot(x, y, size * 1.2, tint(p.color, '#29242a', 0.55)), dot(x, y, size, p.color), dot(x - size * 0.18, y - size * 0.18, size * 0.35, tint(p.color, '#ffffff', 0.85)))
    }
    return out
  },
  malachite: (p) => {
    const rand = rng(p.seed), out: Stroke[] = []
    for (let i = 0; i < 6; i++) out.push(dot(0.2 + rand() * 0.6, rand(), 0.38, p.colors[i % 2]!, { brush: 'airbrush', opacity: 0.45, softness: 1 }))
    const a = p.angle * Math.PI / 180, phase = rand() * Math.PI * 2
    const pathAt = (offset: number, from = 0, to = 1): Pt[] => Array.from({ length: 65 }, (_, j): Pt => {
      const t = from + j / 64 * (to - from)
      const warp = Math.sin(t * 6 + phase) * 0.11
      const x = offset + Math.sin(t * 7 + phase + offset * 2) * 0.12 + Math.sin(t * 16 + warp * 3 + phase) * 0.045
      return [0.5 + x * Math.cos(a) - (t - 0.5) * Math.sin(a), 0.5 + x * Math.sin(a) + (t - 0.5) * Math.cos(a)]
    })
    for (let i = 0; i < p.bands; i++) {
      const path = pathAt((i / (p.bands - 1) - 0.5) * 1.25)
      out.push(line(path, p.colors[i % p.colors.length]!, 0.09 + rand() * 0.07, { brush: 'airbrush', opacity: 0.18 + p.contrast * 0.17, softness: 1 }))
      out.push(line(path, p.colors[p.colors.length - 1]!, 0.002 + rand() * 0.003, { opacity: 0.25 + p.contrast * 0.25, softness: 0.5 }))
    }
    for (let i = 0; i < 14; i++) {
      const from = rand() * 0.7
      out.push(line(pathAt((rand() - 0.5) * 0.9, from, from + 0.15 + rand() * 0.15), p.colors[2 % p.colors.length]!, 0.025 + rand() * 0.025, { brush: 'airbrush', opacity: 0.18 + p.contrast * 0.2, softness: 1 }))
    }
    return out
  },
  gold_vein: (p) => {
    const rand = rng(p.seed), out: Stroke[] = []
    const segments: { a: Pt; b: Pt; width: number }[] = []
    const junctions: Pt[] = []
    const edge = p.region === 'edge'
    const side = p.side === 'left' ? -1 : 1
    const bound = (point: Pt): Pt => [clamp(point[0], edge ? 0.23 : 0, edge ? 0.77 : 1), clamp(point[1], 0, 1)]
    const walk = (start: Pt, direction: number, steps: number, level: number): Pt[] => {
      let current = start, heading = direction
      const path: Pt[] = [current]
      for (let i = 0; i < steps && segments.length < 220; i++) {
        heading += (rand() - 0.5) * 70 * Math.PI / 180
        heading = direction + clamp(heading - direction, -0.8, 0.8)
        const length = 0.03 + rand() * 0.03
        let next: Pt = [current[0] + Math.cos(heading) * length, current[1] + Math.sin(heading) * length]
        if (edge && level === 0) next = [0.5 + side * (0.04 + 0.18 * Math.sin(Math.PI * clamp(next[1], 0, 1)) ** 0.7 + 0.018 * Math.sin(next[1] * 5 + p.seed)), next[1]]
        const clipped = clipSegment(current, next)
        if (clipped.length < 2) break
        next = bound(clipped[1]!)
        segments.push({ a: current, b: next, width: p.width * 0.6 ** level * (0.5 + rand() * 0.8) })
        current = next; path.push(current)
        if (current[0] <= 0 || current[0] >= 1 || current[1] <= 0 || current[1] >= 1) break
      }
      return path
    }
    const main: Pt[][] = []
    const direction = edge ? Math.PI / 2 + p.angle * Math.PI / 180 * 0.15 : p.angle * Math.PI / 180
    for (let i = 0; i < p.veins; i++) {
      const start: Pt = edge ? [0.5 + side * 0.06, 0.02 + i * 0.13] : [Math.cos(direction) >= 0 ? 0.03 : 0.97, clamp(0.5 - Math.sin(direction) * 0.5 + (i / Math.max(1, p.veins - 1) - 0.5) * 0.42, 0.12, 0.88)]
      main.push(walk(start, direction, edge ? 28 : 26, 0))
    }
    for (const [trunk, path] of main.entries()) {
      for (let i = 4; i < path.length - 1; i += 5) {
        if (rand() > p.branches && !(p.branches >= 0.5 && junctions.length === 0)) continue
        const root = path[i]!
        junctions.push(root)
        const branch = walk(root, direction + (rand() < 0.5 ? -1 : 1) * (0.8 + rand()), 7, 1)
        if (p.branches > 0.4 && branch.length > 3) {
          const fork = branch[3]!
          junctions.push(fork)
          walk(fork, direction - 1, 4, 2)
        }
        // Pick the next trunk in O(1); bounded jagged segments close the cell.
        if (!edge && main.length > 1 && segments.length < 220) {
          const other = main[(trunk + 1) % main.length]!
          const target = other[Math.min(i + 3, other.length - 1)]!
          let current = branch[branch.length - 1]!
          const steps = Math.ceil(Math.hypot(target[0] - current[0], target[1] - current[1]) / 0.05)
          for (let k = 0; k < steps && segments.length < 220; k++) {
            const remaining = steps - k
            const next: Pt = remaining === 1 ? target : bound([current[0] + (target[0] - current[0]) / remaining + (rand() - 0.5) * 0.018, current[1] + (target[1] - current[1]) / remaining + (rand() - 0.5) * 0.018])
            segments.push({ a: current, b: next, width: p.width * 0.36 * (0.7 + rand() * 0.6) })
            current = next
          }
        }
      }
    }
    if (segments.length === 0) return []
    if (!edge && p.branches >= 0.5 && junctions.length === 0) {
      const root = segments[0]!.a
      junctions.push(root)
      walk(root, direction + 0.9, 5, 1)
    }
    for (const { a, b, width } of segments) {
      out.push(line([a, b], tint(p.color, '#5a3d12', 0.35), width * 1.4, { opacity: 0.5 }), line([a, b], p.color, width), line([a, b], tint(p.color, '#fff6d0', 0.6), width * 0.35))
    }
    const count = Math.min(160, Math.round(p.flakes * 110 + p.tipCluster * 50))
    for (let i = 0; i < count; i++) {
      const tip = i < Math.round(p.tipCluster * 50)
      const segment = segments[Math.floor(rand() * segments.length)]!
      const t = rand()
      const root: Pt = !tip && junctions.length && i % 3 === 0 ? junctions[i % junctions.length]! : [segment.a[0] + (segment.b[0] - segment.a[0]) * t, segment.a[1] + (segment.b[1] - segment.a[1]) * t]
      const center = bound(tip ? [edge ? 0.5 + side * (0.035 + rand() * 0.065) : 0.3 + rand() * 0.4, 0.04 + rand() * 0.13] : [root[0] + (rand() - 0.5) * p.width * 2, root[1] + (rand() - 0.5) * p.width * 2])
      const r = 0.002 + rand() ** 2 * (tip ? 0.009 : 0.006)
      const turn = rand() * Math.PI * 2
      const fragment = Array.from({ length: 4 }, (_, k): Pt => bound([center[0] + Math.cos(turn + k * Math.PI / 2) * r, center[1] + Math.sin(turn + k * Math.PI / 2) * r * (0.6 + rand() * 0.7)]))
      out.push(line(closed(fragment), i % 3 === 0 ? tint(p.color, '#fff8cf', 0.65) : p.color, r * 0.9))
    }
    return out
  },
  bow: (p) => {
    const at = transform(p)
    const out: Stroke[] = []
    for (const side of [-1, 1]) {
      const loop = [
        ...bezier([at(0, 0), at(side * 0.62, -0.9), at(side * 1.12, -0.78), at(side * 0.95, -0.23)], 18),
        ...bezier([at(side * 0.95, -0.23), at(side * 0.8, 0.12), at(side * 0.3, 0.18), at(0, 0)], 18).slice(1),
      ]
      const tail = bezier([at(side * 0.08, 0.05), at(side * 0.12, 0.62), at(side * 0.7, 0.7), at(side * 0.66, 1.1)], 24)
      if (p.style === 'silk') {
        out.push(...fill(loop, p.color, { brushWidth: p.size * 0.04 }))
        out.push(line(tail, p.color, p.size * 0.2))
        out.push(line(bezier([at(side * 0.12, -0.02), at(side * 0.55, -0.55), at(side * 0.84, -0.55)], 16), tint(p.color, '#ffffff', 0.4), p.size * 0.045))
        out.push(line(tail, tint(p.color, '#ffffff', 0.22), p.size * 0.045))
      } else {
        out.push(line(closed(loop), p.color, p.size * 0.065))
        out.push(line(tail, p.color, p.size * 0.055))
      }
    }
    out.push(...fill(ellipse(...at(0, 0), p.size * 0.13, p.size * 0.1, p.angle * Math.PI / 180), p.color, { brushWidth: p.size * 0.03 }))
    out.push(dot(...at(-0.035, -0.035), p.size * 0.06, tint(p.color, '#ffffff', 0.55)))
    return out
  },
  cloud: (p) => {
    const at = transform(p)
    const curves: Pt[][] = [
      [at(-1.1, 0.25), at(-1.48, -0.08), at(-0.92, -0.65), at(-0.55, -0.28)],
      [at(-0.55, -0.28), at(-0.65, -1), at(0.45, -1.02), at(0.5, -0.3)],
      [at(0.5, -0.3), at(1, -0.66), at(1.55, 0.08), at(1.1, 0.28)],
      [at(1.1, 0.28), at(0.55, 0.55), at(-0.5, 0.48), at(-1.1, 0.25)],
    ]
    const shape = curves.flatMap((c) => bezier(c, 12).slice(0, -1))
    return fill(shape, p.color, { brushWidth: p.size * 0.05 })
  },
  rainbow: (p) => {
    const at = transform(p)
    return p.colors.map((col, i) => {
      const r = 1 - i * 0.1
      const arc = Array.from({ length: 49 }, (_, k): Pt => {
        const a = Math.PI + k / 48 * Math.PI
        return at(Math.cos(a) * r, Math.sin(a) * r)
      })
      return line(arc, col, p.size * 0.075)
    })
  },
  constellation: (p) => {
    const rand = rng(p.seed)
    const out: Stroke[] = []
    const stars: Pt[] = [[0.36, 0.23], [0.6, 0.37], [0.42, 0.57], [0.65, 0.75]]
    if (p.orbit) {
      for (const tilt of [-0.6, 0.55]) out.push(line(closed(ellipse(0.5, 0.49, 0.18, 0.36, tilt, 64)), p.color, 0.004))
    } else out.push(line(stars, p.color, 0.0035, { opacity: 0.8 }))
    for (const [x, y] of stars) out.push(...fill(sparkleShape(x, y, 0.025, 0.04, 32), p.color, { brushWidth: 0.003 }))
    for (let i = 0; i < 18; i++) out.push(dot(0.24 + rand() * 0.52, 0.12 + rand() * 0.76, 0.004 + rand() * 0.007, p.color))
    return out
  },
  quilt: (p) => {
    const out: Stroke[] = []
    const offsets: number[] = []
    for (let offset = -1; offset <= 2; offset += p.spacing) {
      offsets.push(offset)
      for (const sign of [-1, 1]) {
        const path = clipSegment([0, offset], [1, offset + sign])
        if (path.length === 0) continue
        out.push(line(path, tint(p.color, '#ffffff', 0.55), 0.014))
        out.push(line(path, p.color, 0.004))
      }
    }
    if (p.pearls) {
      for (const a of offsets) {
        for (const b of offsets) {
          // จุดตัดของเส้น y = x + a และ y = -x + b ใช้กริดเดียวกับเส้นที่วาด
          const x = (b - a) / 2
          const y = (a + b) / 2
          if (x < 0.2 || x > 0.8 || y < 0.05 || y > 0.95) continue
          out.push(dot(x, y, 0.023, p.color), dot(x - 0.003, y - 0.003, 0.011, '#fff8e8'))
        }
      }
    }
    return out
  },
  aura: (p) => {
    const out: Stroke[] = []
    const a = p.rotation * Math.PI / 180
    const aspect = Math.sqrt(p.aspect)
    const at = (x: number, y: number): Pt => [p.u + x * Math.cos(a) - y * Math.sin(a), p.v + x * Math.sin(a) + y * Math.cos(a)]
    // The legacy grid overlaps even at aspect 0.6–2.5: maximum step < 0.4 radius,
    // versus a 0.65-radius dab diameter. Fixed sampling avoids count/brightness jumps.
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const r2 = (row * row + col * col) / 9
        if (r2 > 1) continue
        const x = col / 3 * p.radius * 0.75 / aspect
        const y = row / 3 * p.radius * 0.75 * aspect
        out.push(dot(...at(x, y), p.radius * 0.65, p.color, { brush: 'airbrush', opacity: p.strength * 0.32 * Math.exp(-r2 * 2.5), softness: 1 }))
      }
    }
    if (p.inner) {
      for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
        const r2 = (row * row + col * col) / 9
        if (r2 > 1) continue
        out.push(dot(...at(col / 3 * p.radius * 0.4 / aspect, row / 3 * p.radius * 0.5 * aspect - 0.035), p.radius * 0.4, p.inner, { brush: 'airbrush', opacity: p.strength * 0.2 * Math.exp(-r2 * 3.5), softness: 1 }))
      }
    }
    return out
  },
  cat_eye: (p) => {
    const a = p.angle * Math.PI / 180
    const at = (x: number, y: number): Pt => [0.5 + x * Math.cos(a) - y * Math.sin(a), 0.5 + x * Math.sin(a) + y * Math.cos(a)]
    const out: Stroke[] = []
    for (let i = -12; i <= 12; i++) {
      const offset = i / 12 * p.width
      const alpha = Math.exp(-((offset / (p.width * 0.48)) ** 2)) * 0.18
      const path = clipSegment(at(offset, -0.8), at(offset, 0.8))
      if (path.length) out.push(line(path, p.color, p.width / 5, { brush: 'airbrush', opacity: alpha, softness: 1 }))
    }
    if (p.core > 0) {
      const glow = p.glow ?? tint(p.color, '#fff4ef', 0.72)
      const path = clipSegment(at(0, -0.8), at(0, 0.8))
      out.push(line(path, glow, p.width * 1.8, { brush: 'airbrush', opacity: p.core * 0.34, softness: 1 }))
      out.push(line(path, glow, p.width * 0.85, { brush: 'airbrush', opacity: p.core * 0.55, softness: 1 }))
      out.push(line(path, glow, p.width * 0.38, { brush: 'airbrush', opacity: p.core * 0.65, softness: 1 }))
    }
    const legacy = p.core === 0 && p.glow === undefined
    const rand = rng(p.seed)
    const count = p.shimmer <= 0.25 ? Math.round(p.shimmer * 960) : Math.round(240 + (p.shimmer - 0.25) * 880)
    for (let i = 0; i < count; i++) {
      let x = 0.18 + rand() * 0.64
      let y = 0.04 + rand() * 0.92
      if (!legacy && i % 3 === 0) {
        const point = at((rand() - 0.5) * p.width, (rand() - 0.5) * 1.1)
        x = clamp(point[0], 0.18, 0.82); y = clamp(point[1], 0.04, 0.96)
      }
      const d = (x - 0.5) * Math.cos(a) + (y - 0.5) * Math.sin(a)
      const alpha = (legacy ? 0.08 : 0.24) + (legacy ? 0.55 : 0.75) * Math.exp(-((d / p.width) ** 2))
      out.push(dot(x, y, (legacy ? 0.002 + rand() * 0.004 : 0.002 + rand() * (i % 3 === 0 ? 0.005 : 0.0025)), tint(p.color, '#ffffff', rand() * 0.5), { opacity: alpha, softness: 0.15 }))
    }
    return out
  },
  wavy_tip: (p) => {
    const edge = Array.from({ length: 81 }, (_, i): Pt => [i / 80, p.depth + Math.sin(i / 80 * Math.PI * 2 * p.waves) * p.amplitude])
    const out: Stroke[] = fill([...edge, [1, 0], [0, 0]], p.color, { brushWidth: 0.012 })
    if (p.border) out.push(line(edge, p.border, 0.009))
    return out
  },
  sprinkles: (p) => {
    const rand = rng(p.seed)
    const lo = Math.min(p.from, p.to)
    const hi = Math.max(p.from, p.to)
    return Array.from({ length: p.count }, () => {
      const x = 0.23 + rand() * 0.54
      const y = lo + rand() * (hi - lo)
      const a = rand() * Math.PI
      return line([[x, y], [x + Math.cos(a) * 0.023, y + Math.sin(a) * 0.023]], p.colors[Math.floor(rand() * p.colors.length)]!, 0.012)
    })
  },
  checkerboard: (p) => {
    const out: Stroke[] = []
    const cells = Math.ceil(1 / p.size)
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        if ((row + col) % 2) continue
        const x = col * p.size
        const y = row * p.size
        if (p.style === 'solid') out.push(...fill([[x, y], [x + p.size, y], [x + p.size, y + p.size], [x, y + p.size]], p.color, { brushWidth: 0.018 }))
        else {
          out.push(line([[x, y], [x + p.size, y], [x + p.size, y + p.size], [x, y + p.size], [x, y]], p.color, 0.012))
          for (let i = 0; i < 4; i++) out.push(line([[x + p.size * i / 4, y], [x + p.size, y + p.size * (1 - i / 4)]], p.color, 0.014))
        }
      }
    }
    return out
  },
  smiley: (p) => {
    const at = transform(p)
    const ring = circle(0, 0, 1, 64).map(([x, y]) => at(x, y))
    const smile = bezier([at(-0.55, 0.18), at(0, 1), at(0.55, 0.18)], 24)
    const out: Stroke[] = [line(closed(ring), p.color, p.size * 0.09), line(smile, p.color, p.size * 0.08), dot(...at(-0.32, -0.25), p.size * 0.12, p.color), dot(...at(0.32, -0.25), p.size * 0.12, p.color)]
    if (p.hair) for (const x of [-0.25, 0, 0.25]) out.push(line([at(x, -1), at(x * 1.6, -1.35)], p.color, p.size * 0.07))
    return out
  },
  squiggle: (p) => {
    const at = transform(p)
    const pts = Array.from({ length: 81 }, (_, i): Pt => {
      const t = i / 80
      return at((t - 0.5) * 2 + Math.sin(t * Math.PI * 4) * 0.4, Math.cos(t * Math.PI * 4) * 0.4)
    })
    return [line(pts, p.color, p.size * 0.09)]
  },
  ghost: (p) => {
    const at = transform(p)
    const body = [
      ...bezier([at(-0.7, 0.65), at(-0.85, -1.3), at(0.85, -1.3), at(0.7, 0.65)], 36),
      ...bezier([at(0.7, 0.65), at(0.4, 0.3), at(0.3, 1.1), at(0, 0.65)], 12).slice(1),
      ...bezier([at(0, 0.65), at(-0.3, 1.1), at(-0.4, 0.3), at(-0.7, 0.65)], 12).slice(1),
    ]
    return [
      ...fill(body, p.color, { brushWidth: p.size * 0.04 }),
      ...[-1, 1].flatMap((side) => fill(ellipse(...at(side * 0.25, -0.25), p.size * 0.1, p.size * 0.17, p.angle * Math.PI / 180), p.detail, { brushWidth: p.size * 0.025 })),
      dot(...at(0, 0.12), p.size * 0.15, p.detail),
    ]
  },
  skull: (p) => {
    const at = transform(p)
    const head = [
      ...bezier([at(-0.55, 0.3), at(-1.35, -1.25), at(1.35, -1.25), at(0.55, 0.3)], 32),
      at(0.45, 0.75), at(-0.45, 0.75),
    ]
    const out: Stroke[] = fill(head, p.color, { brushWidth: p.size * 0.04 })
    for (const side of [-1, 1]) out.push(...fill(ellipse(...at(side * 0.32, -0.16), p.size * 0.15, p.size * 0.2, p.angle * Math.PI / 180), p.detail, { brushWidth: p.size * 0.025 }))
    out.push(...fill([at(0, 0.08), at(-0.1, 0.29), at(0.1, 0.29)], p.detail, { brushWidth: p.size * 0.02 }))
    if (p.stitched) {
      out.push(line(bezier([at(-0.6, 0.25), at(0, 0.8), at(0.6, 0.25)], 24), p.detail, p.size * 0.045))
      for (const x of [-0.42, -0.21, 0, 0.21, 0.42]) out.push(line([at(x - 0.03, 0.42 - x * x), at(x + 0.03, 0.65 - x * x)], p.detail, p.size * 0.04))
    } else for (const x of [-0.24, 0, 0.24]) out.push(line([at(x, 0.5), at(x, 0.78)], p.detail, p.size * 0.04))
    return out
  },
  spiderweb: (p) => {
    const f = (x: number, y: number): Pt => [p.corner === 'right' ? 1 - x : x, y]
    const out: Stroke[] = []
    const origin = f(0.13, 0.03)
    for (let i = 0; i <= 5; i++) {
      const a = i / 5 * Math.PI / 2
      out.push(line([origin, f(0.13 + Math.cos(a) * 0.84, 0.03 + Math.sin(a) * 0.84)], p.color, 0.004))
    }
    for (const r of [0.18, 0.34, 0.51, 0.7]) {
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI / 2
        const b = (i + 1) / 5 * Math.PI / 2
        out.push(line(bezier([
          f(0.13 + Math.cos(a) * r, 0.03 + Math.sin(a) * r),
          f(0.13 + Math.cos((a + b) / 2) * r * 0.87, 0.03 + Math.sin((a + b) / 2) * r * 0.87),
          f(0.13 + Math.cos(b) * r, 0.03 + Math.sin(b) * r),
        ], 10), p.color, 0.0035))
      }
    }
    return out
  },
  flame: (p) => {
    const out: Stroke[] = []
    for (const [x, height, lean, width] of [[0.27, 0.65, -0.06, 0.1], [0.48, 1, 0.1, 0.13], [0.73, 0.8, -0.06, 0.11]] as const) {
      const h = height * p.height
      const tip: Pt = [x + lean, h]
      const shape = [
        [x - width, 0] as Pt,
        ...bezier([[x - width, 0], [x - width * 1.25, h * 0.65], [x + lean * 0.2, h * 0.35], tip], 24).slice(1),
        ...bezier([tip, [x + lean * 0.8, h * 0.7], [x + width, h * 0.42], [x + width, 0]], 24).slice(1),
      ]
      out.push(...fill(shape, p.color, { brushWidth: 0.009 }))
      if (p.accent) out.push(line(bezier([[x, 0], [x - width * 0.3, h * 0.3], [x + lean, h * 0.7]], 20), p.accent, 0.01))
    }
    return out
  },
  bunny: (p) => {
    const at = transform(p)
    const out: Stroke[] = []
    for (const side of [-1, 1]) {
      const ear = ellipse(side * 0.35, -0.65, 0.22, 0.65, side * 0.16).map(([x, y]) => at(x, y))
      out.push(...fill(ear, p.color, { brushWidth: p.size * 0.04 }))
      const inner = ellipse(side * 0.35, -0.7, 0.09, 0.42, side * 0.16).map(([x, y]) => at(x, y))
      out.push(...fill(inner, tint(p.detail, '#ffffff', 0.3), { brushWidth: p.size * 0.03 }))
    }
    out.push(...fill(ellipse(0, 0.35, 0.8, 0.65).map(([x, y]) => at(x, y)), p.color, { brushWidth: p.size * 0.04 }))
    if (p.face) {
      for (const side of [-1, 1]) out.push(dot(...at(side * 0.27, 0.3), p.size * 0.09, '#40333c'), dot(...at(side * 0.48, 0.48), p.size * 0.18, p.detail, { opacity: 0.4, softness: 0.8 }))
      out.push(dot(...at(0, 0.48), p.size * 0.1, p.detail))
    }
    return out
  },
  cat: (p) => {
    const at = transform(p)
    const face = [at(-0.72, -0.15), at(-0.68, -0.85), at(-0.22, -0.52), at(0.22, -0.52), at(0.68, -0.85), at(0.72, -0.15), ...bezier([at(0.72, -0.15), at(1, 0.95), at(-1, 0.95), at(-0.72, -0.15)], 32).slice(1)]
    const out: Stroke[] = fill(face, p.color, { brushWidth: p.size * 0.04 })
    for (const side of [-1, 1]) {
      out.push(dot(...at(side * 0.28, -0.03), p.size * 0.12, p.detail))
      for (const y of [0.18, 0.34]) out.push(line([at(side * 0.48, y), at(side * 0.88, y - 0.06)], p.detail, p.size * 0.03))
    }
    out.push(dot(...at(0, 0.21), p.size * 0.13, '#d7aa73'))
    return out
  },
  marble: (p) => {
    const rand = rng(p.seed)
    const out: Stroke[] = []
    for (let i = 0; i < 9; i++) {
      const col = p.colors[i % p.colors.length]!
      out.push(dot(0.2 + rand() * 0.6, rand(), 0.2 + rand() * 0.18, col, { brush: 'airbrush', opacity: 0.3, softness: 1 }))
    }
    for (let i = 0; i < 5; i++) {
      const x = 0.1 + i * 0.2
      const phase = rand() * Math.PI * 2
      const path = Array.from({ length: 65 }, (_, j): Pt => {
        const t = j / 64
        return [x + Math.sin(t * Math.PI * 2 + phase) * 0.13 + Math.sin(t * Math.PI * 6 + phase * 0.6) * 0.035, t]
      })
      out.push(line(path, p.colors[i % p.colors.length]!, 0.09, { opacity: 0.14, softness: 1 }))
      out.push(line(path, p.vein, 0.014 + rand() * 0.012, { opacity: 0.22, softness: 0.85 }))
      out.push(line(path, p.vein, 0.0035, { opacity: 0.35, softness: 0.5 }))
      for (const index of [16, 37]) {
        const root = path[index]!
        const end = path[Math.min(index + 14, 64)]!
        out.push(line(bezier([root, [root[0] + 0.17, root[1] + 0.04], [end[0] - 0.1, end[1] - 0.05], end], 24), p.vein, 0.004, { opacity: 0.3, softness: 0.6 }))
      }
    }
    return out
  },
  foil: (p) => {
    const rand = rng(p.seed)
    const path = p.points.length === 2 ? [p.points[0]!, p.points[1]!] : bezier(p.points, 48)
    const out: Stroke[] = []
    const target = Math.round(40 + p.density * 90)
    for (let i = 0; i < target; i++) {
      const t = rand() * (path.length - 1)
      const j = Math.min(path.length - 2, Math.floor(t))
      const a = path[j]!
      const b = path[j + 1]!
      const x = a[0] + (b[0] - a[0]) * (t - j) + (rand() - 0.5) * p.width
      const y = a[1] + (b[1] - a[1]) * (t - j) + (rand() - 0.5) * p.width
      const r = 0.002 + rand() ** 2 * 0.007
      const turn = rand() * Math.PI * 2
      const fragment = Array.from({ length: 4 }, (_, k): Pt => {
        const a = turn + k / 4 * Math.PI * 2
        return [x + Math.cos(a) * r, y + Math.sin(a) * r * (0.6 + rand() * 0.7)]
      })
      const col = i % 5 === 0 ? tint(p.color, '#fff8cf', 0.65) : i % 3 === 0 ? tint(p.color, '#71521d', 0.25) : p.color
      out.push(...fill(fragment, col, { brushWidth: r * 0.8, softness: 0.03 }))
    }
    return out
  },
  floral_spray: (p) => {
    const at = transform(p)
    const local = bezier([[-0.45, 1.15], [-0.3, 0.5], [0.32, -0.4], [0.4, -1.15]], 40)
    const branch = local.map(([x, y]) => at(x, y))
    const out: Stroke[] = [line(branch, p.stem, p.size * 0.015)]
    for (const [index, side] of [[5, -1], [11, 1], [17, -1], [25, 1], [32, -1], [37, 1]] as const) {
      const root = branch[index]!
      const source = local[index]!
      const next = local[Math.min(index + 4, 40)]!
      const tip = at(source[0] + side * 0.42, next[1] - 0.1)
      out.push(...fill(leafShape(root, tip, p.size * 0.09), p.leaf, { brushWidth: p.size * 0.025 }))
      out.push(line([root, tip], tint(p.leaf, '#fff5db', 0.4), p.size * 0.009))
    }
    for (const [i, index] of [9, 22, 34].entries()) {
      const center = branch[index]!
      const radius = p.size * (i === 1 ? 0.33 : 0.26)
      const col = p.colors[i % p.colors.length]!
      for (let petal = 0; petal < 5; petal++) {
        const a = petal / 5 * Math.PI * 2 - Math.PI / 2 + p.angle * Math.PI / 180
        const atPetal = (r: number): Pt => [center[0] + Math.cos(a) * radius * r, center[1] + Math.sin(a) * radius * r]
        out.push(...fill(ellipse(...atPetal(0.55), radius * 0.55, radius * 0.32, a), col, { brushWidth: radius * 0.06 }))
        for (let layer = 0; layer < 3; layer++) {
          out.push(...fill(ellipse(...atPetal(0.6), radius * (0.44 - layer * 0.09), radius * (0.24 - layer * 0.065), a), tint(col, '#fffef8', 0.18 + layer * 0.16), { brushWidth: radius * 0.06 }))
        }
        out.push(line([atPetal(0.15), atPetal(0.65)], tint(col, '#965c72', 0.2), radius * 0.03))
      }
      out.push(dot(...center, radius * 0.25, '#c6a65f'))
      for (let j = 0; j < 5; j++) {
        const a = j / 5 * Math.PI * 2
        out.push(dot(center[0] + Math.cos(a) * radius * 0.15, center[1] + Math.sin(a) * radius * 0.15, radius * 0.055, '#fff3bd'))
      }
    }
    return out
  },
}
