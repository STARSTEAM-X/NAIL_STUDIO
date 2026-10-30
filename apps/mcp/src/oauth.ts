import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidClientMetadataError, InvalidGrantError, InvalidRequestError, InvalidScopeError, InvalidTokenError, TemporarilyUnavailableError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { API_TOKEN_PREFIX } from '@nail-studio/contracts'

export const DESIGN_SCOPE = 'nails:design'
/** Claude ขอ scope นี้เพิ่มเมื่อเห็นใน metadata เพื่อรับ refresh token */
export const OFFLINE_SCOPE = 'offline_access'
const KNOWN_SCOPES = new Set([DESIGN_SCOPE, OFFLINE_SCOPE])
const ACCESS_SECONDS = 60 * 60
const REFRESH_SECONDS = 30 * 24 * 60 * 60
// public client (Claude) ได้ refresh token แบบหมุน — อายุสั้นกว่าเพราะการกันใช้ซ้ำเก็บในหน่วยความจำ
const PUBLIC_REFRESH_SECONDS = 14 * 24 * 60 * 60
const MAX_USED_REFRESH = 10000
const FLOW_SECONDS = 5 * 60
// code ใช้แค่ตอน redirect กลับทันที — อายุสั้นเพราะกันใช้ซ้ำได้แค่ภายใน instance
const CODE_SECONDS = 60
const MAX_CODES = 1000
const COOKIE = '__Host-nailstudio-oauth'
const tokenSchema = z.string().regex(new RegExp(`^${API_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`))

export interface OAuthOptions {
  publicUrl: string
  secret: string
  webUrl: string
  validateApiToken: (token: string) => Promise<void>
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!)

/** Authenticated encryption keeps upstream API tokens out of client-visible plaintext and logs. */
class SealedValues {
  private readonly key: Buffer
  private readonly issuer: string

  constructor(secret: string, issuer: string) {
    if (secret.length < 32) throw new Error('NAIL_STUDIO_OAUTH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร')
    this.key = createHash('sha256').update(secret).digest()
    this.issuer = issuer
  }

  seal(kind: string, value: object): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(Buffer.from(`${this.issuer}:${kind}`))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return `nso_${kind}_${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')}`
  }

  open(kind: string, value: string): unknown {
    const prefix = `nso_${kind}_`
    if (!value.startsWith(prefix) || value.length > 16000) throw new Error('Invalid sealed value')
    const data = Buffer.from(value.slice(prefix.length), 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', this.key, data.subarray(0, 12))
    decipher.setAAD(Buffer.from(`${this.issuer}:${kind}`))
    decipher.setAuthTag(data.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8')) as unknown
  }

  clientSecret(clientId: string): string {
    return createHmac('sha256', this.key).update(`client-secret:${clientId}`).digest('base64url')
  }
}

const clientSchema = z.object({
  redirect_uris: z.array(z.string().max(2048)).min(1).max(5),
  client_name: z.string().max(100),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post']),
  client_id_issued_at: z.number(),
})
const flowSchema = z.object({
  clientId: z.string(), redirectUri: z.string(), challenge: z.string(),
  state: z.string().optional(), csrf: z.string(), expiresAt: z.number(),
})
const accessSchema = z.object({
  clientId: z.string(), apiToken: tokenSchema, expiresAt: z.number(),
})
const refreshSchema = accessSchema.extend({ jti: z.string().optional() })
const codeSchema = accessSchema.extend({ redirectUri: z.string(), challenge: z.string(), jti: z.string() })
type Flow = z.infer<typeof flowSchema>
type Code = z.infer<typeof codeSchema>

/** callback ของ Claude ที่โฮสต์ไว้ (claude.ai, Desktop, มือถือ, Cowork) — claude.com เผื่อย้ายในอนาคตตามเอกสารของ Anthropic */
const CLAUDE_CALLBACKS = new Set(['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'])
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1'])

/** loopback redirect ของแอปบนเครื่อง (Claude Code, RFC 8252) — พอร์ตเปลี่ยนทุกครั้ง จึงไม่ผูกพอร์ต */
export function isLoopbackRedirect(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) && url.pathname === '/callback'
      && !url.search && !url.hash && !url.username && !url.password
  } catch { return false }
}

/**
 * Only known AI-client callbacks may receive credentials from this deployment. No arbitrary redirect/SSRF.
 * ChatGPT connectors, Claude custom connectors (hosted callback) and Claude Code (loopback).
 */
function allowedRedirect(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.search || url.hash || url.username || url.password) return false
    if (CLAUDE_CALLBACKS.has(url.href) || isLoopbackRedirect(value)) return true
    return url.origin === 'https://chatgpt.com'
      && (url.pathname === '/connector_platform_oauth_redirect' || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname))
  } catch { return false }
}

