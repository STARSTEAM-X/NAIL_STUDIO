import type { Mesh, Object3D } from 'three'
import { FINGERS, nailKey, type Hand, type NailKey } from '@nail-studio/contracts'
import { collectBones, type HandBones } from './handBones.ts'

/** ชื่อ mesh ผิวมือที่ pipeline ตั้งให้ (tools/build_model.py: HAND_OUT) */
const SKIN_MESH_NAME = 'Hand'

export interface HandParts {
  /** มือที่ registry ชุดนี้แทนอยู่ — คีย์ของเล็บทั้งหมดขึ้นต้นด้วยค่านี้ */
  hand: Hand
  bones: HandBones
  /** ค้นเล็บจากคีย์ — O(1) ไม่ใช่การไล่ array ทุกครั้งที่ pointer ขยับ (A-12) */
  nails: Map<NailKey, Mesh>
  /** แผนที่ย้อนกลับ ใช้ตอน raycast แล้วได้ object กลับมาแล้วต้องรู้ว่าเป็นเล็บไหน */
  nailOf: Map<Object3D, NailKey>
  /** ทุก mesh ที่ไม่ใช่เล็บ — ต้องเข้า raycast ด้วยไม่งั้นนิ้วที่บังอยู่จะไม่บังจริง */
  occluders: Mesh[]
  skin: Mesh
}

/**
 * ชื่อ mesh จาก pipeline: Nail_index, Nail_little — สองท่อนเท่านั้น
 *
 * โมเดลมีมือเดียว (มือขวา) ส่วนมือซ้ายได้จากการกลับด้านโมเดลเดียวกัน ดังนั้น
 * mesh ชิ้นเดิมจึงแทนเล็บคนละคีย์ตามมือที่กำลังแสดงอยู่ — hand จึงเป็นพารามิเตอร์
 * ไม่ใช่ค่าที่อ่านได้จากชื่อ mesh
 */
function parseNailName(name: string, hand: Hand): NailKey | null {
  const parts = name.split('_')
  if (parts[0] !== 'Nail' || parts.length !== 2) return null
  const finger = FINGERS.find((candidate) => candidate === parts[1])
  return finger ? nailKey(hand, finger) : null
}

/**
 * เดิน scene ครั้งเดียวแล้วสร้างดัชนีไว้ใช้ตลอดอายุของฉาก
 *
 * ต้นทุน O(จำนวน object) ครั้งเดียวตอนโหลด แลกกับการค้นหา O(1) ทุกครั้งหลังจากนั้น
 * ซอร์สเดิมใช้ NAIL_IDS.find(...) ในเส้นทางของ pointermove ซึ่งเป็น O(n) ต่อครั้ง
 */
export function buildPartsRegistry(root: Object3D, hand: Hand): HandParts {
  const nails = new Map<NailKey, Mesh>()
  const nailOf = new Map<Object3D, NailKey>()
  const occluders: Mesh[] = []
  let skin: Mesh | null = null

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const key = parseNailName(mesh.name, hand)
    if (key) {
      // เล็บต้องวาดทับผิวนิ้วเสมอ ไม่งั้นขอบเล็บจะจมเข้าเนื้อตรงที่ผิวสัมผัสกันพอดี
      mesh.renderOrder = 10
      nails.set(key, mesh)
      nailOf.set(mesh, key)
      return
    }

    occluders.push(mesh)
    if (mesh.name === SKIN_MESH_NAME) skin = mesh
  })

  if (!skin) {
    throw new Error(`โมเดลขาด mesh ผิวมือชื่อ ${SKIN_MESH_NAME} — ตรวจไฟล์ hand.glb`)
  }
  if (nails.size !== FINGERS.length) {
    const missing = FINGERS.filter((finger) => !nails.has(nailKey(hand, finger)))
    throw new Error(`โมเดลขาด mesh เล็บ: ${missing.map((finger) => `Nail_${finger}`).join(', ')}`)
  }

  const bones = collectBones(root)

  return { hand, bones, nails, nailOf, occluders, skin }
}
