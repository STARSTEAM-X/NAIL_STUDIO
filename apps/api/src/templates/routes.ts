import { Router } from 'express'
import { z } from 'zod'
import { listTemplatesQuerySchema, templateRemixSchema, templateReportSchema } from '@nail-studio/contracts'
import { currentUser, requireAdmin, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

export const templatesRouter: Router = Router()
const templateIdParamSchema = z.object({ id: z.string().uuid('รหัสดีไซน์ไม่ถูกต้อง') })

// Public feed; write actions below require a session and CSRF token.
templatesRouter.get('/', async (request, response) => {
  const query = listTemplatesQuerySchema.parse(request.query)
  const result = await service.list(query)
  response.json({ success: true, data: result.items, meta: { nextCursor: result.nextCursor } })
})

templatesRouter.get('/:id', async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const result = await service.detail(id)
  response.json({ success: true, data: result })
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

templatesRouter.post('/:id/remix', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const input = templateRemixSchema.parse(request.body ?? {})
  const result = await service.remix(currentUser(request).id, id, input)
  response.status(201).json({ success: true, data: result })
})

templatesRouter.post('/:id/report', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const input = templateReportSchema.parse(request.body)
  const result = await service.report(currentUser(request).id, id, input)
  response.status(201).json({ success: true, data: result })
})

templatesRouter.get('/moderation/reports', requireUser, requireAdmin, async (_request, response) => {
  const reports = await service.moderationQueue()
  response.json({ success: true, data: reports })
})
