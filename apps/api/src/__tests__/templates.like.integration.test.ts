import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const authorEmail = `templates.like.author.${stamp}@example.test`
const likerAEmail = `templates.like.a.${stamp}@example.test`
const likerBEmail = `templates.like.b.${stamp}@example.test`
const password = 'integration-test-password'

let app: Express
let templateId = ''
let projectId = ''
let versionId = ''

beforeAll(async () => {
  app = createApp()

  const author = await prisma.user.create({
    data: { email: authorEmail, passwordHash: 'test-hash', displayName: 'Like fixture author' },
  })
  const project = await prisma.project.create({ data: { userId: author.id, name: 'Like fixture project' } })
  projectId = project.id
  const version = await prisma.designVersion.create({
    data: { projectId, versionNumber: 1, document: {} },
  })
  versionId = version.id
  const template = await prisma.nailTemplate.create({
    data: {
      authorId: author.id,
      designVersionId: version.id,
      name: 'Like fixture template',
      category: 'Modern',
      primaryColor: 'Pink',
    },
  })
  templateId = template.id

  const clientA = new Client(() => app)
  await clientA.send('get', '/health')
  const registeredA = await clientA.send('post', '/auth/register', {
    email: likerAEmail,
    password,
    displayName: 'Like tester A',
  })
  expect(registeredA.status).toBe(201)

  const clientB = new Client(() => app)
  await clientB.send('get', '/health')
  const registeredB = await clientB.send('post', '/auth/register', {
    email: likerBEmail,
    password,
    displayName: 'Like tester B',
  })
  expect(registeredB.status).toBe(201)
})

afterAll(async () => {
  await prisma.templateLike.deleteMany({ where: { templateId } })
  await prisma.nailTemplate.deleteMany({ where: { id: templateId } })
  await prisma.designVersion.deleteMany({ where: { id: versionId } })
  await prisma.project.deleteMany({ where: { id: projectId } })
  await prisma.user.deleteMany({ where: { email: { in: [authorEmail, likerAEmail, likerBEmail] } } })
  await disconnectDb()
})

describe('template like API', () => {
  const clientA = new Client(() => app)
  const clientB = new Client(() => app)

  beforeAll(async () => {
    await clientA.send('get', '/health')
    await clientA.send('post', '/auth/login', { email: likerAEmail, password })
    await clientB.send('get', '/health')
    await clientB.send('post', '/auth/login', { email: likerBEmail, password })
  })

  it('requires authentication and validates the template id', async () => {
    const anonymous = new Client(() => app)
    await anonymous.send('get', '/health')
    const unauthenticated = await anonymous.send('put', `/templates/${templateId}/like`)
    expect(unauthenticated.status).toBe(401)

    const invalid = await clientA.send('put', '/templates/not-a-uuid/like')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('keeps repeated PUT requests at one like and one counter increment', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => clientA.send('put', `/templates/${templateId}/like`)),
    )

    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(responses.every((response) => response.body.data.liked === true)).toBe(true)
    expect(await prisma.templateLike.count({ where: { templateId } })).toBe(1)
    expect((await prisma.nailTemplate.findUniqueOrThrow({ where: { id: templateId } })).likeCount).toBe(1)
  })

  it('updates the counter transactionally for another user and idempotent DELETE', async () => {
    const secondLike = await clientB.send('put', `/templates/${templateId}/like`)
    expect(secondLike.body.data).toEqual({ liked: true, likeCount: 2 })

    const firstUnlike = await clientA.send('delete', `/templates/${templateId}/like`)
    const repeatedUnlike = await clientA.send('delete', `/templates/${templateId}/like`)
    expect(firstUnlike.body.data).toEqual({ liked: false, likeCount: 1 })
    expect(repeatedUnlike.body.data).toEqual({ liked: false, likeCount: 1 })
    expect(await prisma.templateLike.count({ where: { templateId } })).toBe(1)
    expect((await prisma.nailTemplate.findUniqueOrThrow({ where: { id: templateId } })).likeCount).toBe(1)
  })

  it('returns 404 for a template that is not public or does not exist', async () => {
    const missing = await clientA.send('put', '/templates/00000000-0000-4000-8000-000000000001/like')
    expect(missing.status).toBe(404)
  })
})
