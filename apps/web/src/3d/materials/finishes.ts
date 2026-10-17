import { MeshPhysicalMaterial, SRGBColorSpace, type CanvasTexture, type Texture } from 'three'
import type { Nail } from '@nail-studio/contracts'
import type { CanvasFactory } from '@/3d/painting/NailTextureSet.ts'
import type { Ctx2D } from '@/3d/painting/rasterizer.ts'

export type FinishId = Nail['finish']

export interface FinishSpec {
  roughness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
  envMapIntensity: number
  sparkle: boolean
  iridescence?: number
  anisotropy?: number
}

/**
 * ผิวมุกเพิ่ม iridescence และตาแมวเพิ่ม anisotropy ให้ไฮไลต์ตอบสนองตามมุมจริง
 * MaterialPool แยกตาม finish อยู่แล้ว จึงไม่แย่ง uniform ระหว่างนิ้ว
 */
export const FINISH_PRESETS: Record<FinishId, FinishSpec> = {
  glossy: { roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1, sparkle: false },
  matte: { roughness: 0.82, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.7, envMapIntensity: 0.6, sparkle: false },
  chrome: { roughness: 0.05, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, sparkle: false },
  glitter: { roughness: 0.38, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.4, sparkle: true },
  pearl: { roughness: 0.22, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.2, sparkle: false, iridescence: 0.9 },
  cat_eye: { roughness: 0.32, metalness: 0.65, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2, sparkle: true, anisotropy: 0.55 },
}

/**
 * คีย์ที่ระบุ "วัสดุที่ตั้งค่าเหมือนกันทุกอย่าง" สำหรับ MaterialPool
 *
 * `map.uuid` อยู่ในคีย์โดยตั้งใจ: material หนึ่งตัวของ three.js ถือแผนที่สีได้ผืนเดียว
 * เล็บแต่ละนิ้วมีผืนของตัวเอง จึงห้ามใช้ entry ร่วมกันเด็ดขาด ผลข้างเคียงที่ต้องรู้คือ
 * **คีย์จะไม่มีวันซ้ำกันข้ามนิ้ว** pool จึงไม่ได้ลดจำนวน material ในสไลซ์นี้
 * สิ่งที่ได้จริงคือการนับ ref และ dispose ให้ตรงเวลาตอนสลับผิวเล็บ
 * (การ reuse จะเริ่มมีผลกับของตกแต่งใน Slice 4 ที่หลายชิ้นใช้ material ชุดเดียวกันได้)
 */
export function nailMaterialKey(
  finish: FinishId,
  map: Texture,
  sparkle: Texture | null,
): string {
  const spec = FINISH_PRESETS[finish] ?? FINISH_PRESETS.glossy
  const normalMapUuid = spec.sparkle ? (sparkle?.uuid ?? 'none') : 'none'
  return `${finish}|map:${map.uuid}|sparkle:${spec.sparkle}|normal-map:${normalMapUuid}`
}

export const browserCanvasFactory: CanvasFactory = (size) => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('เบราว์เซอร์นี้สร้าง canvas 2d context ไม่ได้')
  return { canvas, ctx: ctx as Ctx2D }
}

export function createNailMaterial(map: CanvasTexture): MeshPhysicalMaterial {
  map.colorSpace = SRGBColorSpace
  return new MeshPhysicalMaterial({
    map,
    roughness: FINISH_PRESETS.glossy.roughness,
    metalness: FINISH_PRESETS.glossy.metalness,
    clearcoat: FINISH_PRESETS.glossy.clearcoat,
    clearcoatRoughness: FINISH_PRESETS.glossy.clearcoatRoughness,
    // ผิวเล็บของโมเดลอยู่ชิดผิวมือมาก ถ้าใช้ค่า depth เดียวกันจะเกิด z-fighting
    // เป็นสามเหลี่ยมสีผิวแทรกขึ้นมาบนลายเล็บ
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
}

/** แผนที่ normal แบบสุ่มเกล็ด ใช้ร่วมกันทุกเล็บที่เป็นวัสดุกลิตเตอร์ */
export function createSparkleNormalMap(factory: CanvasFactory, size = 512): CanvasImageSource {
  const { canvas, ctx } = factory(size)
  ctx.fillStyle = '#8080ff'
  ctx.fillRect(0, 0, size, size)
  const flakes = Math.floor((size * size) / 900)
  for (let index = 0; index < flakes; index += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    const radius = 1 + Math.random() * 2.2
    const nx = Math.floor(128 + (Math.random() * 2 - 1) * 110)
    const ny = Math.floor(128 + (Math.random() * 2 - 1) * 110)
    ctx.fillStyle = `rgb(${nx}, ${ny}, 255)`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  return canvas
}

/**
 * ตั้งค่าวัสดุตามชนิดผิวที่เลือก
 *
 * ค่าเกือบทั้งหมดเป็น uniform เปลี่ยนได้โดยไม่ต้องคอมไพล์เชดเดอร์ใหม่
 * three.js จัดการเปลี่ยน shader เมื่อเปิด/ปิด iridescence หรือ anisotropy
 * ส่วน normalMap ตั้ง needsUpdate เฉพาะตอนเปลี่ยนแผนที่จริง
 */
export function applyFinish(
  material: MeshPhysicalMaterial,
  finish: FinishId,
  sparkle: Texture | null,
): void {
  const spec = FINISH_PRESETS[finish] ?? FINISH_PRESETS.glossy
  material.roughness = spec.roughness
  material.metalness = spec.metalness
  material.clearcoat = spec.clearcoat
  material.clearcoatRoughness = spec.clearcoatRoughness
  material.envMapIntensity = spec.envMapIntensity
  material.iridescence = spec.iridescence ?? 0
  material.anisotropy = spec.anisotropy ?? 0
  material.anisotropyRotation = finish === 'cat_eye' ? -Math.PI / 6 : 0
  material.iridescenceIOR = 1.45
  material.iridescenceThicknessRange = [100, 280]
  const normalStrength = finish === 'cat_eye' ? 0.08 : spec.sparkle ? 0.6 : 1
  material.normalScale.set(normalStrength, normalStrength)
  const nextMap = spec.sparkle ? sparkle : null
  if (material.normalMap !== nextMap) {
    material.normalMap = nextMap
    material.needsUpdate = true
  }
}
