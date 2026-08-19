import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

/**
 * เทสระดับฐานข้อมูลของห้องสนทนา
 *
 * เทสหน่วยใน conversations/service.test.ts mock repository ทั้งก้อน จึงพิสูจน์ได้แค่
 * ตรรกะการตัดสินใจ ส่วนของที่ยากจริงอยู่ในชั้น repository และใน schema ทั้งหมด —
 * การเรียงคู่ให้ตรงกับ CHECK, unique ที่กันห้องซ้ำ, การตัดหน้าแบบ keyset,
 * ตัวกรองห้องเปล่า และการบล็อกสองทาง — ไฟล์นี้จึงยิงผ่าน HTTP ลงฐานข้อมูลจริง
 */

const stamp = Date.now()
const password = 'conversation-integration-password'
const aliceEmail = `conversation.alice.${stamp}@example.test`
const bobEmail = `conversation.bob.${stamp}@example.test`
const strangerEmail = `conversation.stranger.${stamp}@example.test`

let app: Express
let aliceId = ''
let bobId = ''

beforeAll(() => { app = createApp() })
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [aliceEmail, bobEmail, strangerEmail] } } })
  await disconnectDb()
})

describe('conversations over the database', () => {
  const alice = new Client(() => app)
  const bob = new Client(() => app)
  const stranger = new Client(() => app)

  it('registers the three accounts', async () => {
    await alice.send('get', '/health')
    await bob.send('get', '/health')
    await stranger.send('get', '/health')
    expect((await alice.send('post', '/auth/register', { email: aliceEmail, password, displayName: 'Alice' })).status).toBe(201)
    expect((await bob.send('post', '/auth/register', { email: bobEmail, password, displayName: 'Bob' })).status).toBe(201)
    expect((await stranger.send('post', '/auth/register', { email: strangerEmail, password, displayName: 'Stranger' })).status).toBe(201)
    aliceId = (await alice.send('get', '/auth/me')).body.data.id
    bobId = (await bob.send('get', '/auth/me')).body.data.id
  })

  it('gives both directions the same room regardless of who asks first', async () => {
    const fromAlice = await alice.send('post', '/conversations', { userId: bobId })
    expect(fromAlice.status).toBe(201)
    const fromBob = await bob.send('post', '/conversations', { userId: aliceId })
    expect(fromBob.status).toBe(201)
    expect(fromBob.body.data.id).toBe(fromAlice.body.data.id)
  })

  it('stores the pair in uuid order so the CHECK constraint holds', async () => {
    const room = await prisma.conversation.findFirstOrThrow({
      where: { OR: [{ participantAId: aliceId }, { participantBId: aliceId }] },
      select: { participantAId: true, participantBId: true, createdById: true },
    })
    expect(room.participantAId < room.participantBId).toBe(true)
    // ห้องนี้ Alice เป็นคนเปิด แม้ uuid ของ Bob อาจมาก่อนก็ตาม
    expect(room.createdById).toBe(aliceId)
  })

  it('refuses a room with yourself', async () => {
    expect((await alice.send('post', '/conversations', { userId: aliceId })).status).toBe(422)
  })

  it('hides an empty room from the other participant but shows it to its creator', async () => {
    const inbox = async (client: Client) => (await client.send('get', '/conversations')).body.data as Array<{ id: string }>
    expect((await inbox(alice)).length).toBe(1)
    expect((await inbox(bob)).length).toBe(0)
  })

  it('shows the room to both once a message exists and counts unread for the recipient only', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    expect((await alice.send('post', `/conversations/${roomId}/messages`, { content: 'สวัสดีค่ะ' })).status).toBe(201)

    const bobInbox = (await bob.send('get', '/conversations')).body.data
    expect(bobInbox.length).toBe(1)
    expect(bobInbox[0].unreadCount).toBe(1)

    const aliceInbox = (await alice.send('get', '/conversations')).body.data
    expect(aliceInbox[0].unreadCount).toBe(0)

    expect((await bob.send('post', `/conversations/${roomId}/read`)).status).toBe(200)
    expect((await bob.send('get', '/conversations')).body.data[0].unreadCount).toBe(0)
  })

  it('hides the room from an outsider with 404 rather than 403', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    expect((await stranger.send('get', `/conversations/${roomId}`)).status).toBe(404)
    expect((await stranger.send('post', `/conversations/${roomId}/messages`, { content: 'ขอแทรก' })).status).toBe(404)
  })

  it('pages backwards with a keyset cursor without skipping or repeating', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    for (let index = 0; index < 5; index += 1) {
      await alice.send('post', `/conversations/${roomId}/messages`, { content: `ข้อความที่ ${index}` })
    }

    const seen: string[] = []
    let cursor: string | undefined
    let guard = 0
    for (;;) {
      guard += 1
      expect(guard).toBeLessThan(10)
      const path = `/conversations/${roomId}?limit=2${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`
      const page = (await alice.send('get', path)).body.data as {
        messages: Array<{ id: string; createdAt: string }>
        hasMore: boolean
      }
      // แต่ละหน้าเรียงเก่า→ใหม่ จึงต่อหน้าเก่ากว่าไว้ข้างหน้าเสมอ
      seen.unshift(...page.messages.map((message) => message.id))
      if (!page.hasMore || !page.messages[0]) break
      cursor = `${page.messages[0].createdAt}|${page.messages[0].id}`
    }

    expect(new Set(seen).size).toBe(seen.length)
    const stored = await prisma.conversationMessage.count({ where: { conversationId: roomId } })
    expect(seen.length).toBe(stored)
  })

  it('refuses reporting your own message and lets the other party report', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    const messageId = (await alice.send('get', `/conversations/${roomId}?limit=1`)).body.data.messages[0].id as string

    expect((await alice.send('post', `/conversations/messages/${messageId}/report`, { reason: 'spam' })).status).toBe(422)
    expect((await stranger.send('post', `/conversations/messages/${messageId}/report`, { reason: 'spam' })).status).toBe(404)

    const reported = await bob.send('post', `/conversations/messages/${messageId}/report`, { reason: 'harassment' })
    expect(reported.status).toBe(201)
    const stored = await prisma.contentReport.findFirst({ where: { targetType: 'message', targetId: messageId } })
    expect(stored?.reporterId).toBe(bobId)
  })

  it('stops messages in both directions once either side blocks', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    expect((await bob.send('post', '/blocks', { userId: aliceId })).status).toBe(201)

    // ฝั่งที่บล็อกได้ 409 พร้อมทางออก ฝั่งที่ถูกบล็อกได้ 403 ที่ไม่บอกว่าถูกบล็อก
    const blockerAttempt = await bob.send('post', `/conversations/${roomId}/messages`, { content: 'ยังส่งได้ไหม' })
    expect(blockerAttempt.status).toBe(409)

    const blockedAttempt = await alice.send('post', `/conversations/${roomId}/messages`, { content: 'ยังส่งได้ไหม' })
    expect(blockedAttempt.status).toBe(403)
    expect(JSON.stringify(blockedAttempt.body)).not.toContain('บล็อก')
  })

  it('lets messages through again after unblocking', async () => {
    const roomId = (await alice.send('get', '/conversations')).body.data[0].id as string
    expect((await bob.send('delete', `/blocks/${aliceId}`)).status).toBe(200)
    expect((await alice.send('post', `/conversations/${roomId}/messages`, { content: 'กลับมาคุยได้แล้ว' })).status).toBe(201)
  })

  it('notifies the recipient with the direct_message kind', async () => {
    const notifications = await prisma.notification.findMany({
      where: { userId: bobId, kind: 'direct_message' },
      select: { sourceType: true, sourceId: true },
    })
    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications[0]?.sourceType).toBe('conversation')
  })
})
