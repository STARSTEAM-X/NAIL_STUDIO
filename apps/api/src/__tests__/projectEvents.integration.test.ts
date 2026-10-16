import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createEmptyDocument, type ProjectVersionEvent } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { Client } from './httpClient.ts'
import { disconnectDb, prisma } from '../db.ts'

/**
 * SSE ของงานออกแบบ: editor ที่เปิดงานอยู่ต้องรู้ทันทีเมื่อ AI (API token) บันทึกเวอร์ชันใหม่
 * ใช้เซิร์ฟเวอร์จริงบนพอร์ตสุ่ม เพราะต้องอ่านสตรีมที่ไม่จบ ซึ่ง supertest รอจนจบเสมอ
 */

const stamp = Date.now()
const email = `events.${stamp}@example.test`
const outsiderEmail = `events.outsider.${stamp}@example.test`
let server: Server
let base = ''

beforeAll(async () => {
  const app = createApp()
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`
})

afterAll(async () => {
  server.close()
  await prisma.user.deleteMany({ where: { email: { in: [email, outsiderEmail] } } })
  await disconnectDb()
})

describe('project events (SSE)', () => {
  it('ส่ง version-saved ให้ผู้ที่เปิดงานอยู่เมื่อ AI บันทึกเวอร์ชันใหม่ และกันคนนอก', async () => {
    const app = createApp()
    const web = new Client(() => app)
    await web.send('get', '/health')
    await web.send('post', '/auth/register', { email, password: 'integration-test-password', displayName: 'Events' })
    const projectId = (await web.send('post', '/projects', { name: 'live' })).body.data.id as string
    const token = (await web.send('post', '/tokens', { name: 'ai' })).body.data.token as string
    const cookie = web.cookieHeader()

    const outsider = new Client(() => app)
    await outsider.send('get', '/health')
    await outsider.send('post', '/auth/register', { email: outsiderEmail, password: 'integration-test-password', displayName: 'Out' })
    const denied = await fetch(`${base}/projects/${projectId}/events`, { headers: { Cookie: outsider.cookieHeader() } })
    expect(denied.status).toBe(404)

    const controller = new AbortController()
    const stream = await fetch(`${base}/projects/${projectId}/events`, { headers: { Cookie: cookie }, signal: controller.signal })
    expect(stream.headers.get('content-type')).toContain('text/event-stream')
    const reader = stream.body!.getReader()
    const decoder = new TextDecoder()

    const received = (async (): Promise<ProjectVersionEvent> => {
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) throw new Error('stream ended')
        buffer += decoder.decode(value, { stream: true })
        const match = /event: version-saved\ndata: (.+)\n\n/.exec(buffer)
        if (match) return JSON.parse(match[1]!) as ProjectVersionEvent
      }
    })()

    const saved = await fetch(`${base}/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: createEmptyDocument(), expectedVersion: 1 }),
    })
    expect(saved.status).toBe(201)

    const event = await received
    controller.abort()
    expect(event).toEqual({ type: 'version-saved', projectId, versionNumber: 2, via: 'token' })
  })
})
