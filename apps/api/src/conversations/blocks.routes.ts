import { Router } from 'express'
import { blockUserSchema } from '@nail-studio/contracts'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

const idParam = z.object({ userId: z.string().uuid() })
export const blocksRouter: Router = Router()
blocksRouter.use(requireUser)
blocksRouter.get('/', async (request, response) => {
  response.json({ success: true, data: await service.blocks(currentUser(request).id) })
})
blocksRouter.post('/', async (request, response) => {
  const input = blockUserSchema.parse(request.body)
  await service.block(currentUser(request).id, input.userId)
  response.status(201).json({ success: true, data: { ok: true } })
})
blocksRouter.delete('/:userId', async (request, response) => {
  const { userId } = idParam.parse(request.params)
  await service.unblock(currentUser(request).id, userId)
  response.json({ success: true, data: { ok: true } })
})
