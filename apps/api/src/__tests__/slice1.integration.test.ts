import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createEmptyDocument, type DesignDocument } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { Client } from './httpClient.ts'
import { disconnectDb, prisma } from '../db.ts'

/**
 * Integration test ของ walking skeleton (Slice 1)
 *
 * ทดสอบกับ PostgreSQL จริง ไม่ mock Prisma — เพราะสิ่งที่อยากพิสูจน์คือ
 * "ทุกชั้นต่อกันได้จริง" ซึ่งการ mock ฐานข้อมูลจะทำให้พิสูจน์ไม่ได้เลย
 *
 * ครอบคลุมทั้งเส้นทางที่ต้องสำเร็จและเส้นทางที่ต้องถูกปฏิเสธ —
 * ระบบที่ยอมทุกอย่างจะผ่านการทดสอบเฉพาะเส้นทางสำเร็จได้เหมือนกัน
 */

const PASSWORD = 'integration-test-password'
const stamp = Date.now()
const emailA = `slice1.a.${stamp}@example.test`
const emailB = `slice1.b.${stamp}@example.test`

let app: Express

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  // เก็บกวาดข้อมูลของเทสนี้เท่านั้น ไม่แตะข้อมูลอื่นในฐานข้อมูล
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } })
  await disconnectDb()
})

