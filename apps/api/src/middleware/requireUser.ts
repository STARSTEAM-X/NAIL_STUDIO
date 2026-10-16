import type { RequestHandler } from 'express'
import { AppError } from '../errors/AppError.ts'
import { SESSION_COOKIE } from '../auth/session.ts'
import { resolveSession } from '../auth/service.ts'
import { resolveToken } from '../tokens/service.ts'

/** API ที่ API token ใช้ได้ — จำกัดไว้ที่งานออกแบบ ไม่ให้ token แตะบัญชี การนัดหมาย ฯลฯ */
const TOKEN_ALLOWED_PREFIXES = ['/api/v1/projects']

/** ค่าใน `Authorization: Bearer ...` หรือ null — ใช้ร่วมกับตัวตรวจ CSRF */
export function bearerToken(request: { get(name: string): string | undefined }): string | null {
  const header = request.get('authorization')
  if (!header || !/^Bearer\s+/i.test(header)) return null
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 ? token : null
}

/**
 * ตรวจตัวตนแล้วเติม request.user — ทุก route ที่ต้องล็อกอินต้องผ่านตัวนี้
 *
 * รับได้สองแบบ: cookie session (เว็บ) หรือ API token ใน header Authorization (AI/MCP)
 * ถ้ามี header Bearer จะใช้ token อย่างเดียวและไม่ดู cookie เลย — คำขอแบบนี้ข้ามการตรวจ
 * CSRF ได้ (ดู csrf.ts) จึงต้องไม่ให้ cookie ที่เบราว์เซอร์แนบมาเองมีผลกับมันเด็ดขาด
 */
export const requireUser: RequestHandler = async (request, _response, next) => {
  const apiToken = bearerToken(request)
  if (apiToken !== null) {
    const fullPath = `${request.baseUrl}${request.path}`
    if (!TOKEN_ALLOWED_PREFIXES.some((prefix) => fullPath.startsWith(prefix))) {
      next(AppError.forbidden('API token ใช้ได้กับ API งานออกแบบเท่านั้น'))
      return
    }
    const resolvedToken = await resolveToken(apiToken)
    if (!resolvedToken) {
      next(AppError.unauthenticated('API token ไม่ถูกต้อง ถูกยกเลิก หรือหมดอายุแล้ว'))
      return
    }
    request.user = resolvedToken.user
    request.authVia = 'token'
    next()
    return
  }

  const token = request.cookies?.[SESSION_COOKIE]
  if (typeof token !== 'string' || token.length === 0) {
    next(AppError.unauthenticated())
    return
  }

  const resolved = await resolveSession(token)
  if (!resolved) {
    next(AppError.unauthenticated('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'))
    return
  }

  request.user = resolved.user
  request.sessionId = resolved.sessionId
  request.authVia = 'session'
  next()
}

/** เติมผู้ใช้จาก session ถ้ามี แต่ปล่อย public route เดินหน้าต่อเสมอแม้ไม่มีหรือมี session ที่ใช้ไม่ได้ */
export const optionalUser: RequestHandler = async (request, _response, next) => {
  try {
    const token = request.cookies?.[SESSION_COOKIE]
    if (typeof token === 'string' && token.length > 0) {
      const resolved = await resolveSession(token)
      if (resolved) {
        request.user = resolved.user
        request.sessionId = resolved.sessionId
      }
    }
  } catch {
    // Public reads must remain public even if an optional session cannot be resolved.
  }
  next()
}

/** ต้องผ่าน requireUser ก่อน — คิว moderation เปิดให้ admin เท่านั้น */
export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.user?.role !== 'admin') {
    next(AppError.forbidden('ต้องเป็นผู้ดูแลระบบจึงเข้าคิว moderation ได้'))
    return
  }
  next()
}

/** อ่าน user ที่ requireUser เติมไว้ — โยนถ้าไม่มี เพื่อให้ลืมใส่ middleware แล้วรู้ทันที */
export function currentUser(request: { user?: { id: string } }): { id: string } {
  if (!request.user) {
    throw new Error('เรียก currentUser โดยที่ route ไม่ได้ผ่าน requireUser')
  }
  return request.user
}
