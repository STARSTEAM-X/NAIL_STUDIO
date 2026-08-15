import express, { Router } from 'express'
import {
  createProjectSchema,
  createVersionSchema,
  duplicateProjectSchema,
  listProjectsQuerySchema,
  saveDraftSchema,
  updateProjectSchema,
  updateVersionLabelSchema,
  versionNumberParamSchema,
} from '@nail-studio/contracts'
import { z } from 'zod'
import { currentUser, requireUser } from '../middleware/requireUser.ts'
import { AppError } from '../errors/AppError.ts'
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

projectsRouter.get('/:id/versions', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const versions = await service.listVersions(currentUser(request).id, id)
  response.json({ success: true, data: versions })
})

projectsRouter.get('/:id/versions/:version', async (request, response) => {
  const { id, version } = versionNumberParamSchema.parse(request.params)
  const result = await service.loadVersion(currentUser(request).id, id, version)
  response.json({ success: true, data: result })
})

projectsRouter.patch('/:id/versions/:version', async (request, response) => {
  const { id, version } = versionNumberParamSchema.parse(request.params)
  const input = updateVersionLabelSchema.parse(request.body)
  const result = await service.renameVersion(currentUser(request).id, id, version, input)
  response.json({ success: true, data: result })
})

projectsRouter.post('/:id/duplicate', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const input = duplicateProjectSchema.parse(request.body)
  const duplicate = await service.duplicateProject(currentUser(request).id, id, input)
  response.status(201).json({ success: true, data: duplicate })
})

// จำกัดขนาด raw body เฉพาะ content-type นี้ — express.json({limit:'4mb'}) ใน app.ts
// ไม่ครอบคลุม content-type อื่น
const rawWebp = express.raw({ type: 'image/webp', limit: '2mb' })

projectsRouter.post('/:id/thumbnail', rawWebp, async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    throw AppError.validation('ต้องแนบไฟล์ภาพ WebP')
  }
  await service.saveThumbnail(currentUser(request).id, id, request.body)
  response.status(204).send()
})

projectsRouter.get('/:id/thumbnail', async (request, response) => {
  const { id } = idParamSchema.parse(request.params)
  const result = await service.loadThumbnail(currentUser(request).id, id)
  if (!result) throw AppError.notFound('งานนี้ยังไม่มีภาพตัวอย่าง')
  response.setHeader('Content-Type', result.mimeType)
  response.setHeader('Cache-Control', 'private, max-age=60')
  response.send(result.data)
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
