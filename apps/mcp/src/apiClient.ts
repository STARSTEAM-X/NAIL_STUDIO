import { readFileSync } from 'node:fs'
import { API_TOKEN_PREFIX, type DesignDocument } from '@nail-studio/contracts'

/**
 * ตัวเรียก API ของ NAIL_STUDIO สำหรับ MCP server
 *
 * ยืนยันตัวตนได้สองแบบ:
 *  - token: ส่ง `Authorization: Bearer nsk_...` (สร้างจากหน้าโปรไฟล์) — ทางที่ควรใช้จริง
 *    API ไม่ตรวจ CSRF กับคำขอแบบ Bearer เพราะเบราว์เซอร์ไม่แนบ header นี้ให้เอง
 *  - tokenFile: อ่าน token จากไฟล์ทุกครั้งที่เรียก — ไม่ต้องใส่ secret ใน config ของ AI client
 *    และเปลี่ยน token ได้โดยไม่ต้องรีสตาร์ท (ไฟล์ยังว่าง = server เปิดได้ แต่ tool ตอบว่าต้องใส่ token)
 *  - email/password: ล็อกอินแบบเดียวกับเว็บ (cookie + CSRF) — สำหรับ dev บนเครื่องเท่านั้น
 */

export interface ApiClientOptions {
  baseUrl: string
  token?: string | undefined
  tokenFile?: string | undefined
  email?: string | undefined
  password?: string | undefined
}

export interface ProjectSummary {
  id: string
  name: string
  status: string
  versionCount: number
  updatedAt: string
}

export interface ProjectDetail {
  project: ProjectSummary
  version: { number: number; document: DesignDocument; createdAt: string }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export class NailStudioApi {
  private readonly options: ApiClientOptions
  private readonly jar = new Map<string, string>()
  private loggedIn = false

  constructor(options: ApiClientOptions) {
    if (!options.token && !options.tokenFile && !(options.email && options.password)) {
      throw new Error('ต้องตั้ง NAIL_STUDIO_TOKEN, NAIL_STUDIO_TOKEN_FILE หรือ NAIL_STUDIO_EMAIL + NAIL_STUDIO_PASSWORD')
    }
    this.options = options
  }

  private get usesToken(): boolean {
    return Boolean(this.options.token || this.options.tokenFile)
  }

  /** token ปัจจุบัน — จากค่าที่ส่งมาตรง ๆ หรืออ่านสดจากไฟล์ */
  private currentToken(): string {
    if (this.options.token) return this.options.token
    const path = this.options.tokenFile!
    let token = ''
    try {
      token = readFileSync(path, 'utf8').trim()
    } catch {
      // ไม่มีไฟล์ = ยังไม่ได้ตั้งค่า — ตอบเป็นข้อความที่บอกวิธีแก้ด้านล่าง
    }
    if (!token.startsWith(API_TOKEN_PREFIX)) {
      throw new ApiError(401, `ยังไม่มี API token — สร้างที่หน้าโปรไฟล์ NailStudio (แก้ไขโปรไฟล์ → เชื่อมต่อ AI) แล้ววาง token (${API_TOKEN_PREFIX}...) ลงในไฟล์ ${path}`)
    }
    return token
  }

  private async raw<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.usesToken) {
      headers.Authorization = `Bearer ${this.currentToken()}`
    } else {
      const csrf = this.jar.get('nscsrf')
      if (csrf) headers['x-csrf-token'] = decodeURIComponent(csrf)
      if (this.jar.size > 0) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const response = await fetch(this.options.baseUrl + path, {
      method,
      headers,
      signal: AbortSignal.timeout(20_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair!.indexOf('=')
      if (index > 0) this.jar.set(pair!.slice(0, index), pair!.slice(index + 1))
    }
    const json = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string; code?: string } }
    if (!response.ok) {
      throw new ApiError(response.status, json.error?.message ?? `HTTP ${response.status}`, json.error?.code)
    }
    return json.data as T
  }

  private async ensureSession(): Promise<void> {
    if (this.usesToken || this.loggedIn) return
    await this.raw('GET', '/auth/me').catch(() => undefined) // รับ CSRF cookie ก่อน
    await this.raw('POST', '/auth/login', { email: this.options.email, password: this.options.password })
    this.loggedIn = true
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.ensureSession()
    try {
      return await this.raw<T>(method, path, body)
    } catch (error) {
      // session หมดอายุระหว่างทาง — ล็อกอินใหม่หนึ่งครั้งแล้วลองอีกรอบ
      if (error instanceof ApiError && error.status === 401 && !this.usesToken) {
        this.loggedIn = false
        this.jar.clear()
        await this.ensureSession()
        return this.raw<T>(method, path, body)
      }
      throw error
    }
  }

  /** หน้าแรกของรายการงาน — API คืน data เป็น array และเก็บ cursor ไว้ใน meta */
  listProjects(): Promise<ProjectSummary[]> {
    return this.request<ProjectSummary[]>('GET', '/projects')
  }

  getProject(projectId: string): Promise<ProjectDetail> {
    return this.request('GET', `/projects/${projectId}`)
  }

  createProject(name: string): Promise<ProjectSummary> {
    return this.request('POST', '/projects', { name })
  }

  saveVersion(projectId: string, document: DesignDocument, expectedVersion: number): Promise<{ versionNumber: number }> {
    return this.request('POST', `/projects/${projectId}/versions`, { document, expectedVersion })
  }
}
