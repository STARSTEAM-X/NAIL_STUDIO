import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createEmptyDocument } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { Client } from './httpClient.ts'
import { disconnectDb, prisma } from '../db.ts'

/**
 * API token สำหรับ AI/MCP — พิสูจน์ทั้งทางที่ต้องได้ และทางที่ต้องถูกปฏิเสธ:
 * token แก้งานออกแบบได้โดยไม่ต้องมี CSRF แต่แตะ API อื่นไม่ได้ จัดการ token ด้วยกันเองไม่ได้
 * และใช้ไม่ได้ทันทีหลังถูกยกเลิก
 */

const stamp = Date.now()
const email = `tokens.${stamp}@example.test`
const otherEmail = `tokens.other.${stamp}@example.test`
const PASSWORD = 'integration-test-password'

let app: Express

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } })
  await disconnectDb()
})

const bearer = (token: string) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object) => request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${token}`).send(body),
})

describe('API tokens', () => {
  const web = new Client(() => app)
  const other = new Client(() => app)
  let token = ''
  let tokenId = ''
  let projectId = ''

  it('ผู้ใช้ที่ล็อกอินผ่านเว็บสร้าง token ได้ และเห็น token ดิบครั้งเดียว', async () => {
    await web.send('get', '/health')
    expect((await web.send('post', '/auth/register', { email, password: PASSWORD, displayName: 'Token user' })).status).toBe(201)
    const created = await web.send('post', '/tokens', { name: 'Claude Desktop' })
    expect(created.status).toBe(201)
    token = created.body.data.token
    tokenId = created.body.data.id
    expect(token).toMatch(/^nsk_/)
    expect(created.body.data.prefix).toBe(token.slice(0, 10))

    const listed = await web.send('get', '/tokens')
    expect(listed.body.data).toHaveLength(1)
    expect(listed.body.data[0]).not.toHaveProperty('token')
  })

  it('token สร้างงานและบันทึกเวอร์ชันได้โดยไม่ต้องมี CSRF', async () => {
    const created = await bearer(token).post('/projects', { name: 'จาก MCP' })
    expect(created.status).toBe(201)
    projectId = created.body.data.id
    const document = createEmptyDocument()
    document.nails['right.index'].baseColor = '#123456'
    const saved = await bearer(token).post(`/projects/${projectId}/versions`, { document, expectedVersion: 1 })
    expect(saved.status).toBe(201)
    const read = await bearer(token).get(`/projects/${projectId}`)
    expect(read.body.data.version.document.nails['right.index'].baseColor).toBe('#123456')
  })

  it('token แตะ API ที่ไม่ใช่งานออกแบบไม่ได้ และจัดการ token ด้วยกันเองไม่ได้', async () => {
    expect((await bearer(token).get('/notifications')).status).toBe(403)
    expect((await bearer(token).post('/tokens', { name: 'ต่ออายุตัวเอง' })).status).toBe(403)
    expect((await bearer(token).get('/tokens')).status).toBe(403)
  })

  it('token ปลอมหรือผิดรูปแบบถูกปฏิเสธ', async () => {
    expect((await bearer('nsk_not-a-real-token').get('/projects')).status).toBe(401)
    expect((await bearer('random').get('/projects')).status).toBe(401)
  })

  it('ผู้ใช้อื่นยกเลิก token ของเราไม่ได้ และหลังเจ้าของยกเลิกแล้ว token ใช้ไม่ได้ทันที', async () => {
    await other.send('get', '/health')
    await other.send('post', '/auth/register', { email: otherEmail, password: PASSWORD, displayName: 'Other' })
    expect((await other.send('delete', `/tokens/${tokenId}`)).status).toBe(404)
    expect((await bearer(token).get('/projects')).status).toBe(200)

    expect((await web.send('delete', `/tokens/${tokenId}`)).status).toBe(200)
    expect((await bearer(token).get('/projects')).status).toBe(401)
    expect((await web.send('get', '/tokens')).body.data).toHaveLength(0)
  })

  it('cookie ที่เบราว์เซอร์แนบมาไม่มีผลเมื่อมี header Bearer (กัน CSRF ผ่านช่อง token)', async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', `nsid=whatever`)
      .set('Authorization', 'Bearer nsk_invalid')
      .send({ name: 'x' })
    expect(response.status).toBe(401)
  })
})
