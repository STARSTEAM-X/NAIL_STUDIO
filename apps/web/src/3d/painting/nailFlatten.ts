import { Vector3, type Mesh } from 'three'
import { nailMatrix, nailViewOf } from '@/3d/scene/nailViews.ts'
import { TEX_SIZE } from './constants.ts'

/**
 * คลี่เล็บออกมาเป็นรูปแบนที่ยัง "เป็นรูปเล็บ" อยู่
 *
 * ปัญหาที่แก้: ผืนเท็กซ์เจอร์ของเล็บถูกกางเต็มสี่เหลี่ยม 0–1 ทั้งใบ การเอาผืนนั้น
 * มาแสดงตรง ๆ จึงเป็นการยืดรูปเล็บให้เต็มสี่เหลี่ยม — วงกลมที่วาดในผืนนั้นจะไปโผล่
 * บนเล็บเป็นรูปรีที่บิดตามความโค้ง ผู้ใช้วาดโดยเดาผลลัพธ์ไม่ได้
 *
 * วิธี: ฉายจุดยอดของเล็บลงบนระนาบที่ตั้งฉากกับทิศหน้าเล็บ (เหมือนมองเล็บตรง ๆ)
 * แล้วจับคู่สามเหลี่ยมแต่ละชิ้นระหว่าง "พิกัดบนแผง" กับ "พิกัดบนเท็กซ์เจอร์"
 * การวาดจึงเดินผ่านการจับคู่นี้ทั้งขาไปและขากลับ
 *
 * ความซับซ้อน: O(จำนวนสามเหลี่ยม) ต่อการคลี่หนึ่งครั้ง ทำครั้งเดียวต่อเล็บแล้วเก็บไว้
 */

/** สามเหลี่ยมหนึ่งชิ้น: พิกัดบนแผง (พิกเซล) คู่กับพิกัดบนเท็กซ์เจอร์ (พิกเซล) */
export interface FlatTriangle {
  /** [x0, y0, x1, y1, x2, y2] บนแผง */
  screen: readonly [number, number, number, number, number, number]
  /** [u0, v0, u1, v1, u2, v2] บนเท็กซ์เจอร์ */
  tex: readonly [number, number, number, number, number, number]
}

export interface FlatNail {
  triangles: FlatTriangle[]
  /** กรอบของรูปเล็บบนแผง — ใช้จัดวางและวาดขอบ */
  bounds: { x: number; y: number; width: number; height: number }
}

/** เว้นขอบรอบรูปเล็บ กันไม่ให้เส้นขอบถูกตัดตรงริมแผงพอดี */
const PADDING = 0.06

export function flattenNail(mesh: Mesh, panelSize: number, texSize = TEX_SIZE): FlatNail {
  const position = mesh.geometry.getAttribute('position')
  const uv = mesh.geometry.getAttribute('uv')
  if (!position) throw new Error(`mesh ${mesh.name} ไม่มี position attribute`)
  if (!uv) throw new Error(`mesh ${mesh.name} ไม่มี uv attribute`)

  const view = nailViewOf(mesh)
  const matrix = nailMatrix(mesh)

  // ระนาบที่ตั้งฉากกับทิศหน้าเล็บ — เหมือนวางกล้องมองเล็บตรง ๆ แล้วกดให้แบน
  //
  // เลือกแกนอ้างอิงจากแกนตั้งของโลกเพราะมือถูกแสดงโดยให้นิ้วชี้ขึ้น ปลายเล็บจึงชี้ขึ้น
  // บนแผงตามไปด้วย ถ้าทิศหน้าเล็บบังเอิญขนานกับแกนตั้ง (เล็บหันขึ้นฟ้าพอดี)
  // แกนนั้นใช้อ้างอิงไม่ได้ ต้องสลับไปใช้แกนอื่นแทน
  const reference = Math.abs(view.normal.y) > 0.95
    ? new Vector3(0, 0, 1)
    : new Vector3(0, 1, 0)
  const xAxis = new Vector3().crossVectors(reference, view.normal).normalize()
  const yAxis = new Vector3().crossVectors(view.normal, xAxis).normalize()

  const point = new Vector3()
  const flatX: number[] = []
  const flatY: number[] = []
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(matrix).sub(view.center)
    const x = point.dot(xAxis)
    // แกน y ของแคนวาสชี้ลง จึงกลับด้านให้ปลายเล็บอยู่ด้านบน
    const y = -point.dot(yAxis)
    flatX.push(x)
    flatY.push(y)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // ย่อให้พอดีแผงโดย**คงสัดส่วน** — ถ้ายืดให้เต็มทั้งสองแกนก็กลับไปเป็นปัญหาเดิม
  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const usable = panelSize * (1 - PADDING * 2)
  const scale = Math.min(usable / spanX, usable / spanY)
  const width = spanX * scale
  const height = spanY * scale
  const offsetX = (panelSize - width) / 2
  const offsetY = (panelSize - height) / 2
  const toPanelX = (x: number): number => offsetX + (x - minX) * scale
  const toPanelY = (y: number): number => offsetY + (y - minY) * scale

  const index = mesh.geometry.getIndex()
  const count = index ? index.count : position.count
  const vertexAt = (cursor: number): number => (index ? index.getX(cursor) : cursor)

  const triangles: FlatTriangle[] = []
  for (let cursor = 0; cursor + 2 < count; cursor += 3) {
    const a = vertexAt(cursor)
    const b = vertexAt(cursor + 1)
    const c = vertexAt(cursor + 2)
    triangles.push({
      screen: [
        toPanelX(flatX[a]!), toPanelY(flatY[a]!),
        toPanelX(flatX[b]!), toPanelY(flatY[b]!),
        toPanelX(flatX[c]!), toPanelY(flatY[c]!),
      ],
      tex: [
        uv.getX(a) * texSize, (1 - uv.getY(a)) * texSize,
        uv.getX(b) * texSize, (1 - uv.getY(b)) * texSize,
        uv.getX(c) * texSize, (1 - uv.getY(c)) * texSize,
      ],
    })
  }

  return { triangles, bounds: { x: offsetX, y: offsetY, width, height } }
}

