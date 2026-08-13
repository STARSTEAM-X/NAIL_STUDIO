import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 ย้าย connection string ออกจาก schema.prisma มาไว้ที่นี่
 * ส่วนฝั่ง runtime ใช้ driver adapter (@prisma/adapter-pg) ดู apps/api/src/db.ts
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
