import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMcpApp } from './httpApp.ts'

const ORIGIN = 'https://mcp.example.com'
const REDIRECT = 'https://chatgpt.com/connector/oauth/test-callback'
const API_TOKEN = `nsk_${'a'.repeat(43)}`
const VERIFIER = 'v'.repeat(64)
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url')
const ENV = { NAIL_STUDIO_MCP_URL: ORIGIN, NAIL_STUDIO_OAUTH_SECRET: 's'.repeat(64), NAIL_STUDIO_WEB_URL: 'https://web.example.com' }
const appFor = (validateApiToken = vi.fn(async (_token: string) => {})) => createMcpApp({ env: ENV, validateApiToken })
type App = ReturnType<typeof appFor>

async function register(app: App, method = 'client_secret_post') {
  const response = await request(app).post('/register').send({
    client_name: 'ChatGPT test', redirect_uris: [REDIRECT], token_endpoint_auth_method: method,
  }).expect(201)
  return response.body as { client_id: string; client_secret?: string }
}

async function authorize(app: App, client: Awaited<ReturnType<typeof register>>, extra = {}) {
  const response = await request(app).get('/authorize').query({
    client_id: client.client_id, redirect_uri: REDIRECT, response_type: 'code', scope: 'nails:design',
    state: 'original-state', code_challenge: CHALLENGE, code_challenge_method: 'S256', resource: `${ORIGIN}/mcp`, ...extra,
  }).expect(200)
  const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!
  const flow = /name="request" value="([^"]+)"/.exec(response.text)![1]!
  return { cookie, flow, response }
}

async function consent(app: App, client: Awaited<ReturnType<typeof register>>) {
  const { cookie, flow } = await authorize(app, client)
  const result = await request(app).post('/consent').set('Origin', ORIGIN).set('Cookie', cookie)
    .type('form').send({ request: flow, token: API_TOKEN }).expect(303)
  const location = new URL(result.headers.location as string)
  expect(location.origin + location.pathname).toBe(REDIRECT)
  expect(location.searchParams.get('state')).toBe('original-state')
  expect(location.href).not.toContain(API_TOKEN)
  return location.searchParams.get('code')!
}

function exchange(app: App, client: Awaited<ReturnType<typeof register>>, code: string, extra = {}) {
  return request(app).post('/token').type('form').send({
    ...client, grant_type: 'authorization_code', code, code_verifier: VERIFIER, redirect_uri: REDIRECT, resource: `${ORIGIN}/mcp`, ...extra,
  })
}

