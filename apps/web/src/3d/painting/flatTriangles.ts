/**
 * ส่วนคำนวณของการคลี่เล็บที่ไม่พึ่ง three.js — ใช้ร่วมกันระหว่างแผงวาด 2 มิติของเว็บ
 * (nailFlatten.ts) กับภาพตัวอย่างของ MCP (apps/mcp/src/nailShape.ts)
 *
 * ข้อห้ามของไฟล์นี้: import ได้เฉพาะแบบ relative และห้ามแตะ three — MCP รันไฟล์นี้ด้วย
 * `node` ตรง ๆ (ไม่มี bundler, ไม่มี path alias, ไม่มี three ใน dependency)
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
  /** พิกเซลบนแผงต่อหนึ่งหน่วยของพิกัดที่ส่งเข้า fitToPanel */
  scale: number
  /** ขนาดเท็กซ์เจอร์ที่ใช้คำนวณพิกัด tex */
  texSize: number
}

/** เว้นขอบรอบรูปเล็บ กันไม่ให้เส้นขอบถูกตัดตรงริมแผงพอดี */
export const PADDING = 0.06

/**
 * จัดจุดที่ฉายลงระนาบแล้วให้พอดีแผงโดย**คงสัดส่วน** แล้วจับคู่สามเหลี่ยมกับ UV
 *
 * - flatX/flatY: พิกัดบนระนาบของจุดยอดแต่ละจุด (แกน y ชี้ลง — ปลายเล็บมีค่าน้อย)
 * - uv: [u0, v0, u1, v1, …] ของจุดยอด (v ของ UV ตามเอกสาร, v = 0 ปลายเล็บ)
 * - indices: ดัชนีสามเหลี่ยม (null = เรียงจุดตรง ๆ ทีละ 3)
 *
 * ความซับซ้อน: O(จำนวนจุดยอด + จำนวนสามเหลี่ยม)
 */
export function fitToPanel(
  flatX: ArrayLike<number>,
  flatY: ArrayLike<number>,
  uv: ArrayLike<number>,
  indices: ArrayLike<number> | null,
  panelSize: number,
  texSize: number,
): FlatNail {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < flatX.length; index += 1) {
    const x = flatX[index]!
    const y = flatY[index]!
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

  const count = indices ? indices.length : flatX.length
  const vertexAt = (cursor: number): number => (indices ? indices[cursor]! : cursor)

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
        uv[a * 2]! * texSize, (1 - uv[a * 2 + 1]!) * texSize,
        uv[b * 2]! * texSize, (1 - uv[b * 2 + 1]!) * texSize,
        uv[c * 2]! * texSize, (1 - uv[c * 2 + 1]!) * texSize,
      ],
    })
  }

  return { triangles, bounds: { x: offsetX, y: offsetY, width, height }, scale, texSize }
}

/** ค่าน้ำหนัก barycentric ของจุด (x, y) ในสามเหลี่ยม หรือ null ถ้าอยู่นอก/สามเหลี่ยมแบน */
function barycentric(
  points: readonly [number, number, number, number, number, number],
  x: number,
  y: number,
): [number, number, number] | null {
  const [x0, y0, x1, y1, x2, y2] = points
  const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
  if (Math.abs(denominator) < 1e-12) return null
  const w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denominator
  const w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denominator
  const w2 = 1 - w0 - w1
  // ยอมให้เลยขอบนิดหน่อย กันไม่ให้เกิดรูตามรอยต่อสามเหลี่ยมจากความคลาดเคลื่อนทศนิยม
  if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) return null
  return [w0, w1, w2]
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
    const weights = barycentric(triangle.screen, x, y)
    if (!weights) continue
    const [w0, w1, w2] = weights
    const [u0, v0, u1, v1, u2, v2] = triangle.tex
    return {
      u: w0 * u0 + w1 * u1 + w2 * u2,
      v: w0 * v0 + w1 * v1 + w2 * v2,
    }
  }
  return null
}

/**
 * ทิศกลับของ panelToTexture: รับ UV ตามเอกสาร (0–1, v = 0 ปลายเล็บ) คืนพิกัดบนแผง
 * พร้อมสามเหลี่ยมที่จุดนั้นตกอยู่ — null เมื่ออยู่นอกเล็บ
 *
 * ความซับซ้อน: O(จำนวนสามเหลี่ยม)
 */
export function textureToPanel(
  flat: FlatNail,
  u: number,
  v: number,
): { x: number; y: number; triangle: FlatTriangle } | null {
  const tu = u * flat.texSize
  const tv = (1 - v) * flat.texSize
  for (const triangle of flat.triangles) {
    const weights = barycentric(triangle.tex, tu, tv)
    if (!weights) continue
    const [w0, w1, w2] = weights
    const [x0, y0, x1, y1, x2, y2] = triangle.screen
    return {
      x: w0 * x0 + w1 * x1 + w2 * x2,
      y: w0 * y0 + w1 * y1 + w2 * y2,
      triangle,
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

/**
 * ลายในสามเหลี่ยมนี้ถูกยืดแค่ไหนเมื่อไปอยู่บนแผง (= บนเล็บเมื่อมองตรง)
 *
 * stretch = singular value ใหญ่ ÷ เล็ก ของส่วนเชิงเส้นของ affine (1 = วงกลมยังกลม)
 * direction บอกว่ายืดตามแนวยาวเล็บ (แกน v ของ texture) หรือตามแนวขวาง (แกน u)
 * คืน null เมื่อสามเหลี่ยมแบน
 */
export function triangleStretch(
  triangle: FlatTriangle,
): { stretch: number; direction: 'along' | 'across' } | null {
  const transform = textureToPanelTransform(triangle)
  if (!transform) return null
  const [a, b, c, d] = transform
  // J = [[a, c], [b, d]] — singular value จาก JᵀJ = [[E, F], [F, G]]
  const E = a * a + b * b
  const G = c * c + d * d
  const F = a * c + b * d
  const trace = E + G
  const root = Math.sqrt(Math.max(0, (E - G) ** 2 + 4 * F * F))
  const large = Math.sqrt((trace + root) / 2)
  const small = Math.sqrt(Math.max(0, (trace - root) / 2))
  if (small < 1e-12) return null
  return { stretch: large / small, direction: G >= E ? 'along' : 'across' }
}
