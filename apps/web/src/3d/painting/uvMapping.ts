import type { Point } from '@nail-studio/contracts'
import { TEX_SIZE, UV_MARGIN } from './constants.ts'

/**
 * แปลงพิกัดไปมาระหว่าง UV ของผิวเล็บกับพิกเซลของเท็กซ์เจอร์
 *
 * เส้นที่ผู้ใช้วาดถูกเก็บเป็น UV ไม่ใช่พิกเซล เพราะ UV ผูกกับผิวเล็บ ไม่ใช่กับ
 * ความละเอียดของเท็กซ์เจอร์ ถ้าวันหนึ่งเปลี่ยน TEX_SIZE งานเก่าก็ยังวาดออกมาเหมือนเดิม
 */

export interface Px {
  x: number
  y: number
}

/** UV มีแกน v ชี้ขึ้น ส่วนแคนวาสมีแกน y ชี้ลง จึงต้องกลับด้าน */
export function uvToPixel(u: number, v: number, size = TEX_SIZE): Px {
  return { x: u * size, y: (1 - v) * size }
}

export function pixelToUv(x: number, y: number, size = TEX_SIZE): { u: number; v: number } {
  const safe = size || 1
  return { u: x / safe, v: 1 - y / safe }
}

/**
 * แปลงพิกัดหน้าจอเป็น UV ภายในกรอบสี่เหลี่ยม — ใช้กับแผงวาดแบบแบน
 *
 * ไม่ขึ้นกับขนาดที่แผงถูกย่อ/ขยาย เพราะหารด้วยขนาดกรอบจริงเสมอ ผลลัพธ์จึงเป็น
 * สัดส่วน 0–1 ของผืนเท็กซ์เจอร์ ไม่ใช่พิกเซลของแผง
 */
export function rectToUv(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { u: number; v: number } {
  return {
    u: (clientX - rect.left) / (rect.width || 1),
    v: 1 - (clientY - rect.top) / (rect.height || 1),
  }
}

export function isInsideUv(u: number, v: number): boolean {
  return Number.isFinite(u) && Number.isFinite(v) && u >= 0 && u <= 1 && v >= 0 && v <= 1
}

export function clampUv(u: number, v: number): { u: number; v: number } {
  return {
    u: Math.min(1, Math.max(0, u)),
    v: Math.min(1, Math.max(0, v)),
  }
}

/**
 * ประตูเดียวที่แปลง uv ดิบจากการ raycast เป็นจุดของเส้น
 *
 * นโยบาย: เลยกรอบนิดหน่อยให้บีบเข้าขอบ เส้นจะได้ลากไปสุดขอบเล็บแล้วหยุด
 * ส่วนที่หลุดไกลเกิน UV_MARGIN ถือว่าออกนอกพื้นที่วาด คืน null ให้ผู้เรียกข้ามจุดนั้น
 *
 * ต้องบีบค่าก่อนเก็บเสมอ ไม่ใช่ตอนวาด เพราะจุดที่เก็บลงเอกสารงานคือสิ่งที่ถูก replay
 * ซ้ำทุกครั้งที่เปิดงาน ถ้าปล่อยจุดนอกกรอบลงไฟล์ เส้นจะเดินซ้ำช่วงที่มองไม่เห็นตลอดไป
 * และ schema ฝั่ง contracts ก็จะปฏิเสธเอกสาร (pointSchema บังคับ 0–1)
 */
export function toPaintPoint(u: number, v: number, pressure: number): Point | null {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null
  if (u < -UV_MARGIN || u > 1 + UV_MARGIN || v < -UV_MARGIN || v > 1 + UV_MARGIN) return null
  const inside = clampUv(u, v)
  return { x: inside.u, y: inside.v, p: Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0.5 }
}
