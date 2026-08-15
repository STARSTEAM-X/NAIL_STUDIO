import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import { projectUvToSurface } from './surfaceProjection.ts'

/** สร้าง mesh สี่เหลี่ยมแบนบนระนาบ XY สองสามเหลี่ยม UV กางเต็ม 0-1 พอดี */
function flatQuadMesh(): Mesh {
  const geometry = new BufferGeometry()
  // ลำดับจุด: (0,0,0) (1,0,0) (1,1,0) (0,1,0) — สองสามเหลี่ยม (0,1,2) และ (0,2,3)
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
  ])
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ])
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ])
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return new Mesh(geometry)
}

describe('projectUvToSurface', () => {
  it('returns null for a UV point outside every triangle', () => {
    const mesh = flatQuadMesh()
    expect(projectUvToSurface(mesh, 1.5, 1.5)).toBeNull()
    expect(projectUvToSurface(mesh, -0.5, 0.5)).toBeNull()
  })

  it('projects the center of the quad to the center of the plane', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.5, 0.5)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBeCloseTo(0.5, 5)
    expect(result!.position.y).toBeCloseTo(0.5, 5)
    expect(result!.position.z).toBeCloseTo(0, 5)
  })

  it('returns the flat normal facing +Z everywhere on the quad', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.2, 0.8)
    expect(result).not.toBeNull()
    expect(result!.normal.x).toBeCloseTo(0, 5)
    expect(result!.normal.y).toBeCloseTo(0, 5)
    expect(result!.normal.z).toBeCloseTo(1, 5)
  })

  it('returns a tangent perpendicular to the normal', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.3, 0.4)
    expect(result).not.toBeNull()
    expect(result!.tangent.dot(result!.normal)).toBeCloseTo(0, 5)
    expect(result!.tangent.length()).toBeCloseTo(1, 5)
  })

  it('projects a UV corner to its exact matching vertex', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0, 0)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBeCloseTo(0, 5)
    expect(result!.position.y).toBeCloseTo(0, 5)
  })

  it('handles a degenerate (zero-area) triangle without crashing or matching it', () => {
    const geometry = new BufferGeometry()
    // สามเหลี่ยมเสื่อม (จุดสามจุดเรียงเส้นตรง) ตามด้วยสามเหลี่ยมปกติที่มีจุดกึ่งกลางอยู่จริง
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 2, 0, 0, // degenerate
      0, 0, 0, 1, 0, 0, 0, 1, 0, // normal
    ])
    const normals = new Float32Array(18).fill(0)
    for (let i = 2; i < 18; i += 3) normals[i] = 1
    const uvs = new Float32Array([
      0, 0, 0.5, 0, 1, 0,
      0, 0, 1, 0, 0, 1,
    ])
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    geometry.setIndex([0, 1, 2, 3, 4, 5])
    const mesh = new Mesh(geometry)
    expect(() => projectUvToSurface(mesh, 0.2, 0.2)).not.toThrow()
    const result = projectUvToSurface(mesh, 0.2, 0.2)
    expect(result).not.toBeNull()
  })
})
