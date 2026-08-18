import { Router } from 'express'
import { z } from 'zod'
import {
  createTemplateSchema,
  createTemplateCommentSchema,
  listTemplatesQuerySchema,
  templateRemixSchema,
  templateReportSchema,
  templateShareSchema,
} from '@nail-studio/contracts'
import { currentUser, optionalUser, requireAdmin, requireUser } from '../middleware/requireUser.ts'
import { AppError } from '../errors/AppError.ts'
import * as service from './service.ts'

export const templatesRouter: Router = Router()
const templateIdParamSchema = z.object({ id: z.string().uuid('รหัสดีไซน์ไม่ถูกต้อง') })

// Public feed; write actions below require a session and CSRF token.
templatesRouter.get('/', optionalUser, async (request, response) => {
  const query = listTemplatesQuerySchema.parse(request.query)
  const result = await service.list(query, request.user?.id ?? null)
  response.json({ success: true, data: result.items, meta: { nextCursor: result.nextCursor } })
})

templatesRouter.post('/', requireUser, async (request, response) => {
  const input = createTemplateSchema.parse(request.body)
  const result = await service.create(currentUser(request).id, input)
  response.status(201).json({ success: true, data: result })
})

templatesRouter.get('/:id/thumbnail', async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const result = await service.loadThumbnail(id)
  if (!result) throw AppError.notFound('ไม่พบภาพตัวอย่างผลงาน')
  response.setHeader('Content-Type', result.mimeType)
  response.setHeader('Cache-Control', 'public, max-age=300')
  response.send(result.data)
})

templatesRouter.get('/:id', optionalUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const result = await service.detail(id, request.user?.id ?? null)
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

templatesRouter.post('/:id/share', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const input = templateShareSchema.parse(request.body ?? {})
  const result = await service.share(currentUser(request).id, id, input)
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

templatesRouter.post('/:id/comments', requireUser, async (request, response) => {
  const { id } = templateIdParamSchema.parse(request.params)
  const input = createTemplateCommentSchema.parse(request.body)
  const result = await service.comment(currentUser(request).id, id, input)
  response.status(201).json({ success: true, data: result })
})

templatesRouter.get('/moderation/reports', requireUser, requireAdmin, async (_request, response) => {
  const reports = await service.moderationQueue()
  response.json({ success: true, data: reports })
})