/** CSP form-action ต้องอนุญาตทุกปลายทางที่หน้า consent redirect ไปได้ (Chrome ตรวจ form-action กับ redirect ด้วย) */
export const CONSENT_FORM_ACTIONS = ["'self'", 'https://chatgpt.com', 'https://claude.ai', 'https://claude.com', 'http://localhost:*', 'http://127.0.0.1:*']

export class NailStudioOAuth implements OAuthServerProvider {
  readonly issuer: URL
  readonly resource: URL
  readonly clientsStore: OAuthRegisteredClientsStore
  private readonly sealed: SealedValues
  private readonly options: OAuthOptions
  // code เป็นค่า sealed (stateless) เพราะ /consent กับ /token อาจวิ่งคนละ instance บน serverless
  // shortcut: กันใช้ code ซ้ำได้แค่ภายใน instance (jti → หมดอายุ) — PKCE + อายุ 60 วินาทีเป็นแนวป้องกันหลัก, ย้ายไป store กลางถ้าต้องการ single-use จริง
  private readonly usedCodes = new Map<string, number>()
  // refresh token ของ public client ที่ถูกใช้แล้ว (jti → หมดอายุ) — กันใช้ซ้ำตาม OAuth 2.1 rotation
  // อยู่ในหน่วยความจำ: หลังรีสตาร์ท token เก่าที่ยังไม่หมดอายุใช้ได้อีกครั้ง จึงจำกัดอายุไว้ที่ 14 วัน
  private readonly usedRefresh = new Map<string, number>()

  constructor(options: OAuthOptions) {
    const url = new URL(options.publicUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('NAIL_STUDIO_MCP_URL ต้องเป็น HTTPS origin')
    }
    this.issuer = url
    this.resource = new URL('/mcp', url)
    this.options = options
    this.sealed = new SealedValues(options.secret, this.issuer.href)
    this.clientsStore = {
      getClient: (id) => {
        try {
          const metadata = clientSchema.parse(this.sealed.open('client', id))
          return {
            ...metadata, client_id: id,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'], scope: `${DESIGN_SCOPE} ${OFFLINE_SCOPE}`,
            ...(metadata.token_endpoint_auth_method === 'none' ? {} : {
              client_secret: this.sealed.clientSecret(id), client_secret_expires_at: 0,
            }),
          }
        } catch { return undefined }
      },
      registerClient: (client) => {
        if (client.redirect_uris.some((uri) => !allowedRedirect(uri))) {
          throw new InvalidClientMetadataError('Only ChatGPT, Claude or loopback OAuth callbacks are allowed')
        }
        const result = clientSchema.safeParse({
          redirect_uris: client.redirect_uris,
          client_name: client.client_name ?? 'AI client',
          token_endpoint_auth_method: client.token_endpoint_auth_method ?? 'client_secret_post',
          client_id_issued_at: this.now(),
        })
        if (!result.success) throw new InvalidClientMetadataError('Unsupported client metadata')
        const id = this.sealed.seal('client', result.data)
        return this.clientsStore.getClient(id) as OAuthClientInformationFull
      },
    }
  }

  private now(): number { return Math.floor(Date.now() / 1000) }

