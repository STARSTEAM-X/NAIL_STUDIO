import { z } from 'zod'

/**
 * API token ส่วนตัว — ให้ AI/เครื่องมือภายนอก (เช่น NailStudio MCP server) แก้งานออกแบบแทนผู้ใช้
 *
 * token ดิบจะถูกส่งกลับ "ครั้งเดียว" ตอนสร้าง หลังจากนั้นเซิร์ฟเวอร์เก็บแค่ hash
 * สิทธิ์ของ token จำกัดไว้ที่ API งานออกแบบ (/projects) เท่านั้น
 */

export const API_TOKEN_PREFIX = 'nsk_'
export const MAX_API_TOKENS_PER_USER = 10

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาตั้งชื่อ token').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
})

export const apiTokenSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
})

export const createdApiTokenSchema = apiTokenSummarySchema.extend({
  /** token ดิบ — แสดงครั้งเดียว */
  token: z.string(),
})

export type CreateApiTokenInput = z.input<typeof createApiTokenSchema>
export type ApiTokenSummary = z.infer<typeof apiTokenSummarySchema>
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>
