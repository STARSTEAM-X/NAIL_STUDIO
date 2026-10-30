import { fileURLToPath } from 'node:url'
import { createMcpApp } from './httpApp.ts'

/**
 * entry ของ Vercel Function (mcp.func) — ไม่มี listen() ดู tools/vercel-build.mjs
 * hand.glb ถูกคัดลอกไว้ข้าง index.mjs ที่ bundle แล้ว
 */
process.env.NAIL_STUDIO_HAND_GLB ??= fileURLToPath(new URL('./hand.glb', import.meta.url))

// API และเว็บอยู่ deployment เดียวกัน — ค่าเริ่มต้นจากโดเมน production ของ Vercel (system env) เมื่อไม่ได้ตั้งเอง
const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
if (production) {
  process.env.NAIL_STUDIO_API_URL ??= `https://${production}/api/v1`
  process.env.NAIL_STUDIO_WEB_URL ??= `https://${production}`
}

export default createMcpApp()
