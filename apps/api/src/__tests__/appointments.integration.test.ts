import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { disconnectDb, prisma } from '../db.ts'
import { Client } from './httpClient.ts'

const stamp = Date.now()
const password = 'appointment-integration-password'
const customerEmail = `appointment.customer.${stamp}@example.test`
const shopEmail = `appointment.shop.${stamp}@example.test`
const strangerEmail = `appointment.stranger.${stamp}@example.test`

let app: Express
let appointmentId = ''
let serviceId = ''

beforeAll(() => { app = createApp() })
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [customerEmail, shopEmail, strangerEmail] } } })
  await disconnectDb()
})

describe('Slice 7 appointments', () => {
  const customer = new Client(() => app)
  const shop = new Client(() => app)
  const stranger = new Client(() => app)

  it('creates a shop profile and service', async () => {
    await customer.send('get', '/health')
    await shop.send('get', '/health')
    await stranger.send('get', '/health')
    expect((await customer.send('post', '/auth/register', { email: customerEmail, password, displayName: 'Customer' })).status).toBe(201)
    expect((await shop.send('post', '/auth/register', { email: shopEmail, password, displayName: 'Studio', role: 'shop' })).status).toBe(201)
    expect((await stranger.send('post', '/auth/register', { email: strangerEmail, password, displayName: 'Stranger' })).status).toBe(201)

    expect((await shop.send('put', '/shops/me', { shopName: 'Studio Test' })).status).toBe(200)
    const created = await shop.send('post', '/shops/me/services', { name: 'Classic', priceThb: 450, durationMinutes: 60 })
    expect(created.status).toBe(201)
    serviceId = created.body.data.id
  })

  it('creates a pending proposal and shop can accept it', async () => {
    const created = await customer.send('post', '/appointments', {
      shopId: (await shop.send('get', '/auth/me')).body.data.id,
      serviceId,
      proposedStartAt: '2030-01-02T10:00:00.000Z',
      durationMinutes: 60,
    })
    expect(created.status).toBe(201)
    appointmentId = created.body.data.id
    expect(created.body.data.status).toBe('pending')
    expect(created.body.data.proposals).toHaveLength(1)

    const accepted = await shop.send('post', `/appointments/${appointmentId}/accept`)
    expect(accepted.status).toBe(200)
    expect(accepted.body.data.status).toBe('confirmed')
  })

  it('scopes detail and chat to appointment participants', async () => {
    expect((await stranger.send('get', `/appointments/${appointmentId}`)).status).toBe(404)
    expect((await customer.send('post', `/appointments/${appointmentId}/messages`, { content: '<b>hello</b>' })).status).toBe(201)
    expect((await shop.send('get', `/appointments/${appointmentId}/messages`)).body.data[0].content).toBe('<b>hello</b>')
    expect((await shop.send('post', `/appointments/${appointmentId}/messages/read`)).status).toBe(200)
  })

  it('allows only completed appointments to receive one review', async () => {
    expect((await customer.send('post', `/appointments/${appointmentId}/review`, { rating: 5 })).status).toBe(409)
    expect((await shop.send('post', `/appointments/${appointmentId}/complete`)).status).toBe(200)
    expect((await customer.send('post', `/appointments/${appointmentId}/review`, { rating: 5, comment: 'great' })).status).toBe(200)
    expect((await customer.send('post', `/appointments/${appointmentId}/review`, { rating: 4 })).status).toBe(409)
  })
})
