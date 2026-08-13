import {
  createEmptyDocument,
  designDocumentSchema,
  type CreateVersionInput,
  type DesignDocument,
  type DuplicateProjectInput,
  type ProjectSummary,
  type SaveDraftInput,
  type UpdateProjectInput,
  type UpdateVersionLabelInput,
  type VersionSummary,
} from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import * as repository from './repository.ts'

interface ProjectRow {
  id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  versionCount: number
  createdAt: Date
  updatedAt: Date
  draftDocument?: unknown
  draftUpdatedAt?: Date | null
  draftBaseVersion?: number | null
}

function toSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    versionCount: row.versionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const CURSOR_SEPARATOR = '|'

export function encodeCursor(row: { updatedAt: Date; id: string }): string {
  return `${row.updatedAt.toISOString()}${CURSOR_SEPARATOR}${row.id}`
}

function decodeCursor(raw: string | undefined): repository.Cursor | null {
  if (!raw) return null
  const [timestamp, id] = raw.split(CURSOR_SEPARATOR)
  const updatedAt = timestamp ? new Date(timestamp) : null
  if (!updatedAt || Number.isNaN(updatedAt.getTime()) || !id) {
    throw AppError.validation('cursor ไม่ถูกต้อง')
  }
  return { updatedAt, id }
}

export async function list(
  userId: string,
  limit: number,
  cursor: string | undefined,
): Promise<{ items: ProjectSummary[]; nextCursor: string | null }> {
  const rows = await repository.listProjects(userId, limit, decodeCursor(cursor))
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page.at(-1)
  return {
    items: page.map(toSummary),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  }
}

export async function create(userId: string, name: string): Promise<ProjectSummary> {
  const row = await repository.createProject(userId, name, createEmptyDocument())
  return toSummary(row)
}

async function mustOwn(userId: string, projectId: string): Promise<ProjectRow> {
  const project = await repository.findProject(userId, projectId)
  // ตอบ 404 ไม่ใช่ 403 แม้จะรู้ว่ามีอยู่จริงแต่เป็นของคนอื่น (ดู AppError.notFound)
  if (!project) throw AppError.notFound('ไม่พบงานที่ต้องการ')
  return project
}

export interface ProjectDetail {
  project: ProjectSummary
  version: { number: number; document: DesignDocument; createdAt: string }
  /** งานที่ยังไม่ได้บันทึกเป็นเวอร์ชัน — ถ้ามี ให้เปิดอันนี้แทนเวอร์ชันล่าสุด */
  draft: { document: DesignDocument; updatedAt: string } | null
}

export async function detail(userId: string, projectId: string): Promise<ProjectDetail> {
  const project = await mustOwn(userId, projectId)
  const version = await repository.latestVersion(projectId)
  if (!version) throw AppError.notFound('งานนี้ไม่มีเวอร์ชันใด ๆ')

  // เอกสารในฐานข้อมูลอาจถูกเขียนโดยโค้ดเวอร์ชันเก่า จึง parse ทุกครั้งที่อ่าน
  // ไม่ใช่เชื่อว่าถูกต้องเพราะเคยผ่านตอนเขียน (นโยบาย migrate ตอนอ่าน — database.md §5)
  const parsed = designDocumentSchema.safeParse(version.document)
  if (!parsed.success) {
    throw AppError.conflict('ไฟล์งานนี้อยู่ในรูปแบบที่ระบบยังอ่านไม่ได้')
  }

  return {
    project: toSummary(project),
    version: {
      number: version.versionNumber,
      document: parsed.data,
      createdAt: version.createdAt.toISOString(),
    },
    draft: readDraft(project, version.versionNumber),
  }
}

export interface VersionDetail {
  number: number
  label: string | null
  createdAt: string
  document: DesignDocument
}

export async function listVersions(
  userId: string,
  projectId: string,
): Promise<VersionSummary[]> {
  await mustOwn(userId, projectId)
  const versions = await repository.listVersions(projectId)
  return versions.map((version) => ({
    number: version.number,
    label: version.label,
    createdAt: version.createdAt.toISOString(),
    documentBytes: version.documentBytes,
  }))
}

export async function loadVersion(
  userId: string,
  projectId: string,
  versionNumber: number,
): Promise<VersionDetail> {
  await mustOwn(userId, projectId)
  const version = await repository.findVersion(projectId, versionNumber)
  if (!version) throw AppError.notFound('Version not found')

  const parsed = designDocumentSchema.safeParse(version.document)
  if (!parsed.success) {
    throw AppError.conflict('This version uses a document format the system cannot read')
  }

  return {
    number: version.versionNumber,
    label: version.label,
    createdAt: version.createdAt.toISOString(),
    document: parsed.data,
  }
}

