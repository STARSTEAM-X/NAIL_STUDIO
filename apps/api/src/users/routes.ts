import { Router } from 'express'
import { z } from 'zod'
import { publicProfileQuerySchema } from '@nail-studio/contracts'
import * as service from './service.ts'

export const usersRouter: Router = Router()
const userIdParamSchema = z.object({ id: z.string().uuid('รหัสผู้ใช้ไม่ถูกต้อง') })

usersRouter.get('/:id/profile', async (request, response) => {
  const { id } = userIdParamSchema.parse(request.params)
  const query = publicProfileQuerySchema.parse(request.query)
  const result = await service.profile(id, query)
  response.json({ success: true, data: result.data, meta: { nextCursor: result.nextCursor } })
})
