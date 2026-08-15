import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const email = `registration-details.${Date.now()}@example.test`

let app: Express
let client: Client

beforeAll(async () => {
  app = createApp()
  client = new Client(() => app)
  await client.send('get', '/health')
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  await disconnectDb()
})

describe('registration details', () => {
  it('persists date of birth and terms acceptance', async () => {
    const result = await client.send('post', '/auth/register', {
      email,
      password: 'integration-registration-password',
      displayName: 'Registration details',
      dateOfBirth: '1995-04-12',
      termsAccepted: true,
    })

    expect(result.status).toBe(201)

    const stored = await prisma.user.findUnique({
      where: { email },
      select: { dateOfBirth: true, termsAcceptedAt: true },
    })

    expect(stored?.dateOfBirth?.toISOString().slice(0, 10)).toBe('1995-04-12')
    expect(stored?.termsAcceptedAt).toBeInstanceOf(Date)
  })
})
