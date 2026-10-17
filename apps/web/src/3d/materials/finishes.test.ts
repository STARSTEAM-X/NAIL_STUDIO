import { describe, expect, it } from 'vitest'
import { CanvasTexture, MeshPhysicalMaterial, Texture } from 'three'
import { FINISHES, createEmptyDocument, designDocumentSchema } from '@nail-studio/contracts'
import { applyFinish, createNailMaterial, nailMaterialKey } from './finishes.ts'

describe('nail finishes', () => {
  it('โหลดเอกสารผิวมุก/ตาแมว และสลับกลับผิวเดิมโดยไม่มี shader feature ค้าง', () => {
    const material = new MeshPhysicalMaterial()
    const sparkle = new Texture()
    applyFinish(material, 'pearl', sparkle)
    expect(material.iridescence).toBeGreaterThan(0)
    applyFinish(material, 'cat_eye', sparkle)
    expect(material.iridescence).toBe(0)
    expect(material.anisotropy).toBeGreaterThan(0)
    expect(material.normalMap).toBe(sparkle)
    applyFinish(material, 'glossy', sparkle)
    expect(material.anisotropy).toBe(0)
    expect(material.iridescence).toBe(0)
    expect(material.normalMap).toBeNull()
    material.dispose(); sparkle.dispose()
  })

  it('ผิวทุกแบบ round-trip ผ่าน schema และมีคีย์ material แยกกัน', () => {
    const map = new CanvasTexture({} as HTMLCanvasElement)
    const keys = new Set<string>()
    const document = createEmptyDocument()
    for (const finish of FINISHES) {
      document.nails['right.index'].finish = finish
      expect(designDocumentSchema.parse(document).nails['right.index'].finish).toBe(finish)
      const material = createNailMaterial(map)
      applyFinish(material, finish, null)
      expect(Number.isFinite(material.roughness)).toBe(true)
      keys.add(nailMaterialKey(finish, map, null))
      material.dispose()
    }
    expect(keys.size).toBe(FINISHES.length)
    map.dispose()
  })
})
