import type { BufferAttribute, Mesh, Vector3 } from 'three'

/**
 * ตำแหน่ง/normal ของจุดยอดหนึ่งจุด **รวมผลของ morph target ที่เปิดอยู่แล้ว**
 *
 * three.js ไม่มีฟังก์ชันสำเร็จรูปให้อ่านค่าที่รวม morph แล้วจาก CPU (การรวมเกิดบน GPU
 * ตอนวาดเท่านั้น) โค้ดที่ต้องรู้ตำแหน่งจริงของเล็บฝั่ง CPU — nailViews.ts (จ่อกล้อง)
 * และ nailFlatten.ts (คลี่ผิวให้แผงวาด 2 มิติ) — จึงต้องรวมเองตรงนี้ ไม่งั้นทั้งสอง
 * จะอ่านทรงฐาน (round) เสมอ ไม่ว่าผู้ใช้จะเลือกทรงอะไรไว้จริง
 */
export function morphedPosition(mesh: Mesh, index: number, out: Vector3): Vector3 {
  out.fromBufferAttribute(mesh.geometry.getAttribute('position') as BufferAttribute, index)
  addMorphDelta(mesh.geometry.morphAttributes.position, mesh.morphTargetInfluences, index, out)
  return out
}

export function morphedNormal(mesh: Mesh, index: number, out: Vector3): Vector3 {
  out.fromBufferAttribute(mesh.geometry.getAttribute('normal') as BufferAttribute, index)
  addMorphDelta(mesh.geometry.morphAttributes.normal, mesh.morphTargetInfluences, index, out)
  return out
}

function addMorphDelta(
  targets: BufferAttribute[] | undefined,
  influences: number[] | undefined,
  index: number,
  out: Vector3,
): void {
  if (!targets || !influences) return
  for (let target = 0; target < influences.length; target += 1) {
    const weight = influences[target]
    if (!weight) continue
    const delta = targets[target]
    if (!delta) continue
    out.x += delta.getX(index) * weight
    out.y += delta.getY(index) * weight
    out.z += delta.getZ(index) * weight
  }
}
