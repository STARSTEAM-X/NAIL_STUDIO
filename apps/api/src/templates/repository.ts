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

export interface TemplateLikeMutationRow {
  liked: boolean
  likeCount: number
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

/**
 * เพิ่มไลก์แบบ idempotent — composite primary key กันคำขอซ้ำที่ระดับ DB
 * และ increment counter อยู่ใน transaction เดียวกับ insert เสมอ
 */
export function addTemplateLike(templateId: string, userId: string): Promise<TemplateLikeMutationRow | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.nailTemplate.findFirst({
      where: { id: templateId, visibility: 'public', deletedAt: null },
      select: { id: true },
    })
    if (!template) return null

    const inserted = await tx.templateLike.createMany({
      data: { templateId: template.id, userId },
      skipDuplicates: true,
    })
    if (inserted.count === 1) {
      await tx.nailTemplate.update({
        where: { id: template.id },
        data: { likeCount: { increment: 1 } },
      })
    }

    const current = await tx.nailTemplate.findUniqueOrThrow({
      where: { id: template.id },
      select: { likeCount: true },
    })
    return { liked: true, likeCount: current.likeCount }
  })
}

/**
 * ลบไลก์แบบ idempotent — ถ้าไม่มีไลก์อยู่แล้วจะไม่ลด counter
 */
export function removeTemplateLike(templateId: string, userId: string): Promise<TemplateLikeMutationRow | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.nailTemplate.findFirst({
      where: { id: templateId, visibility: 'public', deletedAt: null },
      select: { id: true },
    })
    if (!template) return null

    const removed = await tx.templateLike.deleteMany({ where: { templateId: template.id, userId } })
    if (removed.count === 1) {
      await tx.nailTemplate.update({
        where: { id: template.id },
        data: { likeCount: { decrement: 1 } },
      })
    }

    const current = await tx.nailTemplate.findUniqueOrThrow({
      where: { id: template.id },
      select: { likeCount: true },
    })
    return { liked: false, likeCount: current.likeCount }
  })
}
