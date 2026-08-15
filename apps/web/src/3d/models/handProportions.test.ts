import { describe, expect, it } from 'vitest'
import { Bone, BufferAttribute, BufferGeometry, Skeleton, SkinnedMesh } from 'three'
import type { Finger } from '@nail-studio/contracts'
import type { HandBones } from './handBones.ts'
import { applyProportions, refreshSkinnedBounds } from './handProportions.ts'

const FINGERS: Finger[] = ['thumb', 'index', 'middle', 'ring', 'little']

function makeBones(): HandBones {
  const palm = new Bone()
  palm.name = 'Palm'
  const fingerRoots = Object.fromEntries(FINGERS.map((finger) => {
    const bone = new Bone()
    bone.name = finger
    palm.add(bone)
    return [finger, bone]
  })) as Record<Finger, Bone>
  return { palm, fingerRoots }
}

describe('applyProportions', () => {
  it('ตั้ง scale ของ Palm ตาม palmWidth บนแกน x/z เท่านั้น แกน y คงที่ 1', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1.3, fingerLength: 1, fingerWidth: 1 })
    expect(bones.palm.scale.x).toBeCloseTo(1.3)
    expect(bones.palm.scale.y).toBeCloseTo(1)
    expect(bones.palm.scale.z).toBeCloseTo(1.3)
  })

  it('ตั้ง scale ของรากนิ้วโดยหาร palmWidth ออก เพื่อไม่ให้นิ้วอ้วนขึ้นตามฝ่ามือ', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1.3, fingerLength: 1, fingerWidth: 1 })
    // fingerWidth(1) / palmWidth(1.3) ≈ 0.7692
    expect(bones.fingerRoots.index.scale.x).toBeCloseTo(1 / 1.3, 4)
    expect(bones.fingerRoots.index.scale.z).toBeCloseTo(1 / 1.3, 4)
    expect(bones.fingerRoots.index.scale.y).toBeCloseTo(1)
  })

  it('fingerLength ตั้งเฉพาะแกน y ของรากนิ้ว', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1, fingerLength: 0.85, fingerWidth: 1 })
    expect(bones.fingerRoots.thumb.scale.y).toBeCloseTo(0.85)
    expect(bones.fingerRoots.thumb.scale.x).toBeCloseTo(1)
  })

  it('ค่าตั้งต้นทั้งหมด = 1 ทำให้ scale ทุกบอร์นเป็น 1 (ไม่เปลี่ยนรูป)', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 })
    expect(bones.palm.scale.x).toBeCloseTo(1)
    for (const finger of FINGERS) {
      expect(bones.fingerRoots[finger].scale.x).toBeCloseTo(1)
      expect(bones.fingerRoots[finger].scale.y).toBeCloseTo(1)
    }
  })
})

function makeSkinnedMesh(): SkinnedMesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  const bone = new Bone()
  const mesh = new SkinnedMesh(geometry)
  mesh.bind(new Skeleton([bone]))
  return mesh
}

describe('refreshSkinnedBounds', () => {
  it('คำนวณ boundingSphere/boundingBox ใหม่ (ไม่ null หลังเรียก)', () => {
    const mesh = makeSkinnedMesh()
    expect(mesh.geometry.boundingSphere).toBeNull()
    expect(mesh.geometry.boundingBox).toBeNull()

    refreshSkinnedBounds([mesh])

    expect(mesh.geometry.boundingSphere).not.toBeNull()
    expect(mesh.geometry.boundingBox).not.toBeNull()
  })

  it('ทำงานกับ mesh หลายตัวในคราวเดียว', () => {
    const meshes = [makeSkinnedMesh(), makeSkinnedMesh()]
    expect(() => refreshSkinnedBounds(meshes)).not.toThrow()
    for (const mesh of meshes) expect(mesh.geometry.boundingSphere).not.toBeNull()
  })
})
