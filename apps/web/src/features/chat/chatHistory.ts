import type { ConversationMessageResponse } from '@nail-studio/contracts'

/** ประวัติที่ผู้ใช้กดโหลดเพิ่ม เก็บแยกจากแคชของ react-query */
export interface HistoryPage {
  roomId: string
  messages: ConversationMessageResponse[]
  hasMore: boolean
}

type Sortable = Pick<ConversationMessageResponse, 'id' | 'createdAt'>

/**
 * cursor ของหน้าถัดไป — ต้องมีทั้งเวลาและ id
 *
 * ฝั่ง API ตัดหน้าด้วย (createdAt, id) ถ้าส่งแต่เวลา ข้อความที่สร้างในมิลลิวินาที
 * เดียวกันจะถูกข้ามหรือถูกส่งซ้ำ
 */
export function cursorOf(message: Sortable): string {
  return `${message.createdAt}|${message.id}`
}

/**
 * เรียงเก่า→ใหม่
 *
 * createdAt เป็น ISO ที่ลงท้ายด้วย Z เสมอ (มาจาก toISOString ฝั่ง API) จึงเทียบแบบ
 * ข้อความตรง ๆ ได้ ไม่ต้องแปลงเป็น Date ทีละใบ — ถ้าวันหนึ่ง API เปลี่ยนไปส่ง offset
 * แบบอื่น การเทียบนี้จะพังเงียบ ๆ จึงผูกไว้กับเทสต์
 */
function compare(first: Sortable, second: Sortable): number {
  if (first.createdAt !== second.createdAt) return first.createdAt.localeCompare(second.createdAt)
  return first.id.localeCompare(second.id)
}

/**
 * รวมประวัติเก่ากับหน้าล่าสุดที่ถูก poll ทับอยู่ตลอด
 *
 * ห้องที่เปิดอยู่ถูกดึงซ้ำทุก 10 วินาที และคืน "หน้าล่าสุด" เสมอ ถ้ามีข้อความใหม่เข้ามา
 * มากระหว่างที่ผู้ใช้อ่านย้อนหลัง ขอบล่างของหน้าล่าสุดจะเลื่อนไปข้างหน้าจนสองชุด
 * ไม่ต่อกันพอดี — ยุบตาม id แล้วเรียงใหม่จึงปลอดภัยกว่าเชื่อว่าต่อกันเสมอ
 *
 * ข้อความจากหน้าล่าสุดชนะเมื่อ id ซ้ำ เพราะเป็นสถานะที่สดกว่า (เช่น readAt เพิ่งเปลี่ยน)
 */
export function mergeMessages(
  older: ConversationMessageResponse[],
  live: ConversationMessageResponse[],
): ConversationMessageResponse[] {
  if (!older.length) return live
  const byId = new Map(older.map((item) => [item.id, item]))
  for (const item of live) byId.set(item.id, item)
  return [...byId.values()].sort(compare)
}

/** ประวัติใช้ได้เฉพาะห้องที่โหลดมา — สลับห้องแล้วต้องกลับไปใช้ค่าจากหน้าล่าสุด */
export function historyFor(history: HistoryPage | null, roomId: string | undefined): HistoryPage | null {
  return history && roomId && history.roomId === roomId ? history : null
}
