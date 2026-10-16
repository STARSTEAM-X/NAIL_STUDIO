import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.ts'
import { disconnectDb } from '../db.ts'

/**
 * API ส่งหน้าเว็บเอง (WEB_DIST) — ใช้ตอน deploy เป็น service เดียวเพื่อให้ cookie เป็น first-party
 * ต้องไม่กลืน /api: เส้นทาง API ที่ไม่มีอยู่จริงยังต้องได้ 404 แบบ JSON ไม่ใช่หน้าเว็บ
 */

const dist = mkdtempSync(join(tmpdir(), 'nail-web-'))
mkdirSync(join(dist, 'assets'))
writeFileSync(join(dist, 'index.html'), '<!doctype html><div id="root"></div>')
writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)')

afterAll(async () => {
  await disconnectDb()
})

describe('serving the web app from the API', () => {
  const app = createApp({ webDist: dist })

  it('ส่ง index.html สำหรับเส้นทางของเว็บ (SPA fallback) และไม่ให้ cache', async () => {
    for (const path of ['/', '/login', '/editor/some-id']) {
      const response = await request(app).get(path)
      expect(response.status, path).toBe(200)
      expect(response.text).toContain('id="root"')
      expect(response.headers['cache-control']).toBe('no-cache')
    }
  })

  it('ไฟล์ใน /assets cache ได้ยาว', async () => {
    const response = await request(app).get('/assets/index-abc123.js')
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toContain('immutable')
  })

  it('API ยังทำงานตามเดิม และเส้นทาง API ที่ไม่มีได้ 404 แบบ JSON', async () => {
    expect((await request(app).get('/api/v1/health')).body.data.status).toBe('ok')
    const missing = await request(app).get('/api/v1/nope')
    expect(missing.status).toBe(404)
    expect(missing.body.success).toBe(false)
  })

  it('ไม่ส่งหน้าเว็บเมื่อไม่ได้ตั้ง WEB_DIST', async () => {
    const plain = createApp({ webDist: undefined })
    expect((await request(plain).get('/login')).status).toBe(404)
  })
})
