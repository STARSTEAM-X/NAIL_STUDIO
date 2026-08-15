import type { ApiError, ApiResponse } from '@nail-studio/contracts'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const CSRF_COOKIE = 'nscsrf'
const CSRF_HEADER = 'x-csrf-token'

/** error ที่ฝั่ง UI จับได้ พร้อมข้อมูลพอที่จะแสดงข้อความที่ถูกต้อง */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: ApiError['error']['code']
  readonly details: ApiError['error']['details']
  readonly requestId: string

  constructor(status: number, body: ApiError) {
    super(body.error.message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = body.error.code
    this.details = body.error.details
    this.requestId = body.error.requestId
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export interface ApiPage<T> {
  data: T
  nextCursor: string | null
}

/** แนบโทเคน CSRF ให้ request ที่เปลี่ยนแปลงข้อมูล — ใช้ร่วมกันระหว่าง apiFetch และ apiUploadBinary */
function csrfHeaders(method: string): Record<string, string> {
  if (method === 'GET') return {}
  const csrf = readCookie(CSRF_COOKIE)
  return csrf ? { [CSRF_HEADER]: csrf } : {}
}

/**
 * ตัวเรียก API ตัวเดียวของทั้งแอป
 *
 * รับผิดชอบสามอย่างที่ต้องทำเหมือนกันทุกครั้ง:
 *   1. ส่ง cookie ข้าม origin (credentials: 'include')
 *   2. แนบโทเคน CSRF ให้ทุก request ที่เปลี่ยนแปลงข้อมูล
 *   3. แปลง error response เป็น ApiRequestError รูปแบบเดียว
 *
 * ถ้าปล่อยให้แต่ละหน้าเรียก fetch เอง ทั้งสามข้อจะถูกลืมเป็นบางที่เสมอ
 */
async function requestApi<T>(path: string, options: RequestOptions = {}) {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...csrfHeaders(method),
  }

  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload || payload.success === false) {
    throw new ApiRequestError(
      response.status,
      payload && payload.success === false
        ? payload
        : {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
              requestId: response.headers.get('x-request-id') ?? 'unknown',
            },
          },
    )
  }

  return payload
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await requestApi<T>(path, options)
  return payload.data
}

export async function apiFetchPage<T>(path: string, options: RequestOptions = {}): Promise<ApiPage<T>> {
  const payload = await requestApi<T>(path, options)
  return { data: payload.data, nextCursor: payload.meta?.nextCursor ?? null }
}

/** อัปโหลดไฟล์ไบนารีตรงๆ (ไม่ JSON-encode) — ปลายทางเดียวที่ใช้ตอนนี้คือ thumbnail */
export async function apiUploadBinary(path: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...csrfHeaders('POST') },
    credentials: 'include',
    body: blob,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null
    throw new ApiRequestError(
      response.status,
      payload ?? {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'อัปโหลดภาพตัวอย่างไม่สำเร็จ',
          requestId: response.headers.get('x-request-id') ?? 'unknown',
        },
      },
    )
  }
}

/** เปิด response แบบ streaming สำหรับ AI chat โดยยังใช้ cookie/CSRF ชุดเดียวกับ API ปกติ */
export async function apiStream(path: string, body: unknown, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders('POST') },
    credentials: 'include',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as ApiError | null
    throw new ApiRequestError(
      response.status,
      payload ?? {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'AI service ไม่พร้อมใช้งาน',
          requestId: response.headers.get('x-request-id') ?? 'unknown',
        },
      },
    )
  }
  return response.body
}
