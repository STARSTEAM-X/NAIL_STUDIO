import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const email = `templates.feed.${stamp}@example.test`

let app: Express
let userId = ''
let projectId = ''

beforeAll(async () => {
  app = createApp()
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      displayName: 'Feed fixture author',
    },
  })
  userId = user.id

  const project = await prisma.project.create({ data: { userId, name: 'Feed fixture project' } })
  projectId = project.id
  const version = await prisma.designVersion.create({
    data: { projectId, versionNumber: 1, document: {} },
  })

  const fixture = [
    { name: 'Latest rose', category: 'Modern', primaryColor: 'Pink', likeCount: 12, secondsAgo: 1 },
    { name: 'Latest nude', category: 'Minimalistic', primaryColor: 'Nude', likeCount: 4, secondsAgo: 2 },
    { name: 'Latest red', category: 'Festive', primaryColor: 'Red', likeCount: 12, secondsAgo: 3 },
    { name: 'Latest black', category: 'Geometric', primaryColor: 'Black', likeCount: 1, secondsAgo: 4 },
  ]

  for (const item of fixture) {
    await prisma.nailTemplate.create({
      data: {
        authorId: userId,
        designVersionId: version.id,
        name: item.name,
        category: item.category,
        primaryColor: item.primaryColor,
        likeCount: item.likeCount,
        createdAt: new Date(Date.now() - item.secondsAgo * 1000),
      },
    })
  }
})

afterAll(async () => {
  await prisma.nailTemplate.deleteMany({ where: { authorId: userId } })
  await prisma.project.deleteMany({ where: { id: projectId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await disconnectDb()
})

describe('template feed API', () => {
  const client = new Client(() => app)

  it('paginates the latest feed with a stable keyset cursor', async () => {
    const first = await client.send('get', '/templates?limit=2')

    expect(first.status).toBe(200)
    expect(first.body.data).toHaveLength(2)
    expect(first.body.data[0].name).toBe('Latest rose')
    expect(first.body.meta.nextCursor).toEqual(expect.any(String))

    const second = await client.send(
      'get',
      `/templates?limit=2&cursor=${encodeURIComponent(first.body.meta.nextCursor)}`,
    )
    expect(second.status).toBe(200)
    expect(second.body.data).toHaveLength(2)
    expect(second.body.meta.nextCursor).toBeNull()
    expect(new Set(second.body.data.map((item: { id: string }) => item.id))).not.toEqual(
      new Set(first.body.data.map((item: { id: string }) => item.id)),
    )
  })

  it('sorts popular templates by likes and applies category/color filters', async () => {
    const popular = await client.send('get', '/templates?sort=popular&limit=4')
    expect(popular.status).toBe(200)
    expect(popular.body.data.map((item: { likeCount: number }) => item.likeCount)).toEqual([12, 12, 4, 1])

    const filtered = await client.send('get', '/templates?category=Modern&color=Pink')
    expect(filtered.status).toBe(200)
    expect(filtered.body.data).toHaveLength(1)
    expect(filtered.body.data[0].name).toBe('Latest rose')
  })

  it('rejects a malformed or mismatched cursor', async () => {
    const malformed = await client.send('get', '/templates?cursor=not-a-cursor')
    expect(malformed.status).toBe(400)
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR')

    const latest = await client.send('get', '/templates?limit=1')
    const mismatched = await client.send(
      'get',
      `/templates?sort=popular&cursor=${encodeURIComponent(latest.body.meta.nextCursor)}`,
    )
    expect(mismatched.status).toBe(400)
    expect(mismatched.body.error.code).toBe('VALIDATION_ERROR')
  })
})
