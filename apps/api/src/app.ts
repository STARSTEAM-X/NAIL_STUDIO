import express, { type Express } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.ts'
import { requestId } from './middleware/requestId.ts'
import { csrfProtection, ensureCsrfCookie } from './middleware/csrf.ts'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts'
import { authRouter } from './auth/routes.ts'
import { projectsRouter } from './projects/routes.ts'
import { templatesRouter } from './templates/routes.ts'
import { notificationsRouter } from './notifications/routes.ts'
import { aiRouter } from './ai/routes.ts'

export function createApp(): Express {
  const app = express()

  // อยู่หลัง reverse proxy ตอน production — ต้องบอก Express ให้เชื่อ X-Forwarded-*
  // ไม่งั้น rate limit จะเห็นทุกคนเป็น IP เดียวกัน (ของ proxy) แล้วบล็อกทั้งระบบ
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(requestId)
  app.use(helmet())
  app.use(
    cors({
      // allowlist เท่านั้น ห้าม '*' เพราะเราส่ง cookie ข้าม origin
      origin: env.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ['Content-Type', 'x-csrf-token'],
    }),
  )
  app.use(cookieParser())
  // จำกัดขนาด body — เอกสารงานที่มีเส้นเยอะอาจใหญ่ แต่ต้องมีเพดานกัน DoS
  app.use(express.json({ limit: '4mb' }))
  // ต้องออกโทเคนก่อนตรวจเสมอ ไม่งั้นผู้ใช้ใหม่จะสมัครสมาชิกไม่ได้เลย
  app.use(ensureCsrfCookie)
  app.use(csrfProtection)

  app.get('/api/v1/health', (_request, response) => {
    response.json({ success: true, data: { status: 'ok' } })
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/projects', projectsRouter)
  app.use('/api/v1/templates', templatesRouter)
  app.use('/api/v1/notifications', notificationsRouter)
  app.use('/api/v1/ai', aiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
