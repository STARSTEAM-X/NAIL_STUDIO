import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createEmptyDocument, type DesignDocument } from '@nail-studio/contracts'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const PASSWORD = 'integration-test-password'
const stamp = Date.now()
const ownerEmail = `slice3.owner.${stamp}@example.test`
const otherEmail = `slice3.other.${stamp}@example.test`

let app: Express

beforeAll(() => {
  app = createApp()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
  await disconnectDb()
})

describe('Slice 3 version history API', () => {
  const owner = new Client(() => app)
  const other = new Client(() => app)
  const savedDocument: DesignDocument = createEmptyDocument()
  const duplicateDocument: DesignDocument = createEmptyDocument()
  let projectId = ''

  savedDocument.hand.skinTone = '#c79070'
  duplicateDocument.hand.skinTone = '#805f50'

  it('creates two users and a project with two immutable versions', async () => {
    await owner.send('get', '/auth/me')
    await other.send('get', '/auth/me')

    const registeredOwner = await owner.send('post', '/auth/register', {
      email: ownerEmail,
      password: PASSWORD,
      displayName: 'Version owner',
    })
    const registeredOther = await other.send('post', '/auth/register', {
      email: otherEmail,
      password: PASSWORD,
      displayName: 'Other user',
    })
    expect(registeredOwner.status).toBe(201)
    expect(registeredOther.status).toBe(201)

    const created = await owner.send('post', '/projects', { name: 'Version history source' })
    expect(created.status).toBe(201)
    projectId = created.body.data.id

    const saved = await owner.send('post', `/projects/${projectId}/versions`, {
      document: savedDocument,
      expectedVersion: 1,
      label: 'Skin tone study',
    })
    expect(saved.status).toBe(201)
    expect(saved.body.data.versionNumber).toBe(2)
  })

  it('lists version metadata in newest-first order without document JSON', async () => {
    const result = await owner.send('get', `/projects/${projectId}/versions`)

    expect(result.status).toBe(200)
    expect(result.body.data).toHaveLength(2)
    expect(result.body.data.map((version: { number: number }) => version.number)).toEqual([2, 1])
    expect(result.body.data[0].label).toBe('Skin tone study')
    expect(result.body.data[1].label).toBeNull()
    for (const version of result.body.data) {
      expect(version).not.toHaveProperty('document')
      expect(version.documentBytes).toEqual(expect.any(Number))
      expect(version.documentBytes).toBeGreaterThan(0)
      expect(Date.parse(version.createdAt)).not.toBeNaN()
    }
  })

  it('loads one historical version with its document', async () => {
    const result = await owner.send('get', `/projects/${projectId}/versions/2`)

    expect(result.status).toBe(200)
    expect(result.body.data.number).toBe(2)
    expect(result.body.data.label).toBe('Skin tone study')
    expect(result.body.data.document).toEqual(savedDocument)
    expect(Date.parse(result.body.data.createdAt)).not.toBeNaN()
  })

  it('renames only the label and leaves the historical document unchanged', async () => {
    const renamed = await owner.send('patch', `/projects/${projectId}/versions/2`, {
      label: 'Approved palette',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.data.label).toBe('Approved palette')

    const reloaded = await owner.send('get', `/projects/${projectId}/versions/2`)
    expect(reloaded.status).toBe(200)
    expect(reloaded.body.data.label).toBe('Approved palette')
    expect(reloaded.body.data.document).toEqual(savedDocument)
  })

  it('rejects labels longer than 120 characters', async () => {
    const result = await owner.send('patch', `/projects/${projectId}/versions/2`, {
      label: 'x'.repeat(121),
    })

    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when the owner loads or renames a missing version', async () => {
    const loaded = await owner.send('get', `/projects/${projectId}/versions/999`)
    const renamed = await owner.send('patch', `/projects/${projectId}/versions/999`, {
      label: null,
    })

    expect(loaded.status).toBe(404)
    expect(renamed.status).toBe(404)
  })

  it('returns 404 for every version and duplicate operation by a non-owner', async () => {
    const listed = await other.send('get', `/projects/${projectId}/versions`)
    const loaded = await other.send('get', `/projects/${projectId}/versions/2`)
    const renamed = await other.send('patch', `/projects/${projectId}/versions/2`, {
      label: 'Not mine',
    })
    const duplicated = await other.send('post', `/projects/${projectId}/duplicate`, {
      name: 'Stolen copy',
      document: duplicateDocument,
    })

    for (const result of [listed, loaded, renamed, duplicated]) {
      expect(result.status).toBe(404)
      expect(result.body.error.code).toBe('NOT_FOUND')
    }
  })

  it('duplicates into a fresh project version 1 from the supplied document', async () => {
    const duplicated = await owner.send('post', `/projects/${projectId}/duplicate`, {
      name: 'Current editor copy',
      document: duplicateDocument,
    })

    expect(duplicated.status).toBe(201)
    expect(duplicated.body.data.name).toBe('Current editor copy')
    expect(duplicated.body.data.versionCount).toBe(1)
    expect(duplicated.body.data.id).not.toBe(projectId)

    const detail = await owner.send('get', `/projects/${duplicated.body.data.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.version.number).toBe(1)
    expect(detail.body.data.version.document).toEqual(duplicateDocument)
  })

  it('accepts exactly one of two concurrent saves with the same expected version', async () => {
    const created = await owner.send('post', '/projects', { name: 'Concurrent version race' })
    const raceProjectId = created.body.data.id as string

    const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      owner.send('post', `/projects/${raceProjectId}/versions`, {
        document: index % 2 === 0 ? savedDocument : duplicateDocument,
        expectedVersion: 1,
      })))

    expect(results.filter((result) => result.status === 201)).toHaveLength(1)
    expect(results.filter((result) => result.status === 409)).toHaveLength(11)
    const detail = await owner.send('get', `/projects/${raceProjectId}`)
    const versions = await owner.send('get', `/projects/${raceProjectId}/versions`)
    expect(detail.body.data.project.versionCount).toBe(2)
    expect(versions.body.data).toHaveLength(2)
  })
})
