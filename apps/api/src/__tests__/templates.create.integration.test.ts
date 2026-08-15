import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createEmptyDocument } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const ownerEmail = `templates.create.owner.${stamp}@example.test`
const otherEmail = `templates.create.other.${stamp}@example.test`
const password = 'integration-test-password'

let app: Express
let ownerId = ''
let projectId = ''
let versionNumber = 0
let createdTemplateIds: string[] = []

beforeAll(async () => {
  app = createApp()

  const owner = new Client(() => app)
  await owner.send('get', '/health')
  const registered = await owner.send('post', '/auth/register', {
    email: ownerEmail,
    password,
    displayName: 'Template creator',
  })
  expect(registered.status).toBe(201)
  ownerId = registered.body.data.id

  const project = await owner.send('post', '/projects', { name: 'Shareable project' })
  expect(project.status).toBe(201)
  projectId = project.body.data.id

  const version = await owner.send('post', `/projects/${projectId}/versions`, {
    document: createEmptyDocument(),
    expectedVersion: 1,
  })
  expect(version.status).toBe(201)
  versionNumber = version.body.data.versionNumber

  const other = new Client(() => app)
  await other.send('get', '/health')
  const registeredOther = await other.send('post', '/auth/register', {
    email: otherEmail,
    password,
    displayName: 'Other creator',
  })
  expect(registeredOther.status).toBe(201)
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  await disconnectDb()
})

afterEach(async () => {
  if (createdTemplateIds.length > 0) {
    await prisma.nailTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } })
    createdTemplateIds = []
  }
})

describe('template create API', () => {
  it('publishes an owned version to the feed and owner profile', async () => {
    const owner = new Client(() => app)
    await owner.send('get', '/health')
    await owner.send('post', '/auth/login', { email: ownerEmail, password })

    const created = await owner.send('post', '/templates', {
      projectId,
      versionNumber,
      name: 'Spring set',
      caption: 'A soft pink set',
      category: 'Modern',
      primaryColor: 'Pink',
    })

    expect(created.status).toBe(201)
    createdTemplateIds.push(created.body.data.id)
    expect(created.body.data).toMatchObject({
      name: 'Spring set',
      caption: 'A soft pink set',
      category: 'Modern',
      primaryColor: 'Pink',
      author: { id: ownerId },
    })

    const feed = await owner.send('get', '/templates?sort=latest')
    expect(feed.body.data.some((template: { id: string }) => template.id === created.body.data.id)).toBe(true)

    const profile = await owner.send('get', `/users/${ownerId}/profile`)
    expect(profile.body.data.templateCount).toBe(1)
    expect(profile.body.data.templates[0].id).toBe(created.body.data.id)

    const shared = await owner.send('post', `/templates/${created.body.data.id}/share`, { channel: 'copy' })
    expect(shared.status).toBe(200)
    expect(shared.body.data.shareCount).toBe(1)
  })

  it('does not allow another user to publish the owned version', async () => {
    const other = new Client(() => app)
    await other.send('get', '/health')
    await other.send('post', '/auth/login', { email: otherEmail, password })

    const response = await other.send('post', '/templates', {
      projectId,
      versionNumber,
      name: 'Unauthorized share',
    })

    expect(response.status).toBe(404)
  })

  it('requires authentication and validates the project reference', async () => {
    const anonymous = new Client(() => app)
    await anonymous.send('get', '/health')
    const unauthenticated = await anonymous.send('post', '/templates', {
      projectId,
      versionNumber,
      name: 'Anonymous share',
    })
    expect(unauthenticated.status).toBe(401)

    const owner = new Client(() => app)
    await owner.send('get', '/health')
    await owner.send('post', '/auth/login', { email: ownerEmail, password })
    const invalid = await owner.send('post', '/templates', {
      projectId: 'not-a-uuid',
      versionNumber,
      name: 'Invalid share',
    })
    expect(invalid.status).toBe(400)
  })
})
