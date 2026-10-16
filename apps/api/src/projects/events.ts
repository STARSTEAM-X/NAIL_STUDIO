import { EventEmitter } from 'node:events'
import type { ProjectVersionEvent } from '@nail-studio/contracts'

/**
 * กระจายเหตุการณ์ "มีเวอร์ชันใหม่" ให้ editor ที่เปิดงานนั้นอยู่ (ผ่าน SSE)
 *
 * ใช้ EventEmitter ในโปรเซส — พอสำหรับ API instance เดียว ถ้าวันหนึ่งรันหลาย instance
 * ต้องเปลี่ยนตรงนี้เป็น pub/sub ข้ามเครื่อง (เช่น PostgreSQL LISTEN/NOTIFY หรือ Redis)
 * โดยที่ routes และฝั่งเว็บไม่ต้องแก้
 */
const bus = new EventEmitter()
// แต่ละแท็บ editor ที่เปิดอยู่ = listener หนึ่งตัวต่องาน — ปิดเพดานเตือนของ Node
bus.setMaxListeners(0)

export function publishVersionSaved(event: Omit<ProjectVersionEvent, 'type'>): void {
  bus.emit(event.projectId, { type: 'version-saved', ...event } satisfies ProjectVersionEvent)
}

export function subscribeProject(projectId: string, listener: (event: ProjectVersionEvent) => void): () => void {
  bus.on(projectId, listener)
  return () => bus.off(projectId, listener)
}
