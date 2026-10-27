import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * จำลอง PostgreSQL: notify() ส่งข้อความไปยังทุก LISTEN client ที่เปิดอยู่ — เหมือนสองโปรเซส
 * ที่ใช้ DB เดียวกัน ทำให้ตรวจได้ว่า event ไม่ได้วิ่งผ่าน EventEmitter ในโปรเซสโดยตรง
 */
const fake = vi.hoisted(() => ({
  clients: [] as Array<EventEmitter & { listening: boolean; ended: boolean; failConnect: boolean }>,
  failNextConnect: false,
}))

vi.mock('../db.ts', () => ({
  notify: async (channel: string, payload: string) => {
    for (const client of fake.clients) {
      if (client.listening && !client.ended) client.emit('notification', { channel, payload, processId: 1 })
    }
  },
  createListenClient: () => {
    const client = Object.assign(new EventEmitter(), {
      listening: false,
      ended: false,
      failConnect: fake.failNextConnect,
      connect: async () => {
        if (client.failConnect) throw new Error('connect refused')
      },
      query: async (sql: string) => {
        if (sql.startsWith('LISTEN')) client.listening = true
      },
      end: async () => {
        client.ended = true
      },
    })
    fake.failNextConnect = false
    fake.clients.push(client)
    return client
  },
}))

const { publishVersionSaved, subscribeProject } = await import('./events.ts')

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  fake.clients.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('project events over LISTEN/NOTIFY', () => {
  it('delivers a published event to subscribers of that project only', async () => {
    const received: unknown[] = []
    const other: unknown[] = []
    const stopA = await subscribeProject('p1', (event) => received.push(event))
    const stopB = await subscribeProject('p2', (event) => other.push(event))

    publishVersionSaved({ projectId: 'p1', versionNumber: 3, via: 'token' })
    await flush()

    expect(received).toEqual([{ type: 'version-saved', projectId: 'p1', versionNumber: 3, via: 'token' }])
    expect(other).toEqual([])
    // ทั้ง instance ใช้ LISTEN connection เดียว
    expect(fake.clients).toHaveLength(1)
    stopA()
    stopB()
  })

  it('closes the LISTEN connection when the last subscriber leaves, and reopens on demand', async () => {
    const stop = await subscribeProject('p1', () => {})
    stop()
    stop() // เรียกซ้ำต้องไม่ทำให้ตัวนับติดลบ
    expect(fake.clients[0]!.ended).toBe(true)

    const again = await subscribeProject('p1', () => {})
    expect(fake.clients).toHaveLength(2)
    expect(fake.clients[1]!.listening).toBe(true)
    again()
  })

  it('reconnects after the connection drops while someone is still listening', async () => {
    vi.useFakeTimers()
    const received: unknown[] = []
    const stop = await subscribeProject('p1', (event) => received.push(event))
    fake.clients[0]!.emit('error', new Error('terminated'))

    await vi.advanceTimersByTimeAsync(1_000)
    expect(fake.clients).toHaveLength(2)

    publishVersionSaved({ projectId: 'p1', versionNumber: 4, via: 'session' })
    await vi.advanceTimersByTimeAsync(0)
    expect(received).toHaveLength(1)
    stop()
  })

  it('rejects the subscription when LISTEN cannot be opened and leaves no listener behind', async () => {
    fake.failNextConnect = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(subscribeProject('p1', () => {})).rejects.toThrow('connect refused')

    // ครั้งถัดไปเปิดใหม่ได้ตามปกติ
    const stop = await subscribeProject('p1', () => {})
    expect(fake.clients.at(-1)!.listening).toBe(true)
    stop()
  })
})
