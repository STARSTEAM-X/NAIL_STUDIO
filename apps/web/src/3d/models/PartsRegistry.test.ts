import { describe, expect, it } from 'vitest'
import { Bone, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { FINGERS } from '@nail-studio/contracts'
import { buildPartsRegistry } from './PartsRegistry.ts'

/**
 * ทดสอบด้วย scene graph ของ three.js จริง แต่ไม่ต้องมี WebGL
 *
 * เป็นเหตุผลที่ PartsRegistry ถูกแยกออกมาจาก component — ตรรกะการจับชิ้นส่วน
 * ทดสอบได้ใน Node ล้วน ไม่ต้องเปิดเบราว์เซอร์
 */
function makeMesh(name: string): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial())
  mesh.name = name
  return mesh
}

const ALL_NAILS = FINGERS.map((finger) => `Nail_${finger}`)

function makeHand(names: string[]): Group {
  const group = new Group()
  for (const name of names) group.add(makeMesh(name))
  return group
}

const CHAIN_BONE_NAMES = ['Palm', 'Thumb2', 'Index1', 'Middle1', 'Ring1', 'Pinky1']

function makeHandWithBones(meshNames: string[]): Group {
  const group = makeHand(meshNames)
  for (const name of CHAIN_BONE_NAMES) {
    const bone = new Bone()
    bone.name = name
    group.add(bone)
  }
  return group
}

describe('buildPartsRegistry', () => {
  it('จับเล็บครบห้านิ้วและแยกผิวมือออกจากเล็บ', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'right')

    expect(registry.nails.size).toBe(5)
    expect(registry.skin.name).toBe('Hand')
    expect(registry.nails.has('right.index')).toBe(true)
    expect(registry.nails.has('right.little')).toBe(true)
  })

  it('mesh ชุดเดียวกันให้คีย์ของมือที่ระบุ — มือซ้ายมาจากการกลับด้านโมเดลเดิม', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'left')
    expect([...registry.nails.keys()].every((key) => key.startsWith('left.'))).toBe(true)
    expect(registry.hand).toBe('left')
  })

  it('สร้างแผนที่ย้อนกลับจาก object เป็นคีย์เล็บ', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'right')
    const mesh = registry.nails.get('right.index')

    expect(mesh).toBeDefined()
    // ใช้ตอน raycast: ได้ object กลับมาแล้วต้องรู้ว่าเป็นเล็บนิ้วไหนใน O(1)
    expect(registry.nailOf.get(mesh!)).toBe('right.index')
  })

  it('นับ mesh ที่ไม่ใช่เล็บเป็น occluder รวมถึงผิวมือด้วย', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', 'Sleeve', ...ALL_NAILS]), 'right')

    // ผิวมือต้องอยู่ใน occluder ด้วย ไม่งั้นนิ้วที่บังอยู่จะไม่บังจริง
    // แล้วสีจะทะลุไปลงเล็บที่มองไม่เห็น (PaintController.tsx:35 ของซอร์สเดิม)
    expect(registry.occluders.map((mesh) => mesh.name).sort()).toEqual(['Hand', 'Sleeve'])
  })

  it('ตั้ง renderOrder ให้เล็บวาดทับผิวนิ้ว', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'right')
    expect(registry.nails.get('right.index')?.renderOrder).toBe(10)
  })

  it('ชื่อที่ไม่ตรงรูปแบบ Nail_<นิ้ว> ถูกนับเป็น occluder ไม่ใช่เล็บ', () => {
    const registry = buildPartsRegistry(
      makeHandWithBones(['Hand', ...ALL_NAILS, 'Nail_index_extra', 'Nail_unknown', 'NailIndex']),
      'right',
    )
    expect(registry.nails.size).toBe(5)
    expect(registry.occluders.map((mesh) => mesh.name).sort()).toEqual([
      'Hand',
      'NailIndex',
      'Nail_index_extra',
      'Nail_unknown',
    ])
  })

  it('โยนข้อผิดพลาดที่อ่านเข้าใจได้เมื่อโมเดลขาดผิวมือ', () => {
    expect(() => buildPartsRegistry(makeHand(ALL_NAILS), 'right')).toThrow(/ผิวมือ/)
  })

  it('โยนข้อผิดพลาดที่ระบุชื่อนิ้วที่ขาดไป เมื่อโมเดลมีเล็บไม่ครบ', () => {
    // ปล่อยให้โหลดแบบขาดนิ้วไม่ได้ ไม่งั้นผู้ใช้จะวาดนิ้วนั้นไม่ได้โดยไม่มีคำอธิบาย
    expect(() => buildPartsRegistry(makeHand(['Hand', 'Nail_index']), 'right'))
      .toThrow(/Nail_thumb/)
  })

  it('เก็บบอร์นฝ่ามือ+รากนิ้วไว้ใน bones สำหรับสไลเดอร์สัดส่วนมือ', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'right')
    expect(registry.bones.palm.name).toBe('Palm')
    expect(registry.bones.fingerRoots.index.name).toBe('Index1')
  })

  it('โยนข้อผิดพลาดเมื่อโมเดลขาดบอร์นที่จำเป็นสำหรับสัดส่วนมือ', () => {
    const hand = makeHand(['Hand', ...ALL_NAILS]) // ไม่มี bones เลย
    expect(() => buildPartsRegistry(hand, 'right')).toThrow(/Palm/)
  })
})
