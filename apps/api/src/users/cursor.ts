import { z } from 'zod'
import { AppError } from '../errors/AppError.ts'

const userProfileCursorSchema = z.object({
  userId: z.string().uuid(),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.string().uuid(),
})

export type UserProfileCursor = z.infer<typeof userProfileCursorSchema>

export function encodeUserProfileCursor(cursor: UserProfileCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeUserProfileCursor(value: string, userId: string): UserProfileCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const cursor = userProfileCursorSchema.safeParse(parsed)
    if (cursor.success && cursor.data.userId === userId) return cursor.data
  } catch {
    // Fall through to the safe, user-facing validation error below.
  }

  throw AppError.validation('Cursor ของโปรไฟล์ไม่ถูกต้องหรือหมดอายุแล้ว')
}
