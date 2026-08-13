import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

/**
 * ให้ทุก request มีรหัสประจำตัว แล้วส่งกลับใน header และในทุก error response
 *
 * เมื่อผู้ใช้แจ้งปัญหาพร้อมรหัสนี้ เราค้นใน log เจอทันทีว่าเกิดอะไรขึ้น
 * โดยไม่ต้องเดาจากเวลาโดยประมาณ (เกณฑ์ P8 — สังเกตการณ์ได้)
 */
export const requestId: RequestHandler = (_request, response, next) => {
  const id = randomUUID()
  response.locals.requestId = id
  response.setHeader('x-request-id', id)
  next()
}
