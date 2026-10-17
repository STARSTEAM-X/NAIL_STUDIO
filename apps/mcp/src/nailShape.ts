import type { Finger, Nail } from '@nail-studio/contracts'
// ส่วนคำนวณชุดเดียวกับแผงวาด 2 มิติและโมเดลในเว็บ — ไม่พึ่ง three จึงรันบน node ได้
import { fitToPanel, type FlatNail } from '../../web/src/3d/painting/flatTriangles.ts'
import { nailMorphWeights } from '../../web/src/3d/models/nailMorphWeights.ts'
import { nailMeshes, type NailMeshData } from './glb.ts'

/**
 * เล็บหนึ่งนิ้วที่คลี่เป็นภาพแบน "ตามทรงจริง" — ทรง/ความยาวมาจาก morph target ชุดเดียวกับ
 * โมเดล 3 มิติ ลายที่ถูกยืดบนโมเดล (เช่นปลายเล็บ stiletto/extra) จึงยืดแบบเดียวกันในภาพนี้
 *
 * ต่างจาก flattenNail ของเว็บตรงแกนอ้างอิง: เว็บใช้แกนตั้งของโลกของมือที่จัดท่าแล้ว
 * ส่วนที่นี่ใช้ทิศของเล็บเอง (ทิศที่ v ลดลง = ไปทางปลายเล็บ) ทุกนิ้วจึงตั้งตรง ปลายเล็บอยู่บน
 * เสมอ ซึ่งเหมาะกับภาพตัวอย่างที่เรียงหลายนิ้วเทียบกัน (ตั้งใจให้ต่าง ไม่ใช่บั๊ก)
 */
export interface NailShapeView extends FlatNail {
  /** normal ต่อจุดยอดในกรอบภาพ: x ขวา, y ขึ้น, z ชี้หาผู้ดู */
  normals: Float32Array
  /** ดัชนีจุดยอดของสามเหลี่ยมผิวบน — triangles[i] ใช้จุด indices[3i..3i+2] */
  indices: Uint32Array
}

/**
 * แคชแบบจำกัดจำนวน (LRU) — ชิ้นหนึ่งราว 0.5 MB (2,048 สามเหลี่ยม) ชุดที่เป็นไปได้มีหลายร้อย
 * ถ้าไม่จำกัด service ที่รันนานจะกิน RAM ได้หลายร้อย MB
 */
const CACHE_LIMIT = 48
const cache = new Map<string, NailShapeView>()

/** ตำแหน่ง/normal ที่รวมผล morph แล้ว: ฐาน + Σ น้ำหนัก × delta */
function morphed(mesh: NailMeshData, shape: Nail['shape'], length: Nail['length']) {
  const weights = nailMorphWeights(mesh.targets.map((t) => t.name), shape, length)
  const positions = Float32Array.from(mesh.positions)
  const normals = Float32Array.from(mesh.normals)
  mesh.targets.forEach((target, t) => {
    const weight = weights[t]!
    if (!weight) return
    for (let i = 0; i < positions.length; i++) positions[i]! += target.positions[i]! * weight
    if (target.normals) for (let i = 0; i < normals.length; i++) normals[i]! += target.normals[i]! * weight
  })
  return { positions, normals }
}

type Vec3 = [number, number, number]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  if (length < 1e-12) throw new Error('nailShape: เวกเตอร์ยาวเป็นศูนย์ — โมเดลเล็บผิดรูป')
  return [v[0] / length, v[1] / length, v[2] / length]
}

/**
 * แกนของภาพ: n = normal เฉลี่ย (ชี้ออกนอกเล็บ), up = ทิศไปทางปลายเล็บบนระนาบนั้น
 * (ค่าเฉลี่ยถ่วงพื้นที่ UV ของ −∂P/∂v), right = up × n → ภาพที่มองจากนอกเล็บ
 */
