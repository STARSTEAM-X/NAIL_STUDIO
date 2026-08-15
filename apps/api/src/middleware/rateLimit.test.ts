import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimit.ts'

describe('rate limit middleware', () => {
  it('returns 429 after the configured budget is exhausted', async () => {
    const app = express()
    app.use(createRateLimiter(2, { keyGenerator: () => 'rate-limit-test-key' }))
    app.get('/', (_request, response) => response.json({ ok: true }))
    expect((await request(app).get('/')).status).toBe(200)
    expect((await request(app).get('/')).status).toBe(200)
    expect((await request(app).get('/')).status).toBe(429)
  })
})
