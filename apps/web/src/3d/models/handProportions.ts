import type { SkinnedMesh } from 'three'
import { FINGERS, type HandSettings } from '@nail-studio/contracts'
import type { HandBones } from './handBones.ts'

/**
 * ตั้ง scale เฉพาะที่บอร์นราก (Palm + รากนิ้วแต่ละนิ้ว) เท่านั้น — scale สืบทอด
 * ลงบอร์นลูกอัตโนมัติใน three.js ตั้งทุกข้อต่อจะทบเป็นกำลังสูงขึ้นเรื่อย ๆ
 *
 * fingerWidth หารด้วย palmWidth ออก เพราะบอร์นรากนิ้วเป็นลูกของ Palm ใน
 * hierarchy — ถ้าไม่หารออก การขยาย palmWidth จะทำให้นิ้วอ้วนขึ้นไปด้วยโดยไม่ตั้งใจ
 *
 * สมมติฐาน: rest-pose scale ของ Palm และรากนิ้วทุกตัวใน hand.glb เป็น 1.0 พอดี
 * ฟังก์ชันนี้เขียนทับ scale แบบ absolute ไม่ใช่คูณสะสมจากค่าปัจจุบัน
 */
export function applyProportions(bones: HandBones, proportions: HandSettings['proportions']): void {
  const { palmWidth, fingerLength, fingerWidth } = proportions
  bones.palm.scale.set(palmWidth, 1, palmWidth)
  const fingerScale = fingerWidth / palmWidth
  for (const finger of FINGERS) {
    bones.fingerRoots[finger].scale.set(fingerScale, fingerLength, fingerScale)
  }
}

/**
 * รีเฟรช bounding volume ของ mesh ที่ผูก skeleton หลังสเกลบอร์นเปลี่ยน
 *
 * three.js แคช boundingSphere/boundingBox ไว้ที่ geometry ไม่รู้ตัวว่าบอร์น
 * ขยับ ถ้าไม่เรียกฟังก์ชันนี้ raycast วาดสี (picking.ts) และ frustum culling
 * จะใช้ bounding เดิมที่ผิดไปแล้วเงียบ ๆ ไม่มี error ให้เห็น
 */
export function refreshSkinnedBounds(meshes: readonly SkinnedMesh[]): void {
  for (const mesh of meshes) {
    for (const bone of mesh.skeleton.bones) bone.updateWorldMatrix(true, false)
    mesh.updateMatrixWorld(true)
    mesh.geometry.computeBoundingSphere()
    mesh.geometry.computeBoundingBox()
  }
}
