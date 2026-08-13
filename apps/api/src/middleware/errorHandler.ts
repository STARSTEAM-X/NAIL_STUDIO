import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.ts'
import { isProduction } from '../config/env.ts'

/** ตัวจัดการ 404 — ต้องอยู่หลัง route ทั้งหมด */
export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(AppError.notFound('ไม่พบเส้นทางนี้'))
}

/**
 * ตัวจัดการ error กลาง — จุดเดียวของระบบที่แปลง error เป็น HTTP response
 *
 * หลักการ: error ที่เราตั้งใจสร้าง (AppError, ZodError) ส่งรายละเอียดออกไปได้
 * ส่วน error อื่นถือว่าเป็นข้อบกพร่องภายใน ต้องกลบข้อความจริงใน production
 * เพราะอาจมี path ของไฟล์ ชื่อคอลัมน์ หรือ connection string ปนอยู่ (เกณฑ์ P3)
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = response.locals.requestId ?? 'unknown'

  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
        requestId,
      },
    })
    return
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    })
    return
  }

  // ถึงตรงนี้แปลว่าเป็นข้อบกพร่องที่เราไม่ได้คาดไว้ — ต้องบันทึกเสมอ
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      method: request.method,
      path: request.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  )

  response.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง'
        : `เกิดข้อผิดพลาดภายในระบบ: ${error instanceof Error ? error.message : String(error)}`,
      requestId,
    },
  })
}
