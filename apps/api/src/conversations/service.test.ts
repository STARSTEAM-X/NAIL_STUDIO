import { beforeEach, describe, expect, it, vi } from 'vitest'

const repositoryMock = vi.hoisted(() => ({
  findUser: vi.fn(),
  findBlockBetween: vi.fn(),
  upsertConversation: vi.fn(),
  findConversationForParticipant: vi.fn(),
  listConversations: vi.fn(),
  countUnreadByConversation: vi.fn(),
  findBlocksForPairs: vi.fn(),
  listMessages: vi.fn(),
  countUnreadInConversation: vi.fn(),
  findLatestMessage: vi.fn(),
  createMessageAndNotification: vi.fn(),
  markRead: vi.fn(),
  findMessageForParticipant: vi.fn(),
  createMessageReport: vi.fn(),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  findBlocks: vi.fn(),
}))
vi.mock('./repository.ts', () => repositoryMock)
import * as service from './service.ts'

const ids = { a: '00000000-0000-0000-0000-000000000001', b: '00000000-0000-0000-0000-000000000002', c: '00000000-0000-0000-0000-000000000003', room: '10000000-0000-0000-0000-000000000001', m1: '20000000-0000-0000-0000-000000000001', m2: '20000000-0000-0000-0000-000000000002' }
const date = '2026-08-19T00:00:00.000Z'
function message(id = ids.m1, senderId = ids.a, createdAt = date) { return { id, conversationId: ids.room, senderId, content: 'hello', readAt: null, createdAt: new Date(createdAt) } }
function row(userId = ids.a, otherId = ids.b, messages = [message()]) {
  const a = userId < otherId ? userId : otherId
  const b = userId < otherId ? otherId : userId
  return { id: ids.room, participantAId: a, participantBId: b, createdById: userId, lastMessageAt: new Date(date), createdAt: new Date(date), participantA: { id: a, displayName: 'A', shopProfile: null }, participantB: { id: b, displayName: 'B', shopProfile: null }, messages }
}
beforeEach(() => {
  vi.clearAllMocks()
  repositoryMock.findUser.mockResolvedValue({ id: ids.b })
  repositoryMock.findBlockBetween.mockResolvedValue(null)
  repositoryMock.upsertConversation.mockResolvedValue(row())
  repositoryMock.findConversationForParticipant.mockResolvedValue(row())
  repositoryMock.listMessages.mockResolvedValue([message()])
  repositoryMock.countUnreadInConversation.mockResolvedValue(1)
  repositoryMock.findLatestMessage.mockResolvedValue(message())
  repositoryMock.createMessageAndNotification.mockResolvedValue(message(ids.m2, ids.a, '2026-08-19T00:01:00.000Z'))
  repositoryMock.findMessageForParticipant.mockResolvedValue(message(ids.m1, ids.b))
  repositoryMock.createMessageReport.mockResolvedValue({ id: ids.m1 })
})

