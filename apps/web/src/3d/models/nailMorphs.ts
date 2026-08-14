import type { Mesh } from 'three'
import type { Nail } from '@nail-studio/contracts'

/**
 * ตั้งค่า `morphTargetInfluences` ของ mesh เล็บให้ตรงกับทรง/ความยาวที่เลือก
 *
 * ทรงกับความยาวมาจาก shape key คนละชุดที่บวกกันได้ (ไม่ใช่ทางแยกที่ต้องเลือกอย่างใด
 * อย่างหนึ่ง) เพราะ `hand.glb` ถูกสร้างให้ delta ของ morph เป็นเวกเตอร์ที่บวกกันตรง ๆ
 * (ดูสเปก D-A2) — `round`/`medium` เป็นทรงฐาน ไม่มี target ของตัวเอง จึงไม่เปิดอะไรเลย
 */
export function applyNailMorphs(mesh: Mesh, shape: Nail['shape'], length: Nail['length']): void {
  const dictionary = mesh.morphTargetDictionary
  const count = mesh.geometry.morphAttributes.position?.length ?? 0
  if (!dictionary || count === 0) return

  const influences = mesh.morphTargetInfluences?.length === count
    ? mesh.morphTargetInfluences
    : new Array(count).fill(0)
  influences.fill(0)

  if (shape !== 'round') {
    const index = dictionary[shape]
    if (index !== undefined) influences[index] = 1
  }
  if (length !== 'medium') {
    const index = dictionary[length]
    if (index !== undefined) influences[index] = 1
  }

  mesh.morphTargetInfluences = influences
}
