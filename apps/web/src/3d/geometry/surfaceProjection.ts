import { Matrix3, Vector3, type Mesh } from 'three'
import { morphedNormal, morphedPosition } from '@/3d/scene/nailMorph.ts'
import { nailMatrix } from '@/3d/scene/nailViews.ts'

/** ตำแหน่ง/ทิศ/แนวราบของผิวเล็บ ณ จุด UV หนึ่งจุด ในพิกัดโลก */
export interface SurfacePoint {
  position: Vector3
  normal: Vector3
  tangent: Vector3
}

/** แกนสำรองเมื่อคำนวณ tangent จาก UV ไม่ได้ (UV เสื่อมเป็นเส้นตรง) — เลี่ยงขนานกับ normal */
function fallbackTangent(normal: Vector3): Vector3 {
  const reference = Math.abs(normal.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  return new Vector3().crossVectors(reference, normal).normalize()
}

/**
 * แปลงพิกัด UV เป็นตำแหน่ง/ทิศ/แนวราบจริงบนผิวเล็บในโลก (A-11)
 *
 * วนหาสามเหลี่ยมที่มี (u,v) ตกอยู่ข้างในด้วย barycentric coordinate แบบเดียวกับที่
 * nailFlatten.ts ทำ (แค่คนละทิศทาง — ที่นี่หาโลกจาก UV ไม่ใช่หาแผงจากโลก) แล้วรวม
 * ตำแหน่ง/normal ที่ morph แล้วผ่านเมทริกซ์เดียวกับที่ nailViewOf ใช้ เพื่อให้ของตกแต่ง
 * ตามทรง/ความยาวเล็บและสัดส่วนมือที่เปลี่ยนแปลงได้เสมอ (DECISION D-10)
 *
 * brute-force O(จำนวนสามเหลี่ยม) ต่อการเรียกหนึ่งครั้ง — acceptable ที่ T ≤ 512 ตาม A-11
 * ไม่ทำตารางแบ่งช่วงจนกว่าจะวัดแล้วว่าช้าจริง
 *
 * คืน null เมื่อจุดไม่ตกในสามเหลี่ยมไหนเลย (นอกรูปเล็บ)
 */
export function projectUvToSurface(mesh: Mesh, u: number, v: number): SurfacePoint | null {
  const uvAttribute = mesh.geometry.getAttribute('uv')
  if (!uvAttribute) throw new Error(`mesh ${mesh.name} ไม่มี uv attribute`)

  const index = mesh.geometry.getIndex()
  const count = index ? index.count : uvAttribute.count
  const vertexAt = (cursor: number): number => (index ? index.getX(cursor) : cursor)

  for (let cursor = 0; cursor + 2 < count; cursor += 3) {
    const a = vertexAt(cursor)
    const b = vertexAt(cursor + 1)
    const c = vertexAt(cursor + 2)
    const u0 = uvAttribute.getX(a)
    const v0 = uvAttribute.getY(a)
    const u1 = uvAttribute.getX(b)
    const v1 = uvAttribute.getY(b)
    const u2 = uvAttribute.getX(c)
    const v2 = uvAttribute.getY(c)

    const denominator = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
    if (Math.abs(denominator) < 1e-12) continue
    const w0 = ((v1 - v2) * (u - u2) + (u2 - u1) * (v - v2)) / denominator
    const w1 = ((v2 - v0) * (u - u2) + (u0 - u2) * (v - v2)) / denominator
    const w2 = 1 - w0 - w1
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue

    const matrix = nailMatrix(mesh)
    const normalMatrix = new Matrix3().getNormalMatrix(matrix)

    const p0 = morphedPosition(mesh, a, new Vector3()).applyMatrix4(matrix)
    const p1 = morphedPosition(mesh, b, new Vector3()).applyMatrix4(matrix)
    const p2 = morphedPosition(mesh, c, new Vector3()).applyMatrix4(matrix)
    const position = new Vector3(
      w0 * p0.x + w1 * p1.x + w2 * p2.x,
      w0 * p0.y + w1 * p1.y + w2 * p2.y,
      w0 * p0.z + w1 * p1.z + w2 * p2.z,
    )

    const n0 = morphedNormal(mesh, a, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const n1 = morphedNormal(mesh, b, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const n2 = morphedNormal(mesh, c, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const normal = new Vector3(
      w0 * n0.x + w1 * n1.x + w2 * n2.x,
      w0 * n0.y + w1 * n1.y + w2 * n2.y,
      w0 * n0.z + w1 * n1.z + w2 * n2.z,
    )
    if (normal.lengthSq() < 1e-12) normal.copy(n0)
    normal.normalize()

    // tangent จากอนุพันธ์ UV: หาแกนในโลกที่สอดคล้องกับทิศ +u บนผิว (สูตรมาตรฐานของ
    // tangent-space จาก normal mapping) แล้วตัดองค์ประกอบตามแนว normal ออกด้วย
    // Gram-Schmidt ให้ตั้งฉากกับ normal จริง ๆ
    const edge1 = p1.clone().sub(p0)
    const edge2 = p2.clone().sub(p0)
    const deltaU1 = u1 - u0
    const deltaV1 = v1 - v0
    const deltaU2 = u2 - u0
    const deltaV2 = v2 - v0
    const tangentDenominator = deltaU1 * deltaV2 - deltaU2 * deltaV1

    let tangent: Vector3
    if (Math.abs(tangentDenominator) < 1e-12) {
      tangent = fallbackTangent(normal)
    } else {
      const f = 1 / tangentDenominator
      tangent = new Vector3(
        f * (deltaV2 * edge1.x - deltaV1 * edge2.x),
        f * (deltaV2 * edge1.y - deltaV1 * edge2.y),
        f * (deltaV2 * edge1.z - deltaV1 * edge2.z),
      )
      tangent.sub(normal.clone().multiplyScalar(tangent.dot(normal)))
      tangent = tangent.lengthSq() < 1e-12 ? fallbackTangent(normal) : tangent.normalize()
    }

    return { position, normal, tangent }
  }
  return null
}
