import { z } from 'zod'

export const NOTIFICATION_KINDS = [
  'post_like',
  'post_comment',
  'template_remix',
  'appointment_status',
  'appointment_message',
] as const

export const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string().min(1).max(200),
  sourceType: z.string().min(1),
  sourceId: z.string().uuid(),
  isRead: z.boolean(),
  createdAt: z.string(),
})

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
})

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type Notification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>
