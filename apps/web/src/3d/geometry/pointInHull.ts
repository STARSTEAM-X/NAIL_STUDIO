import type { Pt2 } from './hull.ts'

/**
 * ตรวจว่าจุดอยู่ใน convex hull หรือไม่ ด้วย fan decomposition + binary search (A-21)
 *
 * hull ต้องเป็นผลจาก computeHull (เรียงทวนเข็มนาฬิกา, convex เสมอ) — ใช้ประโยชน์จาก
 * ความนูนนี้: มุมรอบจุด hull[0] เรียงเป็น monotone จึง binary search หา "ลิ่ม" ที่จุด
 * ตกอยู่ได้ใน Θ(log h) แทนที่จะไล่ทุกขอบแบบ ray casting ที่ Θ(h)
 * ดู docs/algorithms.md A-21 สำหรับเหตุผลเต็ม
 */
export function isPointInHull(hull: readonly Pt2[], point: Pt2): boolean {
  const h = hull.length
  if (h < 3) return false

  const cross = (o: Pt2, a: Pt2, b: Pt2): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const origin = hull[0]!
  // จุดต้องอยู่ในลิ่มระหว่างขอบแรกกับขอบสุดท้ายที่ติดกับ origin ก่อน ไม่งั้นอยู่นอก hull แน่นอน
  if (cross(origin, hull[1]!, point) < 0) return false
  if (cross(origin, hull[h - 1]!, point) > 0) return false

  let low = 1
  let high = h - 1
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (cross(origin, hull[mid]!, point) >= 0) low = mid
    else high = mid
  }

  return cross(hull[low]!, hull[high]!, point) >= 0
}
