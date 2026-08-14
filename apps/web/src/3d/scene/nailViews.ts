import { Matrix3, Matrix4, Vector3, type Mesh, type SkinnedMesh } from 'three'
import { distanceForRadius, FRAME_FILL } from './cameraPresets.ts'
import { morphedNormal, morphedPosition } from './nailMorph.ts'

/**
 * กึ่งกลาง ทิศหน้า และรัศมีของเล็บหนึ่งชิ้นในพิกัดโลก — ข้อมูลที่กล้องต้องใช้เพื่อจ่อ
 */
export interface NailView {
  center: Vector3
  normal: Vector3
  radius: number
}

/** ตำแหน่งกล้องที่ทำให้เล็บชิ้นนี้กินเฟรมตามสัดส่วนที่กำหนด */
export function cameraForNail(view: NailView, fov: number, fill = FRAME_FILL): Vector3 {
  const distance = distanceForRadius(view.radius, fov, fill)
  return view.center.clone().addScaledVector(view.normal, distance)
}

/**
 * เมทริกซ์ที่พาจุดใน geometry ของเล็บไปยังตำแหน่งจริงในโลก (A-09)
 *
 * เมื่อโมเดลมี skinning ท่าจริงอยู่ในบอร์น ส่วน geometry ค้างอยู่ที่ท่า rest และ
 * mesh.matrixWorld เป็นแค่ transform ของ Armature ซึ่งไม่สะท้อนการ deform เลย
 * ถ้าใช้ matrixWorld ตรง ๆ กล้องจะบินไปจ่อตำแหน่งเล็บในท่า rest ซึ่งผิด
 *
 * เล็บทุกชิ้นผูกกับบอร์นเดียวเต็มน้ำหนัก การ deform จึงเป็น transform แบบแข็งล้วน
 * พับลงเหลือเมทริกซ์เดียวต่อเล็บได้ ไม่ต้องไล่คิดทีละจุด
 */
export function nailMatrix(mesh: Mesh): Matrix4 {
  const skinned = mesh as SkinnedMesh
  if (!skinned.isSkinnedMesh) return mesh.matrixWorld.clone()

  const indices = skinned.geometry.getAttribute('skinIndex')
  const weights = skinned.geometry.getAttribute('skinWeight')
  if (!indices || !weights) {
    throw new Error(`mesh ${mesh.name} เป็น SkinnedMesh แต่ไม่มีข้อมูลน้ำหนัก skin`)
  }

  let bound = -1
  for (let vertex = 0; vertex < indices.count; vertex += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      const weight = weights.getComponent(vertex, slot)
      if (weight < 1e-4) continue
      const index = indices.getComponent(vertex, slot)
      if (weight < 1 - 1e-3 || (bound !== -1 && bound !== index)) {
        throw new Error(
          `mesh ${mesh.name} ผูกกับหลายบอร์น — การพับเมทริกซ์รองรับแบบผูกบอร์นเดียวเท่านั้น`,
        )
      }
      bound = index
    }
  }
  if (bound === -1) throw new Error(`mesh ${mesh.name} ไม่ได้ผูกกับบอร์นใดเลย`)

  const bone = skinned.skeleton.bones[bound]
  if (!bone) throw new Error(`mesh ${mesh.name} อ้างถึงบอร์นที่ไม่มีอยู่ (${bound})`)
  const inverse = skinned.skeleton.boneInverses[bound]
  if (!inverse) throw new Error(`mesh ${mesh.name} ไม่มี boneInverse ของบอร์น ${bound}`)

  bone.updateWorldMatrix(true, false)
  return new Matrix4()
    .multiplyMatrices(skinned.matrixWorld, skinned.bindMatrixInverse)
    .multiply(bone.matrixWorld)
    .multiply(inverse)
    .multiply(skinned.bindMatrix)
}

export function nailViewOf(mesh: Mesh): NailView {
  mesh.updateWorldMatrix(true, false)
  // updateWorldMatrix อัปเดตแค่ matrixWorld ส่วน bindMatrixInverse (ซึ่ง nailMatrix ใช้)
  // ถูกคำนวณใหม่ใน SkinnedMesh.updateMatrixWorld เท่านั้น — คนละเมธอดกัน
  // ถ้า matrixWorld ขยับ (สไลเดอร์ขนาดมือตั้ง scale ที่ <primitive>) โดยยังไม่มีใคร
  // เรียก updateMatrixWorld ค่าสองตัวจะไม่ตรงกัน แล้วสเกลจะถูกนับซ้ำเงียบ ๆ
  const skinned = mesh as SkinnedMesh
  if (skinned.isSkinnedMesh) skinned.updateMatrixWorld(true)

  const matrix = nailMatrix(mesh)
  const position = mesh.geometry.getAttribute('position')
  const normalAttribute = mesh.geometry.getAttribute('normal')
  if (!position) throw new Error(`mesh ${mesh.name} ไม่มี position attribute`)
  if (!normalAttribute) throw new Error(`mesh ${mesh.name} ไม่มี normal attribute`)

  const centre = new Vector3()
  const point = new Vector3()
  for (let index = 0; index < position.count; index += 1) {
    centre.add(morphedPosition(mesh, index, point).applyMatrix4(matrix))
  }
  centre.divideScalar(position.count)

  // ต้องใช้ normal matrix ไม่ใช่การคูณเมทริกซ์ตรง ๆ เพราะสไลเดอร์สัดส่วนมือทำให้
  // สเกลไม่เท่ากันทุกแกน ซึ่งบิดทิศ normal ถ้าคูณด้วยเมทริกซ์เดียวกับตำแหน่ง
  const normalMatrix = new Matrix3().getNormalMatrix(matrix)
  const normal = new Vector3()
  const facing = new Vector3()
  for (let index = 0; index < normalAttribute.count; index += 1) {
    normal.add(
      morphedNormal(mesh, index, facing).applyMatrix3(normalMatrix).normalize(),
    )
  }
  if (normal.lengthSq() < 1e-12) {
    throw new Error(`mesh ${mesh.name} หา normal เฉลี่ยไม่ได้ (หักล้างกันหมด)`)
  }
  normal.normalize()

  let radius = 0
  for (let index = 0; index < position.count; index += 1) {
    const distance = morphedPosition(mesh, index, point)
      .applyMatrix4(matrix)
      .distanceTo(centre)
    if (distance > radius) radius = distance
  }

  return { center: centre, normal, radius }
}
