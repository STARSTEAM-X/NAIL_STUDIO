/**
 * Convex hull ด้วย Andrew's Monotone Chain (A-01)
 *
 * ใช้หาเส้นขอบนอกของเล็บในพิกัด UV เพื่อจำกัดพื้นที่วางของตกแต่ง (pointInHull.ts)
 * ดู docs/algorithms.md A-01 สำหรับ complexity analysis เต็ม — Θ(V log V), preprocessing
 * รันครั้งเดียวตอนโหลดโมเดล ไม่ใช่ทุกเฟรม
 */

export interface Pt2 {
  x: number
  y: number
}

function cross(o: Pt2, a: Pt2, b: Pt2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** คืนจุดยอดของ convex hull เรียงทวนเข็มนาฬิกา — จุดซ้ำและจุดภายในถูกตัดออก */
export function computeHull(points: readonly Pt2[]): Pt2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const unique: Pt2[] = []
  for (const point of sorted) {
    const last = unique[unique.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    unique.push(point)
  }
  if (unique.length < 3) return unique

  const lower: Pt2[] = []
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: Pt2[] = []
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}
