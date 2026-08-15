import request from 'supertest'
import type { Express } from 'express'

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface HttpResponse {
  status: number
  body: any
}

/**
 * เก็บ cookie ระหว่างคำขอ เลียนแบบพฤติกรรมของเบราว์เซอร์
 *
 * จำเป็นเพราะการยืนยันตัวตนทั้งระบบอยู่บน cookie (httpOnly + CSRF แบบ double submit)
 * ถ้าเทสส่ง token เองในหัวข้อความ จะพิสูจน์เส้นทางที่ผู้ใช้จริงไม่ได้เดิน
 */
export class Client {
  private cookies = new Map<string, string>()

  private readonly getApp: () => Express

  /**
   * รับเป็นฟังก์ชัน ไม่ใช่ตัว app ตรง ๆ เพราะ client ถูกสร้างตอน vitest เก็บรายการเทส
   * ซึ่งเกิดก่อน beforeAll ที่สร้าง app จริง — การอ่านตอนใช้งานจึงเป็นทางเดียวที่ถูก
   */
  constructor(getApp: () => Express) {
    this.getApp = getApp
  }

  private header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  private absorb(raw: string[] | undefined): void {
    for (const entry of raw ?? []) {
      const [pair] = entry.split(';')
      const index = pair?.indexOf('=') ?? -1
      if (!pair || index < 0) continue
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === '') this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  csrf(): string {
    return this.cookies.get('nscsrf') ?? ''
  }

  has(name: string): boolean {
    return this.cookies.has(name)
  }

  async send(method: HttpMethod, path: string, body?: unknown): Promise<HttpResponse> {
    let call = request(this.getApp())[method](`/api/v1${path}`)
    const cookieHeader = this.header()
    if (cookieHeader) call = call.set('Cookie', cookieHeader)
    if (method !== 'get') call = call.set('x-csrf-token', this.csrf())
    if (body !== undefined) call = call.send(body as object)
    const response = await call
    this.absorb(response.headers['set-cookie'] as string[] | undefined)
    return { status: response.status, body: response.body }
  }

  /** ส่ง body เป็นไบต์ดิบ (ไม่ JSON-encode) — สำหรับ endpoint ที่รับไฟล์ตรงๆ เช่น thumbnail */
  async sendRaw(
    method: HttpMethod,
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<HttpResponse> {
    let call = request(this.getApp())[method](`/api/v1${path}`).set('Content-Type', contentType)
    const cookieHeader = this.header()
    if (cookieHeader) call = call.set('Cookie', cookieHeader)
    if (method !== 'get') call = call.set('x-csrf-token', this.csrf())
    const response = await call.send(body)
    this.absorb(response.headers['set-cookie'] as string[] | undefined)
    return { status: response.status, body: response.body }
  }

  /** ยิงคำขอโดยจงใจไม่ใส่ header CSRF */
  async sendWithoutCsrf(path: string, body: unknown): Promise<HttpResponse> {
    let call = request(this.getApp()).post(`/api/v1${path}`)
    const cookieHeader = this.header()
    if (cookieHeader) call = call.set('Cookie', cookieHeader)
    const response = await call.send(body as object)
    return { status: response.status, body: response.body }
  }
}
