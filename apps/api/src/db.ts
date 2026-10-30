import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.ts'
import { env } from './config/env.ts'

/**
 * จุดเดียวของระบบที่สร้าง PrismaClient
 *
 * ชั้น repository เท่านั้นที่ import ไฟล์นี้ได้ — service และ controller ห้ามแตะ
 * เพื่อให้การเปลี่ยน ORM หรือการเพิ่ม cache ทำที่เดียว (architecture.md D-07)
 *
 * Prisma 7 ต้องใช้ driver adapter ไม่มี engine ในตัวแล้ว เราจึงคุม connection pool
 * ได้เองโดยตรง ซึ่งเป็นข้อดี: จำกัดจำนวน connection ให้เหมาะกับขนาดเครื่องได้
 */
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  // ตัด query ที่ค้างนานผิดปกติ ไม่ให้ล็อกทรัพยากรไว้ (database.md §7)
  statement_timeout: 5_000,
})

const adapter = new PrismaPg(pool)

export const prisma: PrismaClient = new PrismaClient({ adapter })

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect()
  await pool.end()
}
