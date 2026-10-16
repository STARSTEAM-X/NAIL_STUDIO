import { useEffect, useRef } from 'react'
import type { ProjectVersionEvent } from '@nail-studio/contracts'
import { API_BASE } from '@/api/client.ts'

/**
 * ฟังเหตุการณ์ของงานจาก API (Server-Sent Events) — ใช้รู้ทันทีเมื่อ AI บันทึกเวอร์ชันใหม่ผ่าน MCP
 *
 * EventSource ต่อใหม่เองเมื่อหลุด จึงไม่ต้องเขียน retry; callback อ่านจาก ref ทุกครั้ง
 * เพื่อให้เห็นค่า state ล่าสุดของ editor โดยไม่ต้องเปิดการเชื่อมต่อใหม่ทุกครั้งที่ render
 */
export function useProjectEvents(projectId: string, onEvent: (event: ProjectVersionEvent) => void): void {
  const callback = useRef(onEvent)
  callback.current = onEvent

  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined
    const source = new EventSource(`${API_BASE}/api/v1/projects/${projectId}/events`, { withCredentials: true })
    const handle = (message: MessageEvent<string>) => {
      try {
        callback.current(JSON.parse(message.data) as ProjectVersionEvent)
      } catch {
        // ข้อความเสียหนึ่งอันไม่ควรทำให้ editor ล้ม
      }
    }
    source.addEventListener('version-saved', handle)
    return () => {
      source.removeEventListener('version-saved', handle)
      source.close()
    }
  }, [projectId])
}
