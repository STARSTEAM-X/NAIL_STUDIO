export type TooltipSide = 'bottom' | 'top' | 'left' | 'right'

export interface AnchorRect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

export interface Placement {
  side: TooltipSide
  x: number
  y: number
}

/** ระยะห่างจากขอบปุ่ม และระยะกันชนขอบจอ */
const GAP = 6
const EDGE = 8

/** ความสูงคร่าว ๆ ของฟองหนึ่งบรรทัดรวมช่องไฟ ใช้ตัดสินว่าข้างล่างเหลือที่พอไหม */
const BUBBLE_SPACE = 44

/**
 * คำนวณตำแหน่งฟอง tooltip บนพิกัดของหน้าจอ (viewport)
 *
 * แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพราะเป็นส่วนเดียวที่มีการตัดสินใจจริง — การพลิกขึ้น
 * ข้างบนเมื่อข้างล่างไม่พอ และการดึงกลับไม่ให้ล้นขอบจอ ส่วนที่เหลือใน TooltipLayer
 * เป็นการต่อ event เข้ากับ DOM ล้วน ๆ
 */
export function tooltipPlacement(rect: AnchorRect, side: TooltipSide, viewport: Viewport): Placement {
  // ข้างล่างเหลือที่ไม่พอก็พลิกขึ้นข้างบน — ทำเฉพาะแกนตั้ง เพราะ right/left
  // ถูกเลือกมาแล้วด้วยเหตุผลเรื่องพื้นที่ของแถบนั้น ๆ
  const resolved: TooltipSide = side === 'bottom' && rect.bottom + BUBBLE_SPACE > viewport.height ? 'top' : side

  const raw = {
    bottom: { x: rect.left + rect.width / 2, y: rect.bottom + GAP },
    top: { x: rect.left + rect.width / 2, y: rect.top - GAP },
    right: { x: rect.right + GAP, y: rect.top + rect.height / 2 },
    left: { x: rect.left - GAP, y: rect.top + rect.height / 2 },
  }[resolved]

  return {
    side: resolved,
    x: Math.min(Math.max(raw.x, EDGE), viewport.width - EDGE),
    y: Math.min(Math.max(raw.y, EDGE), viewport.height - EDGE),
  }
}