describe('Slice 1 — walking skeleton', () => {
  const clientA = new Client(() => app)
  const clientB = new Client(() => app)
  let projectId = ''
  let document: DesignDocument

  it('health ตอบ ok และออก CSRF cookie ให้ตั้งแต่ GET แรก', async () => {
    const result = await clientA.send('get', '/health')
    expect(result.status).toBe(200)
    expect(result.body.data.status).toBe('ok')
    expect(clientA.csrf()).not.toBe('')
  })

  it('ปฏิเสธคำขอที่เปลี่ยนข้อมูลแต่ไม่มีโทเคน CSRF', async () => {
    const result = await clientA.sendWithoutCsrf('/auth/register', {
      email: emailA,
      password: PASSWORD,
      displayName: 'ผู้ใช้ A',
    })
    expect(result.status).toBe(403)
    expect(result.body.error.code).toBe('FORBIDDEN')
  })

  it('ปฏิเสธรหัสผ่านที่สั้นเกินเกณฑ์ พร้อมบอกฟิลด์ที่ผิด', async () => {
    const result = await clientA.send('post', '/auth/register', {
      email: `weak.${stamp}@example.test`,
      password: 'sh0rt',
      displayName: 'สั้น',
    })
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('VALIDATION_ERROR')
    expect(result.body.error.details?.length).toBeGreaterThan(0)
  })

  it('สมัครสมาชิกได้ และไม่ส่ง passwordHash กลับมา', async () => {
    const result = await clientA.send('post', '/auth/register', {
      email: emailA,
      password: PASSWORD,
      displayName: 'ผู้ใช้ A',
    })
    expect(result.status).toBe(201)
    expect(result.body.data.email).toBe(emailA)
    expect(result.body.data).not.toHaveProperty('passwordHash')
    expect(clientA.has('nsid')).toBe(true)
  })

  it('สมัครด้วยอีเมลซ้ำถูกปฏิเสธ', async () => {
    const result = await clientA.send('post', '/auth/register', {
      email: emailA,
      password: PASSWORD,
      displayName: 'ซ้ำ',
    })
    expect(result.status).toBe(409)
  })

  it('/auth/me คืนผู้ใช้ที่ล็อกอินอยู่ และ 401 เมื่อยังไม่ล็อกอิน', async () => {
    const mine = await clientA.send('get', '/auth/me')
    expect(mine.status).toBe(200)
    expect(mine.body.data.email).toBe(emailA)

    const anonymous = new Client(() => app)
    await anonymous.send('get', '/health')
    const theirs = await anonymous.send('get', '/auth/me')
    expect(theirs.status).toBe(401)
  })

  it('แก้ไขชื่อโปรไฟล์ของบัญชีที่ล็อกอินอยู่ได้เท่านั้น', async () => {
    const updated = await clientA.send('patch', '/auth/me', { displayName: 'ผู้ใช้ A คนใหม่' })
    expect(updated.status).toBe(200)
    expect(updated.body.data.displayName).toBe('ผู้ใช้ A คนใหม่')
    expect(updated.body.data.email).toBe(emailA)

    const mine = await clientA.send('get', '/auth/me')
    expect(mine.body.data.displayName).toBe('ผู้ใช้ A คนใหม่')

    const anonymous = new Client(() => app)
    await anonymous.send('get', '/health')
    const unauthorized = await anonymous.send('patch', '/auth/me', { displayName: 'ไม่ควรแก้ได้' })
    expect(unauthorized.status).toBe(401)

    const invalid = await clientA.send('patch', '/auth/me', { displayName: ' ' })
    expect(invalid.status).toBe(400)
  })

  it('ล็อกอินผิดรหัสได้ข้อความเดียวกับอีเมลที่ไม่มีอยู่จริง', async () => {
    const wrongPassword = await clientA.send('post', '/auth/login', {
      email: emailA,
      password: 'ไม่ใช่รหัสผ่านที่ถูกต้อง',
    })
    const missingAccount = await clientA.send('post', '/auth/login', {
      email: `ghost.${stamp}@example.test`,
      password: PASSWORD,
    })
    expect(wrongPassword.status).toBe(401)
    expect(missingAccount.status).toBe(401)
    // ข้อความต้องเหมือนกันเป๊ะ ไม่งั้นผู้โจมตีไล่หาได้ว่าอีเมลไหนมีบัญชีอยู่
    expect(wrongPassword.body.error.message).toBe(missingAccount.body.error.message)
  })

  it('สร้างงานใหม่แล้วได้เอกสารเปล่าที่มีเล็บครบ 10 นิ้ว', async () => {
    const created = await clientA.send('post', '/projects', { name: 'งานทดสอบ Slice 1' })
    expect(created.status).toBe(201)
    expect(created.body.data.versionCount).toBe(1)
    projectId = created.body.data.id

    const detail = await clientA.send('get', `/projects/${projectId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.version.number).toBe(1)
    expect(Object.keys(detail.body.data.version.document.nails)).toHaveLength(10)
    expect(detail.body.data.version.document.schemaVersion).toBe(2)
    document = detail.body.data.version.document
  })

  it('บันทึกเวอร์ชันใหม่แล้วโหลดกลับได้ค่าที่แก้จริง', async () => {
    document.hand.skinTone = '#d8a882'
    const saved = await clientA.send('post', `/projects/${projectId}/versions`, {
      document,
      expectedVersion: 1,
    })
    expect(saved.status).toBe(201)
    expect(saved.body.data.versionNumber).toBe(2)

    const reloaded = await clientA.send('get', `/projects/${projectId}`)
    expect(reloaded.body.data.version.number).toBe(2)
    expect(reloaded.body.data.version.document.hand.skinTone).toBe('#d8a882')
  })

  it('บันทึกทับด้วยเลขเวอร์ชันเก่าถูกปฏิเสธ (optimistic concurrency)', async () => {
    const stale = await clientA.send('post', `/projects/${projectId}/versions`, {
      document,
      expectedVersion: 1,
    })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('CONFLICT')
  })

  it('ปฏิเสธเอกสารที่ผิด schema', async () => {
    const broken = createEmptyDocument() as unknown as Record<string, any>
    broken.hand.skinTone = 'ไม่ใช่รหัสสี'
    const result = await clientA.send('post', `/projects/${projectId}/versions`, {
      document: broken,
      expectedVersion: 2,
    })
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ผู้ใช้อื่นเข้าถึงงานไม่ได้ และได้ 404 ไม่ใช่ 403', async () => {
    await clientB.send('get', '/health')
    await clientB.send('post', '/auth/register', {
      email: emailB,
      password: PASSWORD,
      displayName: 'ผู้ใช้ B',
    })

    const read = await clientB.send('get', `/projects/${projectId}`)
    const remove = await clientB.send('delete', `/projects/${projectId}`)
    const list = await clientB.send('get', '/projects')

    // 404 ไม่ใช่ 403 — การตอบ 403 เท่ากับยืนยันว่า id นี้มีอยู่จริง
    expect(read.status).toBe(404)
    expect(remove.status).toBe(404)
    expect(list.body.data).toHaveLength(0)
  })

  it('ทุก error มี requestId สำหรับตามรอยใน log', async () => {
    const result = await clientA.send('get', '/projects/00000000-0000-0000-0000-000000000000')
    expect(result.status).toBe(404)
    expect(result.body.error.requestId).toBeTruthy()
  })

  it('route param ที่ไม่ใช่ uuid ถูกปฏิเสธ', async () => {
    const result = await clientA.send('get', '/projects/not-a-uuid')
    expect(result.status).toBe(400)
  })

  it('ออกจากระบบแล้วเข้าถึงข้อมูลไม่ได้อีก', async () => {
    const loggedOut = await clientA.send('post', '/auth/logout')
    expect(loggedOut.status).toBe(200)

    const after = await clientA.send('get', '/auth/me')
    expect(after.status).toBe(401)
  })
})
