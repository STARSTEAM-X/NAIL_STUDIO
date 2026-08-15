import { describe, expect, it } from 'vitest'
import { notificationPageSchema, notificationSchema } from './notification.ts'

describe('notification contracts', () => {
  it('validates notification rows and unread counts', () => {
    const notification = {
      id: '00000000-0000-4000-8000-000000000000',
      kind: 'post_like',
      title: 'มีคนถูกใจดีไซน์',
      sourceType: 'post',
      sourceId: '00000000-0000-4000-8000-000000000001',
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    expect(notificationSchema.safeParse(notification).success).toBe(true)
    expect(notificationPageSchema.parse({ items: [notification], unreadCount: 1 }).unreadCount).toBe(1)
    expect(notificationSchema.safeParse({ ...notification, kind: 'unknown' }).success).toBe(false)
  })
})
