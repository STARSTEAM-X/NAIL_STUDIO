import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Response } from 'express'
import { env, isProduction } from '../config/env.ts'

export const SESSION_COOKIE = 'nsid'
export const CSRF_COOKIE = 'nscsrf'
export const CSRF_HEADER = 'x-csrf-token'

/** token ดิบ 256 บิต — ส่งให้เบราว์เซอร์ครั้งเดียว ไม่เคยเก็บลงฐานข้อมูล */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * เก็บ SHA-256 ของ token ไม่ใช่ token เอง
 *
 * ใช้ SHA-256 ธรรมดาได้ (ไม่ต้อง Argon2 เหมือนรหัสผ่าน) เพราะ token เป็นค่าสุ่ม
 * 256 บิตที่ brute force ไม่ได้อยู่แล้ว — ต่างจากรหัสผ่านที่ entropy ต่ำ
 *
 * คืนเป็น Uint8Array ไม่ใช่ Buffer เพราะ Prisma 7 ประกาศฟิลด์ Bytes เป็น
 * `Uint8Array<ArrayBuffer>` ส่วน Buffer ของ Node เป็น `Buffer<ArrayBufferLike>`
 * ซึ่ง TypeScript ถือว่าเข้ากันไม่ได้ (Buffer อาจอ้าง SharedArrayBuffer ได้)
 */
export function hashSessionToken(token: string): Uint8Array<ArrayBuffer> {
  const digest = createHash('sha256').update(token).digest()
  return new Uint8Array(digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength))
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

export function createCsrfToken(): string {
  return randomBytes(24).toString('base64url')
}

/** เทียบแบบเวลาคงที่ เพื่อไม่ให้ผู้โจมตีเดา token ทีละตัวอักษรจากเวลาที่ใช้ */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function setAuthCookies(response: Response, token: string, csrf: string, expiresAt: Date): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  // CSRF cookie ต้องอ่านได้ด้วย JavaScript เพราะ client ต้องคัดลอกค่าไปใส่ header
  // (รูปแบบ double-submit) จึงตั้ง httpOnly เป็น false โดยตั้งใจ
  response.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(SESSION_COOKIE, { path: '/' })
  response.clearCookie(CSRF_COOKIE, { path: '/' })
}
