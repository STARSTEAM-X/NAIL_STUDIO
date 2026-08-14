import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three'
import { morphedNormal, morphedPosition } from './nailMorph.ts'

function meshWithOneMorphTarget(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0, 1, 0, 0,
  ]), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1,
  ]), 3))
  geometry.morphAttributes.position = [
    new BufferAttribute(new Float32Array([0, 0, 0, 0, 5, 0]), 3),
  ]
  geometry.morphAttributes.normal = [
    new BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0]), 3),
  ]
  const mesh = new Mesh(geometry)
  mesh.morphTargetInfluences = [0]
  return mesh
}

describe('morphedPosition', () => {
  it('คืนตำแหน่งฐานตรง ๆ เมื่อ influence เป็นศูนย์', () => {
    const mesh = meshWithOneMorphTarget()
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 0, 0])
  })

  it('บวก delta ตาม influence เมื่อเปิด target', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 1
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 5, 0])
  })

  it('คูณ delta ตามน้ำหนัก influence เศษส่วน', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 0.5
    const out = morphedPosition(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([1, 2.5, 0])
  })

  it('ไม่พังเมื่อ mesh ไม่มี morph เลย', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([1, 2, 3]), 3))
    const mesh = new Mesh(geometry)
    const out = morphedPosition(mesh, 0, new Vector3())
    expect(out.toArray()).toEqual([1, 2, 3])
  })
})

describe('morphedNormal', () => {
  it('บวก delta ของ normal ตาม influence', () => {
    const mesh = meshWithOneMorphTarget()
    mesh.morphTargetInfluences![0] = 1
    const out = morphedNormal(mesh, 1, new Vector3())
    expect(out.toArray()).toEqual([0, 1, 1])
  })
})
