import { createApp } from './app.ts'
import { env } from './config/env.ts'
import { disconnectDb } from './db.ts'

const app = createApp()
const server = app.listen(env.API_PORT, () => {
  console.log(
    JSON.stringify({ level: 'info', message: 'API พร้อมใช้งาน', port: env.API_PORT, env: env.NODE_ENV }),
  )
})

/** ปิดอย่างเรียบร้อย — ให้ request ที่ค้างอยู่ทำงานจบก่อนตัดการเชื่อมต่อฐานข้อมูล */
async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ level: 'info', message: 'กำลังปิดเซิร์ฟเวอร์', signal }))
  server.close(() => {
    void disconnectDb().finally(() => process.exit(0))
  })
  // กันกรณี connection ค้างจนปิดไม่ลง
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
