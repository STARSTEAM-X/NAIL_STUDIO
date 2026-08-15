/**
 * ดาวน์โหลดข้อมูลไบนารีผ่านลิงก์ชั่วคราว เพื่อให้ exporter ทุกตัวใช้วิธีเดียวกัน
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** ตัดอักขระที่ระบบไฟล์หลัก ๆ ห้ามใช้ โดยคงชื่อภาษาไทยและช่องว่างไว้ */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?\"<>|]/g, '').trim()
  return cleaned.length > 0 ? cleaned : 'nail-studio-design'
}
