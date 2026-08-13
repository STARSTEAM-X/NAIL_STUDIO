import { Router } from 'express'
import {
  createProjectSchema,
  createVersionSchema,
  listProjectsQuerySchema,
  saveDraftSchema,
  updateProjectSchema,
} from '@nail-studio/contracts'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import * as service from './service.ts'

const idParamSchema = z.object({ id: z.string().uuid('รหัสงานไม่ถูกต้อง') })

export const projectsRouter: Router = Router()

// ทุกเส้นทางในไฟล์นี้ต้องล็อกอิน — ใส่ที่ router ไม่ใช่ทีละ route เพื่อกันลืม
projectsRouter.use(requireUser)

projectsRouter.get('/', async (request, response) => {
  const query = listProjectsQuerySchema.parse(request.query)
  const result = await service.list(currentUser(request).id, query.limit, query.cursor)
  response.json({ success: true, data: result.items, meta: { nextCursor: result.nextCursor } })
})

projectsRouter.post('/', async (request, response) => {
  const input = createProjectSchema.parse(request.body)
  const project = await service.create(currentUser(request).id, input.name)
  response.status(201).json({ success: true, data: project })
})

projectsRouter.get('/:id', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const detail = await service.detail(currentUser(request).id, id)
  response.json({ success: true, data: detail })
})

projectsRouter.patch('/:id', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const input = updateProjectSchema.parse(request.body)
  const project = await service.update(currentUser(request).id, id, input)
  response.json({ success: true, data: project })
})

projectsRouter.delete('/:id', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  await service.remove(currentUser(request).id, id)
  response.json({ success: true, data: { ok: true } })
})

// PUT ไม่ใช่ POST เพราะเป็นการเขียนทับ draft เดิมทั้งก้อน การยิงซ้ำด้วยข้อมูลเดิม
// จึงได้ผลลัพธ์เดียวกันเสมอ — สำคัญกับ autosave ที่อาจยิงซ้ำเมื่อเครือข่ายสะดุด
projectsRouter.put('/:id/draft', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const input = saveDraftSchema.parse(request.body)
  const result = await service.saveDraft(currentUser(request).id, id, input)
  response.json({ success: true, data: result })
})

projectsRouter.post('/:id/versions', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const input = createVersionSchema.parse(request.body)
  const result = await service.saveVersion(currentUser(request).id, id, input)
  response.status(201).json({ success: true, data: result })
})
