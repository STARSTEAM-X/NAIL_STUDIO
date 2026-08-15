import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  RingGeometry,
  Shape,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
  type BufferGeometry,
} from 'three'

/** หมวดหมู่ของ asset ที่แสดงในแผงตกแต่ง — ช่วยให้คลัง 30 ชิ้นยังเลือกใช้ง่าย */
export type DecorationCategory = 'gemstone' | 'metal' | 'pearl' | 'motif' | 'ribbon'

/**
 * รายการ asset ของตกแต่งที่ renderer ใช้ร่วมกันทั้ง UI และ InstancedMesh
 *
 * รอบนี้ใช้ built-in authored geometry แทนการดึงไฟล์ภายนอก: แต่ละชิ้นมีรูปทรง,
 * สี และค่าความเงาเฉพาะตัว จึงไม่ใช่ primitive เดิมที่วนซ้ำ 2-3 แบบอีกต่อไป
 * และยังคง `geometry()` factory ไว้เพื่อให้เปลี่ยนเป็น GLB loader ได้โดยไม่แตะ caller
 * เมื่อมีคลัง asset ที่ผ่านการตรวจ license/visual review ในภายหลัง
 */
export interface CatalogEntry {
  id: string
  label: string
  category: DecorationCategory
  geometry: () => BufferGeometry
  defaultScale: number
  defaultColor: string
  metalness: number
  roughness: number
  /** สงวนไว้สำหรับรอบที่เปลี่ยน asset เป็น GLB — undefined หมายถึง built-in geometry */
  modelUrl?: string
}

export const DECORATION_CATEGORY_LABELS: Readonly<Record<DecorationCategory, string>> = {
  gemstone: 'อัญมณี',
  metal: 'โลหะ',
  pearl: 'ไข่มุก',
  motif: 'ลวดลาย',
  ribbon: 'ริบบิ้น',
}

function heartGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(0, -0.35)
  shape.bezierCurveTo(-0.9, -0.95, -1.15, 0.05, 0, 0.8)
  shape.bezierCurveTo(1.15, 0.05, 0.9, -0.95, 0, -0.35)
  return new ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.05, bevelSegments: 2 })
}

function leafGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(0, -0.8)
  shape.quadraticCurveTo(0.85, -0.1, 0, 0.85)
  shape.quadraticCurveTo(-0.85, -0.1, 0, -0.8)
  return new ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 })
}

function starGeometry(): BufferGeometry {
  const shape = new Shape()
  const points = 5
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? 0.9 : 0.38
    const angle = (index / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.04, bevelSegments: 2 })
}

function moonGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(0.15, 0.85)
  shape.absarc(0, 0, 0.85, Math.PI * 0.1, Math.PI * 1.9, false)
  shape.absarc(0.32, 0.08, 0.68, Math.PI * 1.9, Math.PI * 0.1, true)
  return new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
}

function boltGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(-0.2, 0.95)
  shape.lineTo(0.55, 0.1)
  shape.lineTo(0.08, 0.1)
  shape.lineTo(0.3, -0.95)
  shape.lineTo(-0.55, -0.05)
  shape.lineTo(-0.05, -0.05)
  shape.closePath()
  return new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
}

function butterflyGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-0.2, 0.6, -1.0, 0.9, -0.85, 0.05)
  shape.bezierCurveTo(-0.78, -0.45, -0.2, -0.35, 0, 0)
  shape.bezierCurveTo(0.2, -0.35, 0.78, -0.45, 0.85, 0.05)
  shape.bezierCurveTo(1.0, 0.9, 0.2, 0.6, 0, 0)
  return new ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 })
}

function crownGeometry(): BufferGeometry {
  const shape = new Shape()
  shape.moveTo(-0.9, -0.55)
  shape.lineTo(-0.72, 0.65)
  shape.lineTo(-0.25, 0.1)
  shape.lineTo(0, 0.72)
  shape.lineTo(0.25, 0.1)
  shape.lineTo(0.72, 0.65)
  shape.lineTo(0.9, -0.55)
  shape.closePath()
  return new ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 })
}

function waveGeometry(): BufferGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.9, -0.35, 0),
    new Vector3(-0.45, 0.35, 0),
    new Vector3(0, -0.35, 0),
    new Vector3(0.45, 0.35, 0),
    new Vector3(0.9, -0.35, 0),
  ])
  return new TubeGeometry(curve, 24, 0.12, 6, false)
}

function asset(
  id: string,
  label: string,
  category: DecorationCategory,
  geometry: () => BufferGeometry,
  defaultScale: number,
  defaultColor: string,
  metalness = 0.25,
  roughness = 0.35,
): CatalogEntry {
  return { id, label, category, geometry, defaultScale, defaultColor, metalness, roughness }
}

const GOLD = '#d4af37'
const SILVER = '#d8dde5'
const ROSE_GOLD = '#d98f82'
const CRYSTAL = '#eaf7ff'

