import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FINGERS, type Finger } from '@nail-studio/contracts'

/**
 * อ่าน mesh เล็บจาก hand.glb ตัวเดียวกับที่เว็บโหลด — เฉพาะข้อมูลที่ภาพตัวอย่างต้องใช้
 *
 * ไม่ใช้ GLTFLoader ของ three เพราะ MCP ไม่มี three (และไม่ต้องการ scene graph) ไฟล์นี้
 * ไม่ถูกบีบอัด (Draco/meshopt) จึงอ่าน accessor ตรง ๆ ได้ ถ้าวันหนึ่ง build โมเดลแบบบีบอัด
 * ตัวอ่านจะ throw พร้อมบอกสาเหตุ แทนที่จะได้รูปทรงผิดเงียบ ๆ
 *
 * ความซับซ้อน: O(ขนาดไฟล์) ครั้งเดียวต่อ process แล้วเก็บไว้
 */

export interface MorphTargetData {
  name: string
  positions: Float32Array
  normals: Float32Array | null
}

export interface NailMeshData {
  finger: Finger
  /** xyz ต่อจุดยอด (หน่วยเดียวกับโลก เมื่อ handScale = 1) */
  positions: Float32Array
  normals: Float32Array
  /** uv ต่อจุดยอด (v ตามเอกสาร: 0 = ปลายเล็บ) */
  uvs: Float32Array
  indices: Uint32Array
  targets: MorphTargetData[]
}

const GLB_PATH = fileURLToPath(new URL('../../web/public/models/hand.glb', import.meta.url))

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const COMPONENT_BYTES: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }

interface Accessor {
  bufferView?: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  sparse?: {
    count: number
    indices: { bufferView: number; byteOffset?: number; componentType: number }
    values: { bufferView: number; byteOffset?: number }
  }
}

interface Gltf {
  extensionsRequired?: string[]
  nodes: { name?: string; mesh?: number }[]
  meshes: {
    extras?: { targetNames?: string[] }
    primitives: {
      attributes: Record<string, number>
      indices?: number
      targets?: Record<string, number>[]
    }[]
  }[]
  accessors: Accessor[]
  bufferViews: { byteOffset?: number; byteStride?: number }[]
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5126: return view.getFloat32(offset, true)
    case 5125: return view.getUint32(offset, true)
    case 5123: return view.getUint16(offset, true)
    case 5121: return view.getUint8(offset)
    default: throw new Error(`hand.glb: ไม่รองรับ componentType ${componentType}`)
  }
}

/** อ่าน accessor เป็น Float64 แบบเรียงชิด (รองรับ byteStride และ sparse) */
function readAccessor(gltf: Gltf, binary: DataView, index: number): Float64Array {
  const accessor = gltf.accessors[index]
  if (!accessor) throw new Error(`hand.glb: ไม่มี accessor ${index}`)
  const components = COMPONENTS[accessor.type]
  const bytes = COMPONENT_BYTES[accessor.componentType]
  if (!components || !bytes) throw new Error(`hand.glb: ไม่รองรับ accessor ชนิด ${accessor.type}/${accessor.componentType}`)
  const out = new Float64Array(accessor.count * components)

  if (accessor.bufferView !== undefined) {
    const view = gltf.bufferViews[accessor.bufferView]!
    const stride = view.byteStride ?? components * bytes
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    for (let item = 0; item < accessor.count; item++) {
      for (let c = 0; c < components; c++) {
        out[item * components + c] = readComponent(binary, start + item * stride + c * bytes, accessor.componentType)
      }
    }
  }

  // sparse: ค่าเริ่มต้นเป็น 0 (หรือจาก bufferView ด้านบน) แล้วทับเฉพาะจุดที่ระบุ
  // morph target ทุกตัวในไฟล์นี้เก็บแบบนี้ — จุดที่ไม่ขยับไม่ถูกเก็บ
  const sparse = accessor.sparse
  if (sparse) {
    const indexView = gltf.bufferViews[sparse.indices.bufferView]!
    const valueView = gltf.bufferViews[sparse.values.bufferView]!
    const indexStart = (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0)
    const valueStart = (valueView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0)
    const indexBytes = COMPONENT_BYTES[sparse.indices.componentType]
    if (!indexBytes) throw new Error(`hand.glb: ไม่รองรับ sparse index ${sparse.indices.componentType}`)
    for (let k = 0; k < sparse.count; k++) {
      const item = readComponent(binary, indexStart + k * indexBytes, sparse.indices.componentType)
      if (item >= accessor.count) throw new Error('hand.glb: sparse index เกินจำนวนจุดยอด')
      for (let c = 0; c < components; c++) {
        out[item * components + c] = readComponent(binary, valueStart + (k * components + c) * bytes, accessor.componentType)
      }
    }
  }
  return out
}

