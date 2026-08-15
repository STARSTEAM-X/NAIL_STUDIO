import type { NotificationPage } from '@nail-studio/contracts'
import * as repository from './repository.ts'

export async function list(userId: string, limit: number): Promise<NotificationPage> {
  const result = await repository.listForUser(userId, limit)
  return {
    unreadCount: result.unreadCount,
    items: result.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

export async function read(userId: string, notificationId: string): Promise<void> {
  await repository.markRead(userId, notificationId)
}

export async function readAll(userId: string): Promise<void> {
  await repository.markAllRead(userId)
}
