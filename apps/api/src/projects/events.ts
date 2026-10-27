import { EventEmitter } from 'node:events'
import type pg from 'pg'
import type { ProjectVersionEvent } from '@nail-studio/contracts'
import { createListenClient, notify } from '../db.ts'

/**
 * กระจายเหตุการณ์ "มีเวอร์ชันใหม่" ให้ editor ที่เปิดงานนั้นอยู่ (ผ่าน SSE)
 *
 * บน Vercel มีหลาย instance — คนบันทึกกับคนเปิด editor อาจอยู่คนละเครื่อง จึงส่งผ่าน
 * PostgreSQL LISTEN/NOTIFY แทน EventEmitter ในโปรเซส: publish = NOTIFY,
 * แต่ละ instance เปิด LISTEN connection เดียว (เฉพาะตอนมีคนฟังอยู่) แล้วกระจายต่อในโปรเซส
 * event เป็น best-effort — ถ้าพลาด editor ยังเห็นเวอร์ชันใหม่ตอนโหลดงานครั้งถัดไป
 */
const CHANNEL = 'project_events'
// เพดาน payload ของ NOTIFY คือ 8000 bytes
const MAX_PAYLOAD_BYTES = 7_900
const RECONNECT_DELAY_MS = 1_000

const local = new EventEmitter()
// แต่ละแท็บ editor ที่เปิดอยู่ = listener หนึ่งตัวต่องาน — ปิดเพดานเตือนของ Node
local.setMaxListeners(0)

let subscribers = 0
let client: pg.Client | null = null
let ready: Promise<void> | null = null

function log(message: string, error?: unknown): void {
  console.error(JSON.stringify({ level: 'error', message, error: error instanceof Error ? error.message : error }))
}

function dispatch(message: pg.Notification): void {
  if (message.channel !== CHANNEL || !message.payload) return
  try {
    const event = JSON.parse(message.payload) as ProjectVersionEvent
    local.emit(event.projectId, event)
  } catch (error) {
    log('อ่าน project event ไม่ได้', error)
  }
}

function dropClient(target: pg.Client): void {
  if (client !== target) return
  client = null
  ready = null
  void target.end().catch(() => {})
  // ยังมีคนฟังอยู่ (เช่น Neon ตัด connection ตอน scale-to-zero) → ต่อใหม่
  if (subscribers > 0) {
    setTimeout(() => {
      if (subscribers > 0) void listen().catch(() => {})
    }, RECONNECT_DELAY_MS).unref()
  }
}

function listen(): Promise<void> {
  if (ready) return ready
  const next = createListenClient()
  client = next
  next.on('notification', dispatch)
  next.on('error', (error) => {
    log('LISTEN connection ขัดข้อง', error)
    dropClient(next)
  })
  next.on('end', () => dropClient(next))
  ready = next
    .connect()
    .then(() => next.query(`LISTEN ${CHANNEL}`))
    .then(() => undefined)
    .catch((error: unknown) => {
      log('เปิด LISTEN ไม่สำเร็จ', error)
      dropClient(next)
      throw error
    })
  return ready
}

export function publishVersionSaved(event: Omit<ProjectVersionEvent, 'type'>): void {
  const payload = JSON.stringify({ type: 'version-saved', ...event } satisfies ProjectVersionEvent)
  if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) {
    log('project event ใหญ่เกินเพดาน NOTIFY — ข้าม')
    return
  }
  // การบันทึกงานสำเร็จไปแล้ว — notify ล้มต้องไม่ทำให้ request ล้มตาม
  void notify(CHANNEL, payload).catch((error: unknown) => log('ส่ง project event ไม่สำเร็จ', error))
}

/**
 * resolve เมื่อ LISTEN พร้อมแล้ว — ผู้เรียกจึงไม่พลาด event ที่ถูกบันทึกหลังจากนี้
 * คืนฟังก์ชันยกเลิก; เมื่อไม่มีคนฟังเหลือจะปิด LISTEN connection คืน DB
 */
export async function subscribeProject(
  projectId: string,
  listener: (event: ProjectVersionEvent) => void,
): Promise<() => void> {
  subscribers += 1
  local.on(projectId, listener)
  let active = true
  const unsubscribe = () => {
    if (!active) return
    active = false
    local.off(projectId, listener)
    subscribers -= 1
    if (subscribers === 0 && client) {
      const target = client
      client = null
      ready = null
      void target.end().catch(() => {})
    }
  }
  try {
    await listen()
  } catch (error) {
    unsubscribe()
    throw error
  }
  return unsubscribe
}