function viewFrame(positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array) {
  const sum: Vec3 = [0, 0, 0]
  for (let i = 0; i < normals.length; i += 3) {
    sum[0] += normals[i]!
    sum[1] += normals[i + 1]!
    sum[2] += normals[i + 2]!
  }
  const n = normalize(sum)

  const toward: Vec3 = [0, 0, 0]
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]!
    const b = indices[t + 1]!
    const c = indices[t + 2]!
    const e1: Vec3 = [positions[b * 3]! - positions[a * 3]!, positions[b * 3 + 1]! - positions[a * 3 + 1]!, positions[b * 3 + 2]! - positions[a * 3 + 2]!]
    const e2: Vec3 = [positions[c * 3]! - positions[a * 3]!, positions[c * 3 + 1]! - positions[a * 3 + 1]!, positions[c * 3 + 2]! - positions[a * 3 + 2]!]
    const du1 = uvs[b * 2]! - uvs[a * 2]!
    const dv1 = uvs[b * 2 + 1]! - uvs[a * 2 + 1]!
    const du2 = uvs[c * 2]! - uvs[a * 2]!
    const dv2 = uvs[c * 2 + 1]! - uvs[a * 2 + 1]!
    const det = du1 * dv2 - du2 * dv1
    if (Math.abs(det) < 1e-12) continue
    // ∂P/∂v คูณพื้นที่ UV (|det|/2) — หาร det แล้วคูณ |det| เหลือแค่เครื่องหมาย
    const sign = det > 0 ? 0.5 : -0.5
    toward[0] -= (e2[0] * du1 - e1[0] * du2) * sign
    toward[1] -= (e2[1] * du1 - e1[1] * du2) * sign
    toward[2] -= (e2[2] * du1 - e1[2] * du2) * sign
  }
  const along = dot(toward, n)
  const up = normalize([toward[0] - n[0] * along, toward[1] - n[1] * along, toward[2] - n[2] * along])
  return { n, up, right: cross(up, n) }
}

/**
 * คลี่เล็บนิ้วนี้ตามทรง/ความยาว ให้พอดีแผงขนาด panelSize
 * mirror = กลับซ้ายขวา (ใช้กับมือซ้าย: editor มีแต่โมเดลมือขวา มือซ้ายจึงเป็นภาพกระจก)
 *
 * ความซับซ้อน: O(V·K + T) ครั้งแรก (V จุดยอด, K morph target, T สามเหลี่ยม) แล้วแคช —
 * ชุดที่เป็นไปได้มีจำกัด (5 นิ้ว × 5 ทรง × 4 ความยาว × ขนาดแผง × กลับ/ไม่กลับ)
 */
export function flatNailFor(
  finger: Finger,
  shape: Nail['shape'],
  length: Nail['length'],
  panelSize: number,
  texSize: number,
  mirror = false,
): NailShapeView {
  const key = `${finger}|${shape}|${length}|${panelSize}|${texSize}|${mirror}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  const mesh = nailMeshes().get(finger)!
  const { positions, normals } = morphed(mesh, shape, length)
  const { n, up, right } = viewFrame(positions, normals, mesh.uvs, mesh.indices)
  const side = mirror ? -1 : 1

  const vertexCount = positions.length / 3
  const flatX = new Float64Array(vertexCount)
  const flatY = new Float64Array(vertexCount)
  const viewNormals = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    const p: Vec3 = [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!]
    flatX[i] = dot(p, right) * side
    // แกน y ของแคนวาสชี้ลง จึงกลับด้านให้ปลายเล็บอยู่ด้านบน
    flatY[i] = -dot(p, up)
    const normal: Vec3 = [normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!]
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
    viewNormals[i * 3] = (dot(normal, right) / length) * side
    viewNormals[i * 3 + 1] = dot(normal, up) / length
    viewNormals[i * 3 + 2] = dot(normal, n) / length
  }

  // เล็บบางนิ้ว (โป้ง กลาง ก้อย) เป็นเปลือกปิดที่มีผิวล่างใช้ UV ชุดเดียวกับผิวบน — ถ้าเก็บไว้
  // สามเหลี่ยมผิวล่างจะทับผิวบนบนภาพแบน: แสงกลายเป็นตารางมืดสว่างสลับกัน และการหาตำแหน่ง
  // จาก UV อาจได้จุดบนผิวล่าง จึงเก็บเฉพาะสามเหลี่ยมที่หันหาผู้ดู (normal เฉลี่ยมี z > 0)
  const front: number[] = []
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!
    const b = mesh.indices[t + 1]!
    const c = mesh.indices[t + 2]!
    if (viewNormals[a * 3 + 2]! + viewNormals[b * 3 + 2]! + viewNormals[c * 3 + 2]! > 0) front.push(a, b, c)
  }
  const indices = Uint32Array.from(front)

  const view: NailShapeView = {
    ...fitToPanel(flatX, flatY, mesh.uvs, indices, panelSize, texSize),
    normals: viewNormals,
    indices,
  }
  cache.set(key, view)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return view
}
