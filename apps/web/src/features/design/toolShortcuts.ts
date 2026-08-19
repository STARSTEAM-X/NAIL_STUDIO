import { isEditableTarget } from './keyboardTarget.ts'

type ToolShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'target'
>

export type ToolShortcutAction =
  | { kind: 'tool'; tool: 'brush' | 'erase' }
  | { kind: 'size'; direction: -1 | 1 }
  | { kind: 'help' }

/**
 * แปลงการกดปุ่มเป็นคำสั่งเครื่องมือ
 *
 * ตรวจทั้ง `key` และ `code` เพราะผังแป้นพิมพ์ไทยให้ `key` เป็นสระ/พยัญชนะ
 * (กด B ได้ 'ิ', กด [ ได้ 'บ') คนที่ทำงานด้วยผังไทยจึงใช้คีย์ลัดไม่ได้เลยถ้าดูแต่ `key`
 *
 * `?` ก็เช่นกัน — บนผังไทยคือ Shift + ปุ่มเดียวกับ `/` แต่ `key` ไม่ใช่ '?'
 */
export function toolShortcutFrom(event: ToolShortcutEvent): ToolShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (isEditableTarget(event.target)) return null

  // '?' ต้องมี Shift ตามนิยาม จึงตรวจก่อนตัวที่ห้าม Shift
  if (event.key === '?' || (event.shiftKey && event.code === 'Slash')) {
    if (event.repeat) return null
    return { kind: 'help' }
  }

  if (event.shiftKey) return null

  // ปรับขนาดหัวแปรงยอมให้กดค้างรัวได้ ต่างจากคำสั่งอื่นที่กดค้างแล้วไม่มีความหมาย
  if (event.key === '[' || event.code === 'BracketLeft') return { kind: 'size', direction: -1 }
  if (event.key === ']' || event.code === 'BracketRight') return { kind: 'size', direction: 1 }

  if (event.repeat) return null

  if (event.key === 'b' || event.key === 'B' || event.code === 'KeyB') {
    return { kind: 'tool', tool: 'brush' }
  }
  if (event.key === 'e' || event.key === 'E' || event.code === 'KeyE') {
    return { kind: 'tool', tool: 'erase' }
  }

  return null
}

/** ขั้นการปรับขนาดหัวแปรงต่อการกดหนึ่งครั้ง — สองเท่าของ step สไลเดอร์ให้กดแล้วรู้สึกได้ */
export const SIZE_STEP = 4
