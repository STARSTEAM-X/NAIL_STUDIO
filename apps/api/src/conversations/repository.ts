import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'
import { createNotification } from '../notifications/repository.ts'

const partySelect = {
  id: true,
  displayName: true,
  shopProfile: { select: { shopName: true } },
} as const

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  readAt: true,
  createdAt: true,
} as const

const conversationSelect = {
  id: true,
  participantAId: true,
  participantBId: true,
  createdById: true,
  lastMessageAt: true,
  createdAt: true,
  participantA: { select: partySelect },
  participantB: { select: partySelect },
  // ข้อความล่าสุดหนึ่งใบสำหรับแสดงตัวอย่างในกล่องข้อความ
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as Prisma.ConversationMessageOrderByWithRelationInput[],
    take: 1,
    select: messageSelect,
  },
} satisfies Prisma.ConversationSelect

export type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>
export type MessageRow = Prisma.ConversationMessageGetPayload<{ select: typeof messageSelect }>

/**
 * จัดคู่ให้ participantA เป็น uuid ที่น้อยกว่าเสมอ
 *
 * ตาราง conversations มี CHECK (participant_a_id < participant_b_id) กำกับไว้ เพราะถ้า
 * ไม่บังคับลำดับ unique key จะกันห้องซ้ำไม่ได้เลย — (A,B) กับ (B,A) เป็นคนละแถวในสายตา
 * ฐานข้อมูล คู่เดียวกันจะได้สองห้องทันทีที่ทั้งสองฝั่งกดทักพร้อมกัน
 */
export function canonicalPair(first: string, second: string) {
  return first < second
    ? { participantAId: first, participantBId: second }
    : { participantAId: second, participantBId: first }
}

export function findConversationForParticipant(userId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ participantAId: userId }, { participantBId: userId }] },
    select: conversationSelect,
  })
}

/**
 * หา-หรือ-สร้างห้อง
 *
 * upsert ของ Prisma ไม่ได้อะตอมมิกกับ insert ที่วิ่งพร้อมกันในทุกกรณี — สองแท็บที่กด
 * "ทักร้าน" พร้อมกันยังชน unique ได้ จึงต้องจับ P2002 แล้วอ่านห้องที่อีกคำขอสร้างสำเร็จ
 * กลับไปแทนที่จะโยน error ให้ผู้ใช้เห็น
 */
export function upsertConversation(userId: string, otherUserId: string) {
  const pair = canonicalPair(userId, otherUserId)
  return prisma.conversation
    .upsert({
      where: { participantAId_participantBId: pair },
      create: { ...pair, createdById: userId },
      update: {},
      select: conversationSelect,
    })
    .catch((error: unknown) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      return prisma.conversation.findUniqueOrThrow({
        where: { participantAId_participantBId: pair },
        select: conversationSelect,
      })
    })
}

/**
 * กล่องข้อความของผู้ใช้คนหนึ่ง
 *
 * ห้องที่ยังไม่มีข้อความจะโผล่เฉพาะกับคนที่เปิดห้องเอง — กันคนกดเปิดห้องเปล่ารัว ๆ
 * ใส่คนอื่นจนกล่องข้อความของปลายทางเต็มไปด้วยห้องที่ไม่มีใครพูดอะไรเลย
 */
export function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: {
      OR: [{ participantAId: userId }, { participantBId: userId }],
      AND: [{ OR: [{ createdById: userId }, { messages: { some: {} } }] }],
    },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    select: conversationSelect,
  })
}

/** นับข้อความที่ยังไม่อ่านของทั้งกล่องด้วยคำสั่งเดียว ไม่ยิงทีละห้อง */
export function countUnreadByConversation(userId: string, conversationIds: string[]) {
  if (!conversationIds.length) return Promise.resolve([])
  return prisma.conversationMessage.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: conversationIds }, senderId: { not: userId }, readAt: null },
    _count: { _all: true },
  })
}

/**
 * หาการบล็อกระหว่างผู้ใช้ปัจจุบันกับคู่สนทนาทุกคนในกล่อง
 *
 * เขียนเป็นสองสาขาที่ใช้ IN แทนการกาง OR ทีละคู่ — รายการห้อง 50 ห้องจะกลายเป็น
 * เงื่อนไข OR ร้อยก้อน ซึ่งอ่านยากและบังคับให้ตัววางแผนคิวรีทำงานหนักกว่าที่จำเป็น
 * รูปแบบนี้ใช้ PK (blocker_id, blocked_id) และ index user_blocks_target_idx ได้ตรง ๆ
 */
