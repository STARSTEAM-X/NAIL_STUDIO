import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * โหลด .env เข้าสู่ process ก่อนเทสเริ่ม
 *
 * จำเป็นเพราะ vitest อ่าน .env ให้เฉพาะตัวแปรที่ขึ้นต้นด้วย VITE_ เท่านั้น
 * ส่วน API อ่านค่าจาก process.env ตรง ๆ ตอน import โมดูล config/env
 * ถ้าไม่โหลดตรงนี้ เทสจะพังตั้งแต่ import ก่อนถึงบรรทัดแรกของเทสด้วยซ้ำ
 */
process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

export default defineConfig({
  test: {
    environment: 'node',
    // integration test คุยกับ PostgreSQL จริง จึงต้องรันเรียงกัน ไม่ใช่ขนาน
    // ไม่งั้นการเก็บกวาดข้อมูลของไฟล์หนึ่งจะไปลบข้อมูลที่อีกไฟล์กำลังใช้
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})