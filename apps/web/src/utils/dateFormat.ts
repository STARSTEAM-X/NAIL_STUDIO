const DD_MM_YYYY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/
const YYYY_MM_DD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false
  return year <= new Date().getFullYear()
}

/** แปลง "31/01/2000" → "2000-01-31" คืน null ถ้า parse ไม่ได้หรือไม่ใช่วันที่จริง */
export function parseDdMmYyyy(input: string): string | null {
  const match = DD_MM_YYYY_PATTERN.exec(input)
  if (!match) return null

  const [, dayText, monthText, yearText] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  if (!isValidCalendarDate(day, month, year)) return null

  return `${yearText}-${monthText}-${dayText}`
}

/** แปลง ISO "2000-01-31" → "31/01/2000" คืน "" ถ้า input ว่างหรือ parse ไม่ได้ */
export function formatDdMmYyyy(isoDate: string): string {
  if (!isoDate) return ''
  const match = YYYY_MM_DD_PATTERN.exec(isoDate)
  if (!match) return ''

  const [, yearText, monthText, dayText] = match
  const parsed = parseDdMmYyyy(`${dayText}/${monthText}/${yearText}`)
  if (!parsed) return ''
  return `${dayText}/${monthText}/${yearText}`
}

/** ใส่ "/" อัตโนมัติระหว่างพิมพ์ และรับเฉพาะตัวเลขไม่เกิน 8 หลัก */
export function maskDdMmYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
