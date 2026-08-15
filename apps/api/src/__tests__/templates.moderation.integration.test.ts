import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const authorEmail = `templates.moderation.author.${stamp}@example.test`
const reporterEmails = Array.from({ length: 5 }, (_, index) => `templates.moderation.${index}.${stamp}@example.test`)
const adminEmail = `templates.moderation.admin.${stamp}@example.test`
const password = 'integration-test-password'

let app: Express
let templateId = ''
let sourceProjectId = ''
let sourceVersionId = ''
let reporterClients: Client[] = []
let adminClient: Client

beforeAll(async () => {
  app = createApp()
  const author = await prisma.user.create({
    data: { email: authorEmail, passwordHash: 'test-hash', displayName: 'Moderation fixture author' },
  })
  const project = await prisma.project.create({ data: { userId: author.id, name: 'Moderation source', versionCount: 1 } })
  sourceProjectId = project.id
  const version = await prisma.designVersion.create({ data: { projectId: project.id, versionNumber: 1, document: {} } })
  sourceVersionId = version.id
  const template = await prisma.nailTemplate.create({
    data: { authorId: author.id, designVersionId: version.id, name: 'Report me', category: 'Festive' },
  })
  templateId = template.id

  reporterClients = []
  for (const [index, email] of reporterEmails.entries()) {
    const client = new Client(() => app)
    await client.send('get', '/health')
    const registered = await client.send('post', '/auth/register', {
      email,
      password,
      displayName: `Reporter ${index + 1}`,
    })
    expect(registered.status).toBe(201)
    reporterClients.push(client)
  }

  adminClient = new Client(() => app)
  await adminClient.send('get', '/health')
  const admin = await adminClient.send('post', '/auth/register', {
    email: adminEmail,
    password,
    displayName: 'Moderation admin',
  })
  expect(admin.status).toBe(201)
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } })
  await adminClient.send('post', '/auth/login', { email: adminEmail, password })
})

afterAll(async () => {
  await prisma.contentReport.deleteMany({ where: { targetId: templateId } })
  await prisma.nailTemplate.deleteMany({ where: { id: templateId } })
  await prisma.designVersion.deleteMany({ where: { id: sourceVersionId } })
  await prisma.project.deleteMany({ where: { id: sourceProjectId } })
  await prisma.user.deleteMany({ where: { email: { in: [authorEmail, ...reporterEmails, adminEmail] } } })
  await disconnectDb()
})

describe('template moderation API', () => {
  it('deduplicates one reporter and hides a template at five reports', async () => {
    const firstReporter = reporterClients[0]!
    const first = await firstReporter.send('post', `/templates/${templateId}/report`, {
      reason: 'spam',
      detail: 'Repeated promotional content',
    })
    const repeated = await firstReporter.send('post', `/templates/${templateId}/report`, {
      reason: 'spam',
    })
    expect(first.status).toBe(201)
    expect(first.body.data.reportCount).toBe(1)
    expect(first.body.data.visibility).toBe('public')
    expect(repeated.status).toBe(201)
    expect(repeated.body.data.reportId).toBe(first.body.data.reportId)
    expect(repeated.body.data.reportCount).toBe(1)
    expect(await prisma.contentReport.count({ where: { targetId: templateId } })).toBe(1)

    for (const client of reporterClients.slice(1)) {
      const result = await client.send('post', `/templates/${templateId}/report`, { reason: 'inappropriate' })
      expect(result.status).toBe(201)
    }

    const template = await prisma.nailTemplate.findUniqueOrThrow({ where: { id: templateId } })
    expect(template.reportCount).toBe(5)
    expect(template.visibility).toBe('hidden')
    expect(await prisma.contentReport.count({ where: { targetId: templateId } })).toBe(5)
  })

  it('serves pending reports to admins and blocks regular users', async () => {
    const regular = await reporterClients[0]!.send('get', '/templates/moderation/reports')
    expect(regular.status).toBe(403)

    const queue = await adminClient.send('get', '/templates/moderation/reports')
    expect(queue.status).toBe(200)
    expect(queue.body.data).toHaveLength(5)
    expect(queue.body.data[0]).toMatchObject({
      targetId: templateId,
      status: 'pending',
      template: { name: 'Report me', visibility: 'hidden', reportCount: 5 },
    })
  })

  it('validates report input and does not expose hidden templates in the feed', async () => {
    const firstReporter = reporterClients[0]!
    const invalid = await firstReporter.send('post', `/templates/${templateId}/report`, { reason: 'not-a-reason' })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    const feed = await firstReporter.send('get', '/templates?category=Festive&limit=50')
    expect(feed.status).toBe(200)
    expect(feed.body.data.some((item: { id: string }) => item.id === templateId)).toBe(false)
  })
})
