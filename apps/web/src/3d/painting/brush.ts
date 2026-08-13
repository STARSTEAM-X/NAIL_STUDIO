import type { Point, Stroke } from '@nail-studio/contracts'
import { TEX_SIZE } from './constants.ts'
import type { BrushId, PaintSettings } from './paintSettings.ts'
import { uvToPixel } from './uvMapping.ts'

/**
 * แปลง "เส้นที่ลาก" เป็น "แต้มสีเรียงกัน" (A-14)
 *
 * แปรงจริงไม่ได้วาดเป็นเส้นต่อเนื่อง แต่เป็นการแตะหัวแปรงถี่ ๆ ตามแนวที่ลาก
 * การจำลองแบบนี้ทำให้ได้ทั้งการไล่ขนาดตามแรงกดและขอบที่ฟุ้งได้ตามชนิดแปรง
 * โดยไม่ต้องคำนวณ stroke outline ซึ่งยากกว่ามากเมื่อรัศมีเปลี่ยนระหว่างเส้น
 *
 * ความซับซ้อน: O(ความยาวเส้นเป็นพิกเซล ÷ ระยะห่างแต้ม) — เป็นเชิงเส้นกับความยาวเส้น
 * ไม่ใช่กับจำนวนจุด จึงคุมได้ด้วย spacing ไม่ว่าอุปกรณ์จะส่ง pointermove ถี่แค่ไหน
 */

export interface Dab {
  x: number
  y: number
  r: number
  alpha: number
}

export interface BrushPreset {
  /** ระยะห่างระหว่างแต้ม คิดเป็นสัดส่วนของขนาดแปรง */
  spacing: number
  softness: number
  /** รัศมีขั้นต่ำเมื่อแตะเบาสุด คิดเป็นสัดส่วนของรัศมีเต็ม */
  minPressure: number
}

export const BRUSH_PRESETS: Record<BrushId, BrushPreset> = {
  round: { spacing: 0.25, softness: 0.25, minPressure: 0.35 },
  flat: { spacing: 0.2, softness: 0.1, minPressure: 0.6 },
  liner: { spacing: 0.12, softness: 0.05, minPressure: 0.5 },
  glitter: { spacing: 0.5, softness: 0.4, minPressure: 0.4 },
  airbrush: { spacing: 0.35, softness: 0.85, minPressure: 0.2 },
}

/**
 * เพดานล่างของระยะก้าว — กันการวนไม่รู้จบเมื่อขนาดแปรงเล็กมาก
 *
 * ถ้า spacing × size ออกมาเป็น 0 ลูปใน pathToDabs จะเดินหน้าครั้งละ 0 พิกเซล
 * แล้วค้างทั้งแท็บ ค่านี้จึงไม่ใช่การจูนคุณภาพ แต่เป็นเงื่อนไขที่ทำให้ลูปจบเสมอ
 */
const MIN_STEP_PX = 0.5

export function pressureToRadius(size: number, pressure: number, minPressure = 0.35): number {
  const clamped = Math.min(1, Math.max(0, pressure))
  return (size / 2) * (minPressure + (1 - minPressure) * clamped)
}

export function presetOf(brush: BrushId | undefined): BrushPreset {
  return (brush && BRUSH_PRESETS[brush]) || BRUSH_PRESETS.round
}

export function pathToDabs(
  points: Point[],
  size: number,
  opacity: number,
  spacing: number,
  texSize = TEX_SIZE,
  minPressure = 0.35,
): Dab[] {
  const pixels = points.map((point) => ({
    ...uvToPixel(point.x, point.y, texSize),
    p: point.p,
  }))
  const head = pixels[0]
  if (!head) return []
  const step = Math.max(MIN_STEP_PX, spacing * size)
  const dabs: Dab[] = [{
    x: head.x,
    y: head.y,
    r: pressureToRadius(size, head.p, minPressure),
    alpha: opacity,
  }]
  if (pixels.length === 1) return dabs

  // carry คือเศษระยะที่เหลือจากช่วงก่อนหน้า ทำให้แต้มเรียงห่างเท่ากันตลอดเส้น
  // ไม่ใช่กระจุกตัวใหม่ทุกครั้งที่ขึ้นช่วงใหม่ (ซึ่งจะเห็นเป็นปุ่มสีเข้มทุกจุดที่บันทึก)
  let carry = 0
  for (let index = 1; index < pixels.length; index += 1) {
    const start = pixels[index - 1]
    const end = pixels[index]
    if (!start || !end) continue
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    let travelled = step - carry
    while (travelled <= length + 1e-9) {
      const t = Math.min(1, travelled / length)
      const pressure = start.p + (end.p - start.p) * t
      dabs.push({
        x: start.x + dx * t,
        y: start.y + dy * t,
        r: pressureToRadius(size, pressure, minPressure),
        alpha: opacity,
      })
      travelled += step
    }
    carry = (carry + length) % step
  }
  return dabs
}

/**
 * ทั้งพรีวิวสดตอนลากนิ้วและการ replay ตอนบันทึก ต้องเข้าประตูเดียวกันสองบานนี้เท่านั้น
 *
 * ถ้าฝั่งไหนไปเรียก pathToDabs เองด้วยพารามิเตอร์ของตัวเอง เส้นที่เห็นตอนลาก
 * กับเส้นที่ได้ตอนปล่อยนิ้วจะเป็นคนละรูป — เป็นบั๊กที่ผู้ใช้เห็นชัดที่สุดแบบหนึ่ง
 */
export function settingsToDabs(
  points: Point[],
  settings: PaintSettings,
  texSize = TEX_SIZE,
): Dab[] {
  const preset = presetOf(settings.brush)
  return pathToDabs(
    points,
    settings.size,
    // ยางลบใช้ความทึบเต็มเสมอ ความจางของยางลบมาจาก softness ไม่ใช่ opacity
    settings.tool === 'erase' ? 1 : settings.opacity,
    preset.spacing,
    texSize,
    preset.minPressure,
  )
}

export function strokeToDabs(stroke: Stroke, texSize = TEX_SIZE): Dab[] {
  if (stroke.kind === 'fill') return []
  const preset = presetOf(stroke.brush)
  return pathToDabs(
    stroke.points,
    stroke.size,
    stroke.kind === 'erase' ? 1 : stroke.opacity,
    preset.spacing,
    texSize,
    preset.minPressure,
  )
}

/** จุดเดียวที่แปลง "ค่าที่ผู้ใช้ตั้งไว้ + จุดที่ลาก" เป็นเส้นที่จะเก็บลงเอกสารงาน */
export function settingsToStroke(settings: PaintSettings, points: Point[]): Stroke {
  if (settings.tool === 'erase') {
    return {
      kind: 'erase',
      // ยางลบก็ใช้หัวแปรงที่ผู้ใช้เลือกอยู่ ต้องเก็บไว้ด้วย
      // ไม่งั้น replay จะได้รูปคนละแบบกับตอนลาก
      brush: settings.brush,
      size: settings.size,
      softness: settings.softness,
      points,
    }
  }
  return {
    kind: 'brush',
    brush: settings.brush,
    color: settings.color,
    size: settings.size,
    opacity: settings.opacity,
    softness: settings.softness,
    points,
  }
}
