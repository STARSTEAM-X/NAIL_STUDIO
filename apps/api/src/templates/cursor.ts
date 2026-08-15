import { z } from 'zod'
import { AppError } from '../errors/AppError.ts'

const cursorBaseSchema = z.object({
  sort: z.enum(['latest', 'popular']),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  id: z.string().uuid(),
})

const popularCursorSchema = cursorBaseSchema.extend({
  sort: z.literal('popular'),
  likeCount: z.number().int().nonnegative(),
})

const latestCursorSchema = cursorBaseSchema.extend({ sort: z.literal('latest') })

export type LatestCursor = z.infer<typeof latestCursorSchema>
export type PopularCursor = z.infer<typeof popularCursorSchema>
export type TemplateFeedCursor = LatestCursor | PopularCursor

export function encodeTemplateCursor(cursor: TemplateFeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeTemplateCursor(value: string, sort: 'latest' | 'popular'): TemplateFeedCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    const cursor = sort === 'latest'
      ? latestCursorSchema.safeParse(parsed)
      : popularCursorSchema.safeParse(parsed)
    if (cursor.success) return cursor.data
  } catch {
    // Fall through to the safe, user-facing validation error below.
  }

  throw AppError.validation('Cursor ของฟีดไม่ถูกต้องหรือหมดอายุแล้ว')
}
