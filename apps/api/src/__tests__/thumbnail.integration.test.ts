import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const PASSWORD = 'integration-test-password'
const stamp = Date.now()
const ownerEmail = `thumbnail.owner.${stamp}@example.test`
const otherEmail = `thumbnail.other.${stamp}@example.test`

const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00,
  0x2f, 0x00, 0x00, 0x00, 0x10, 0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
])

let app: Express

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  await disconnectDb()
})

describe('Thumbnail upload/download API', () => {
  const owner = new Client(() => app)
  const other = new Client(() => app)
  let projectId = ''

  it('sets up two users and a project', async () => {
    await owner.send('get', '/auth/me')
    await other.send('get', '/auth/me')
    const registeredOwner = await owner.send('post', '/auth/register', {
      email: ownerEmail, password: PASSWORD, displayName: 'Thumbnail owner',
    })
    const registeredOther = await other.send('post', '/auth/register', {
      email: otherEmail, password: PASSWORD, displayName: 'Other user',
    })
    expect(registeredOwner.status).toBe(201)
    expect(registeredOther.status).toBe(201)

    const created = await owner.send('post', '/projects', { name: 'Thumbnail source' })
    expect(created.status).toBe(201)
    projectId = created.body.data.id
  })

  it('project list initially reports hasThumbnail: false', async () => {
    const list = await owner.send('get', '/projects')
    const project = list.body.data.find((item: { id: string }) => item.id === projectId)
    expect(project.hasThumbnail).toBe(false)
  })

  it('GET thumbnail before upload returns 404', async () => {
    const result = await owner.send('get', `/projects/${projectId}/thumbnail`)
    expect(result.status).toBe(404)
  })

  it('uploads a valid WebP and the project list reflects it', async () => {
    const uploaded = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(uploaded.status).toBe(204)

    const list = await owner.send('get', '/projects')
    const project = list.body.data.find((item: { id: string }) => item.id === projectId)
    expect(project.hasThumbnail).toBe(true)
  })

  it('downloads the thumbnail with a 200 status', async () => {
    const downloaded = await owner.send('get', `/projects/${projectId}/thumbnail`)
    expect(downloaded.status).toBe(200)
  })

  it('rejects a non-WebP upload (fake header, real PNG bytes)', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const result = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, png, 'image/webp')
    expect(result.status).toBe(400)
  })

  it('another user cannot upload to or read this project\'s thumbnail (404, not 403)', async () => {
    const uploadResult = await other.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(uploadResult.status).toBe(404)

    const readResult = await other.send('get', `/projects/${projectId}/thumbnail`)
    expect(readResult.status).toBe(404)
  })

  it('re-uploading replaces the old asset (old asset row is gone)', async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const firstAssetId = before.thumbnailAssetId
    expect(firstAssetId).not.toBeNull()

    const second = await owner.sendRaw('post', `/projects/${projectId}/thumbnail`, VALID_WEBP, 'image/webp')
    expect(second.status).toBe(204)

    const after = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    expect(after.thumbnailAssetId).not.toBe(firstAssetId)

    const orphan = await prisma.asset.findUnique({ where: { id: firstAssetId! } })
    expect(orphan).toBeNull()
  })
})