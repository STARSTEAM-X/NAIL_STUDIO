import type { Pt } from './geometry.ts'

export type Subpath = { points: Pt[]; closed: boolean }
export type PathCommand = { type: string; values: number[]; position: number }

export class PathSyntaxError extends Error {
  readonly position: number
  constructor(position: number, reason: string) {
    super(`path ผิดที่ตำแหน่ง ${position}: ${reason}`)
    this.name = 'PathSyntaxError'
    this.position = position
  }
}

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
const SPACE = /[\t\n\r ]/

/** อ่านครั้งเดียวตามลำดับ ไม่ข้ามอักขระที่ผิด — O(ความยาว d) */
export function parseSvgPath(d: string): PathCommand[] {
  if (d.length > 8000) throw new PathSyntaxError(8000, 'ยาวเกิน 8,000 ตัวอักษร — แบ่ง path หรือลดรายละเอียด')
  const out: PathCommand[] = []
  let i = 0
  const spaces = (): void => { while (i < d.length && SPACE.test(d[i]!)) i++ }
  spaces()
  while (i < d.length) {
    const position = i
    const type = d[i++]!
    const upper = type.toUpperCase()
    const arity = ARITY[upper]
    if (arity === undefined) throw new PathSyntaxError(position, `ไม่รู้จักคำสั่ง ${type}`)
    if (out.length === 0 && upper !== 'M') throw new PathSyntaxError(position, 'ต้องเริ่มด้วย M หรือ m')
    if (arity === 0) { out.push({ type, values: [], position }); spaces(); continue }
    let repeat = 0
    do {
      const values: number[] = []
      for (let p = 0; p < arity; p++) {
        spaces()
        if ((p > 0 || repeat > 0) && d[i] === ',') { i++; spaces() }
        let token: string | undefined
        if (upper === 'A' && (p === 3 || p === 4)) {
          if (d[i] === '0' || d[i] === '1') token = d[i++]!
          else throw new PathSyntaxError(i, 'flag ของ A ต้องเป็น 0 หรือ 1')
        } else {
          NUMBER.lastIndex = i
          token = NUMBER.exec(d)?.[0]
          if (token) i = NUMBER.lastIndex
        }
        if (!token) throw new PathSyntaxError(i, `คาดว่าเป็นตัวเลขหลัง ${type}`)
        const value = Number(token)
        if (!Number.isFinite(value)) throw new PathSyntaxError(i - token.length, 'ตัวเลขต้อง finite')
        if (upper === 'A' && p < 2 && value < 0) throw new PathSyntaxError(i - token.length, 'รัศมี A ต้องไม่ติดลบ')
        values.push(value)
      }
      out.push({ type: upper === 'M' && repeat > 0 ? (type === 'M' ? 'L' : 'l') : type, values, position })
      repeat++
      spaces()
    } while (i < d.length && (d[i] === ',' || /[+\-.0-9]/.test(d[i]!)))
  }
  return out
}

const mid = (a: Pt, b: Pt): Pt => [a[0] / 2 + b[0] / 2, a[1] / 2 + b[1] / 2]
const distance = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy) || 0))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