export async function renameVersion(
  userId: string,
  projectId: string,
  versionNumber: number,
  input: UpdateVersionLabelInput,
): Promise<{ number: number; label: string | null }> {
  await mustOwn(userId, projectId)
  const result = await repository.updateVersionLabel(projectId, versionNumber, input.label)
  if (result.count === 0) throw AppError.notFound('Version not found')
  return { number: versionNumber, label: input.label }
}

export async function duplicateProject(
  userId: string,
  projectId: string,
  input: DuplicateProjectInput,
): Promise<ProjectSummary> {
  await mustOwn(userId, projectId)
  const duplicate = await repository.createProject(userId, input.name, input.document)
  return toSummary(duplicate)
}

/**
 * อ่าน draft เฉพาะเมื่อยังใช้ได้จริง
 *
 * เงื่อนไขสองข้อที่ทำให้ draft ถูกทิ้ง:
 *   1. ต่อยอดมาจากเวอร์ชันเก่า — มีการบันทึกเวอร์ชันใหม่ทับไปแล้ว งานที่ตั้งใจบันทึก
 *      ต้องชนะงานที่แค่ค้างอยู่เสมอ
 *   2. อ่านตาม schema ไม่ผ่าน — draft เสียไม่ควรทำให้เปิดงานไม่ได้ทั้งชิ้น
 *      ผู้ใช้ยังต้องได้เวอร์ชันล่าสุดที่ตัวเองกดบันทึกไว้กลับมาเสมอ
 */
function readDraft(
  project: ProjectRow,
  latestVersionNumber: number,
): { document: DesignDocument; updatedAt: string } | null {
  if (project.draftDocument === null || project.draftDocument === undefined) return null
  if (project.draftBaseVersion !== latestVersionNumber) return null
  const parsed = designDocumentSchema.safeParse(project.draftDocument)
  if (!parsed.success) return null
  return {
    document: parsed.data,
    updatedAt: (project.draftUpdatedAt ?? project.updatedAt).toISOString(),
  }
}

export async function saveDraft(
  userId: string,
  projectId: string,
  input: SaveDraftInput,
): Promise<{ savedAt: string }> {
  await mustOwn(userId, projectId)
  const latest = await repository.latestVersion(projectId)
  const current = latest?.versionNumber ?? 0
  if (input.baseVersion !== current) {
    throw AppError.conflict(
      `งานนี้ถูกบันทึกจากที่อื่นไปแล้ว (เวอร์ชันล่าสุดคือ ${current}) — โหลดงานใหม่ก่อนวาดต่อ`,
    )
  }
  const row = await repository.saveDraft(projectId, input.document, current)
  return { savedAt: (row.draftUpdatedAt ?? new Date()).toISOString() }
}

export async function update(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectSummary> {
  await mustOwn(userId, projectId)

  // ประกอบ patch เฉพาะฟิลด์ที่ส่งมาจริง ไม่ส่งคีย์ที่มีค่า undefined ต่อให้ Prisma
  //
  // จำเป็นเพราะ exactOptionalPropertyTypes ถือว่า `{ name?: string | undefined }`
  // (ผลจาก .optional() ของ Zod) เข้ากันไม่ได้กับ `{ name?: string }` ของ Prisma
  // การกรองออกให้ชัดเจนดีกว่าการ cast เพราะได้ผลลัพธ์ที่ถูกต้องด้วย ไม่ใช่แค่ผ่าน compiler
  const patch: { name?: string; status?: 'draft' | 'published' | 'archived' } = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.status !== undefined) patch.status = input.status

  if (Object.keys(patch).length > 0) {
    await repository.updateProject(userId, projectId, patch)
  }
  const refreshed = await repository.findProject(userId, projectId)
  if (!refreshed) throw AppError.notFound('ไม่พบงานที่ต้องการ')
  return toSummary(refreshed)
}

export async function remove(userId: string, projectId: string): Promise<void> {
  await mustOwn(userId, projectId)
  await repository.softDeleteProject(userId, projectId)
}

export async function saveVersion(
  userId: string,
  projectId: string,
  input: CreateVersionInput,
): Promise<{ versionNumber: number }> {
  await mustOwn(userId, projectId)
  const latest = await repository.latestVersion(projectId)
  const current = latest?.versionNumber ?? 0

  // optimistic concurrency — ถ้ามีคนบันทึกแซงไปแล้ว อย่าเขียนทับงานเขาเงียบ ๆ
  if (input.expectedVersion !== current) {
    throw AppError.conflict(
      `งานนี้ถูกบันทึกจากที่อื่นไปแล้ว (เวอร์ชันล่าสุดคือ ${current} แต่คุณกำลังบันทึกทับเวอร์ชัน ${input.expectedVersion})`,
    )
  }

  const version = await repository.createVersion(
    projectId,
    current + 1,
    input.document,
    input.label ?? null,
  )
  if (!version) {
    throw AppError.conflict('งานนี้ถูกบันทึกจากที่อื่นไปแล้ว กรุณาโหลดเวอร์ชันล่าสุด')
  }
  return { versionNumber: version.versionNumber }
}
