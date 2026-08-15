import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const authorEmail = `profile.author.${stamp}@example.test`
const strangerEmail = `profile.stranger.${stamp}@example.test`
const password = 'profile-integration-password'

let app: Express
let authorId = ''
let strangerId = ''

async function createTemplate(
  userId: string,
  name: string,
  visibility: 'public' | 'unlisted' | 'hidden',
  createdAt: Date,
) {
  const project = await prisma.project.create({ data: { userId, name, versionCount: 1 } })
  const version = await prisma.designVersion.create({
    data: { projectId: project.id, versionNumber: 1, document: {}, createdAt },
  })
  return prisma.nailTemplate.create({
    data: { authorId: userId, designVersionId: version.id, name, visibility, createdAt },
  })
}

beforeAll(async () => {
  app = createApp()
  const client = new Client(() => app)
  await client.send('get', '/health')
  const author = await client.send('post', '/auth/register', {
    email: authorEmail,
    password,
    displayName: 'Profile author',
  })
  expect(author.status).toBe(201)
  authorId = author.body.data.id

  const stranger = await client.send('post', '/auth/register', {
    email: strangerEmail,
    password,
    displayName: 'Profile stranger',
  })
  expect(stranger.status).toBe(201)
  strangerId = stranger.body.data.id

  await createTemplate(authorId, 'Older public design', 'public', new Date('2026-01-01T00:00:00.000Z'))
  await createTemplate(authorId, 'Newest public design', 'public', new Date('2026-01-02T00:00:00.000Z'))
  await createTemplate(authorId, 'Private design', 'hidden', new Date('2026-01-03T00:00:00.000Z'))
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [authorId, strangerId] } } })
  await disconnectDb()
})

describe('public user profiles', () => {
  it('returns public identity and only public templates without sensitive fields', async () => {
    const client = new Client(() => app)
    const response = await client.send('get', `/users/${authorId}/profile?limit=50`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      id: authorId,
      displayName: 'Profile author',
      role: 'user',
      templateCount: 2,
    })
    expect(response.body.data.templates.map((template: { name: string }) => template.name)).toEqual([
      'Newest public design',
      'Older public design',
    ])
    expect(response.body.data.email).toBeUndefined()
    expect(response.body.data.passwordHash).toBeUndefined()
    expect(response.body.data.templates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Private design' }),
    ]))
  })

  it('supports keyset pagination and binds cursors to their profile', async () => {
    const client = new Client(() => app)
    const first = await client.send('get', `/users/${authorId}/profile?limit=1`)
    expect(first.status).toBe(200)
    expect(first.body.meta.nextCursor).toEqual(expect.any(String))

    const second = await client.send(
      'get',
      `/users/${authorId}/profile?limit=1&cursor=${first.body.meta.nextCursor}`,
    )
    expect(second.status).toBe(200)
    expect(second.body.data.templates.map((template: { name: string }) => template.name)).toEqual(['Older public design'])
    expect(second.body.meta.nextCursor).toBeNull()

    const reused = await client.send(
      'get',
      `/users/${strangerId}/profile?cursor=${first.body.meta.nextCursor}`,
    )
    expect(reused.status).toBe(400)
    expect(reused.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns an empty profile for a user without public templates', async () => {
    const client = new Client(() => app)
    const response = await client.send('get', `/users/${strangerId}/profile`)

    expect(response.status).toBe(200)
    expect(response.body.data.templateCount).toBe(0)
    expect(response.body.data.templates).toEqual([])
    expect(response.body.meta.nextCursor).toBeNull()
  })

  it('is public and validates profile ids', async () => {
    const anonymous = new Client(() => app)
    const publicResponse = await anonymous.send('get', `/users/${authorId}/profile`)
    expect(publicResponse.status).toBe(200)

    const invalid = await anonymous.send('get', '/users/not-a-uuid/profile')
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    const missing = await anonymous.send('get', '/users/00000000-0000-4000-8000-000000000000/profile')
    expect(missing.status).toBe(404)
  })
})