/** คลัง built-in ที่คัดให้มี 30 รูปทรงไม่ซ้ำกัน — พร้อมสลับ geometry เป็น GLB ผ่าน modelUrl */
export const DECORATION_CATALOG: readonly CatalogEntry[] = [
  asset('gem-diamond', 'เพชรทรงเหลี่ยม', 'gemstone', () => new OctahedronGeometry(1, 0), 0.0016, CRYSTAL, 0.6, 0.12),
  asset('gem-round', 'เพชรกลม', 'gemstone', () => new IcosahedronGeometry(1, 1), 0.00145, '#d9ecff', 0.55, 0.14),
  asset('gem-princess', 'เพชรสี่เหลี่ยม', 'gemstone', () => new BoxGeometry(1.1, 1.1, 0.5), 0.00155, '#f4fbff', 0.5, 0.16),
  asset('gem-cushion', 'เพชรคุชชั่น', 'gemstone', () => new DodecahedronGeometry(0.85, 0), 0.00155, '#f6d9ff', 0.55, 0.15),
  asset('gem-emerald', 'มรกต', 'gemstone', () => new CylinderGeometry(0.68, 0.68, 0.32, 6), 0.00175, '#49bf8a', 0.45, 0.18),
  asset('gem-sapphire', 'แซฟไฟร์', 'gemstone', () => new SphereGeometry(0.72, 12, 8), 0.0016, '#3e75df', 0.4, 0.18),
  asset('gem-ruby', 'ทับทิม', 'gemstone', () => new TetrahedronGeometry(0.95, 1), 0.00165, '#d64a62', 0.45, 0.16),
  asset('gem-crystal', 'คริสตัลยอดแหลม', 'gemstone', () => new ConeGeometry(0.58, 1.45, 6), 0.0016, '#b9f2ff', 0.5, 0.12),
  asset('metal-hoop', 'ห่วงกลม', 'metal', () => new TorusGeometry(0.62, 0.14, 8, 24), 0.00125, GOLD, 0.9, 0.18),
  asset('metal-double-hoop', 'ห่วงคู่', 'metal', () => new TorusGeometry(0.7, 0.09, 8, 24), 0.0013, ROSE_GOLD, 0.88, 0.2),
  asset('metal-square-hoop', 'ห่วงเหลี่ยม', 'metal', () => new RingGeometry(0.4, 0.68, 4), 0.00155, SILVER, 0.9, 0.16),
  asset('metal-bar', 'แท่งทอง', 'metal', () => new BoxGeometry(1.7, 0.26, 0.2), 0.00105, GOLD, 0.95, 0.14),
  asset('metal-bar-double', 'แท่งคู่', 'metal', () => new CapsuleGeometry(0.12, 1.15, 6, 12), 0.0011, SILVER, 0.92, 0.16),
  asset('metal-stud', 'หมุดเงิน', 'metal', () => new CylinderGeometry(0.5, 0.5, 0.24, 12), 0.0014, SILVER, 0.92, 0.15),
  asset('metal-knot', 'ปมโลหะ', 'metal', () => new TorusGeometry(0.42, 0.18, 8, 16), 0.0013, ROSE_GOLD, 0.9, 0.2),
  asset('pearl-single', 'ไข่มุกเดี่ยว', 'pearl', () => new SphereGeometry(0.68, 16, 10), 0.00145, '#fff4e8', 0.1, 0.18),
  asset('pearl-cabochon', 'ไข่มุกรี', 'pearl', () => new CapsuleGeometry(0.32, 0.65, 8, 12), 0.00135, '#f4e2ce', 0.08, 0.2),
  asset('pearl-drop', 'ไข่มุกหยดน้ำ', 'pearl', () => new ConeGeometry(0.6, 1, 12), 0.00145, '#fff1da', 0.08, 0.18),
  asset('motif-heart', 'หัวใจ', 'motif', heartGeometry, 0.0009, '#e85d75', 0.25, 0.25),
  asset('motif-star', 'ดาวห้าแฉก', 'motif', starGeometry, 0.00085, GOLD, 0.45, 0.22),
  asset('motif-moon', 'พระจันทร์เสี้ยว', 'motif', moonGeometry, 0.0009, '#f3d57a', 0.4, 0.24),
  asset('motif-bolt', 'สายฟ้า', 'motif', boltGeometry, 0.00085, '#f4c84f', 0.35, 0.2),
  asset('motif-leaf', 'ใบไม้', 'motif', leafGeometry, 0.0009, '#69b889', 0.2, 0.28),
  asset('motif-butterfly', 'ผีเสื้อ', 'motif', butterflyGeometry, 0.00085, '#bb7be8', 0.2, 0.3),
  asset('motif-crown', 'มงกุฎ', 'motif', crownGeometry, 0.0008, GOLD, 0.55, 0.2),
  asset('motif-flower', 'ดอกไม้', 'motif', () => new TorusGeometry(0.48, 0.22, 6, 18), 0.0012, '#f28fa6', 0.18, 0.3),
  asset('motif-orbit', 'วงแหวนซ้อน', 'motif', () => new TorusGeometry(0.6, 0.08, 6, 20), 0.0014, '#9aa8bb', 0.75, 0.2),
  asset('ribbon-bow', 'โบว์', 'ribbon', () => new BoxGeometry(1.6, 0.42, 0.58), 0.001, '#e9799a', 0.15, 0.3),
  asset('ribbon-knot', 'ริบบิ้นปม', 'ribbon', () => new CapsuleGeometry(0.28, 0.95, 6, 10), 0.00105, '#e8a0bc', 0.12, 0.32),
  asset('ribbon-wave', 'ริบบิ้นคลื่น', 'ribbon', waveGeometry, 0.00085, '#c982d8', 0.12, 0.32),
  asset('ribbon-loop', 'ริบบิ้นห่วง', 'ribbon', () => new TorusGeometry(0.58, 0.13, 6, 18), 0.0012, '#e48aab', 0.12, 0.3),
]

export function catalogEntry(id: string): CatalogEntry | undefined {
  return DECORATION_CATALOG.find((entry) => entry.id === id)
}
