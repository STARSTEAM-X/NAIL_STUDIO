/**
 * ตัวกรองเป้าหมายคีย์บอร์ดที่ใช้ร่วมกันทุกชุดคีย์ลัดในหน้าแก้ไขงาน
 *
 * แยกออกมาเพราะคีย์ลัดทุกชุด (เลือกนิ้ว, ประวัติ, เครื่องมือ) ต้องเงียบเหมือนกัน
 * ตอนผู้ใช้กำลังพิมพ์อยู่ในช่องกรอก ถ้าแต่ละชุดเขียนเงื่อนไขเอง จะหลุดกันทีหลัง
 * แล้วกลายเป็นว่าพิมพ์ชื่อเลเยอร์ตัว "B" แล้วเครื่องมือสลับไปเป็นแปรง
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { tagName?: string; isContentEditable?: boolean }
  return element.isContentEditable === true
    || element.tagName === 'INPUT'
    || element.tagName === 'TEXTAREA'
    || element.tagName === 'SELECT'
}
