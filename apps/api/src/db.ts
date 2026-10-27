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
  max: env.DB_POOL_MAX,
  // serverless: instance ที่ว่างต้องคืน connection เร็ว ไม่งั้นหลาย instance รวมกันจะชนเพดานของ DB
  idleTimeoutMillis: 10_000,
  // ตัด query ที่ค้างนานผิดปกติ ไม่ให้ล็อกทรัพยากรไว้ (database.md §7)
  statement_timeout: 5_000,
})

const adapter = new PrismaPg(pool)

export const prisma: PrismaClient = new PrismaClient({ adapter })

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect()
  await pool.end()
}

/** ส่ง NOTIFY ผ่าน pool เดิม — pooler โหมด transaction ส่ง NOTIFY ได้ (ที่รับไม่ได้คือ LISTEN) */
export async function notify(channel: string, payload: string): Promise<void> {
  await pool.query('SELECT pg_notify($1, $2)', [channel, payload])
}

/**
 * connection เฉพาะสำหรับ LISTEN — ต้องเป็น connection ยาวที่ไม่ผ่าน pooler
 * จึงใช้ DATABASE_URL_UNPOOLED ถ้ามี (บน Neon) และไม่ใส่ statement_timeout เพราะไม่ได้รัน query ยาว
 */
export function createListenClient(): pg.Client {
  return new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL })
}
