import { API_BASE } from '@/api/client.ts'
import { ORIGIN_LABELS as ORIGIN_SHORT_LABELS, getInitials } from './initials.ts'

export { ORIGIN_SHORT_LABELS, getInitials }

/** ป้ายแบบเต็มสำหรับหน้ารายละเอียด — แบบสั้น (ใช้บน badge) อยู่ใน initials.ts */
export const ORIGIN_LABELS: Record<string, string> = {
  original: 'ต้นฉบับ',
  ai: 'สร้างด้วย AI',
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

/**
 * สีอวาตาร์ต้องคงที่ต่อผู้ใช้หนึ่งคน ไม่ใช่สุ่มใหม่ทุกครั้งที่ re-render
 * จึงคำนวณจาก hash ของ id แทนการสุ่ม
 */
export function avatarGradient(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360
  }
  const hue = hash
  return `linear-gradient(145deg, hsl(${hue} 45% 32%), hsl(${(hue + 28) % 360} 58% 62%))`
}

const numberFormatter = new Intl.NumberFormat('th-TH')

/** ย่อตัวเลขการมีส่วนร่วมให้อ่านง่ายในแถบสถิติ */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return numberFormatter.format(value)
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** เวลาแบบสัมพัทธ์ ("3 ชั่วโมงที่แล้ว") สำหรับหัวโพสต์และคอมเมนต์ */
export function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} วันที่แล้ว`
  return dateFormatter.format(date)
}

export function formatFullDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateTimeFormatter.format(date)
}
