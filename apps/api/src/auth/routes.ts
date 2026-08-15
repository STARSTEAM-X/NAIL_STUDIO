import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { loginSchema, registerSchema, updateProfileSchema } from '@nail-studio/contracts'
import { env } from '../config/env.ts'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import { clearAuthCookies, createCsrfToken, setAuthCookies } from './session.ts'
import * as service from './service.ts'

/**
 * จำกัดอัตราการเรียกอย่างเข้มที่นี่ด้วยสองเหตุผล
 *   1. กัน brute force รหัสผ่าน
 *   2. Argon2id ใช้หน่วยความจำ 19 MiB ต่อครั้ง — 100 คำขอพร้อมกันคือ 1.9 GB
 *      จึงเป็นช่องทาง DoS ที่ถูกที่สุดของระบบถ้าไม่จำกัด
 */
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // ปิดเฉพาะตอนรันเทส — integration test ต้องสร้างผู้ใช้หลายคนในไม่กี่วินาที
  // ถ้าไม่ปิด เทสจะล้มด้วย 429 ซึ่งไม่ได้บอกอะไรเกี่ยวกับความถูกต้องของระบบ
  // (มีเทสแยกที่ยืนยันว่าตัวจำกัดทำงานจริง — ดู rateLimit.test.ts ใน Slice 8)
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'พยายามบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', requestId: '' },
  },
})

export const authRouter: Router = Router()

authRouter.post('/register', authLimiter, async (request, response) => {
  const input = registerSchema.parse(request.body)
  const issued = await service.register(input, request.get('user-agent') ?? null)
  setAuthCookies(response, issued.token, createCsrfToken(), issued.expiresAt)
  response.status(201).json({ success: true, data: issued.user })
})

authRouter.post('/login', authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body)
  const issued = await service.login(input, request.get('user-agent') ?? null)
  setAuthCookies(response, issued.token, createCsrfToken(), issued.expiresAt)
  response.json({ success: true, data: issued.user })
})

authRouter.post('/logout', requireUser, async (request, response) => {
  if (request.sessionId) await service.logout(request.sessionId)
  clearAuthCookies(response)
  response.json({ success: true, data: { ok: true } })
})

authRouter.get('/me', requireUser, (request, response) => {
  response.json({ success: true, data: request.user })
})

authRouter.patch('/me', requireUser, async (request, response) => {
  const input = updateProfileSchema.parse(request.body)
  const user = await service.updateProfile(currentUser(request).id, input)
  response.json({ success: true, data: user })
})
