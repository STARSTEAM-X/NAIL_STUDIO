import { describe, expect, it } from 'vitest'
import type { ConversationMessageResponse } from '@nail-studio/contracts'
import { cursorOf, historyFor, mergeMessages } from './chatHistory.ts'

function message(
  id: string,
  createdAt: string,
  overrides: Partial<ConversationMessageResponse> = {},
): ConversationMessageResponse {
  return {
    id,
    conversationId: 'room-1',
    senderId: 'user-1',
    content: `ข้อความ ${id}`,
    readAt: null,
    createdAt,
    ...overrides,
  }
}

describe('cursorOf', () => {
  it('carries both the timestamp and the id', () => {
    expect(cursorOf(message('b2', '2026-08-19T10:00:00.000Z'))).toBe('2026-08-19T10:00:00.000Z|b2')
  })
})

describe('mergeMessages', () => {
  it('returns the live page untouched when nothing older was loaded', () => {
    const live = [message('a', '2026-08-19T10:00:00.000Z')]
    expect(mergeMessages([], live)).toBe(live)
  })

  it('puts older messages before the live page', () => {
    const older = [message('a', '2026-08-19T09:00:00.000Z'), message('b', '2026-08-19T09:30:00.000Z')]
    const live = [message('c', '2026-08-19T10:00:00.000Z')]
    expect(mergeMessages(older, live).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops duplicates and keeps the live copy, which is the fresher state', () => {
    const older = [message('a', '2026-08-19T09:00:00.000Z', { readAt: null })]
    const live = [message('a', '2026-08-19T09:00:00.000Z', { readAt: '2026-08-19T11:00:00.000Z' })]
    const merged = mergeMessages(older, live)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.readAt).toBe('2026-08-19T11:00:00.000Z')
  })

  it('breaks ties on id so messages sharing a millisecond keep a stable order', () => {
    const stamp = '2026-08-19T09:00:00.000Z'
    const older = [message('b', stamp), message('a', stamp)]
    const live = [message('c', stamp)]
    expect(mergeMessages(older, live).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('reorders correctly when the live page has drifted past the loaded history', () => {
    // ผู้ใช้อ่านย้อนหลังอยู่ แล้วมีข้อความใหม่เข้ามาจนหน้าล่าสุดไม่ต่อกับประวัติที่โหลดไว้
    const older = [message('a', '2026-08-19T09:00:00.000Z')]
    const live = [message('z', '2026-08-19T12:00:00.000Z'), message('m', '2026-08-19T11:00:00.000Z')]
    expect(mergeMessages(older, live).map((item) => item.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('historyFor', () => {
  const page = { roomId: 'room-1', messages: [message('a', '2026-08-19T09:00:00.000Z')], hasMore: true }

  it('keeps the history while the same room is open', () => {
    expect(historyFor(page, 'room-1')).toBe(page)
  })

  it('drops the history after switching rooms so it never leaks across conversations', () => {
    expect(historyFor(page, 'room-2')).toBeNull()
  })

  it('drops the history when no room is selected', () => {
    expect(historyFor(page, undefined)).toBeNull()
  })
})
