import { z } from 'zod'

/**
 * ตรวจ environment ตอนบูตแล้วล้มทันทีถ้าไม่ครบ (fail fast)
 *
 * ถ้าปล่อยให้บูตผ่านแล้วค่อยพังตอนมี request แรก จะ debug ยากกว่ามาก
 * และในกรณีเลวร้ายที่สุดคือระบบขึ้น production โดยที่ SESSION_SECRET ยังเป็นค่า default
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'ต้องตั้ง DATABASE_URL'),
  WEB_ORIGIN: z.string().url('WEB_ORIGIN ต้องเป็น URL เต็ม'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร')
    .refine((value) => !value.startsWith('CHANGE_ME'), 'ยังไม่ได้เปลี่ยน SESSION_SECRET จากค่าตัวอย่าง'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_ROOT: z.string().min(1).default('./storage'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`ตั้งค่า environment ไม่ครบ:\n${detail}\n\nดูตัวอย่างที่ .env.example`)
  }
  return parsed.data
}

export const env: Env = loadEnv()
export const isProduction: boolean = env.NODE_ENV === 'production'
