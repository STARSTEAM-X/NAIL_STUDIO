import type { RequestHandler } from 'express'
import { AppError } from '../errors/AppError.ts'
import { SESSION_COOKIE } from '../auth/session.ts'
import { resolveSession } from '../auth/service.ts'

/** ตรวจ session แล้วเติม request.user — ทุก route ที่ต้องล็อกอินต้องผ่านตัวนี้ */
export const requireUser: RequestHandler = async (request, _response, next) => {
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
  next()
}

/** อ่าน user ที่ requireUser เติมไว้ — โยนถ้าไม่มี เพื่อให้ลืมใส่ middleware แล้วรู้ทันที */
export function currentUser(request: { user?: { id: string } }): { id: string } {
  if (!request.user) {
    throw new Error('เรียก currentUser โดยที่ route ไม่ได้ผ่าน requireUser')
  }
  return request.user
}