export function findBlocksForPairs(userId: string, otherUserIds: string[]) {
  if (!otherUserIds.length) return Promise.resolve([])
  return prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: userId, blockedId: { in: otherUserIds } },
        { blockedId: userId, blockerId: { in: otherUserIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  })
}

/** การบล็อกมีผลสองทาง จึงต้องดูทั้งสองทิศ ไม่ใช่เฉพาะที่ผู้ใช้ปัจจุบันเป็นคนบล็อก */
export function findBlockBetween(userId: string, otherUserId: string) {
  return prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  })
}

export function findUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
}

export function findBlocks(userId: string) {
  return prisma.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }],
    select: { blockedId: true, createdAt: true, blocked: { select: partySelect } },
  })
}

export function findMessageForParticipant(messageId: string, userId: string) {
  return prisma.conversationMessage.findFirst({
    where: {
      id: messageId,
      conversation: { OR: [{ participantAId: userId }, { participantBId: userId }] },
    },
    select: messageSelect,
  })
}

/**
 * ส่งข้อความ
 *
 * createdAt ถูกกำหนดจากฝั่งแอปเพื่อให้ข้อความกับ lastMessageAt ของห้องเป็นเวลาเดียวกันเป๊ะ
 * ถ้าปล่อยให้ทั้งสองคำสั่งใช้ now() ของฐานข้อมูลเอง กล่องข้อความจะเรียงเพี้ยนได้ในกรณี
 * ที่สองคำสั่งคร่อมขอบมิลลิวินาที
 */
export async function createMessageAndNotification(
  userId: string,
  conversationId: string,
  recipientId: string,
  content: string,
) {
  const createdAt = new Date()
  return prisma.$transaction(async (tx) => {
    const message = await tx.conversationMessage.create({
      data: { conversationId, senderId: userId, content, createdAt },
      select: messageSelect,
    })
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: createdAt } })
    await createNotification(tx, {
      userId: recipientId,
      kind: 'direct_message',
      title: 'มีข้อความใหม่',
      sourceType: 'conversation',
      sourceId: conversationId,
    })
    return message
  })
}

/**
 * หน้าข้อความแบบ keyset
 *
 * เงื่อนไขเป็น (createdAt < X) OR (createdAt = X AND id < Y) ไม่ใช่ createdAt อย่างเดียว
 * เพราะข้อความที่สร้างในมิลลิวินาทีเดียวกันจะถูกข้ามหรือถูกส่งซ้ำถ้าตัดด้วยเวลาล้วน
 * ดึงเกินมาหนึ่งใบเพื่อให้ผู้เรียกรู้ว่ายังมีของเก่ากว่านี้อีกไหม
 */
export function listMessages(
  conversationId: string,
  before: { createdAt: Date; id?: string } | null,
  limit: number,
) {
  return prisma.conversationMessage.findMany({
    where: {
      conversationId,
      ...(before
        ? {
            OR: [
              { createdAt: { lt: before.createdAt } },
              ...(before.id ? [{ createdAt: before.createdAt, id: { lt: before.id } }] : []),
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: messageSelect,
  })
}

export function countUnreadInConversation(conversationId: string, userId: string) {
  return prisma.conversationMessage.count({
    where: { conversationId, senderId: { not: userId }, readAt: null },
  })
}

export function markRead(conversationId: string, userId: string) {
  return prisma.conversationMessage.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  })
}

export function findLatestMessage(conversationId: string) {
  return prisma.conversationMessage.findFirst({
    where: { conversationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: messageSelect,
  })
}

/** upsert เพื่อให้กดบล็อกซ้ำไม่พัง — ผลลัพธ์ที่ผู้ใช้ต้องการคือ "ถูกบล็อกอยู่" ไม่ใช่ error */
export function createBlock(blockerId: string, blockedId: string) {
  return prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
    select: { blockerId: true, blockedId: true },
  })
}

export function deleteBlock(blockerId: string, blockedId: string) {
  return prisma.userBlock.deleteMany({ where: { blockerId, blockedId } })
}

/** upsert ด้วยกุญแจ (targetType, targetId, reporterId) — รายงานซ้ำไม่ควรสร้างคิวซ้ำ */
export function createMessageReport(
  reporterId: string,
  messageId: string,
  reason: 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'other',
  detail: string | undefined,
) {
  return prisma.contentReport.upsert({
    where: { targetType_targetId_reporterId: { targetType: 'message', targetId: messageId, reporterId } },
    create: { targetType: 'message', targetId: messageId, reporterId, reason, detail: detail ?? null },
    update: {},
    select: { id: true },
  })
}
