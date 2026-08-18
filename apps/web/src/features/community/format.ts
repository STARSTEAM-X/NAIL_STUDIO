import { API_BASE } from '@/api/client.ts'

/**
 * ตัวช่วยเฉพาะของโดเมนชุมชน
 * ส่วนที่ใช้ร่วมกับโดเมนอื่น (ตัวย่อชื่อ สีอวาตาร์ วันเวลา ตัวเลข) อยู่ใน @/lib
 */

/** ป้ายแบบเต็มสำหรับหน้ารายละเอียด */
export const ORIGIN_LABELS: Record<string, string> = {
  original: 'ต้นฉบับ',
  ai: 'สร้างด้วย AI',
  remix: 'รีมิกซ์',
}

/** ป้ายสั้นสำหรับ badge บนการ์ด */
export const ORIGIN_SHORT_LABELS: Record<string, string> = {
  original: 'ต้นฉบับ',
  ai: 'AI',
  remix: 'รีมิกซ์',
}

/** สีจริงของสีหลักแต่ละแบบ ใช้ทั้ง swatch ในตัวกรองและพื้นหลังการ์ดที่ไม่มีภาพ */
export const PRIMARY_COLOR_SWATCHES: Record<string, string> = {
  Red: 'linear-gradient(135deg, #b3122e, #e26d5a)',
  Pink: 'linear-gradient(135deg, #d98c9a, #f3c7cf)',
  Nude: 'linear-gradient(135deg, #d9a78e, #f2ded0)',
  Black: 'linear-gradient(135deg, #1a1a1a, #5a6472)',
  White: 'linear-gradient(135deg, #fffdf8, #e8ddd0)',
}

export const PRIMARY_COLOR_FALLBACK = 'linear-gradient(135deg, #b18d88, #e8ddd0)'

/** พื้นหลังของการ์ดที่ยังไม่มีภาพตัวอย่าง — อิงสีหลักที่ผู้เขียนเลือกไว้จริง */
export function previewGradient(primaryColor: string | null | undefined): string {
  return PRIMARY_COLOR_SWATCHES[primaryColor ?? ''] ?? PRIMARY_COLOR_FALLBACK
}

/** สีหลักที่พื้นหลังสว่างจนต้องสลับไปใช้ตัวอักษรสีเข้ม */
const LIGHT_PREVIEW_COLORS = new Set(['Pink', 'Nude', 'White'])

export function isLightPreview(primaryColor: string | null | undefined): boolean {
  return LIGHT_PREVIEW_COLORS.has(primaryColor ?? '')
}

export function thumbnailUrl(templateId: string): string {
  return `${API_BASE}/api/v1/templates/${templateId}/thumbnail`
}
