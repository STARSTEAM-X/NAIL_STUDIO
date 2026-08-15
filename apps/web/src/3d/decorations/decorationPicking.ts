import type { Decoration } from '@nail-studio/contracts'

/**
 * ตรรกะการเล็งเป้าของตกแต่งล้วน ๆ แยกจากการผูก event — ทดสอบได้ด้วยข้อมูลธรรมดา
 * ไม่ต้องมี WebGL หรือ pointer event ใด ๆ (มาตรฐานเดียวกับ picking.ts ของระบบวาด)
 *
 * เลือกด้วยระยะทาง UV ที่ใกล้ที่สุดจากจุดที่คลิก แทนที่จะ raycast กับ InstancedMesh
 * ที่เรนเดอร์จริงแล้วแปลง instanceId กลับเป็นของตกแต่ง — pointer-down บนเล็บให้พิกัด UV
 * มาอยู่แล้วผ่าน pickNail (picking.ts) การหาของตกแต่งที่ใกล้ UV นั้นที่สุดจึงพอ ไม่ต้อง
 * สร้างระบบ hit-test คู่ขนานอีกชุด
 */
export const SELECTION_RADIUS_UV = 0.08

export function nearestDecoration(
  decorations: readonly Decoration[],
  u: number,
  v: number,
): Decoration | null {
  let best: Decoration | null = null
  let bestDistance = SELECTION_RADIUS_UV
  for (const decoration of decorations) {
    const distance = Math.hypot(decoration.u - u, decoration.v - v)
    if (distance <= bestDistance) {
      best = decoration
      bestDistance = distance
    }
  }
  return best
}
