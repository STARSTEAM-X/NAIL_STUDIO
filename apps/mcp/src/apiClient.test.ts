import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NailStudioApi } from './apiClient.ts'

describe('NailStudioApi — token จากไฟล์', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nail-mcp-'))
  const file = join(dir, 'token')

  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(file, { force: true })
  })

  it('ยังไม่มีไฟล์: บอกวิธีแก้พร้อม path และไม่ยิงคำขอ', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const api = new NailStudioApi({ baseUrl: 'http://api.test', tokenFile: file })
    await expect(api.listProjects()).rejects.toSatisfy((error: unknown) =>
      error instanceof ApiError && error.status === 401 && error.message.includes(file))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('อ่าน token ใหม่ทุกครั้ง — เปลี่ยนไฟล์แล้วใช้ค่าใหม่ทันทีโดยไม่ต้องรีสตาร์ท', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      seen.push((init.headers as Record<string, string>).Authorization!)
      return new Response(JSON.stringify({ success: true, data: [], meta: { nextCursor: null } }), { status: 200 })
    }))
    const api = new NailStudioApi({ baseUrl: 'http://api.test', tokenFile: file })
    writeFileSync(file, 'nsk_first\n')
    await api.listProjects()
    writeFileSync(file, 'nsk_second')
    await api.listProjects()
    expect(seen).toEqual(['Bearer nsk_first', 'Bearer nsk_second'])
  })

  it('อ่านรายการงานตามรูปแบบ response จริงของ API (data เป็น array, cursor อยู่ใน meta)', async () => {
    writeFileSync(file, 'nsk_x')
    const project = { id: 'p1', name: 'งาน', status: 'draft', versionCount: 2, updatedAt: '2026-10-17T00:00:00.000Z' }
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: [project], meta: { nextCursor: null } }), { status: 200 })))
    const api = new NailStudioApi({ baseUrl: 'http://api.test', tokenFile: file })
    expect(await api.listProjects()).toEqual([project])
  })
})