/** แยก GLB เป็น JSON + BIN chunk — export ไว้ให้เทสใช้ไฟล์จริง */
export function parseNailMeshes(buffer: Buffer): Map<Finger, NailMeshData> {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('hand.glb: ไม่ใช่ไฟล์ GLB')
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf
  if (gltf.extensionsRequired?.length) {
    throw new Error(`hand.glb: ต้องใช้ extension ${gltf.extensionsRequired.join(', ')} ซึ่งตัวอ่านของ MCP ไม่รองรับ`)
  }
  const binStart = 20 + jsonLength + 8
  const binLength = buffer.readUInt32LE(20 + jsonLength)
  const binary = new DataView(buffer.buffer, buffer.byteOffset + binStart, binLength)

  const meshes = new Map<Finger, NailMeshData>()
  for (const node of gltf.nodes) {
    const match = /^Nail_(\w+)$/.exec(node.name ?? '')
    if (!match || node.mesh === undefined) continue
    const finger = match[1] as Finger
    if (!FINGERS.includes(finger)) continue
    const mesh = gltf.meshes[node.mesh]!
    const primitive = mesh.primitives[0]!
    const attribute = (name: string): number => {
      const index = primitive.attributes[name]
      if (index === undefined) throw new Error(`hand.glb: Nail_${finger} ไม่มี ${name}`)
      return index
    }
    const positions = Float32Array.from(readAccessor(gltf, binary, attribute('POSITION')))
    const vertexCount = positions.length / 3
    const indices = primitive.indices === undefined
      ? Uint32Array.from({ length: vertexCount }, (_, i) => i)
      : Uint32Array.from(readAccessor(gltf, binary, primitive.indices))
    const names = mesh.extras?.targetNames ?? []
    const targets = (primitive.targets ?? []).map((target, i) => {
      if (target.POSITION === undefined) throw new Error(`hand.glb: morph ${i} ของ Nail_${finger} ไม่มี POSITION`)
      return {
        name: names[i] ?? `target-${i}`,
        positions: Float32Array.from(readAccessor(gltf, binary, target.POSITION)),
        normals: target.NORMAL === undefined ? null : Float32Array.from(readAccessor(gltf, binary, target.NORMAL)),
      }
    })
    meshes.set(finger, {
      finger,
      positions,
      normals: Float32Array.from(readAccessor(gltf, binary, attribute('NORMAL'))),
      uvs: Float32Array.from(readAccessor(gltf, binary, attribute('TEXCOORD_0'))),
      indices,
      targets,
    })
  }
  for (const finger of FINGERS) {
    if (!meshes.has(finger)) throw new Error(`hand.glb: ไม่พบ mesh Nail_${finger}`)
  }
  return meshes
}

let cached: Map<Finger, NailMeshData> | null = null

/** mesh เล็บทั้ง 5 นิ้ว (อ่านไฟล์ครั้งแรกครั้งเดียว) */
export function nailMeshes(): Map<Finger, NailMeshData> {
  if (!cached) cached = parseNailMeshes(readFileSync(GLB_PATH))
  return cached
}
