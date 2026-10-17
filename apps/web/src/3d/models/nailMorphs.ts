import type { Mesh } from 'three'
import type { Nail } from '@nail-studio/contracts'
import { nailMorphWeights } from './nailMorphWeights.ts'

/**
 * ตั้งค่า `morphTargetInfluences` ของ mesh เล็บให้ตรงกับทรง/ความยาวที่เลือก
 *
 * กฎการเลือกน้ำหนักอยู่ที่ nailMorphWeights.ts (ใช้ร่วมกับภาพตัวอย่างของ MCP)
 */
export function applyNailMorphs(mesh: Mesh, shape: Nail['shape'], length: Nail['length']): void {
  const dictionary = mesh.morphTargetDictionary
  const count = mesh.geometry.morphAttributes.position?.length ?? 0
  if (!dictionary || count === 0) return

  const influences = mesh.morphTargetInfluences?.length === count
    ? mesh.morphTargetInfluences
    : new Array(count).fill(0)
  const names: string[] = new Array(count).fill('')
  for (const [name, index] of Object.entries(dictionary)) {
    if (index < count) names[index] = name
  }
  nailMorphWeights(names, shape, length).forEach((weight, index) => { influences[index] = weight })

  mesh.morphTargetInfluences = influences
}
