import { z } from 'zod'

/**
 * ตรวจ environment ตอนบูตแล้วล้มทันทีถ้าไม่ครบ (fail fast)
 *
 * ถ้าปล่อยให้บูตผ่านแล้วค่อยพังตอนมี request แรก จะ debug ยากกว่ามาก
 * และในกรณีเลวร้ายที่สุดคือระบบขึ้น production โดยที่ SESSION_SECRET ยังเป็นค่า default
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'ต้องตั้ง DATABASE_URL'),
    // connection ตรง (ไม่ผ่าน pooler) สำหรับ LISTEN — pooler โหมด transaction ไม่ส่ง NOTIFY ให้
    DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
    // บน serverless แต่ละ instance มี pool ของตัวเอง จึงต้องตั้งให้เล็ก
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    WEB_ORIGIN: z.string().url('WEB_ORIGIN ต้องเป็น URL เต็ม'),
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร')
      .refine((value) => !value.startsWith('CHANGE_ME'), 'ยังไม่ได้เปลี่ยน SESSION_SECRET จากค่าตัวอย่าง'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // vercel-blob: ดิสก์ของ Vercel Function เป็น ephemeral จึงต้องเก็บไฟล์นอกเครื่อง
    STORAGE_DRIVER: z.enum(['local', 'vercel-blob']).default('local'),
    // vercel-blob ยืนยันตัวตนได้สองแบบ: OIDC (BLOB_STORE_ID ที่ Vercel ใส่ให้เมื่อเชื่อม store — ไม่มี
    // secret ค้างใน env) หรือ token แบบเดิม (BLOB_READ_WRITE_TOKEN) — @vercel/blob เลือกเองตามที่มี
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    BLOB_STORE_ID: z.string().min(1).optional(),
    STORAGE_ROOT: z.string().min(1).default('./storage'),
    AI_SERVICE_URL: z.string().url().default('http://localhost:4100'),
    AI_INTERNAL_TOKEN: z.string().default(''),
    // โฟลเดอร์ build ของเว็บ (apps/web/dist) — ตั้งเมื่อให้ API ส่งหน้าเว็บเองจากโดเมนเดียวกัน
    // (เช่นบน Render) ทำให้ cookie ล็อกอินเป็น first-party โดยไม่ต้องตั้ง rewrite/proxy
    WEB_DIST: z.string().min(1).optional(),
    // Vercel ตั้งค่านี้ให้เองทุก build/function — ใช้ตรวจว่ากำลังรันบน Vercel
    VERCEL: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.STORAGE_DRIVER === 'vercel-blob' && !value.BLOB_READ_WRITE_TOKEN && !value.BLOB_STORE_ID) {
      context.addIssue({
        code: 'custom',
        path: ['BLOB_STORE_ID'],
        message: 'STORAGE_DRIVER=vercel-blob ต้องเชื่อม Blob store (BLOB_STORE_ID) หรือตั้ง BLOB_READ_WRITE_TOKEN',
      })
    }
    if (value.VERCEL && value.STORAGE_DRIVER === 'local') {
      context.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'บน Vercel ดิสก์ไม่ถาวร — ต้องใช้ STORAGE_DRIVER=vercel-blob' })
    }
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
