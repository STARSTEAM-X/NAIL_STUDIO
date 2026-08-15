import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'
import type { TemplateFeedCursor } from './cursor.ts'

export interface ListTemplatesOptions {
  sort: 'latest' | 'popular'
  category?: string
  color?: string
  limit: number
  cursor: TemplateFeedCursor | null
}

const templateListSelect = {
  id: true,
  name: true,
  caption: true,
  category: true,
  primaryColor: true,
  origin: true,
  likeCount: true,
  shareCount: true,
  remixCount: true,
  commentCount: true,
  viewCount: true,
  createdAt: true,
  author: { select: { id: true, displayName: true } },
} satisfies Prisma.NailTemplateSelect

export type TemplateListRow = Prisma.NailTemplateGetPayload<{ select: typeof templateListSelect }>

export function listTemplates(options: ListTemplatesOptions): Promise<TemplateListRow[]> {
  const where: Prisma.NailTemplateWhereInput = {
    visibility: 'public',
    deletedAt: null,
  }
  if (options.category) where.category = options.category
  if (options.color) where.primaryColor = options.color

  if (options.cursor?.sort === 'latest') {
    where.OR = [
      { createdAt: { lt: options.cursor.createdAt } },
      { createdAt: options.cursor.createdAt, id: { lt: options.cursor.id } },
    ]
  }

  if (options.cursor?.sort === 'popular') {
    where.OR = [
      { likeCount: { lt: options.cursor.likeCount } },
      { likeCount: options.cursor.likeCount, createdAt: { lt: options.cursor.createdAt } },
      {
        likeCount: options.cursor.likeCount,
        createdAt: options.cursor.createdAt,
        id: { lt: options.cursor.id },
      },
    ]
  }

  const orderBy = options.sort === 'latest'
    ? [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
    : [{ likeCount: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'desc' as const }]

  return prisma.nailTemplate.findMany({
    where,
    orderBy,
    select: templateListSelect,
    take: options.limit + 1,
  })
}