describe('conversation service', () => {
  it('returns the same room for A to B and B to A', async () => {
    const first = await service.start(ids.a, ids.b)
    const second = await service.start(ids.b, ids.a)
    expect(first.id).toBe(second.id)
    expect(repositoryMock.upsertConversation).toHaveBeenCalledTimes(2)
  })
  it('returns one room when concurrent starts resolve the same upsert result', async () => {
    repositoryMock.upsertConversation.mockResolvedValue(row())
    const rooms = await Promise.all([service.start(ids.a, ids.b), service.start(ids.b, ids.a)])
    expect(new Set(rooms.map((room) => room.id)).size).toBe(1)
  })
  it('rejects starting a conversation with self with 422', async () => {
    await expect(service.start(ids.a, ids.a)).rejects.toMatchObject({ status: 422 })
  })
  it('hides a conversation from a non-participant with 404', async () => {
    repositoryMock.findConversationForParticipant.mockResolvedValue(null)
    await expect(service.detail(ids.c, ids.room, undefined, 50)).rejects.toMatchObject({ status: 404 })
  })
  it('counts only the other party unread messages and reads only the other party', async () => {
    repositoryMock.countUnreadInConversation.mockResolvedValue(3)
    const result = await service.detail(ids.a, ids.room, undefined, 50)
    expect(result.unreadCount).toBe(3)
    await service.markRead(ids.a, ids.room)
    expect(repositoryMock.markRead).toHaveBeenCalledWith(ids.room, ids.a)
  })
  it('moves lastMessageAt when sending and notifies only the recipient', async () => {
    await service.send(ids.a, ids.room, 'hello')
    expect(repositoryMock.createMessageAndNotification).toHaveBeenCalledWith(ids.a, ids.room, ids.b, 'hello')
  })
  it('uses both createdAt and id for cursor pagination ties', async () => {
    await service.detail(ids.a, ids.room, date + '|' + ids.m1, 1)
    expect(repositoryMock.listMessages).toHaveBeenCalledWith(ids.room, { createdAt: new Date(date), id: ids.m1 }, 1)
  })
  it('blocks sending in both directions', async () => {
    repositoryMock.findBlockBetween.mockResolvedValue({ blockerId: ids.a, blockedId: ids.b })
    await expect(service.send(ids.a, ids.room, 'x')).rejects.toMatchObject({ status: 409 })
    repositoryMock.findBlockBetween.mockResolvedValue({ blockerId: ids.a, blockedId: ids.b })
    await expect(service.send(ids.b, ids.room, 'x')).rejects.toMatchObject({ status: 403, message: 'ส่งข้อความในห้องนี้ไม่ได้' })
  })
  it('allows sending after unblock', async () => {
    repositoryMock.findBlockBetween.mockResolvedValueOnce({ blockerId: ids.a, blockedId: ids.b }).mockResolvedValueOnce(null)
    await expect(service.send(ids.a, ids.room, 'x')).rejects.toMatchObject({ status: 409 })
    await expect(service.send(ids.a, ids.room, 'x')).resolves.toBeDefined()
  })
  it('returns 404 when an outsider reports a message', async () => {
    repositoryMock.findMessageForParticipant.mockResolvedValue(null)
    await expect(service.report(ids.c, ids.m1, { reason: 'spam' })).rejects.toMatchObject({ status: 404 })
  })
  it('rejects reporting own message with 422', async () => {
    repositoryMock.findMessageForParticipant.mockResolvedValue(message(ids.m1, ids.a))
    await expect(service.report(ids.a, ids.m1, { reason: 'spam' })).rejects.toMatchObject({ status: 422 })
  })
  it('creates a message report for moderation', async () => {
    const result = await service.report(ids.a, ids.m1, { reason: 'harassment', detail: 'detail' })
    expect(result.reportId).toBe(ids.m1)
    expect(repositoryMock.createMessageReport).toHaveBeenCalledWith(ids.a, ids.m1, 'harassment', 'detail')
  })
  it('shows an empty room to its creator but not to the other participant', async () => {
    repositoryMock.listConversations.mockResolvedValue([row(ids.a, ids.b, [])])
    repositoryMock.countUnreadByConversation.mockResolvedValue([])
    repositoryMock.findBlocksForPairs.mockResolvedValue([])
    const result = await service.list(ids.a)
    expect(result).toHaveLength(1)
    repositoryMock.listConversations.mockResolvedValue([])
    expect(await service.list(ids.b)).toHaveLength(0)
  })
  it('uses one groupBy result for the whole inbox', async () => {
    repositoryMock.listConversations.mockResolvedValue([row(), row(ids.a, ids.c)])
    repositoryMock.countUnreadByConversation.mockResolvedValue([{ conversationId: ids.room, _count: { _all: 2 } }])
    repositoryMock.findBlocksForPairs.mockResolvedValue([])
    await service.list(ids.a)
    expect(repositoryMock.countUnreadByConversation).toHaveBeenCalledTimes(1)
    expect(repositoryMock.countUnreadByConversation.mock.calls[0]![1]).toHaveLength(2)
  })
})
