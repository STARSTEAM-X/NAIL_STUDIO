import { BoxGeometry, ConeGeometry, IcosahedronGeometry, type BufferGeometry } from 'three'

/**
 * รายการของตกแต่งที่เลือกวางบนเล็บได้
 *
 * ตอนนี้ใช้ placeholder geometry ล้วน — ยังไม่มี asset 3D จริง (การทำคลัง asset จริง
 * 30-50 ชิ้นเป็นงาน Slice 5) โครงสร้างนี้ออกแบบให้สลับ geometry factory เป็น GLTF
 * loader ได้ทีหลังโดยไม่ต้องแก้โค้ดที่เรียกใช้ catalog เลย — แค่เปลี่ยนข้อมูลในไฟล์นี้
 */
export interface CatalogEntry {
  id: string
  label: string
  /** factory ไม่ใช่ instance เดียวที่แชร์ข้าม InstancedMesh — แต่ละเรียกต้องได้ก้อนใหม่ */
  geometry: () => BufferGeometry
  defaultScale: number
}

export const DECORATION_CATALOG: readonly CatalogEntry[] = [
  { id: 'gem', label: 'เพชร', geometry: () => new IcosahedronGeometry(1, 0), defaultScale: 0.0018 },
  { id: 'bow', label: 'โบว์', geometry: () => new BoxGeometry(1.6, 0.4, 0.6), defaultScale: 0.001 },
  { id: 'star', label: 'ดาว', geometry: () => new ConeGeometry(1, 1, 5), defaultScale: 0.0013 },
]

export function catalogEntry(id: string): CatalogEntry | undefined {
  return DECORATION_CATALOG.find((entry) => entry.id === id)
}
