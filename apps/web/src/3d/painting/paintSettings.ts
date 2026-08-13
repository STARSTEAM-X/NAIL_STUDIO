import { BRUSHES } from '@nail-studio/contracts'

/**
 * ค่าที่ผู้ใช้ตั้งบนแถบเครื่องมือ
 *
 * จงใจไม่อยู่ใน @nail-studio/contracts เพราะไม่ใช่ส่วนหนึ่งของ "งานออกแบบ"
 * มันคือสถานะของเครื่องมือ ไม่ใช่ผลลัพธ์ — เปิดงานเดิมบนเครื่องอื่นแล้วขนาดแปรง
 * ที่ค้างไว้ไม่ควรตามไปด้วย ส่วนค่าที่ *มีผลต่อรูปเส้น* ถูกคัดลอกลงไปในตัว stroke
 * ตอน commit แล้ว (ดู settingsToStroke) เอกสารงานจึง replay ได้ครบโดยไม่ต้องรู้จักไฟล์นี้
 */

export type BrushId = (typeof BRUSHES)[number]

export interface PaintSettings {
  tool: 'brush' | 'erase'
  brush: BrushId
  color: string
  size: number
  opacity: number
  softness: number
}

export const DEFAULT_PAINT_SETTINGS: PaintSettings = {
  tool: 'brush',
  brush: 'round',
  color: '#b5314c',
  size: 120,
  opacity: 1,
  softness: 0.25,
}
