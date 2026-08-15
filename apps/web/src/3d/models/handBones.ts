import { Bone, type Object3D } from 'three'
import { FINGERS, type Finger } from '@nail-studio/contracts'

const PALM_BONE = 'Palm'

/**
 * ชื่อรากของแต่ละ chain นิ้ว — thumb ใช้ Thumb2 ไม่ใช่ Thumb1 เพราะ Thumb1
 * เป็นใบไม้ข้างเคียงใน rig ไม่ใช่รากของ chain จริง (ยกจาก NailDesine-TEST)
 */
const FINGER_CHAIN_ROOTS: Record<Finger, string> = {
  thumb: 'Thumb2',
  index: 'Index1',
  middle: 'Middle1',
  ring: 'Ring1',
  little: 'Pinky1',
}

export interface HandBones {
  palm: Bone
  fingerRoots: Record<Finger, Bone>
}

function findBone(root: Object3D, name: string): Bone {
  let found: Bone | null = null
  root.traverse((object) => {
    if (found) return
    if ((object as Bone).isBone && object.name === name) found = object as Bone
  })
  if (!found) {
    throw new Error(`โมเดลขาดบอร์นชื่อ ${name} — ตรวจไฟล์ hand.glb ว่ายังคง armature ไว้หรือไม่`)
  }
  return found
}

/**
 * เดิน scene หาบอร์นรากของฝ่ามือและแต่ละนิ้ว — ใช้เป็นจุดตั้ง scale สำหรับสไลเดอร์
 * สัดส่วนมือ (handProportions.ts) throw ถ้าหาบอร์นไม่เจอ ตามแพทเทิร์นเดียวกับ
 * buildPartsRegistry ที่ throw เมื่อ mesh เล็บ/ผิวหาย
 */
export function collectBones(root: Object3D): HandBones {
  const palm = findBone(root, PALM_BONE)
  const fingerRoots = Object.fromEntries(
    FINGERS.map((finger) => [finger, findBone(root, FINGER_CHAIN_ROOTS[finger])]),
  ) as Record<Finger, Bone>
  return { palm, fingerRoots }
}
