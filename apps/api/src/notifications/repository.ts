import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'

export type NotificationKind = 'post_like' | 'post_comment' | 'template_remix' | 'appointment_status' | 'appointment_message'

export interface NotificationEvent {
  userId: string
  kind: NotificationKind
  title: string
  sourceType: string
  sourceId: string
}

export function createNotification(tx: Prisma.TransactionClient, event: NotificationEvent) {
  return tx.notification.create({ data: event })
}

const notificationSelect = {
  id: true,
  kind: true,
  title: true,
  sourceType: true,
  sourceId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>

export async function listForUser(userId: string, limit: number): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: notificationSelect,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])
  return { items, unreadCount }
}

export function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true } })
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
}
