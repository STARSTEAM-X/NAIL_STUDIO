import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const authorEmail = `notifications.author.${stamp}@example.test`
const actorEmail = `notifications.actor.${stamp}@example.test`
const password = 'integration-test-password'

let app: Express
let authorClient: Client
let actorClient: Client
let authorId = ''
let templateId = ''
let sourceProjectId = ''
let sourceVersionId = ''
let remixProjectId = ''

beforeAll(async () => {
  app = createApp()
  authorClient = new Client(() => app)
  await authorClient.send('get', '/health')
  const author = await authorClient.send('post', '/auth/register', {
    email: authorEmail,
    password,
    displayName: 'Notification author',
  })
  expect(author.status).toBe(201)
  authorId = author.body.data.id

  actorClient = new Client(() => app)
  await actorClient.send('get', '/health')
  const actor = await actorClient.send('post', '/auth/register', {
    email: actorEmail,
    password,
    displayName: 'Notification actor',
  })
  expect(actor.status).toBe(201)

  const project = await prisma.project.create({ data: { userId: authorId, name: 'Notification source', versionCount: 1 } })
  sourceProjectId = project.id
  const version = await prisma.designVersion.create({ data: { projectId: project.id, versionNumber: 1, document: {} } })
  sourceVersionId = version.id
  const template = await prisma.nailTemplate.create({
    data: { authorId, designVersionId: version.id, name: 'Notification template' },
  })
  templateId = template.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { sourceId: templateId } })
  await prisma.templateComment.deleteMany({ where: { templateId } })
  await prisma.templateRemix.deleteMany({ where: { templateId } })
  await prisma.templateLike.deleteMany({ where: { templateId } })
  await prisma.nailTemplate.deleteMany({ where: { id: templateId } })
  await prisma.designVersion.deleteMany({ where: { id: sourceVersionId } })
  await prisma.designVersion.deleteMany({ where: { projectId: remixProjectId } })
  await prisma.project.deleteMany({ where: { id: { in: [sourceProjectId, remixProjectId] } } })
  await prisma.user.deleteMany({ where: { email: { in: [authorEmail, actorEmail] } } })
  await disconnectDb()
})

describe('notifications API and template events', () => {
  it('creates owner notifications for another user like and remix, but not self-like', async () => {
    const like = await actorClient.send('put', `/templates/${templateId}/like`)
    expect(like.status).toBe(200)

    const remix = await actorClient.send('post', `/templates/${templateId}/remix`)
    expect(remix.status).toBe(201)
    remixProjectId = remix.body.data.project.id

    const comment = await actorClient.send('post', `/templates/${templateId}/comments`, {
      content: '<script>alert(1)</script> สวยมาก',
    })
    expect(comment.status).toBe(201)
    expect(comment.body.data.comment.content).toBe('<script>alert(1)</script> สวยมาก')

    const own = await authorClient.send('put', `/templates/${templateId}/like`)
    expect(own.status).toBe(200)

    const notifications = await authorClient.send('get', '/notifications')
    expect(notifications.status).toBe(200)
    expect(notifications.body.data.unreadCount).toBe(3)
    expect(notifications.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'post_like', sourceId: templateId, isRead: false }),
      expect.objectContaining({ kind: 'template_remix', sourceId: templateId, isRead: false }),
      expect.objectContaining({ kind: 'post_comment', sourceId: templateId, isRead: false }),
    ]))

    const actorNotifications = await actorClient.send('get', '/notifications')
    expect(actorNotifications.status).toBe(200)
    expect(actorNotifications.body.data.unreadCount).toBe(0)
  })

  it('marks one notification and then all remaining notifications read', async () => {
    const before = await authorClient.send('get', '/notifications')
    const notificationId = before.body.data.items[0].id as string
    const marked = await authorClient.send('patch', `/notifications/${notificationId}/read`)
    expect(marked.status).toBe(200)

    const afterOne = await authorClient.send('get', '/notifications')
    expect(afterOne.body.data.unreadCount).toBe(2)
    await authorClient.send('post', '/notifications/read-all')
    const afterAll = await authorClient.send('get', '/notifications')
    expect(afterAll.body.data.unreadCount).toBe(0)
  })

  it('requires auth and validates notification ids', async () => {
    const anonymous = new Client(() => app)
    await anonymous.send('get', '/health')
    const unauthenticated = await anonymous.send('get', '/notifications')
    expect(unauthenticated.status).toBe(401)

    const invalid = await authorClient.send('patch', '/notifications/not-a-uuid/read')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
  })
})
