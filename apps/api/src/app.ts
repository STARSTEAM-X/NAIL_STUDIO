import path from 'node:path'
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
import { reviewsRouter, shopsRouter } from './shops/routes.ts'
import { appointmentsRouter } from './appointments/routes.ts'
import { usersRouter } from './users/routes.ts'
import { tokensRouter } from './tokens/routes.ts'
import { apiLimiter } from './middleware/rateLimit.ts'
import { isProduction } from './config/env.ts'

const localDevelopmentOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/

function allowsCorsOrigin(origin: string | undefined): boolean {
  if (!origin || origin === env.WEB_ORIGIN) {
    return true
  }

  // Vite may move to the next free port when the configured port is occupied.
  // Keep this fallback limited to loopback origins and non-production environments.
  return !isProduction && localDevelopmentOrigin.test(origin)
}

export interface AppOptions {
  /** โฟลเดอร์ build ของเว็บ — ถ้ามี API จะส่งหน้าเว็บด้วย (โดเมนเดียวกัน) */
  webDist?: string | undefined
}

export function createApp(options: AppOptions = { webDist: env.WEB_DIST }): Express {
  const app = express()

  // อยู่หลัง reverse proxy ตอน production — ต้องบอก Express ให้เชื่อ X-Forwarded-*
  // ไม่งั้น rate limit จะเห็นทุกคนเป็น IP เดียวกัน (ของ proxy) แล้วบล็อกทั้งระบบ
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(requestId)
  app.use(helmet({
    // Vite's development client needs its own headers; production gets an explicit allowlist.
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            // wasm-unsafe-eval: ตัวถอดรหัส meshopt ของ three.js คอมไพล์ WebAssembly ตอนโหลด hand.glb
            // อนุญาตเฉพาะ WASM — eval()/new Function() ของ JS ยังถูกบล็อกตามเดิม
            scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
            // blob:/data: — three.js โหลด texture ที่ฝังใน hand.glb ผ่าน fetch ของ blob URL
            connectSrc: ["'self'", env.WEB_ORIGIN, 'blob:', 'data:'],
          },
        }
      : false,
    strictTransportSecurity: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  }))
  app.use(
    cors({
      // allowlist เท่านั้น ห้าม '*' เพราะเราส่ง cookie ข้าม origin
      origin: (requestOrigin, callback) => {
        callback(null, allowsCorsOrigin(requestOrigin))
      },
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
  app.use('/api/v1', apiLimiter)

  app.get('/api/v1/health', (_request, response) => {
    response.json({ success: true, data: { status: 'ok' } })
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/projects', projectsRouter)
  app.use('/api/v1/templates', templatesRouter)
  app.use('/api/v1/notifications', notificationsRouter)
  app.use('/api/v1/ai', aiRouter)
  app.use('/api/v1/shops', shopsRouter)
  app.use('/api/v1/reviews', reviewsRouter)
  app.use('/api/v1/appointments', appointmentsRouter)
  app.use('/api/v1/users', usersRouter)
  app.use('/api/v1/tokens', tokensRouter)

  if (options.webDist) serveWebApp(app, path.resolve(options.webDist))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * ส่งหน้าเว็บ (Vite build) จาก API เอง — ใช้เมื่อ deploy เว็บกับ API เป็น service เดียว
 *
 * ไฟล์ใน /assets มี hash ในชื่อ จึง cache ได้ยาว ส่วน index.html ต้องไม่ cache ไม่งั้น
 * ผู้ใช้จะค้างอยู่กับ build เก่าที่อ้างไฟล์ซึ่งถูกลบไปแล้วหลัง deploy ใหม่
 * ทุกเส้นทางที่ไม่ใช่ /api และไม่ใช่ไฟล์จริงตอบ index.html ให้ router ฝั่งเว็บจัดการเอง
 */
function serveWebApp(app: Express, dist: string): void {
  app.use(express.static(dist, {
    index: false,
    setHeaders: (response, filePath) => {
      response.setHeader(
        'Cache-Control',
        filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      )
    },
  }))
  app.get(/^\/(?!api\/).*/, (_request, response) => {
    response.setHeader('Cache-Control', 'no-cache')
    response.sendFile(path.join(dist, 'index.html'))
  })
}