/**
 * แปลงพิกัดบนแผงกลับเป็นพิกัด UV ของเท็กซ์เจอร์
 *
 * คืน null เมื่อจุดนั้นอยู่นอกรูปเล็บ — ซึ่งเป็นสิ่งที่ต้องการ: นอกรูปเล็บไม่มีผิวให้ทา
 * ผู้ใช้จึงวาดไม่ติด แทนที่จะไปโผล่ที่ไหนสักแห่งบนเล็บโดยไม่ตั้งใจ
 *
 * ความซับซ้อน: O(จำนวนสามเหลี่ยม) ต่อการเรียกหนึ่งครั้ง — เรียกทุก pointermove
 * ที่ ~300 สามเหลี่ยมยังเป็นงานหลักไมโครวินาที ถ้าวันหนึ่งเล็บละเอียดขึ้นมาก
 * ค่อยใส่ตารางแบ่งช่องมาช่วย แต่ต้องวัดก่อน ไม่ใช่เดา
 */
export function panelToTexture(
  flat: FlatNail,
  x: number,
  y: number,
): { u: number; v: number } | null {
  for (const triangle of flat.triangles) {
    const [x0, y0, x1, y1, x2, y2] = triangle.screen
    const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if (Math.abs(denominator) < 1e-12) continue
    const w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denominator
    const w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denominator
    const w2 = 1 - w0 - w1
    // ยอมให้เลยขอบนิดหน่อย กันไม่ให้เกิดรูตามรอยต่อสามเหลี่ยมจากความคลาดเคลื่อนทศนิยม
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
    const [u0, v0, u1, v1, u2, v2] = triangle.tex
    return {
      u: w0 * u0 + w1 * u1 + w2 * u2,
      v: w0 * v0 + w1 * v1 + w2 * v2,
    }
  }
  return null
}

/**
 * เมทริกซ์ที่พาสามเหลี่ยมบนเท็กซ์เจอร์ไปวางบนสามเหลี่ยมของแผง
 *
 * เป็นการแปลงเชิงเส้นแบบ affine ซึ่งพอดีกับสามเหลี่ยม เพราะสามจุดกำหนด affine
 * ได้เพียงคำตอบเดียว การวาดทีละสามเหลี่ยมจึงให้ผลตรงกับที่ GPU ทำบนโมเดลจริง
 *
 * คืน null เมื่อสามเหลี่ยมแบนจนไม่มีพื้นที่ (จุดสามจุดเรียงเป็นเส้นตรง)
 */
export function textureToPanelTransform(
  triangle: FlatTriangle,
): [number, number, number, number, number, number] | null {
  const [x0, y0, x1, y1, x2, y2] = triangle.screen
  const [u0, v0, u1, v1, u2, v2] = triangle.tex
  const denominator = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)
  if (Math.abs(denominator) < 1e-12) return null
  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / denominator
  const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / denominator
  const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / denominator
  const d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / denominator
  return [a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0]
}
