import type { ListTemplatesQuery, TemplateCard, TemplateLikeResult } from '@nail-studio/contracts'
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
