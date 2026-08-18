import { Router } from 'express'
import {
  appointmentMessageSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  proposeAppointmentSchema,
  reviewAppointmentSchema,
} from '@nail-studio/contracts'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

const idParam = z.object({ id: z.string().uuid() })

export const appointmentsRouter: Router = Router()
appointmentsRouter.use(requireUser)

appointmentsRouter.get('/', async (request, response) => {
  const query = listAppointmentsQuerySchema.parse(request.query)
  response.json({ success: true, data: await service.list(currentUser(request).id, query.status, query.limit) })
})

appointmentsRouter.post('/', async (request, response) => {
  const input = createAppointmentSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.create(currentUser(request).id, input) })
})

appointmentsRouter.get('/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.detail(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/accept', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.accept(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/propose', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = proposeAppointmentSchema.parse(request.body)
  response.json({ success: true, data: await service.propose(currentUser(request).id, id, input) })
})

appointmentsRouter.post('/:id/decline', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.decline(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/cancel', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.cancel(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/complete', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.complete(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/review', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = reviewAppointmentSchema.parse(request.body)
  response.json({ success: true, data: await service.review(currentUser(request).id, id, input) })
})

appointmentsRouter.delete('/:id/review', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await service.deleteReview(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})

appointmentsRouter.get('/:id/same-day', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.listSameDayConfirmed(currentUser(request).id, id) })
})

appointmentsRouter.get('/:id/messages', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ success: true, data: await service.listMessages(currentUser(request).id, id) })
})

appointmentsRouter.post('/:id/messages', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = appointmentMessageSchema.parse(request.body)
  response.status(201).json({ success: true, data: await service.sendMessage(currentUser(request).id, id, input.content) })
})

appointmentsRouter.post('/:id/messages/read', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await service.markMessagesRead(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})
