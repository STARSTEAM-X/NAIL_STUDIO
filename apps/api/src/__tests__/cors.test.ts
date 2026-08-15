import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'

const app = createApp()

describe('development CORS', () => {
  it('allows Vite fallback ports on loopback during development', async () => {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5175')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5175')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('does not allow non-loopback origins outside the configured origin', async () => {
    const response = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
