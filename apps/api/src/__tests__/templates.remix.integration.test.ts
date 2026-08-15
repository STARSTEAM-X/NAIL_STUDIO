import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const authorEmail = `templates.remix.author.${stamp}@example.test`
const remixerEmail = `templates.remix.user.${stamp}@example.test`
const password = 'integration-test-password'
const sourceDocument = { schemaVersion: 2, fixture: 'immutable-template-document' }

let app: Express
let templateId = ''
let sourceProjectId = ''
let sourceVersionId = ''
let remixerId = ''
let remixedProjectIds: string[] = []

beforeAll(async () => {
  app = createApp()

  const author = await prisma.user.create({
    data: { email: authorEmail, passwordHash: 'test-hash', displayName: 'Remix fixture author' },
  })
  const sourceProject = await prisma.project.create({
    data: { userId: author.id, name: 'Remix source project', versionCount: 1 },
  })
  sourceProjectId = sourceProject.id
  const sourceVersion = await prisma.designVersion.create({
    data: { projectId: sourceProject.id, versionNumber: 1, document: sourceDocument },
  })
  sourceVersionId = sourceVersion.id
  const template = await prisma.nailTemplate.create({
    data: {
      authorId: author.id,
      designVersionId: sourceVersion.id,
      name: 'Source template',
      category: 'Modern',
      primaryColor: 'Pink',
    },
  })
  templateId = template.id

  const client = new Client(() => app)
  await client.send('get', '/health')
  const registered = await client.send('post', '/auth/register', {
    email: remixerEmail,
    password,
    displayName: 'Remix tester',
  })
  expect(registered.status).toBe(201)
  remixerId = registered.body.data.id
})

afterAll(async () => {
  await prisma.templateRemix.deleteMany({ where: { templateId } })
  await prisma.nailTemplate.deleteMany({ where: { id: templateId } })
  await prisma.designVersion.deleteMany({ where: { id: sourceVersionId } })
  await prisma.designVersion.deleteMany({ where: { projectId: { in: remixedProjectIds } } })
  await prisma.project.deleteMany({ where: { id: { in: [sourceProjectId, ...remixedProjectIds] } } })
  await prisma.user.deleteMany({ where: { email: { in: [authorEmail, remixerEmail] } } })
  await disconnectDb()
})

describe('template remix API', () => {
  const client = new Client(() => app)

  beforeAll(async () => {
    await client.send('get', '/health')
    await client.send('post', '/auth/login', { email: remixerEmail, password })
  })

  it('creates a project from the immutable template version and records its source', async () => {
    const result = await client.send('post', `/templates/${templateId}/remix`)

    expect(result.status).toBe(201)
    expect(result.body.data.sourceTemplateId).toBe(templateId)
    expect(result.body.data.remixCount).toBe(1)
    expect(result.body.data.project.name).toBe('Remix: Source template')

    const projectId = result.body.data.project.id as string
    remixedProjectIds.push(projectId)
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(project.userId).toBe(remixerId)
    const version = await prisma.designVersion.findUniqueOrThrow({
      where: { projectId_versionNumber: { projectId, versionNumber: 1 } },
    })
    expect(version.document).toEqual(sourceDocument)
    expect(await prisma.templateRemix.count({ where: { templateId, projectId } })).toBe(1)
    expect((await prisma.nailTemplate.findUniqueOrThrow({ where: { id: templateId } })).remixCount).toBe(1)
  })

  it('accepts a project name and increments each distinct remix event', async () => {
    const result = await client.send('post', `/templates/${templateId}/remix`, { name: 'My inspired remix' })
    expect(result.status).toBe(201)
    expect(result.body.data.project.name).toBe('My inspired remix')
    expect(result.body.data.remixCount).toBe(2)
    remixedProjectIds.push(result.body.data.project.id)
    expect(await prisma.templateRemix.count({ where: { templateId } })).toBe(2)
  })

  it('rejects invalid input and unknown templates', async () => {
    const invalid = await client.send('post', `/templates/${templateId}/remix`, { name: 'x'.repeat(121) })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    const missing = await client.send('post', '/templates/00000000-0000-4000-8000-000000000001/remix')
    expect(missing.status).toBe(404)
  })
})
