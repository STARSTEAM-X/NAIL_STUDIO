import type { Object3D } from 'three'
import type { NailKey, Point } from '@nail-studio/contracts'
import { toPaintPoint } from './uvMapping.ts'

/**
 * ตรรกะการเล็งเป้าล้วน ๆ แยกออกจากการผูก event
 *
 * เหตุผลที่แยก: ส่วนที่ผิดง่ายที่สุดของการวาดบนวัตถุ 3 มิติ คือกฎว่า "โดนอะไรถือว่าโดน"
 * ซึ่งทดสอบได้ด้วยข้อมูลธรรมดาโดยไม่ต้องมี WebGL, กล้อง หรือ pointer event เลย
 * ส่วนที่เหลือใน PaintController จึงเป็นเพียงการต่อสาย ไม่มีการตัดสินใจซ่อนอยู่
 */

export interface Ndc {
  x: number
  y: number
}

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/** แปลงพิกัดหน้าจอเป็นพิกัดปกติของกล้อง (-1 ถึง 1 โดยแกน y ชี้ขึ้น) */
export function pointerToNdc(clientX: number, clientY: number, rect: ScreenRect): Ndc {
  return {
    x: ((clientX - rect.left) / (rect.width || 1)) * 2 - 1,
    y: -((clientY - rect.top) / (rect.height || 1)) * 2 + 1,
  }
}

/** เท่าที่การเล็งเป้าต้องรู้จากผลการยิงรังสี — ไม่ผูกกับชนิดของ three.js */
export interface Hit {
  object: Object3D
  uv?: { x: number; y: number } | undefined
}

export interface PickResult {
  key: NailKey
  point: Point
}

/**
 * ตัดสินว่าการยิงรังสีครั้งนี้ลงเล็บนิ้วไหน ที่ตำแหน่งใดบนผิวเล็บ
 *
 * กฎสำคัญ: ดูเฉพาะสิ่งที่ถูกชนเป็นอันดับแรกเท่านั้น ถ้าอันดับแรกไม่ใช่เล็บ แปลว่า
 * มีนิ้วอื่นบังอยู่ ต้องคืน null ไม่ใช่ไล่หาเล็บชิ้นถัดไปในรายการ
 *
 * ถ้าไล่หาต่อ สีจะไปลงเล็บที่อยู่หลังฝ่ามือซึ่งผู้ใช้มองไม่เห็น กว่าจะรู้ตัวก็ตอน
 * หมุนกล้องแล้ว — เป็นข้อบกพร่องที่แก้ทีหลังยากเพราะงานเสียไปแล้ว
 */
export function pickNail(
  hits: readonly Hit[],
  nailOf: ReadonlyMap<Object3D, NailKey>,
  pressure: number,
): PickResult | null {
  const first = hits[0]
  if (!first) return null
  const key = nailOf.get(first.object)
  if (!key) return null
  if (!first.uv) return null
  const point = toPaintPoint(first.uv.x, first.uv.y, pressure)
  return point ? { key, point } : null
}