const mcp = (app: App, accessToken?: string, method = 'initialize', params: object = {
  protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' },
}) => {
  const call = request(app).post('/mcp').set('Accept', 'application/json, text/event-stream')
  if (accessToken) call.set('Authorization', `Bearer ${accessToken}`)
  return call.send({ jsonrpc: '2.0', id: 1, method, params })
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('HTTP MCP and OAuth', () => {
  it('serves health and discovery with a resource-specific authentication challenge', async () => {
    const app = appFor()
    await request(app).get('/health').expect(200, { status: 'ok' })
    const resource = await request(app).get('/.well-known/oauth-protected-resource/mcp').expect(200)
    expect(resource.body.resource).toBe(`${ORIGIN}/mcp`)
    const metadata = await request(app).get('/.well-known/oauth-authorization-server').expect(200)
    expect(metadata.body.code_challenge_methods_supported).toEqual(['S256'])
    expect(metadata.body.registration_endpoint).toBe(`${ORIGIN}/register`)
    const response = await mcp(app).expect(401)
    expect(response.headers['www-authenticate']).toContain(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`)
  })

  it('requires HTTPS and a stable encryption key when OAuth is configured', () => {
    expect(() => createMcpApp({ env: { NAIL_STUDIO_MCP_URL: ORIGIN } })).toThrow()
    expect(() => createMcpApp({ env: { ...ENV, NAIL_STUDIO_MCP_URL: 'http://example.com' } })).toThrow()
    expect(() => createMcpApp({ env: { ...ENV, NAIL_STUDIO_OAUTH_SECRET: 'short' } })).toThrow()
  })

  it('rejects arbitrary callback domains, fragments, userinfo and unsupported client authentication', async () => {
    const app = appFor()
    for (const uri of ['https://evil.test/callback', 'https://chatgpt.com.evil.test/connector/oauth/a',
      'https://chatgpt.com/connector/oauth/a#token', 'https://evil@chatgpt.com/connector/oauth/a']) {
      await request(app).post('/register').send({ redirect_uris: [uri] }).expect(400)
    }
    await request(app).post('/register').send({ redirect_uris: [REDIRECT], token_endpoint_auth_method: 'client_secret_basic' }).expect(400)
  })

  it('links a validated API token, exchanges the code once, and discovers all MCP tools', async () => {
    const validate = vi.fn(async (_token: string) => {})
    const app = appFor(validate)
    const client = await register(app)
    const code = await consent(app, client)
    expect(validate).toHaveBeenCalledWith(API_TOKEN)
    const response = await exchange(app, client, code).expect(200)
    expect(response.body.access_token).not.toContain(API_TOKEN)
    expect(response.body.refresh_token).not.toContain(API_TOKEN)
    expect(response.body.expires_in).toBe(3600)
    await exchange(app, client, code).expect(400)
    const init = await mcp(app, response.body.access_token).expect(200)
    expect(init.body.result.serverInfo.name).toBe('nail-studio')
    const list = await mcp(app, response.body.access_token, 'tools/list', {}).expect(200)
    expect(list.body.result.tools).toHaveLength(20)
    expect(list.body.result.tools[0]._meta.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['nails:design'] }])
    const patterns = await mcp(app, response.body.access_token, 'tools/call', { name: 'list_patterns', arguments: {} }).expect(200)
    expect(patterns.body.result.isError).not.toBe(true)
  })

  it('binds authorization codes to PKCE, client, redirect URI and resource', async () => {
    const app = appFor()
    const client = await register(app)
    const otherClient = await register(app)
    const code = await consent(app, client)
    await exchange(app, otherClient, code).expect(400)
    await exchange(app, client, code, { code_verifier: 'wrong' }).expect(400)
    await exchange(app, client, code, { redirect_uri: 'https://evil.test' }).expect(400)
    await exchange(app, client, code, { resource: 'https://evil.test/mcp' }).expect(400)
    await exchange(app, client, code).expect(200)
  })

  it('rejects unregistered redirects, unknown scopes and a different resource at authorization', async () => {
    const app = appFor()
    const client = await register(app)
    const base = { client_id: client.client_id, response_type: 'code', redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256' }
    await request(app).get('/authorize').query({ ...base, redirect_uri: 'https://evil.test' }).expect(400)
    for (const extra of [{ scope: 'admin' }, { resource: 'https://evil.test/mcp' }, { code_challenge_method: 'plain' }]) {
      const response = await request(app).get('/authorize').query({ ...base, ...extra }).expect(302)
      expect(new URL(response.headers.location as string).searchParams.has('error')).toBe(true)
    }
  })

  it('requires the same browser cookie and origin for consent and never echoes credentials', async () => {
    const app = appFor()
    const client = await register(app)
    const { cookie, flow, response } = await authorize(app, client)
    expect(response.headers['set-cookie']![0]).toContain('HttpOnly')
    expect(response.headers['set-cookie']![0]).toContain('Secure')
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    for (const origin of ['https://evil.test', 'null']) {
      await request(app).post('/consent').set('Origin', origin).set('Cookie', cookie).type('form').send({ request: flow, token: API_TOKEN }).expect(403)
    }
    const denied = await request(app).post('/consent').set('Origin', ORIGIN).type('form').send({ request: flow, token: API_TOKEN }).expect(400)
    expect(denied.text).not.toContain(API_TOKEN)
  })

  it('lets browsers send the real Origin when the consent form is submitted', async () => {
    const app = appFor()
    const { response } = await authorize(app, await register(app))
    // no-referrer ทำให้เบราว์เซอร์ส่ง Origin: null ตอน POST ฟอร์ม → consent ตอบ 403 ทุกครั้ง
    expect(response.headers['referrer-policy']).toBe('same-origin')
    const health = await request(app).get('/health').expect(200)
    expect(health.headers['referrer-policy']).toBe('no-referrer')
  })

  it('rejects invalid API tokens without exposing upstream errors', async () => {
    const app = appFor(vi.fn(async () => { throw new Error(`upstream secret ${API_TOKEN}`) }))
    const { cookie, flow } = await authorize(app, await register(app))
    const result = await request(app).post('/consent').set('Origin', ORIGIN).set('Cookie', cookie).type('form')
      .send({ request: flow, token: API_TOKEN }).expect(400)
    expect(result.text).not.toContain(API_TOKEN)
    expect(result.text).not.toContain('upstream')
  })

  it('preserves clients, access and confidential refresh tokens across process restarts', async () => {
    const app = appFor()
    const client = await register(app)
    const token = await exchange(app, client, await consent(app, client)).expect(200)
    const restarted = appFor()
    await mcp(restarted, token.body.access_token).expect(200)
    const renewed = await request(restarted).post('/token').type('form').send({
      ...client, grant_type: 'refresh_token', refresh_token: token.body.refresh_token, resource: `${ORIGIN}/mcp`,
    }).expect(200)
    await mcp(restarted, renewed.body.access_token).expect(200)
    const revoked = appFor(vi.fn(async () => { throw new Error('revoked') }))
    await mcp(revoked, token.body.access_token).expect(401)
    await request(revoked).post('/token').type('form').send({ ...client, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }).expect(400)
  })

  it('rejects expired codes, consent, access and refresh tokens', async () => {
    const app = appFor()
    const client = await register(app)
    const code = await consent(app, client)
    const token = await exchange(app, client, code).expect(200)
    const pendingCode = await consent(app, client)
    const { cookie, flow } = await authorize(app, client)
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 24 * 60 * 60 * 1000)
    await exchange(app, client, pendingCode).expect(400)
    await mcp(app, token.body.access_token).expect(401)
    await request(app).post('/token').type('form').send({ ...client, grant_type: 'refresh_token', refresh_token: token.body.refresh_token }).expect(400)
    await request(app).post('/consent').set('Origin', ORIGIN).set('Cookie', cookie).type('form').send({ request: flow, token: API_TOKEN }).expect(400)
  })

  it('rotates refresh tokens for public clients and rejects a reused one', async () => {
    const app = appFor()
    const client = await register(app, 'none')
    const token = await exchange(app, client, await consent(app, client)).expect(200)
    expect(token.body.refresh_token).toBeTypeOf('string')
    const refresh = (refreshToken: string) => request(app).post('/token').type('form').send({
      client_id: client.client_id, grant_type: 'refresh_token', refresh_token: refreshToken, resource: `${ORIGIN}/mcp`,
    })
    const first = await refresh(token.body.refresh_token).expect(200)
    expect(first.body.refresh_token).not.toBe(token.body.refresh_token)
    await mcp(app, first.body.access_token).expect(200)
    // ใช้ซ้ำ = ถูกปฏิเสธด้วย invalid_grant (Claude จะให้ผู้ใช้เชื่อมต่อใหม่)
    const reused = await refresh(token.body.refresh_token).expect(400)
    expect(reused.body.error).toBe('invalid_grant')
    await refresh(first.body.refresh_token).expect(200)
  })

  it('rejects tampered tokens and tokens from another issuer or encryption key', async () => {
    const app = appFor()
    const client = await register(app)
    const token = await exchange(app, client, await consent(app, client)).expect(200)
    await mcp(app, `${token.body.access_token}tampered`).expect(401)
    const otherIssuer = createMcpApp({ env: { ...ENV, NAIL_STUDIO_MCP_URL: 'https://other.example.com' } })
    const otherKey = createMcpApp({ env: { ...ENV, NAIL_STUDIO_OAUTH_SECRET: 'k'.repeat(64) } })
    await mcp(otherIssuer, token.body.access_token).expect(401)
    await mcp(otherKey, token.body.access_token).expect(401)
  })

  it('preserves direct API-token clients and rejects malformed or oversized MCP requests', async () => {
    const app = createMcpApp({ env: {}, validateApiToken: async () => {} })
    await mcp(app, API_TOKEN).expect(200)
    await request(app).get('/mcp').set('Authorization', `Bearer ${API_TOKEN}`).expect(405)
    await request(app).post('/mcp').set('Authorization', `Bearer ${API_TOKEN}`).set('Content-Type', 'application/json').send('{').expect(400)
    await request(app).post('/mcp').set('Authorization', `Bearer ${API_TOKEN}`).send({ data: 'x'.repeat(6 * 1024 * 1024) }).expect(413)
    await mcp(app).expect(401)
  })
})

describe('Claude custom connector OAuth', () => {
  const CLAUDE = 'https://claude.ai/api/mcp/auth_callback'
  const LOOPBACK = 'http://localhost:3118/callback'

  /** flow แบบที่ Claude ทำจริง: DCR เป็น public client → authorize (ขอ offline_access ด้วย) → consent → token */
  async function connect(app: App, redirect: string) {
    const client = (await request(app).post('/register').send({
      client_name: 'Claude', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'],
    }).expect(201)).body as { client_id: string }
    const page = await request(app).get('/authorize').query({
      client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: 'nails:design offline_access',
      state: 's', code_challenge: CHALLENGE, code_challenge_method: 'S256', resource: `${ORIGIN}/mcp`,
    }).expect(200)
    const cookie = (page.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!
    const flow = /name="request" value="([^"]+)"/.exec(page.text)![1]!
    const consented = await request(app).post('/consent').set('Origin', ORIGIN).set('Cookie', cookie)
      .type('form').send({ request: flow, token: API_TOKEN }).expect(303)
    const location = new URL(consented.headers.location as string)
    expect(location.origin + location.pathname).toBe(redirect)
    const token = await request(app).post('/token').type('form').send({
      client_id: client.client_id, grant_type: 'authorization_code', code: location.searchParams.get('code'),
      code_verifier: VERIFIER, redirect_uri: redirect, resource: `${ORIGIN}/mcp`,
    }).expect(200)
    return { page, consented, token }
  }

  it('connects from claude.ai, shows the destination host and returns a refresh token', async () => {
    const app = appFor()
    const { page, consented, token } = await connect(app, CLAUDE)
    expect(page.text).toContain('claude.ai')
    expect(page.text).not.toContain('localhost')
    expect(consented.headers['content-security-policy']).toContain('https://claude.ai')
    expect(token.body.refresh_token).toBeTypeOf('string')
    await mcp(app, token.body.access_token).expect(200)
  })

  it('accepts the future claude.com callback and Claude Code loopback on any port, with a local-app warning', async () => {
    const app = appFor()
    await connect(app, 'https://claude.com/api/mcp/auth_callback')
    for (const uri of [LOOPBACK, 'http://127.0.0.1:51234/callback']) {
      const { page, token } = await connect(app, uri)
      expect(page.text).toContain('คำเตือน')
      await mcp(app, token.body.access_token).expect(200)
    }
  })

  it('advertises offline_access so Claude asks for refresh tokens', async () => {
    const metadata = await request(appFor()).get('/.well-known/oauth-authorization-server').expect(200)
    expect(metadata.body.scopes_supported).toContain('offline_access')
    expect(metadata.body.token_endpoint_auth_methods_supported).toContain('none')
  })

  it('rejects look-alike Claude and loopback callbacks', async () => {
    const app = appFor()
    for (const uri of [
      'https://claude.ai/api/mcp/auth_callback/extra', 'https://claude.ai.evil.test/api/mcp/auth_callback',
      'https://claude.ai/api/mcp/auth_callback?x=1', 'http://claude.ai/api/mcp/auth_callback',
      'https://localhost:3118/callback', 'http://localhost:3118/other', 'http://localhost.evil.test:3118/callback',
      'http://user@localhost:3118/callback', 'http://10.0.0.5:3118/callback',
    ]) {
      await request(app).post('/register').send({ redirect_uris: [uri], token_endpoint_auth_method: 'none' }).expect(400)
    }
  })
})
