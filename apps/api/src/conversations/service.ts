import type {
  ConversationDetail,
  ConversationMessageResponse,
  ConversationSummary,
  ReportMessageInput,
} from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import * as repository from './repository.ts'

function mapMessage(message: repository.MessageRow): ConversationMessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  }
}

function otherIdOf(row: { participantAId: string; participantBId: string }, userId: string): string {
  return row.participantAId === userId ? row.participantBId : row.participantAId
}

function mapSummaryFor(
  row: repository.ConversationRow,
  userId: string,
  unreadCount: number,
  blocked: boolean,
  lastMessage?: repository.MessageRow | null,
): ConversationSummary {
  const party = row.participantAId === userId ? row.participantB : row.participantA
  const latest = lastMessage ?? row.messages[0] ?? null
  return {
    id: row.id,
    otherParty: {
      id: party.id,
      displayName: party.displayName,
      ...(party.shopProfile ? { shopName: party.shopProfile.shopName } : {}),
    },
    lastMessage: latest ? mapMessage(latest) : null,
    unreadCount,
    lastMessageAt: row.lastMessageAt.toISOString(),
    blocked,
  }
}

/**
 * สองฝั่งได้คำตอบไม่เหมือนกันโดยตั้งใจ
 *
 * ฝั่งที่เป็นคนบล็อกได้ข้อความตรงไปตรงมาพร้อมทางออก (ไปเลิกบล็อก) ส่วนฝั่งที่ถูกบล็อก
 * ได้ข้อความกลาง ๆ ที่ไม่บอกว่าถูกบล็อก — การบอกตรง ๆ มักทำให้คนที่ก่อกวนไปตามต่อ
 * ทางช่องทางอื่นแทนที่จะเลิก
 */
function rejectBlocked(blockerId: string, currentUserId: string): never {
  if (blockerId === currentUserId) {
    throw AppError.conflict('คุณบล็อกผู้ใช้นี้อยู่ กรุณาเลิกบล็อกก่อนจึงจะส่งข้อความได้')
  }
  throw AppError.forbidden('ส่งข้อความในห้องนี้ไม่ได้')
}

async function assertNoBlock(userId: string, otherUserId: string) {
  const block = await repository.findBlockBetween(userId, otherUserId)
  if (block) rejectBlocked(block.blockerId, userId)
}

/**
 * แกะ cursor รูปแบบ `<iso>|<uuid>`
 *
 * ต้องมีทั้งเวลาและ id เพราะการตัดหน้าใช้ทั้งสองค่า (ดู listMessages ใน repository)
 * รูปแบบเก่าที่มีแต่เวลายังรับได้ เผื่อ client ที่ค้างอยู่ยังส่งมาแบบนั้น
 */
function parseBefore(value: string | undefined): { createdAt: Date; id?: string } | null {
  if (!value) return null
  const separator = value.indexOf('|')
  const dateValue = separator === -1 ? value : value.slice(0, separator)
  const id = separator === -1 ? undefined : value.slice(separator + 1)
  const createdAt = new Date(dateValue)
  if (Number.isNaN(createdAt.getTime()) || (id && !/^[0-9a-f-]{36}$/i.test(id))) {
    throw AppError.validation('พารามิเตอร์ before ไม่ถูกต้อง')
  }
  return { createdAt, ...(id ? { id } : {}) }
}

/**
 * เปิดห้องกับผู้ใช้อีกคน — ได้ห้องเดิมถ้าเคยคุยกันแล้ว
 *
 * unreadCount ที่คืนกลับเป็น 0 เสมอ ไม่ได้ไปนับจริง เพราะผู้เรียกใช้ค่านี้แค่ id
 * เพื่อพาไปหน้าห้อง แล้วหน้าห้องจะดึงรายละเอียดพร้อมยอดที่ถูกต้องเองอีกที
 */
export async function start(userId: string, otherUserId: string): Promise<ConversationSummary> {
  if (userId === otherUserId) throw AppError.unprocessable('ไม่สามารถเริ่มห้องสนทนากับตัวเองได้')
  if (!(await repository.findUser(otherUserId))) throw AppError.notFound('ไม่พบผู้ใช้ที่ต้องการ')
  await assertNoBlock(userId, otherUserId)
  const row = await repository.upsertConversation(userId, otherUserId)
  return mapSummaryFor(row, userId, 0, false)
}

