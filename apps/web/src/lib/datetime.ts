/**
 * การจัดรูปแบบวันเวลาของทั้งแอป
 *
 * ก่อนหน้านี้มี Intl.DateTimeFormat กระจายอยู่หกที่ด้วยรูปแบบต่างกัน
 * และ toLocaleString() ดิบอีกสี่ที่ซึ่งสองที่ไม่ได้ระบุ locale
 * ทำให้ผู้ใช้เห็นวันที่คนละแบบในหน้าคนละหน้าของแอปเดียวกัน
 */

const LOCALE = 'th-TH'

const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const longDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const timeOnly = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const weekdayDateTime = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 18 ส.ค. 2569 */
export function formatDate(value: string | Date): string {
  const date = toDate(value)
  return date ? shortDate.format(date) : ''
}

/** 18 สิงหาคม 2569 — ใช้กับข้อมูลโปรไฟล์ที่มีพื้นที่พอ */
export function formatLongDate(value: string | Date): string {
  const date = toDate(value)
  return date ? longDate.format(date) : ''
}

/** 18 ส.ค. 2569 10:57 */
export function formatDateTime(value: string | Date): string {
  const date = toDate(value)
  return date ? dateTime.format(date) : ''
}

/** 10:57 */
export function formatTime(value: string | Date): string {
  const date = toDate(value)
  return date ? timeOnly.format(date) : ''
}

/** อา. 18 ส.ค. 10:57 — ใช้กับเวลานัดหมายที่วันในสัปดาห์สำคัญ */
export function formatAppointmentTime(value: string | Date): string {
  const date = toDate(value)
  return date ? weekdayDateTime.format(date) : ''
}

/** "3 ชั่วโมงที่แล้ว" — สำหรับฟีดและคอมเมนต์ */
export function formatRelativeTime(value: string | Date): string {
  const date = toDate(value)
  if (!date) return ''

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} วันที่แล้ว`
  return shortDate.format(date)
}

const numberFormatter = new Intl.NumberFormat(LOCALE)

/** ย่อตัวเลขการมีส่วนร่วมให้อ่านง่ายในแถบสถิติ */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return numberFormatter.format(value)
}

const bahtFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
})

/**
 * ราคาจาก API มาเป็น string (Prisma Decimal) ไม่ใช่ number
 * จึงต้องแปลงก่อนเสมอ และคืนค่าเดิมถ้าแปลงไม่ได้แทนที่จะแสดง NaN
 */
export function formatBaht(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(amount) ? String(value) : bahtFormatter.format(amount)
}

/** "1 ชม. 30 นาที" จากจำนวนนาที */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} นาที`
}

/**
 * แปลงค่าจาก <input type="datetime-local"> เป็น ISO string พร้อม offset
 * ค่าที่ได้จาก input ไม่มีโซนเวลา การส่งดิบไปให้ API ที่ต้องการ offset จึงถูกปฏิเสธ
 */
export function localInputToIso(value: string): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
