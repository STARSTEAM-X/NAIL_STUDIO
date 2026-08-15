import type {
  TemplateDetail,
  ListTemplatesQuery,
  TemplateCard,
  TemplateLikeResult,
  TemplateModerationReport,
  TemplateReportInput,
  TemplateReportResult,
  TemplateRemixInput,
  TemplateRemixResult,
} from '@nail-studio/contracts'
import { designDocumentSchema } from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import * as repository from './repository.ts'
import { decodeTemplateCursor, encodeTemplateCursor } from './cursor.ts'

export interface TemplateFeedResult {
  items: TemplateCard[]
  nextCursor: string | null
}

function toCard(row: repository.TemplateListRow): TemplateCard {
  return {
    id: row.id,
    name: row.name,
    caption: row.caption,
    category: row.category,
    primaryColor: row.primaryColor,
    origin: row.origin,
    likeCount: row.likeCount,
    shareCount: row.shareCount,
    remixCount: row.remixCount,
    commentCount: row.commentCount,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  }
}

export async function list(input: ListTemplatesQuery): Promise<TemplateFeedResult> {
  const cursor = input.cursor ? decodeTemplateCursor(input.cursor, input.sort) : null
  const options: repository.ListTemplatesOptions = {
    sort: input.sort,
    limit: input.limit,
    cursor,
  }
  if (input.category) options.category = input.category
  if (input.color) options.color = input.color

  const rows = await repository.listTemplates(options)
  const hasNext = rows.length > input.limit
  const items = rows.slice(0, input.limit)
  const last = items.at(-1)

  if (!hasNext || !last) return { items: items.map(toCard), nextCursor: null }

  return {
    items: items.map(toCard),
    nextCursor: encodeTemplateCursor(
      input.sort === 'latest'
        ? { sort: 'latest', createdAt: last.createdAt.toISOString(), id: last.id }
        : {
            sort: 'popular',
            likeCount: last.likeCount,
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          },
    ),
  }
}

export async function detail(templateId: string): Promise<TemplateDetail> {
  const row = await repository.findPublicTemplateDetail(templateId)
  if (!row) throw AppError.notFound('ไม่พบดีไซน์ที่ต้องการ')

  const document = designDocumentSchema.safeParse(row.designVersion.document)
  if (!document.success) {
    throw AppError.conflict('ดีไซน์นี้อยู่ในรูปแบบที่ระบบยังอ่านไม่ได้')
  }
  return { ...toCard(row), document: document.data }
}

export async function like(userId: string, templateId: string): Promise<TemplateLikeResult> {
  const result = await repository.addTemplateLike(templateId, userId)
  if (!result) throw AppError.notFound('ไม่พบดีไซน์ที่ต้องการ')
  return result
}

export async function unlike(userId: string, templateId: string): Promise<TemplateLikeResult> {
  const result = await repository.removeTemplateLike(templateId, userId)
  if (!result) throw AppError.notFound('ไม่พบดีไซน์ที่ต้องการ')
  return result
}

export async function remix(
  userId: string,
  templateId: string,
  input: TemplateRemixInput,
): Promise<TemplateRemixResult> {
  const result = await repository.remixTemplate(templateId, userId, input.name)
  if (!result) throw AppError.notFound('ไม่พบดีไซน์ที่ต้องการ')
  return {
    sourceTemplateId: result.sourceTemplateId,
    remixCount: result.remixCount,
    project: {
      id: result.project.id,
      name: result.project.name,
      status: result.project.status,
      versionCount: result.project.versionCount,
      hasThumbnail: result.project.thumbnailAssetId !== null,
      createdAt: result.project.createdAt.toISOString(),
      updatedAt: result.project.updatedAt.toISOString(),
    },
  }
}

export async function report(
  reporterId: string,
  templateId: string,
  input: TemplateReportInput,
): Promise<TemplateReportResult> {
  const result = await repository.reportTemplate(templateId, reporterId, input.reason, input.detail)
  if (!result) throw AppError.notFound('ไม่พบดีไซน์ที่ต้องการ')
  return result
}

export async function moderationQueue(): Promise<TemplateModerationReport[]> {
  const rows = await repository.listPendingTemplateReports()
  return rows.map((row) => ({
    id: row.id,
    targetId: row.targetId,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reporter: row.reporter,
    template: row.template,
  }))
}
