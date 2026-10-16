import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { API_TOKEN_PREFIX } from '@nail-studio/contracts'
import { apiFromEnv, loadConfig } from './config.ts'
import { createNailStudioServer } from './server.ts'
import { DESIGN_SCOPE, NailStudioOAuth, type OAuthOptions } from './oauth.ts'

export interface HttpOptions {
  env?: NodeJS.ProcessEnv
  validateApiToken?: OAuthOptions['validateApiToken']
}

export function createMcpApp({ env = process.env, validateApiToken }: HttpOptions = {}) {
  const config = loadConfig(env)
  const app = express()
  app.disable('x-powered-by')
  // Render places one trusted reverse proxy in front of this service.
  if (env.RENDER === 'true') app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'none'"], styleSrc: ["'unsafe-inline'"], formAction: ["'self'", 'https://chatgpt.com'], frameAncestors: ["'none'"],
  } }, referrerPolicy: { policy: 'no-referrer' } }))
  app.get('/health', (_request, response) => { response.json({ status: 'ok' }) })

  const publicUrl = env.NAIL_STUDIO_MCP_URL ?? env.RENDER_EXTERNAL_URL
  const secret = env.NAIL_STUDIO_OAUTH_SECRET
  if (Boolean(publicUrl) !== Boolean(secret)) throw new Error('ต้องตั้ง NAIL_STUDIO_MCP_URL และ NAIL_STUDIO_OAUTH_SECRET คู่กัน')
  const validateToken = validateApiToken ?? (async (token: string) => { await apiFromEnv(env, token).listProjects() })
  const oauth = publicUrl && secret ? new NailStudioOAuth({
    publicUrl, secret, webUrl: config.webUrl,
    validateApiToken: validateToken,
  }) : undefined
  if (oauth) {
    // The SDK provides DCR, PKCE validation, OAuth discovery and endpoint rate limits.
    app.use(mcpAuthRouter({ provider: oauth, issuerUrl: oauth.issuer, resourceServerUrl: oauth.resource,
      scopesSupported: [DESIGN_SCOPE], resourceName: 'NailStudio',
      clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
    }))
    app.post('/consent', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }),
      express.urlencoded({ extended: false, limit: '24kb' }), (request, response) => oauth.consent(request, response))
    // Also expose the root form of the metadata URL for clients that do not use path discovery.
    app.get('/.well-known/oauth-protected-resource', (_request, response) => {
      response.json({ resource: oauth.resource.href, authorization_servers: [oauth.issuer.href], scopes_supported: [DESIGN_SCOPE] })
    })
  }
  app.get('/', (_request, response) => {
    response.json({ name: 'NailStudio MCP', transport: 'streamable-http', endpoint: '/mcp', authentication: oauth ? 'OAuth 2.1 / API token' : 'API token' })
  })

  app.use('/mcp', rateLimit({ windowMs: 60 * 1000, limit: 120 }), async (request, response, next) => {
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1]
    // Existing Claude/stdio users keep their per-user API-token path.
    if (token?.startsWith(API_TOKEN_PREFIX)) {
      try {
        await validateToken(token)
        response.locals.apiToken = token
        next()
      } catch { response.status(401).json({ error: 'invalid_token' }) }
      return
    }
    if (oauth) {
      requireBearerAuth({ verifier: oauth, requiredScopes: [DESIGN_SCOPE], expectedResource: oauth.resource,
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(oauth.resource),
      })(request, response, next)
    } else {
      response.setHeader('WWW-Authenticate', 'Bearer')
      response.status(401).json({ error: 'invalid_token' })
    }
  })
  app.post('/mcp', express.json({ limit: '6mb' }), async (request, response) => {
    const token = (response.locals.apiToken ?? request.auth?.extra?.apiToken) as string
    const server = createNailStudioServer({ api: apiFromEnv(env, token), webUrl: config.webUrl, oauth: Boolean(oauth) })
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true })
    response.on('close', () => { void transport.close(); void server.close() })
    try {
      await server.connect(transport as unknown as Transport)
      await transport.handleRequest(request, response, request.body)
    } catch {
      if (!response.headersSent) response.status(400).json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid MCP request' }, id: null })
    }
  })
  app.all('/mcp', (_request, response) => { response.setHeader('Allow', 'POST'); response.status(405).end() })
  app.use((_request, response) => { response.status(404).json({ error: 'not_found' }) })
  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (response.headersSent) return
    const tooLarge = (error as { type?: string })?.type === 'entity.too.large'
    response.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'request_too_large' : 'invalid_request' })
  }
  app.use(errorHandler)
  return app
}
