import { z } from 'zod'

/**
 * รูปแบบคำตอบของ API ที่ทุก endpoint ต้องใช้เหมือนกัน
 * ฝั่ง client จึงเขียนตัวจัดการ error ที่เดียวได้ ไม่ต้องเดารูปแบบต่อ endpoint
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: { nextCursor: string | null }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
