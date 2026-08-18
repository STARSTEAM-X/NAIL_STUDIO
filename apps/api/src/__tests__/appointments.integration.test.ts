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

  async function createPending(startAt: string) {
    const shopId = (await shop.send('get', '/auth/me')).body.data.id
    const response = await customer.send('post', '/appointments', {
      shopId,
      serviceId,
      proposedStartAt: startAt,
      durationMinutes: 60,
    })
    expect(response.status).toBe(201)
    return response.body.data.id as string
  }

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
    appointmentId = await createPending('2030-01-02T10:00:00.000Z')
    const created = await customer.send('get', `/appointments/${appointmentId}`)
    expect(created.body.data.status).toBe('pending')
    expect(created.body.data.proposals).toHaveLength(1)

    const accepted = await shop.send('post', `/appointments/${appointmentId}/accept`)
    expect(accepted.status).toBe(200)
    expect(accepted.body.data.status).toBe('confirmed')
  })

  it('lists same-day confirmed appointments for shops without blocking acceptance', async () => {
    const sameDayPendingId = await createPending('2030-01-02T11:00:00.000Z')
    const listed = await shop.send('get', `/appointments/${sameDayPendingId}/same-day`)
    expect(listed.status).toBe(200)
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: appointmentId, agreedStartAt: '2030-01-02T10:00:00.000Z', customerName: 'Customer' }),
    ])

    expect((await customer.send('get', `/appointments/${sameDayPendingId}/same-day`)).status).toBe(403)
    const empty = await shop.send('get', `/appointments/${appointmentId}/same-day`)
    expect(empty.status).toBe(200)
    expect(empty.body.data).toEqual([])
  })

  it('returns one success and one 409 for concurrent accepts without duplicate notification', async () => {
    const concurrentId = await createPending('2030-01-03T09:00:00.000Z')
    const responses = await Promise.all([
      shop.send('post', `/appointments/${concurrentId}/accept`),
      shop.send('post', `/appointments/${concurrentId}/accept`),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(responses.find((response) => response.status === 200)?.body.data.status).toBe('confirmed')

    const customerId = (await customer.send('get', '/auth/me')).body.data.id
    expect(await prisma.notification.count({ where: { userId: customerId, sourceType: 'appointment', sourceId: concurrentId, kind: 'appointment_status' } })).toBe(1)
  })

  it('rejects accepting an appointment that was cancelled first', async () => {
    const cancelledId = await createPending('2030-01-03T10:00:00.000Z')
    expect((await shop.send('post', `/appointments/${cancelledId}/cancel`)).status).toBe(200)
    expect((await shop.send('post', `/appointments/${cancelledId}/accept`)).status).toBe(409)
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

  it('allows only the review author to delete reviews and recomputes ratings from remaining reviews', async () => {
    const shopId = (await shop.send('get', '/auth/me')).body.data.id
    expect((await shop.send('delete', `/appointments/${appointmentId}/review`)).status).toBe(403)

    const secondAppointmentId = await createPending('2030-01-04T09:00:00.000Z')
    expect((await shop.send('post', `/appointments/${secondAppointmentId}/accept`)).status).toBe(200)
    expect((await shop.send('post', `/appointments/${secondAppointmentId}/complete`)).status).toBe(200)
    expect((await customer.send('post', `/appointments/${secondAppointmentId}/review`, { rating: 3 })).status).toBe(200)

    const beforeDelete = await shop.send('get', `/shops/${shopId}`)
    expect(beforeDelete.body.data.ratingCount).toBe(2)
    expect(Number(beforeDelete.body.data.ratingAvg)).toBe(4)

    expect((await customer.send('delete', `/appointments/${appointmentId}/review`)).status).toBe(200)
    const afterFirstDelete = await shop.send('get', `/shops/${shopId}`)
    expect(afterFirstDelete.body.data.ratingCount).toBe(1)
    expect(Number(afterFirstDelete.body.data.ratingAvg)).toBe(3)
    expect((await customer.send('get', `/appointments/${appointmentId}`)).body.data.review).toBeNull()
    expect((await customer.send('delete', `/appointments/${appointmentId}/review`)).status).toBe(404)

    expect((await customer.send('delete', `/appointments/${secondAppointmentId}/review`)).status).toBe(200)
    expect((await customer.send('delete', `/appointments/${secondAppointmentId}/review`)).status).toBe(404)
    const afterLastDelete = await shop.send('get', `/shops/${shopId}`)
    expect(afterLastDelete.body.data.ratingCount).toBe(0)
    expect(Number(afterLastDelete.body.data.ratingAvg)).toBe(0)
    expect(afterLastDelete.body.data.reviews).toEqual([])
  })
})
