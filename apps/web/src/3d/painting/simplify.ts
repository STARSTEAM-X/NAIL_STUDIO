import type { Point } from '@nail-studio/contracts'

/**
 * ลดจำนวนจุดของเส้นด้วย Ramer–Douglas–Peucker ที่ถ่วงน้ำหนักด้วยแรงกด (A-13)
 *
 * ทำไมต้องลด: pointermove ยิงได้ถึงหลายร้อยครั้งต่อวินาทีบนอุปกรณ์ที่มี pointerrawupdate
 * เส้นเดียวอาจมีพันจุด ซึ่งทั้งบวมในฐานข้อมูลและช้าตอน replay ทุกครั้งที่เปิดงาน
 *
 * ความซับซ้อน: เฉลี่ย O(n log n) กรณีเลวร้ายสุด O(n²) เมื่อจุดเรียงเป็นแนวที่ทำให้
 * แบ่งช่วงไม่สมดุลทุกรอบ — ยอมรับได้เพราะ n คือจำนวนจุดของเส้นเดียว (หลักร้อยถึงพัน)
 * และทำงานครั้งเดียวตอนปล่อยนิ้ว ไม่ได้อยู่ในเส้นทางต่อเฟรม
 */

/**
 * แรงกดคุมรัศมีแปรง จึงต้องมีน้ำหนักในการตัดสินว่าจุดไหนทิ้งได้
 *
 * ค่านี้แปลง "ส่วนต่างของแรงกด" ให้เทียบได้กับ "ระยะทางในหน่วย UV"
 * ที่ 0.02 หมายความว่าแรงกดที่เพี้ยนไปเต็มสเกล (1.0) มีน้ำหนักเท่ากับ
 * จุดที่เบี่ยงออกจากเส้น 0.02 UV — พอให้จังหวะกดหนักกลางเส้นรอดจากการถูกตัด
 * โดยไม่ทำให้เส้นตรงที่แรงกดสั่นเล็กน้อยเก็บจุดไว้ทั้งหมด
 */
const PRESSURE_WEIGHT = 0.02

function deviation(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  let geometric: number
  let along: number
  if (length < 1e-12) {
    geometric = Math.hypot(point.x - start.x, point.y - start.y)
    along = 0
  } else {
    geometric = Math.abs(dy * (point.x - start.x) - dx * (point.y - start.y)) / length
    along = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)
  }

  // เทียบแรงกดจริงกับแรงกดที่ควรเป็นถ้าไล่ระดับเป็นเส้นตรงระหว่างหัวกับท้ายช่วง
  const t = Math.min(1, Math.max(0, along))
  const expected = start.p + (end.p - start.p) * t
  const pressureError = Math.abs(point.p - expected) * PRESSURE_WEIGHT

  return Math.max(geometric, pressureError)
}

export function simplifyPath(points: Point[], tolerance = 0.004): Point[] {
  if (points.length < 3) return [...points]
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const range = stack.pop()
    if (!range) break
    const [start, end] = range
    const from = points[start]
    const to = points[end]
    if (!from || !to) continue
    let worst = 0
    let index = -1
    for (let cursor = start + 1; cursor < end; cursor += 1) {
      const point = points[cursor]
      if (!point) continue
      const distance = deviation(point, from, to)
      if (distance > worst) {
        worst = distance
        index = cursor
      }
    }
    if (index >= 0 && worst > tolerance) {
      keep[index] = true
      stack.push([start, index], [index, end])
    }
  }
  return points.filter((_, index) => keep[index] === true)
}
