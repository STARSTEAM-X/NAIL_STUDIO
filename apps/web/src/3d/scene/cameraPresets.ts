/**
 * ค่ากล้องกลาง — ยกมาจาก NailDesine-TEST/src/three/nailViews.ts
 *
 * เหตุผลที่ต้องอยู่ไฟล์เดียว: ทั้งมุมมองเริ่มต้น การกดปุ่ม "ดูทั้งมือ" และการคำนวณ
 * ระยะจ่อเล็บ ต้องใช้ค่าชุดเดียวกัน ถ้าเขียนซ้ำหลายที่จะหลุดกันทีหลัง
 */

// มุมมองทั้งมือควรเห็นรายละเอียดของฝ่ามือมากกว่าค่าเริ่มต้นเดิม และให้จุดเล็ง
// อยู่บริเวณกึ่งกลางมือ ไม่ใช่ค่อนไปทางข้อมือ
export const HOME_POSITION: [number, number, number] = [0, 0.08, 0.45]
export const HOME_TARGET: [number, number, number] = [0, 0.08, 0.13]

/**
 * เพดานซูมเข้า — 0.025 ต่ำกว่าระยะที่เล็บก้อย (เล็กสุด รัศมี 4.52 มม.) ต้องใช้คือ 0.0318
 * ถ้าตั้งสูงกว่านั้นนิ้วก้อยจะโดน clamp แล้วเล็บเล็กกว่าเพื่อนในเฟรม
 * ทั้งที่สูตรจัดเฟรมตั้งใจให้ทุกนิ้วกินพื้นที่เท่ากัน
 */
export const MIN_DISTANCE = 0.025
export const MAX_DISTANCE = 1.2

/** สัดส่วนความสูงเฟรมที่อยากให้เล็บกิน — เห็นลายชัดโดยยังรู้ว่าเป็นนิ้วไหน */
export const FRAME_FILL = 0.45

/** ระยะกล้องที่ทำให้วัตถุรัศมี r กินเฟรมตามสัดส่วนที่กำหนด */
export function distanceForRadius(radius: number, fovDegrees: number, fill = FRAME_FILL): number {
  const half = (fovDegrees / 2) * (Math.PI / 180)
  const raw = radius / Math.tan(half) / fill
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, raw))
}
