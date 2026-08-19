import { Router } from 'express'
import { conversationMessageSchema, reportMessageSchema, startConversationSchema } from '@nail-studio/contracts'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import { createRateLimiter } from '../middleware/rateLimit.ts'
import * as service from './service.ts'

const idParam = z.object({ id: z.string().uuid() })
const listQuery = z.object({ before: z.string().trim().min(1).max(128).optional(), limit: z.coerce.number().int().min(1).max(50).default(50) })

export const conversationsRouter: Router = Router()
conversationsRouter.use(requireUser)
conversationsRouter.get('/', async (request, response) => {
  response.json({ success: true, data: await service.list(currentUser(request).id) })
})
conversationsRouter.post('/', createRateLimiter(20), async (request, response) => {
  const input = startConversationSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.start(currentUser(request).id, input.userId) })
})
conversationsRouter.get('/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const query = listQuery.parse(request.query)
  response.json({ success: true, data: await service.detail(currentUser(request).id, id, query.before, query.limit) })
})
conversationsRouter.post('/:id/messages', createRateLimiter(120), async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = conversationMessageSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.send(currentUser(request).id, id, input.content) })
})
conversationsRouter.post('/:id/read', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await service.markRead(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})
conversationsRouter.post('/messages/:id/report', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = reportMessageSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.report(currentUser(request).id, id, input) })
})
