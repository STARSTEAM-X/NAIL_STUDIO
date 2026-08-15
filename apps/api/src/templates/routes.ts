import { Router } from 'express'
import { z } from 'zod'
import { listTemplatesQuerySchema } from '@nail-studio/contracts'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

export const templatesRouter: Router = Router()
const templateIdParamSchema = z.object({ id: z.string().uuid('รหัสดีไซน์ไม่ถูกต้อง') })

// Public feed; write actions below require a session and CSRF token.
templatesRouter.get('/', async (request, response) => {
  const query = listTemplatesQuerySchema.parse(request.query)
  const result = await service.list(query)
  response.json({ success: true, data: result.items, meta: { nextCursor: result.nextCursor } })
})

templatesRouter.put('/:id/like', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const result = await service.like(currentUser(request).id, id)
  response.json({ success: true, data: result })
})

templatesRouter.delete('/:id/like', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const result = await service.unlike(currentUser(request).id, id)
  response.json({ success: true, data: result })
})