export async function list(userId: string): Promise<ConversationSummary[]> {
  const rows = await repository.listConversations(userId)
  const otherIds = rows.map((row) => otherIdOf(row, userId))
  const [unread, blocks] = await Promise.all([
    repository.countUnreadByConversation(userId, rows.map((row) => row.id)),
    repository.findBlocksForPairs(userId, otherIds),
  ])
  const unreadById = new Map(unread.map((row) => [row.conversationId, row._count._all]))
  const blockedIds = new Set(blocks.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))
  return rows.map((row) => {
    const otherId = otherIdOf(row, userId)
    return mapSummaryFor(row, userId, unreadById.get(row.id) ?? 0, blockedIds.has(otherId))
  })
}

export async function detail(
  userId: string,
  conversationId: string,
  before: string | undefined,
  limit: number,
): Promise<ConversationDetail> {
  const row = await repository.findConversationForParticipant(userId, conversationId)
  // 404 ไม่ใช่ 403 — คนนอกไม่ควรรู้ด้วยซ้ำว่าห้องนี้มีอยู่
  if (!row) throw AppError.notFound('ไม่พบห้องสนทนาที่ต้องการ')

  const otherUserId = otherIdOf(row, userId)
  const [messages, unreadCount, lastMessage, block] = await Promise.all([
    repository.listMessages(conversationId, parseBefore(before), limit),
    repository.countUnreadInConversation(conversationId, userId),
    repository.findLatestMessage(conversationId),
    repository.findBlockBetween(userId, otherUserId),
  ])

  // repository ดึงเกินมาหนึ่งใบเพื่อบอกว่ายังมีของเก่ากว่านี้อีกไหม
  const hasMore = messages.length > limit
  const page = (hasMore ? messages.slice(0, limit) : messages).reverse()
  return {
    ...mapSummaryFor(row, userId, unreadCount, Boolean(block), lastMessage),
    messages: page.map(mapMessage),
    hasMore,
  }
}

export async function send(userId: string, conversationId: string, content: string) {
  const row = await repository.findConversationForParticipant(userId, conversationId)
  if (!row) throw AppError.notFound('ไม่พบห้องสนทนาที่ต้องการ')
  const otherUserId = otherIdOf(row, userId)
  await assertNoBlock(userId, otherUserId)
  const message = await repository.createMessageAndNotification(userId, conversationId, otherUserId, content)
  return mapMessage(message)
}

export async function markRead(userId: string, conversationId: string) {
  if (!(await repository.findConversationForParticipant(userId, conversationId))) {
    throw AppError.notFound('ไม่พบห้องสนทนาที่ต้องการ')
  }
  await repository.markRead(conversationId, userId)
}

export async function report(userId: string, messageId: string, input: ReportMessageInput) {
  // ค้นผ่าน conversation ที่ผู้ใช้เป็นคู่สนทนา — คนนอกห้องจึงหาข้อความนี้ไม่เจอเลย
  const message = await repository.findMessageForParticipant(messageId, userId)
  if (!message) throw AppError.notFound('ไม่พบข้อความที่ต้องการ')
  if (message.senderId === userId) throw AppError.unprocessable('ไม่สามารถรายงานข้อความของตัวเองได้')
  const result = await repository.createMessageReport(userId, messageId, input.reason, input.detail)
  return { reportId: result.id }
}

export async function block(userId: string, blockedUserId: string) {
  if (userId === blockedUserId) throw AppError.unprocessable('ไม่สามารถบล็อกตัวเองได้')
  if (!(await repository.findUser(blockedUserId))) throw AppError.notFound('ไม่พบผู้ใช้ที่ต้องการ')
  await repository.createBlock(userId, blockedUserId)
}

export function unblock(userId: string, blockedUserId: string) {
  return repository.deleteBlock(userId, blockedUserId)
}

export async function blocks(userId: string) {
  const rows = await repository.findBlocks(userId)
  return rows.map((row) => ({
    userId: row.blockedId,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.blocked.id,
      displayName: row.blocked.displayName,
      ...(row.blocked.shopProfile ? { shopName: row.blocked.shopProfile.shopName } : {}),
    },
  }))
}
