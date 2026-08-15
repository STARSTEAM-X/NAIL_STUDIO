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
  geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array([
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]), 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array([
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
  ]), 4))
  const bone = new Bone()
  const mesh = new SkinnedMesh(geometry)
  mesh.add(bone)
  mesh.bind(new Skeleton([bone]))
  return mesh
}

describe('refreshSkinnedBounds', () => {
  it('คำนวณ boundingSphere/boundingBox ใหม่ (ไม่ null หลังเรียก)', () => {
    const mesh = makeSkinnedMesh()
    expect(mesh.boundingSphere).toBeNull()
    expect(mesh.boundingBox).toBeNull()

    refreshSkinnedBounds([mesh])

    expect(mesh.boundingSphere).not.toBeNull()
    expect(mesh.boundingBox).not.toBeNull()
  })

  it('ทำงานกับ mesh หลายตัวในคราวเดียว', () => {
    const meshes = [makeSkinnedMesh(), makeSkinnedMesh()]
    expect(() => refreshSkinnedBounds(meshes)).not.toThrow()
    for (const mesh of meshes) expect(mesh.boundingSphere).not.toBeNull()
  })

  it('คำนวณ bounds จากตำแหน่ง vertex หลัง bone scale ไม่ใช่ geometry rest pose', () => {
    const mesh = makeSkinnedMesh()
    refreshSkinnedBounds([mesh])
    const beforeRadius = mesh.boundingSphere!.radius

    mesh.skeleton.bones[0]!.scale.setScalar(2)
    refreshSkinnedBounds([mesh])

    expect(mesh.boundingSphere!.radius).toBeGreaterThan(beforeRadius)
  })
})
