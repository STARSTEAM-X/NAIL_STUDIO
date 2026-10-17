import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FINGERS, NAIL_LENGTHS, NAIL_SHAPES } from '@nail-studio/contracts'
import { textureToPanel } from '../../web/src/3d/painting/flatTriangles.ts'
import { nailMeshes, parseNailMeshes } from './glb.ts'
import { flatNailFor } from './nailShape.ts'

const TARGETS = ['almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra']

describe('glb', () => {
  it('อ่านเล็บครบ 5 นิ้ว พร้อม morph target 7 ตัวตามชื่อและลำดับ', () => {
    const meshes = nailMeshes()
    expect([...meshes.keys()].sort()).toEqual([...FINGERS].sort())
    for (const mesh of meshes.values()) {
      const vertices = mesh.positions.length / 3
      expect(mesh.normals.length).toBe(vertices * 3)
      expect(mesh.uvs.length).toBe(vertices * 2)
      expect(mesh.indices.length % 3).toBe(0)
      expect(Math.max(...mesh.indices)).toBeLessThan(vertices)
      expect(mesh.targets.map((t) => t.name)).toEqual(TARGETS)
      // morph ในไฟล์เป็น sparse — ต้องขยายครบทุกจุดยอด และมีจุดที่ขยับจริง
      for (const target of mesh.targets) {
        expect(target.positions.length).toBe(vertices * 3)
        expect(target.positions.some((value) => value !== 0)).toBe(true)
      }
    }
  })

  it('ปฏิเสธไฟล์ที่ไม่ใช่ GLB', () => {
    expect(() => parseNailMeshes(Buffer.from('not a glb file at all'))).toThrow(/GLB/)
  })
})

describe('flatNailFor', () => {
  it('ทุกนิ้ว × ทุกทรง/ความยาว คลี่ได้ และปลายเล็บอยู่ด้านบน', () => {
    for (const finger of FINGERS) {
      const mesh = nailMeshes().get(finger)!
      for (const shape of NAIL_SHAPES) {
        for (const length of NAIL_LENGTHS) {
          const view = flatNailFor(finger, shape, length, 256, 1024)
          // เก็บเฉพาะผิวบน: ต้องเหลือสามเหลี่ยม และทุกชิ้นหันหาผู้ดู
          expect(view.triangles.length).toBeGreaterThan(0)
          expect(view.triangles.length).toBeLessThanOrEqual(mesh.indices.length / 3)
          for (let i = 0; i < view.indices.length; i += 3) {
            const z = view.normals[view.indices[i]! * 3 + 2]! + view.normals[view.indices[i + 1]! * 3 + 2]! + view.normals[view.indices[i + 2]! * 3 + 2]!
            expect(z).toBeGreaterThan(0)
          }
          // ค่าเฉลี่ย y ของจุดยอดช่วงปลาย (v < 0.1) ต้องน้อยกว่าช่วงโคน (v > 0.9)
          let tip = 0
          let tipCount = 0
          let base = 0
          let baseCount = 0
          view.triangles.forEach((triangle) => {
            for (let k = 0; k < 3; k++) {
              const v = 1 - triangle.tex[k * 2 + 1]! / 1024
              const y = triangle.screen[k * 2 + 1]!
              if (v < 0.1) { tip += y; tipCount++ }
              if (v > 0.9) { base += y; baseCount++ }
            }
          })
          expect(tip / tipCount, `${finger} ${shape}/${length}`).toBeLessThan(base / baseCount)
        }
      }
    }
  })

  it('ความยาวเล็บเรียงตามสัดส่วนสูง/กว้างจริง', () => {
    const ratio = (length: (typeof NAIL_LENGTHS)[number]): number => {
      const { bounds } = flatNailFor('index', 'round', length, 256, 1024)
      return bounds.height / bounds.width
    }
    expect(ratio('extra')).toBeGreaterThan(ratio('long'))
    expect(ratio('long')).toBeGreaterThan(ratio('medium'))
    expect(ratio('medium')).toBeGreaterThan(ratio('short'))
  })

  it('mirror กลับซ้ายขวารอบกึ่งกลางแผง', () => {
    const view = flatNailFor('index', 'almond', 'long', 256, 1024)
    const mirrored = flatNailFor('index', 'almond', 'long', 256, 1024, true)
    const a = textureToPanel(view, 0.3, 0.5)!
    const b = textureToPanel(mirrored, 0.3, 0.5)!
    expect(b.x).toBeCloseTo(256 - a.x, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('แคชผลตามชุดพารามิเตอร์', () => {
    expect(flatNailFor('ring', 'square', 'short', 128, 512)).toBe(flatNailFor('ring', 'square', 'short', 128, 512))
  })

  it('โมดูลของเว็บที่ MCP ใช้ ไม่พึ่ง three และไม่ใช้ path alias (รันบน node ตรง ๆ ได้)', () => {
    for (const path of ['../../web/src/3d/painting/flatTriangles.ts', '../../web/src/3d/models/nailMorphWeights.ts']) {
      const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
      const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((match) => match[1]!)
      for (const specifier of imports) {
        expect(specifier, path).not.toBe('three')
        expect(specifier.startsWith('@/'), path).toBe(false)
      }
    }
  })
})