  private checkResource(resource?: URL): void {
    if (resource && resource.href !== this.resource.href) throw new InvalidRequestError('Invalid resource')
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, response: Response): Promise<void> {
    this.checkResource(params.resource)
    if (params.scopes?.some((scope) => !KNOWN_SCOPES.has(scope))) throw new InvalidScopeError('Unknown scope')
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidRequestError('Invalid S256 challenge')
    const flow: Flow = {
      clientId: client.client_id, redirectUri: params.redirectUri, challenge: params.codeChallenge,
      csrf: randomBytes(32).toString('base64url'), expiresAt: this.now() + FLOW_SECONDS,
      ...(params.state === undefined ? {} : { state: params.state }),
    }
    // no-referrer (ค่าทั้งแอป) ทำให้เบราว์เซอร์ส่ง Origin: null ตอน POST ฟอร์ม consent จึงตรวจที่มาไม่ผ่าน
    // same-origin ยังไม่ส่ง referrer ไปปลายทาง redirect ข้าม origin
    response.setHeader('Referrer-Policy', 'same-origin')
    response.cookie(COOKIE, flow.csrf, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: FLOW_SECONDS * 1000 })
    const request = this.sealed.seal('flow', flow)
    // แสดง hostname ปลายทางเสมอ (MCP authorization spec) — ชื่อ client ผู้ลงทะเบียนตั้งเองได้ จึงเชื่อไม่ได้
    const redirectHost = new URL(params.redirectUri).host
    const loopbackWarning = isLoopbackRedirect(params.redirectUri)
      ? '<p><strong>คำเตือน:</strong> ปลายทางเป็นโปรแกรมบนเครื่องนี้ (localhost) อนุญาตเฉพาะเมื่อคุณเพิ่งสั่งเชื่อมต่อจากแอปบนเครื่อง เช่น Claude Code</p>'
      : ''
    response.type('html').send(`<!doctype html><html lang="th"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>เชื่อมต่อ NailStudio</title>
<style>body{font:17px system-ui;background:#f8f4ec;color:#452230;margin:0;padding:24px}main{max-width:480px;margin:8vh auto;background:white;padding:32px;border-radius:20px}h1{font-size:26px}p{line-height:1.7}input,button{box-sizing:border-box;width:100%;padding:14px;margin-top:12px;font:inherit;border:1px solid #c9b9bf;border-radius:10px}button{background:#6b1e2b;color:white;cursor:pointer}a{color:#6b1e2b}small{display:block;margin-top:16px;line-height:1.6}</style>
<main><h1>เชื่อมต่อ NailStudio กับ ${escapeHtml(client.client_name ?? 'AI client')}</h1>
<p>อนุญาตให้ AI อ่าน สร้าง และแก้ไขงานออกแบบของบัญชีคุณ ทุกการบันทึกเป็นเวอร์ชันใหม่ ย้อนกลับได้จากประวัติงาน</p>
<p>หลังอนุญาต ระบบจะส่งกลับไปที่ <strong>${escapeHtml(redirectHost)}</strong> — ตรวจว่าเป็นแอปที่คุณกำลังเชื่อมต่ออยู่จริง</p>${loopbackWarning}
<p>เปิด <a href="${escapeHtml(this.options.webUrl)}/profile" target="_blank" rel="noopener noreferrer">โปรไฟล์ NailStudio</a> → แก้ไขโปรไฟล์ → เชื่อมต่อ AI แล้วสร้าง API token สำหรับการเชื่อมต่อนี้</p>
<form action="/consent" method="post"><input type="hidden" name="request" value="${escapeHtml(request)}">
<label for="token">API token ของคุณ</label><input id="token" type="password" name="token" required autocomplete="off" spellcheck="false" placeholder="nsk_…" maxlength="100">
<button type="submit">อนุญาตและเชื่อมต่อ</button></form>
<small>ยกเลิกสิทธิ์ได้ทุกเมื่อ โดยยกเลิก token นี้จากหน้าโปรไฟล์ ข้อมูล token ส่งผ่าน HTTPS และไม่แสดงให้ AI เห็น</small></main></html>`)
  }

  async consent(request: Request, response: Response): Promise<void> {
    response.setHeader('Cache-Control', 'no-store')
    if (request.headers.origin !== this.issuer.origin) {
      response.status(403).send('ไม่สามารถยืนยันที่มาของคำขอ กรุณาเริ่มเชื่อมต่อใหม่')
      return
    }
    const input = z.object({ request: z.string().max(16000), token: tokenSchema }).safeParse(request.body)
    try {
      if (!input.success) throw new Error('Invalid input')
      const flow = flowSchema.parse(this.sealed.open('flow', input.data.request))
      const csrf = request.headers.cookie?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ''
      if (flow.expiresAt <= this.now() || csrf.length !== flow.csrf.length || !timingSafeEqual(Buffer.from(csrf), Buffer.from(flow.csrf))) {
        throw new Error('Invalid consent')
      }
      await this.options.validateApiToken(input.data.token)
      const code = this.sealed.seal('code', {
        clientId: flow.clientId, redirectUri: flow.redirectUri, challenge: flow.challenge,
        apiToken: input.data.token, expiresAt: this.now() + CODE_SECONDS, jti: randomBytes(16).toString('base64url'),
      } satisfies Code)
      response.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
      const redirect = new URL(flow.redirectUri)
      redirect.searchParams.set('code', code)
      if (flow.state !== undefined) redirect.searchParams.set('state', flow.state)
      response.redirect(303, redirect.href)
    } catch {
      // Never echo upstream errors, form fields or tokens into an error response.
      response.status(400).send('เชื่อมต่อไม่สำเร็จ: token ไม่ถูกต้อง/หมดอายุ หรือคำขอหมดเวลา กรุณาเริ่มเชื่อมต่อใหม่')
    }
  }

  private codeFor(clientId: string, code: string): Code {
    let value: Code
    try { value = codeSchema.parse(this.sealed.open('code', code)) } catch { throw new InvalidGrantError('Invalid or expired code') }
    if (value.expiresAt <= this.now() || value.clientId !== clientId || this.usedCodes.has(value.jti)) {
      throw new InvalidGrantError('Invalid or expired code')
    }
    return value
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string): Promise<string> {
    return this.codeFor(client.client_id, code).challenge
  }

  private tokens(clientId: string, apiToken: string): OAuthTokens {
    return {
      access_token: this.sealed.seal('access', { clientId, apiToken, expiresAt: this.now() + ACCESS_SECONDS }),
      token_type: 'Bearer', expires_in: ACCESS_SECONDS, scope: DESIGN_SCOPE,
    }
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL): Promise<OAuthTokens> {
    this.checkResource(resource)
    const value = this.codeFor(client.client_id, code)
    if (redirectUri !== value.redirectUri) throw new InvalidGrantError('redirect_uri must match the authorization request')
    // Entries are ordered by expiry (fixed TTL); each expired jti is visited only once (amortized O(1)).
    for (const [jti, expiry] of this.usedCodes) {
      if (expiry > this.now()) break
      this.usedCodes.delete(jti)
    }
    if (this.usedCodes.size >= MAX_CODES) throw new TemporarilyUnavailableError('Please try again later')
    this.usedCodes.set(value.jti, value.expiresAt)
    const tokens = this.tokens(client.client_id, value.apiToken)
    tokens.refresh_token = this.refreshFor(client, value.apiToken)
    return tokens
  }

  /**
   * confidential client (ChatGPT): refresh token ใช้ซ้ำได้ 30 วันและอยู่รอดข้ามการรีสตาร์ท
   * public client (Claude ผ่าน DCR): หมุนค่าใหม่ทุกครั้งที่ใช้ (OAuth 2.1 / MCP spec) มี jti กันใช้ซ้ำ
   */
  private refreshFor(client: OAuthClientInformationFull, apiToken: string): string {
    if (client.client_secret) {
      return this.sealed.seal('refresh', { clientId: client.client_id, apiToken, expiresAt: this.now() + REFRESH_SECONDS })
    }
    return this.sealed.seal('refresh', {
      clientId: client.client_id, apiToken, expiresAt: this.now() + PUBLIC_REFRESH_SECONDS, jti: randomBytes(16).toString('base64url'),
    })
  }

  /** บันทึกว่า jti นี้ถูกใช้แล้ว — คืน false ถ้าเคยถูกใช้ (ถือว่า token รั่วหรือถูกเล่นซ้ำ) */
  private consumeRefresh(jti: string, expiresAt: number): boolean {
    const now = this.now()
    for (const [id, expiry] of this.usedRefresh) {
      if (expiry > now) break
      this.usedRefresh.delete(id)
    }
    if (this.usedRefresh.has(jti)) return false
    if (this.usedRefresh.size >= MAX_USED_REFRESH) throw new TemporarilyUnavailableError('Please try again later')
    this.usedRefresh.set(jti, expiresAt)
    return true
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    this.checkResource(resource)
    if (scopes?.some((scope) => !KNOWN_SCOPES.has(scope))) throw new InvalidScopeError('Unknown scope')
    try {
      const value = refreshSchema.parse(this.sealed.open('refresh', refreshToken))
      if (value.clientId !== client.client_id || value.expiresAt <= this.now()) throw new Error('Invalid refresh')
      // token ของ public client ต้องมี jti และใช้ได้ครั้งเดียว ส่วนของ confidential client ต้องไม่มี jti
      if (Boolean(client.client_secret) === Boolean(value.jti)) throw new Error('Wrong refresh kind')
      // ทำเครื่องหมายก่อนเรียก API — คำขอซ้ำที่เข้ามาพร้อมกันระหว่างรอ API จะไม่ผ่านทั้งคู่
      if (value.jti && !this.consumeRefresh(value.jti, value.expiresAt)) throw new Error('Refresh token reused')
      await this.options.validateApiToken(value.apiToken)
      return {
        ...this.tokens(client.client_id, value.apiToken),
        refresh_token: value.jti ? this.refreshFor(client, value.apiToken) : refreshToken,
      }
    } catch (error) {
      if (error instanceof TemporarilyUnavailableError) throw error
      throw new InvalidGrantError('Invalid, revoked or expired refresh token')
    }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const value = accessSchema.parse(this.sealed.open('access', token))
      if (value.expiresAt <= this.now()) throw new Error('Expired')
      await this.options.validateApiToken(value.apiToken)
      return { token, clientId: value.clientId, scopes: [DESIGN_SCOPE], expiresAt: value.expiresAt, resource: this.resource, extra: { apiToken: value.apiToken } }
    } catch { throw new InvalidTokenError('Invalid or expired access token') }
  }
}
