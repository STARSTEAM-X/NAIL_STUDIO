import { Vector3, type Mesh } from 'three'
import { nailMatrix, nailViewOf } from '@/3d/scene/nailViews.ts'
import { morphedPosition } from '@/3d/scene/nailMorph.ts'
import { TEX_SIZE } from './constants.ts'
import { fitToPanel, type FlatNail } from './flatTriangles.ts'

export {
  panelToTexture,
  textureToPanel,
  textureToPanelTransform,
  triangleStretch,
  type FlatNail,
  type FlatTriangle,
} from './flatTriangles.ts'

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
  for (let index = 0; index < position.count; index += 1) {
    morphedPosition(mesh, index, point).applyMatrix4(matrix).sub(view.center)
    const x = point.dot(xAxis)
    // แกน y ของแคนวาสชี้ลง จึงกลับด้านให้ปลายเล็บอยู่ด้านบน
    const y = -point.dot(yAxis)
    flatX.push(x)
    flatY.push(y)
  }

  const index = mesh.geometry.getIndex()
  const uvs = new Float32Array(uv.count * 2)
  for (let vertex = 0; vertex < uv.count; vertex += 1) {
    uvs[vertex * 2] = uv.getX(vertex)
    uvs[vertex * 2 + 1] = uv.getY(vertex)
  }
  const indices = index ? Array.from({ length: index.count }, (_, cursor) => index.getX(cursor)) : null
  return fitToPanel(flatX, flatY, uvs, indices, panelSize, texSize)
}

