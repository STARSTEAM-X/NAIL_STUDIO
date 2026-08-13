import type { RequestHandler } from 'express'
import { AppError } from '../errors/AppError.ts'
import { CSRF_COOKIE, CSRF_HEADER, createCsrfToken, safeEqual } from '../auth/session.ts'
import { isProduction } from '../config/env.ts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * ออกโทเคน CSRF ให้ทุก client ที่ยังไม่มี
 *
 * ทำไมต้องมี: ตัวตรวจด้านล่างบังคับให้ทุก request ที่เปลี่ยนแปลงข้อมูลแนบโทเคน
 * รวมถึง /auth/register และ /auth/login ด้วย แต่ผู้ใช้ใหม่ที่เพิ่งเปิดเว็บครั้งแรก
 * ยังไม่มีโทเคนเลย จึงสมัครสมาชิกไม่ได้ตั้งแต่ต้น
 *
 * แก้ด้วยการออกโทเคนให้ตั้งแต่ request แรกที่ปลอดภัย (เช่น GET /auth/me ที่
 * แอปเรียกตอนบูตเสมอ) — ไม่ใช่การยกเว้นการตรวจให้ login/register
 * ซึ่งจะเปิดช่องให้เกิด login CSRF (ผู้โจมตีบังคับให้เหยื่อล็อกอินเข้าบัญชีของตัวเอง)
 */
export const ensureCsrfCookie: RequestHandler = (request, response, next) => {
  if (typeof request.cookies?.[CSRF_COOKIE] !== 'string') {
    response.cookie(CSRF_COOKIE, createCsrfToken(), {
      // ต้องอ่านได้ด้วย JavaScript เพราะ client ต้องคัดลอกค่าไปใส่ header (double-submit)
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    })
  }
  next()
}

/**
 * ป้องกัน CSRF ด้วยรูปแบบ double-submit cookie
 *
 * เว็บอื่นสั่งเบราว์เซอร์ให้ยิง request พร้อม cookie ของเราไปได้ (นั่นคือ CSRF)
 * แต่มัน **อ่าน** cookie ของเราไม่ได้เพราะ same-origin policy จึงคัดลอกค่าไปใส่
 * header ไม่ได้ → request ที่ไม่มี header ตรงกับ cookie แปลว่าไม่ได้มาจากเว็บของเรา
 *
 * ใช้ร่วมกับ SameSite=Lax ซึ่งกันกรณีส่วนใหญ่อยู่แล้ว — สองชั้นเพราะ SameSite
 * ยังมีช่องว่างในเบราว์เซอร์เก่าและกรณี subdomain
 */
export const csrfProtection: RequestHandler = (request, _response, next) => {
  if (SAFE_METHODS.has(request.method)) {
    next()
    return
  }

  const cookieValue = request.cookies?.[CSRF_COOKIE]
  const headerValue = request.get(CSRF_HEADER)

  if (typeof cookieValue !== 'string' || typeof headerValue !== 'string') {
    next(AppError.forbidden('คำขอนี้ขาดโทเคนความปลอดภัย (CSRF) กรุณารีเฟรชหน้าแล้วลองใหม่'))
    return
  }

  if (!safeEqual(cookieValue, headerValue)) {
    next(AppError.forbidden('โทเคนความปลอดภัย (CSRF) ไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่'))
    return
  }

  next()
}