/** แบ่งครึ่งแบบ adaptive จำกัดความลึกและจำนวนจุดก่อนคืนข้อมูลให้ renderer */
export function flattenSvgPath(d: string, tolerance: number): Subpath[] {
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error('tolerance ต้องเป็นจำนวนบวก finite')
  const commands = parseSvgPath(d)
  const out: Subpath[] = []
  let current: Pt = [0, 0], start: Pt = current
  let sub: Subpath | undefined
  let control: Pt = current
  let previous = ''
  let total = 0
  let position = 0
  const add = (point: Pt): void => {
    if (!point.every(Number.isFinite)) throw new PathSyntaxError(position, 'พิกัดหลังคำนวณต้อง finite — ลดขนาดตัวเลข')
    if (!sub || sub.closed) { sub = { points: [], closed: false }; out.push(sub) }
    const last = sub.points.at(-1)
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 1e-9) return
    if (++total > 4000) throw new PathSyntaxError(position, 'จุดเกิน 4,000 — แบ่ง path หรือลดรายละเอียด')
    sub.points.push(point)
  }
  const cubic = (a: Pt, b: Pt, c: Pt, e: Pt, depth = 0): void => {
    if (depth >= 10 || Math.max(distance(b, a, e), distance(c, a, e)) <= tolerance) { add(e); return }
    const ab = mid(a, b), bc = mid(b, c), ce = mid(c, e)
    const abc = mid(ab, bc), bce = mid(bc, ce), center = mid(abc, bce)
    cubic(a, ab, abc, center, depth + 1)
    cubic(center, bce, ce, e, depth + 1)
  }
  for (const command of commands) {
    position = command.position
    const { type, values: n } = command
    const upper = type.toUpperCase()
    const relative = type !== upper
    const point = (i: number): Pt => [n[i]! + (relative ? current[0] : 0), n[i + 1]! + (relative ? current[1] : 0)]
    const reflect = (): Pt => [2 * current[0] - control[0], 2 * current[1] - control[1]]
    if (upper === 'M') { sub = undefined; current = point(0); start = current; add(current) }
    else if (upper === 'Z') {
      if (sub && !sub.closed) { add(start); sub.closed = true }
      current = start
    } else {
      // หลัง Z เส้นใหม่เริ่มที่จุดเริ่มเดิม แต่ไม่ปิดเส้นใหม่โดยอัตโนมัติ
      if (!sub || sub.closed) add(current)
      let end = current
      if (upper === 'L') end = point(0)
      else if (upper === 'H') end = [n[0]! + (relative ? current[0] : 0), current[1]]
      else if (upper === 'V') end = [current[0], n[0]! + (relative ? current[1] : 0)]
      else if (upper === 'C' || upper === 'S') {
        const b = upper === 'C' ? point(0) : (previous === 'C' || previous === 'S' ? reflect() : current)
        const c = point(upper === 'C' ? 2 : 0)
        end = point(upper === 'C' ? 4 : 2)
        cubic(current, b, c, end)
        control = c
      } else if (upper === 'Q' || upper === 'T') {
        const b = upper === 'Q' ? point(0) : (previous === 'Q' || previous === 'T' ? reflect() : current)
        end = point(upper === 'Q' ? 2 : 0)
        cubic(current, [current[0] + (b[0] - current[0]) * 2 / 3, current[1] + (b[1] - current[1]) * 2 / 3],
          [end[0] + (b[0] - end[0]) * 2 / 3, end[1] + (b[1] - end[1]) * 2 / 3], end)
        control = b
      } else if (upper === 'A') {
        end = point(5)
        let rx = n[0]!, ry = n[1]!
        if (rx && ry && (end[0] !== current[0] || end[1] !== current[1])) {
          const phi = (n[2]! % 360) * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi)
          const dx = (current[0] - end[0]) / 2, dy = (current[1] - end[1]) / 2
          const x = cos * dx + sin * dy, y = -sin * dx + cos * dy
          const scale = Math.hypot(x / rx, y / ry)
          if (scale > 1) { rx *= scale; ry *= scale }
          const xx = x / rx, yy = y / ry, norm = xx * xx + yy * yy
          const factor = (n[3] === n[4] ? -1 : 1) * Math.sqrt(Math.max(0, (1 - norm) / norm))
          const cx = factor * rx * yy, cy = -factor * ry * xx
          const center: Pt = [cos * cx - sin * cy + (current[0] / 2 + end[0] / 2), sin * cx + cos * cy + (current[1] / 2 + end[1] / 2)]
          const a = Math.atan2((y - cy) / ry, (x - cx) / rx)
          let delta = Math.atan2((-y - cy) / ry, (-x - cx) / rx) - a
          if (n[4] === 0 && delta > 0) delta -= Math.PI * 2
          if (n[4] === 1 && delta < 0) delta += Math.PI * 2
          // ลดช่วงเมื่อรัศมีใหญ่มากเพื่อคุม error จาก arc → cubic (ไม่เกิน 90°)
          const angle = Math.min(Math.PI / 2, Math.pow(tolerance / Math.max(rx, ry), 1 / 6))
          const count = Math.ceil(Math.abs(delta) / angle)
          if (!Number.isFinite(count) || count > 4000) throw new PathSyntaxError(position, 'จุดเกิน 4,000 — แบ่ง path หรือลดรายละเอียด')
          const at = (t: number): Pt => [center[0] + cos * rx * Math.cos(t) - sin * ry * Math.sin(t), center[1] + sin * rx * Math.cos(t) + cos * ry * Math.sin(t)]
          const tangent = (t: number): Pt => [-cos * rx * Math.sin(t) - sin * ry * Math.cos(t), -sin * rx * Math.sin(t) + cos * ry * Math.cos(t)]
          for (let j = 0; j < count; j++) {
            const t0 = a + delta * j / count, t1 = a + delta * (j + 1) / count
            const k = 4 / 3 * Math.tan((t1 - t0) / 4)
            const p0 = j === 0 ? current : at(t0), p1 = j === count - 1 ? end : at(t1)
            const v0 = tangent(t0), v1 = tangent(t1)
            cubic(p0, [p0[0] + k * v0[0], p0[1] + k * v0[1]], [p1[0] - k * v1[0], p1[1] - k * v1[1]], p1)
          }
        } else add(end)
      }
      if ('LHV'.includes(upper)) add(end)
      current = end
    }
    previous = upper
  }
  return out
}
