import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createEmptyDocument, type DesignDocument, type Stroke } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { Client } from './httpClient.ts'
import { disconnectDb, prisma } from '../db.ts'

/**
 * Integration test ของการบันทึกงานค้าง (Slice 2)
 *
 * สิ่งที่ต้องพิสูจน์: autosave เก็บงานได้จริงโดยไม่สร้างเวอร์ชันเพิ่ม, งานที่ตั้งใจ
 * บันทึกชนะงานที่แค่ค้างอยู่เสมอ และ autosave ไม่มีวันเขียนทับงานที่คนอื่นบันทึกไว้
 */

const PASSWORD = 'integration-test-password'
const stamp = Date.now()
const emailA = `slice2.a.${stamp}@example.test`
const emailB = `slice2.b.${stamp}@example.test`

let app: Express

function withStroke(color: string): DesignDocument {
  const document = createEmptyDocument()
  const stroke: Stroke = {
    kind: 'brush', brush: 'round', color, size: 100, opacity: 1, softness: 0.25,
    points: [{ x: 0.4, y: 0.4, p: 0.8 }, { x: 0.6, y: 0.6, p: 0.9 }],
  }
  document.nails['right.index'].layers[0]!.strokes.push(stroke)
  return document
}

function colorOf(document: DesignDocument): string | undefined {
  const stroke = document.nails['right.index'].layers[0]?.strokes[0]
  return stroke && stroke.kind === 'brush' ? stroke.color : undefined
}

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } })
  await disconnectDb()
})

describe('Slice 2 — งานค้างและการบันทึกเวอร์ชัน', () => {
  const client = new Client(() => app)
  const other = new Client(() => app)
  let projectId = ''

  it('เตรียมผู้ใช้และงานสำหรับทดสอบ', async () => {
    await client.send('get', '/auth/me')
    const registered = await client.send('post', '/auth/register', {
      email: emailA, password: PASSWORD, displayName: 'ผู้ทดสอบ ก',
    })
    expect(registered.status).toBe(201)

    const created = await client.send('post', '/projects', { name: 'งานทดสอบ Slice 2' })
    expect(created.status).toBe(201)
    projectId = created.body.data.id
  })

  it('บันทึกงานค้างแล้วอ่านกลับมาได้ครบ', async () => {
    const saved = await client.send('put', `/projects/${projectId}/draft`, {
      document: withStroke('#112233'), baseVersion: 1,
    })
    expect(saved.status).toBe(200)

    const detail = await client.send('get', `/projects/${projectId}`)
    expect(colorOf(detail.body.data.draft.document)).toBe('#112233')
  })

  it('งานค้างไม่สร้างเวอร์ชันใหม่ ไม่ว่าจะบันทึกกี่ครั้ง', async () => {
    // เหตุผลทั้งหมดที่ draft มีอยู่ — ถ้าข้อนี้พัง รายการเวอร์ชันจะมีหลายร้อยแถว
    // ต่อการนั่งวาดหนึ่งชั่วโมงจนหาเวอร์ชันที่ตั้งใจบันทึกไว้ไม่เจอ
    for (const color of ['#aa0000', '#00aa00', '#0000aa']) {
      const saved = await client.send('put', `/projects/${projectId}/draft`, {
        document: withStroke(color), baseVersion: 1,
      })
      expect(saved.status).toBe(200)
    }
    const detail = await client.send('get', `/projects/${projectId}`)
    expect(detail.body.data.version.number).toBe(1)
    expect(detail.body.data.project.versionCount).toBe(1)
    expect(colorOf(detail.body.data.draft.document)).toBe('#0000aa')
  })

  it('เวอร์ชันที่บันทึกไว้ยังเป็นของเดิม ไม่ถูกงานค้างเขียนทับ', async () => {
    const detail = await client.send('get', `/projects/${projectId}`)
    expect(colorOf(detail.body.data.version.document)).toBeUndefined()
  })

  it('กดบันทึกเวอร์ชันแล้วงานค้างถูกล้าง เพราะถูกรวมเข้าเวอร์ชันไปแล้ว', async () => {
    const saved = await client.send('post', `/projects/${projectId}/versions`, {
      document: withStroke('#0000aa'), expectedVersion: 1,
    })
    expect(saved.status).toBe(201)

    const detail = await client.send('get', `/projects/${projectId}`)
    expect(detail.body.data.version.number).toBe(2)
    expect(detail.body.data.draft).toBeNull()
    expect(colorOf(detail.body.data.version.document)).toBe('#0000aa')
  })

  it('งานค้างที่ต่อยอดจากเวอร์ชันเก่าถูกปฏิเสธ ไม่ใช่เขียนทับ', async () => {
    // autosave ที่เขียนทับงานที่คนอื่นตั้งใจบันทึกคือความเสียหายที่ผู้ใช้ไม่มีทางทันสังเกต
    // เพราะมันเกิดเองโดยไม่ได้สั่ง
    const stale = await client.send('put', `/projects/${projectId}/draft`, {
      document: withStroke('#ff0000'), baseVersion: 1,
    })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('CONFLICT')
  })

  it('เอกสารที่ผิดรูปแบบถูกปฏิเสธก่อนถึงฐานข้อมูล', async () => {
    const broken = await client.send('put', `/projects/${projectId}/draft`, {
      document: { schemaVersion: 2, nails: {} }, baseVersion: 2,
    })
    expect(broken.status).toBe(400)
  })

  it('คนอื่นบันทึกงานค้างของเราไม่ได้ และไม่ถูกบอกว่างานนี้มีอยู่จริง', async () => {
    await other.send('get', '/auth/me')
    await other.send('post', '/auth/register', {
      email: emailB, password: PASSWORD, displayName: 'ผู้ทดสอบ ข',
    })
    const attempt = await other.send('put', `/projects/${projectId}/draft`, {
      document: createEmptyDocument(), baseVersion: 2,
    })
    // 404 ไม่ใช่ 403 — การตอบ 403 คือการยืนยันว่ารหัสงานนี้มีอยู่จริง
    expect(attempt.status).toBe(404)
  })

  it('ต้องล็อกอินก่อนจึงบันทึกงานค้างได้', async () => {
    const anonymous = new Client(() => app)
    await anonymous.send('get', '/auth/me')
    const attempt = await anonymous.send('put', `/projects/${projectId}/draft`, {
      document: createEmptyDocument(), baseVersion: 2,
    })
    expect(attempt.status).toBe(401)
  })
})
