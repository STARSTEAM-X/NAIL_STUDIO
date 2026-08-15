import { Router } from 'express'
import { listNotificationsQuerySchema } from '@nail-studio/contracts'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import { z } from 'zod'
import * as service from './service.ts'

const idParamSchema = z.object({ id: z.string().uuid('รหัสแจ้งเตือนไม่ถูกต้อง') })

export const notificationsRouter: Router = Router()
notificationsRouter.use(requireUser)

notificationsRouter.get('/', async (request, response) => {
  const query = listNotificationsQuerySchema.parse(request.query)
  const result = await service.list(currentUser(request).id, query.limit)
  response.json({ success: true, data: result })
})

notificationsRouter.patch('/:id/read', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  await service.read(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})

notificationsRouter.post('/read-all', async (request, response) => {
  await service.readAll(currentUser(request).id)
  response.json({ success: true, data: { ok: true } })
})
