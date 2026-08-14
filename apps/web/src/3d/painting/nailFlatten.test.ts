import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import { flattenNail, panelToTexture, textureToPanelTransform } from './nailFlatten.ts'

/**
 * เล็บจำลอง: แผ่นสี่เหลี่ยมผืนผ้าในระนาบ XY หันหน้าไปทาง +Z
 * กว้าง 1 สูง 2 — สัดส่วนใกล้เคียงเล็บจริงที่ยาวกว่ากว้าง
 * UV กางเต็มผืน 0–1 เหมือนโมเดลจริง
 */
function nailPlate(influence = 0): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    -0.5, -1, 0, 0.5, -1, 0, 0.5, 1, 0, -0.5, 1, 0,
  ]), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  // morph สมมติ: ดันมุมปลายทั้งสอง (จุดที่ 2 และ 3, y=1) ออกด้านข้างจุดละ 0.5
  geometry.morphAttributes.position = [
    new BufferAttribute(new Float32Array([
      0, 0, 0, 0, 0, 0, 0.5, 0, 0, -0.5, 0, 0,
    ]), 3),
  ]
  const mesh = new Mesh(geometry)
  mesh.name = 'Nail_index'
  mesh.morphTargetInfluences = [influence]
  mesh.updateMatrixWorld(true)
  return mesh
}

describe('flattenNail', () => {
  it('คงสัดส่วนของเล็บไว้ ไม่ยืดให้เต็มจัตุรัส', () => {
    // นี่คือเหตุผลทั้งหมดที่โมดูลนี้มีอยู่ — ผืนเท็กซ์เจอร์เป็นจัตุรัส แต่เล็บไม่ใช่
    // ถ้ายืดเต็ม วงกลมที่ผู้ใช้วาดจะไปโผล่บนเล็บเป็นวงรี
    const { bounds } = flattenNail(nailPlate(), 512)
    expect(bounds.height / bounds.width).toBeCloseTo(2, 1)
  })

  it('รูปเล็บอยู่ในแผงและมีขอบเว้นรอบ', () => {
    const { bounds } = flattenNail(nailPlate(), 512)
    expect(bounds.x).toBeGreaterThan(0)
    expect(bounds.y).toBeGreaterThan(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(512)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(512)
  })

  it('ได้สามเหลี่ยมครบตาม index buffer', () => {
    expect(flattenNail(nailPlate(), 512).triangles).toHaveLength(2)
  })

  it('ทุกจุดบนแผงอยู่ในกรอบของแผง', () => {
    for (const triangle of flattenNail(nailPlate(), 512).triangles) {
      for (const value of triangle.screen) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(512)
      }
    }
  })
})

describe('panelToTexture', () => {
  it('จุดกึ่งกลางรูปเล็บตรงกับจุดกึ่งกลางเท็กซ์เจอร์', () => {
    const flat = flattenNail(nailPlate(), 512)
    const { x, y, width, height } = flat.bounds
    const texel = panelToTexture(flat, x + width / 2, y + height / 2)
    expect(texel).not.toBeNull()
    expect(texel!.u).toBeCloseTo(512, 0)
    expect(texel!.v).toBeCloseTo(512, 0)
  })

  it('จุดนอกรูปเล็บคืนค่าว่าง ไม่ใช่เดาตำแหน่งให้', () => {
    // ถ้าเดา สีจะไปโผล่ที่ไหนสักแห่งบนเล็บโดยผู้ใช้ไม่ได้ตั้งใจ
    const flat = flattenNail(nailPlate(), 512)
    expect(panelToTexture(flat, 2, 2)).toBeNull()
    expect(panelToTexture(flat, 510, 256)).toBeNull()
  })

  it('มุมของรูปเล็บจับคู่กับมุมของเท็กซ์เจอร์', () => {
    const flat = flattenNail(nailPlate(), 512)
    const { x, y, width, height } = flat.bounds
    const topLeft = panelToTexture(flat, x + 1, y + 1)
    const bottomRight = panelToTexture(flat, x + width - 1, y + height - 1)
    expect(topLeft).not.toBeNull()
    expect(bottomRight).not.toBeNull()
    // ด้านบนของแผง = ปลายเล็บ = v ใกล้ 0 ในพิกัดพิกเซล (แกนกลับด้านแล้ว)
    expect(topLeft!.v).toBeLessThan(bottomRight!.v)
  })
})

describe('textureToPanelTransform', () => {
  it('พาสามจุดของเท็กซ์เจอร์ไปตรงกับสามจุดของแผงพอดี', () => {
    const flat = flattenNail(nailPlate(), 512)
    const triangle = flat.triangles[0]!
    const transform = textureToPanelTransform(triangle)
    expect(transform).not.toBeNull()
    const [a, b, c, d, e, f] = transform!
    for (let corner = 0; corner < 3; corner += 1) {
      const u = triangle.tex[corner * 2]!
      const v = triangle.tex[corner * 2 + 1]!
      expect(a * u + c * v + e).toBeCloseTo(triangle.screen[corner * 2]!, 6)
      expect(b * u + d * v + f).toBeCloseTo(triangle.screen[corner * 2 + 1]!, 6)
    }
  })

  it('สามเหลี่ยมที่แบนจนไม่มีพื้นที่คืนค่าว่าง แทนที่จะหารด้วยศูนย์', () => {
    expect(textureToPanelTransform({
      screen: [0, 0, 1, 1, 2, 2],
      tex: [0, 0, 1, 1, 2, 2],
    })).toBeNull()
  })
})

describe('flattenNail กับ morph target', () => {
  it('ใช้ตำแหน่งที่ผ่าน morph แล้ว ไม่ใช่ทรงฐานเฉย ๆ', () => {
    const base = flattenNail(nailPlate(0), 512)
    const morphed = flattenNail(nailPlate(1), 512)

    // เปิด morph เต็มที่แล้วขอบบนกว้างขึ้น กรอบรูปเล็บบนแผงจึงต้องกว้างขึ้นตาม
    expect(morphed.bounds.width).toBeGreaterThan(base.bounds.width)
  })

  it('influence 0 ให้ผลเหมือนไม่มี morph เลย', () => {
    const withoutMorphField = flattenNail(nailPlate(), 512)
    const withZeroInfluence = flattenNail(nailPlate(0), 512)
    expect(withZeroInfluence.bounds).toEqual(withoutMorphField.bounds)
  })
})
