import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@nail-studio/contracts'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const email = `templates.detail.${stamp}@example.test`

let app: Express
let templateId = ''
let projectId = ''
let versionId = ''

beforeAll(async () => {
  app = createApp()
  const user = await prisma.user.create({
    data: { email, passwordHash: 'test-hash', displayName: 'Detail fixture author' },
  })
  const project = await prisma.project.create({ data: { userId: user.id, name: 'Detail fixture', versionCount: 1 } })
  projectId = project.id
  const version = await prisma.designVersion.create({
    data: { projectId, versionNumber: 1, document: createEmptyDocument() },
  })
  versionId = version.id
  const template = await prisma.nailTemplate.create({
    data: { authorId: user.id, designVersionId: version.id, name: 'Read-only template', category: 'Minimalistic' },
  })
  templateId = template.id
})

afterAll(async () => {
  await prisma.nailTemplate.deleteMany({ where: { id: templateId } })
  await prisma.designVersion.deleteMany({ where: { id: versionId } })
  await prisma.project.deleteMany({ where: { id: projectId } })
  await prisma.user.deleteMany({ where: { email } })
  await disconnectDb()
})

describe('template detail API', () => {
  const client = new Client(() => app)

  it('returns the immutable document for a public template', async () => {
    const result = await client.send('get', `/templates/${templateId}`)
    expect(result.status).toBe(200)
    expect(result.body.data.id).toBe(templateId)
    expect(result.body.data.document.schemaVersion).toBe(2)
    expect(result.body.data.document.nails).toHaveProperty('right.index')
  })

  it('hides non-public templates and rejects malformed ids', async () => {
    await prisma.nailTemplate.update({ where: { id: templateId }, data: { visibility: 'hidden' } })
    const hidden = await client.send('get', `/templates/${templateId}`)
    expect(hidden.status).toBe(404)

    const invalid = await client.send('get', '/templates/not-a-uuid')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
  })
})
