import { Router } from 'express'
import { z } from 'zod'
import { createApiTokenSchema } from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

const idParamSchema = z.object({ id: z.string().uuid('รหัส token ไม่ถูกต้อง') })

export const tokensRouter: Router = Router()
tokensRouter.use(requireUser)
// token สร้าง/ยกเลิก token ด้วยกันเองไม่ได้ — ต้องเป็นผู้ใช้ที่ล็อกอินผ่านเว็บเท่านั้น
// ไม่งั้น token ที่รั่วจะใช้ต่ออายุตัวเองหรือสร้าง token ใหม่ได้ไม่รู้จบ
tokensRouter.use((request, _response, next) => {
  next(request.authVia === 'token' ? AppError.forbidden('จัดการ API token ได้จากหน้าเว็บเท่านั้น') : undefined)
})

tokensRouter.get('/', async (request, response) => {
  response.json({ success: true, data: await service.list(currentUser(request).id) })
})

tokensRouter.post('/', async (request, response) => {
  const input = createApiTokenSchema.parse(request.body)
  const created = await service.create(currentUser(request).id, input.name, input.expiresInDays)
  response.status(201).json({ success: true, data: created })
})

tokensRouter.delete('/:id', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  await service.revoke(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})
