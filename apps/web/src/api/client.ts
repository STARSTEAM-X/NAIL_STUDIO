import type { ApiError, ApiResponse } from '@nail-studio/contracts'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
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
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}

  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers[CSRF_HEADER] = csrf
  }

  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
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

  return payload.data
}
