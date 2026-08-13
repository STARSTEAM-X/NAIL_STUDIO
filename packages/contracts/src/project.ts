import { z } from 'zod'
import { designDocumentSchema } from './design.ts'

export const PROJECT_STATUSES = ['draft', 'published', 'archived'] as const

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'กรุณาตั้งชื่องาน')
  .max(120, 'ชื่องานยาวเกิน 120 ตัวอักษร')

export const createProjectSchema = z.object({
  name: projectNameSchema,
})

export const updateProjectSchema = z.object({
  name: projectNameSchema.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
})

/**
 * บันทึกเวอร์ชันใหม่ — ต้องส่ง expectedVersion มาด้วยเสมอ
 *
 * ถ้าเลขไม่ตรงกับเวอร์ชันล่าสุดในฐานข้อมูล แปลว่ามีคนอื่น (หรือแท็บอื่นของเราเอง)
 * บันทึกแซงไปแล้ว → ตอบ 409 แทนที่จะเขียนทับงานเขาเงียบ ๆ
 */
export const createVersionSchema = z.object({
  document: designDocumentSchema,
  expectedVersion: z.number().int().min(0),
  label: z.string().trim().max(120).optional(),
})

/**
 * บันทึกงานที่ยังไม่ได้กดบันทึกเป็นเวอร์ชัน — ปลายทางของ autosave
 *
 * baseVersion คือเวอร์ชันที่ผู้ใช้กำลังแก้ต่อยอดอยู่ ถ้าไม่ตรงกับเวอร์ชันล่าสุด
 * ในฐานข้อมูลแปลว่ามีคนบันทึกแซงไปแล้ว → ตอบ 409 เหมือนการบันทึกเวอร์ชัน
 * ไม่ใช่เขียนทับเงียบ ๆ เพราะ autosave ที่เขียนทับงานคนอื่นคือสิ่งที่แย่ที่สุด
 * — มันเกิดขึ้นเองโดยผู้ใช้ไม่ได้สั่ง จึงไม่มีจังหวะให้ทันสังเกต
 */
export const saveDraftSchema = z.object({
  document: designDocumentSchema,
  baseVersion: z.number().int().min(0),
})

export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  versionCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const listProjectsQuerySchema = z.object({
  // keyset pagination (A-14) — cursor คือ "updatedAt|id" ของรายการสุดท้ายในหน้าก่อน
  cursor: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateVersionInput = z.infer<typeof createVersionSchema>
export type SaveDraftInput = z.infer<typeof saveDraftSchema>
export type ProjectSummary = z.infer<typeof projectSummarySchema>
