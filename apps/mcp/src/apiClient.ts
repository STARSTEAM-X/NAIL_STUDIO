import type { DesignDocument } from '@nail-studio/contracts'

/**
 * ตัวเรียก API ของ NAIL_STUDIO สำหรับ MCP server
 *
 * ยืนยันตัวตนได้สองแบบ:
 *  - token: ส่ง `Authorization: Bearer nsk_...` (สร้างจากหน้าโปรไฟล์) — ทางที่ควรใช้จริง
 *    API ไม่ตรวจ CSRF กับคำขอแบบ Bearer เพราะเบราว์เซอร์ไม่แนบ header นี้ให้เอง
 *  - email/password: ล็อกอินแบบเดียวกับเว็บ (cookie + CSRF) — สำหรับ dev บนเครื่องเท่านั้น
 */

export interface ApiClientOptions {
  baseUrl: string
  token?: string | undefined
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
    if (!options.token && !(options.email && options.password)) {
      throw new Error('ต้องตั้ง NAIL_STUDIO_TOKEN หรือ NAIL_STUDIO_EMAIL + NAIL_STUDIO_PASSWORD')
    }
    this.options = options
  }

  private async raw<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`
    } else {
      const csrf = this.jar.get('nscsrf')
      if (csrf) headers['x-csrf-token'] = decodeURIComponent(csrf)
      if (this.jar.size > 0) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    const response = await fetch(this.options.baseUrl + path, {
      method,
      headers,
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
    if (this.options.token || this.loggedIn) return
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
      if (error instanceof ApiError && error.status === 401 && !this.options.token) {
        this.loggedIn = false
        this.jar.clear()
        await this.ensureSession()
        return this.raw<T>(method, path, body)
      }
      throw error
    }
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const page = await this.request<{ items: ProjectSummary[] }>('GET', '/projects')
    return page.items
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
