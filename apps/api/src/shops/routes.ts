import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import {
  createShopServiceSchema,
  updateShopProfileSchema,
  updateShopServiceSchema,
} from '@nail-studio/contracts'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

const idParam = z.object({ id: z.string().uuid() })
const listQuery = z.object({ search: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) })
const replySchema = z.object({ reply: z.string().trim().min(1).max(2000) })

export const shopsRouter: Router = Router()
export const reviewsRouter: Router = Router()

shopsRouter.get('/', async (request, response) => {
  const query = listQuery.parse(request.query)
  response.json({ success: true, data: await service.list(query.search, query.limit) })
})

shopsRouter.get('/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.detail(id) })
})

shopsRouter.use(requireUser)

shopsRouter.put('/me', async (request, response) => {
  const input = updateShopProfileSchema.parse(request.body)
  response.json({ success: true, data: await service.updateProfile(currentUser(request).id, input) })
})

shopsRouter.post('/me/services', async (request, response) => {
  const input = createShopServiceSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.createService(currentUser(request).id, input) })
})

shopsRouter.patch('/me/services/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = updateShopServiceSchema.parse(request.body)
  response.json({ success: true, data: await service.updateService(currentUser(request).id, id, input) })
})

shopsRouter.delete('/me/services/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await service.removeService(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})

async function reply(request: Request, response: Response) {
  const { id } = idParam.parse(request.params)
  const input = replySchema.parse(request.body)
  await service.replyToReview(currentUser(request).id, id, input.reply)
  response.json({ success: true, data: { ok: true } })
}

shopsRouter.post('/reviews/:id/reply', reply)
reviewsRouter.use(requireUser)
reviewsRouter.post('/:id/reply', reply)
