import { describe, expect, it } from 'vitest'
import { Bone, Group } from 'three'
import { collectBones } from './handBones.ts'

const CHAIN_BONE_NAMES = ['Palm', 'Thumb2', 'Index1', 'Middle1', 'Ring1', 'Pinky1']

function makeSkeleton(names: string[]): Group {
  const root = new Group()
  for (const name of names) {
    const bone = new Bone()
    bone.name = name
    root.add(bone)
  }
  return root
}

describe('collectBones', () => {
  it('จับบอร์นครบ 6 ตัว (ฝ่ามือ + รากนิ้ว 5 นิ้ว)', () => {
    const bones = collectBones(makeSkeleton(CHAIN_BONE_NAMES))
    expect(bones.palm.name).toBe('Palm')
    expect(bones.fingerRoots.thumb.name).toBe('Thumb2')
    expect(bones.fingerRoots.index.name).toBe('Index1')
    expect(bones.fingerRoots.middle.name).toBe('Middle1')
    expect(bones.fingerRoots.ring.name).toBe('Ring1')
    expect(bones.fingerRoots.little.name).toBe('Pinky1')
  })

  it('โยนข้อผิดพลาดที่ระบุชื่อบอร์นที่หาย เมื่อขาดบอร์นใดบอร์นหนึ่ง', () => {
    const names = CHAIN_BONE_NAMES.filter((name) => name !== 'Thumb2')
    expect(() => collectBones(makeSkeleton(names))).toThrow(/Thumb2/)
  })

  it('โยนข้อผิดพลาดเมื่อขาดบอร์น Palm', () => {
    const names = CHAIN_BONE_NAMES.filter((name) => name !== 'Palm')
    expect(() => collectBones(makeSkeleton(names))).toThrow(/Palm/)
  })

  it('ไม่สับสนกับ Object3D ธรรมดาที่ชื่อซ้ำกัน (ต้องเป็น Bone จริง)', () => {
    const root = new Group()
    root.name = 'Palm'
    expect(() => collectBones(root)).toThrow(/Palm/)
  })
})
