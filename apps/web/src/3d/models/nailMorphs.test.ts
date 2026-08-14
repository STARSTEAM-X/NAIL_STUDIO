import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import { applyNailMorphs } from './nailMorphs.ts'

const TARGET_ORDER = ['almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra']

function meshWithMorphs(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3))
  geometry.morphAttributes.position = TARGET_ORDER.map(
    () => new BufferAttribute(new Float32Array([0, 0, 0]), 3),
  )
  const mesh = new Mesh(geometry)
  mesh.morphTargetDictionary = Object.fromEntries(TARGET_ORDER.map((name, index) => [name, index]))
  return mesh
}

describe('applyNailMorphs', () => {
  it('ไม่เปิด target ใดเลยเมื่อเป็นทรงมนความยาวกลาง (ฐาน)', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'round', 'medium')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('เปิด target ของทรงที่เลือก', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'stiletto', 'medium')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 1, 0, 0, 0])
  })

  it('เปิด target ของความยาวที่เลือก', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'round', 'long')
    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0, 0, 0, 1, 0])
  })

  it('เปิดทั้งทรงและความยาวพร้อมกันได้ (บวกกัน ไม่ทับกัน)', () => {
    const mesh = meshWithMorphs()
    applyNailMorphs(mesh, 'square', 'extra')
    expect(mesh.morphTargetInfluences).toEqual([0, 1, 0, 0, 0, 0, 1])
  })

  it('ไม่พังถ้า mesh ไม่มี morphTargetDictionary', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3))
    const mesh = new Mesh(geometry)
    expect(() => applyNailMorphs(mesh, 'almond', 'short')).not.toThrow()
  })
})
