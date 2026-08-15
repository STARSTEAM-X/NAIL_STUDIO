import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'
import { createNotification } from '../notifications/repository.ts'
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

export interface TemplateRemixMutationRow {
  sourceTemplateId: string
  remixCount: number
  project: {
    id: string
    name: string
    status: 'draft' | 'published' | 'archived'
    versionCount: number
    thumbnailAssetId: string | null
    createdAt: Date
    updatedAt: Date
  }
}

export interface TemplateReportMutationRow {
  reportId: string
  reportCount: number
  visibility: 'public' | 'unlisted' | 'hidden'
}

export interface TemplateModerationReportRow {
  id: string
  targetId: string
  reason: 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'other'
  detail: string | null
  status: 'pending' | 'reviewed' | 'dismissed'
  createdAt: Date
  reporter: { id: string; displayName: string }
  template: { name: string; visibility: 'public' | 'unlisted' | 'hidden'; reportCount: number } | null
}

export interface TemplateCommentMutationRow {
  comment: {
    id: string
    content: string
    createdAt: Date
    author: { id: string; displayName: string }
  }
  commentCount: number
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

const templateDetailSelect = {
  ...templateListSelect,
  designVersion: { select: { document: true } },
  comments: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { id: true, displayName: true } },
    },
  },
} satisfies Prisma.NailTemplateSelect

export type TemplateDetailRow = Prisma.NailTemplateGetPayload<{ select: typeof templateDetailSelect }>

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

export function findPublicTemplateDetail(templateId: string): Promise<TemplateDetailRow | null> {
  return prisma.nailTemplate.findFirst({
    where: { id: templateId, visibility: 'public', deletedAt: null },
    select: templateDetailSelect,
  })
}

export function createTemplateComment(
  templateId: string,
  userId: string,
  content: string,
): Promise<TemplateCommentMutationRow | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.nailTemplate.findFirst({
      where: { id: templateId, visibility: 'public', deletedAt: null },
      select: { id: true, authorId: true, name: true },
    })
    if (!template) return null

    const comment = await tx.templateComment.create({
      data: { templateId: template.id, userId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, displayName: true } },
      },
    })
    const updated = await tx.nailTemplate.update({
      where: { id: template.id },
      data: { commentCount: { increment: 1 } },
      select: { commentCount: true },
    })
    if (template.authorId !== userId) {
      await createNotification(tx, {
        userId: template.authorId,
        kind: 'post_comment',
        title: `มีคอมเมนต์ใหม่ในดีไซน์ “${template.name}”`,
        sourceType: 'post',
        sourceId: template.id,
      })
    }
    return {
      comment: { id: comment.id, content: comment.content, createdAt: comment.createdAt, author: comment.user },
      commentCount: updated.commentCount,
    }
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
      select: { id: true, authorId: true, name: true },
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
    if (inserted.count === 1 && template.authorId !== userId) {
      await createNotification(tx, {
        userId: template.authorId,
        kind: 'post_like',
        title: `มีคนถูกใจดีไซน์ “${template.name}”`,
        sourceType: 'post',
        sourceId: template.id,
      })
    }
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

/**
 * คัดลอกเวอร์ชันที่ถูก freeze ไปเป็นโปรเจกต์ใหม่ พร้อมบันทึก event remix และ
 * เพิ่ม counter ใน transaction เดียว — ถ้าขั้นตอนใดล้มเหลวจะไม่เหลือโปรเจกต์ครึ่งเดียว
 */
export function remixTemplate(
  templateId: string,
  userId: string,
  projectName: string | undefined,
): Promise<TemplateRemixMutationRow | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.nailTemplate.findFirst({
      where: { id: templateId, visibility: 'public', deletedAt: null },
      select: {
        id: true,
        name: true,
        authorId: true,
        designVersion: { select: { document: true } },
      },
    })
    if (!template) return null

    const project = await tx.project.create({
      data: {
        userId,
        name: projectName ?? `Remix: ${template.name}`.slice(0, 120),
        status: 'draft',
        versionCount: 1,
        versions: {
          create: {
            versionNumber: 1,
            document: template.designVersion.document as Prisma.InputJsonValue,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        versionCount: true,
        thumbnailAssetId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await tx.templateRemix.create({
      data: { templateId: template.id, userId, projectId: project.id },
    })
    const updated = await tx.nailTemplate.update({
      where: { id: template.id },
      data: { remixCount: { increment: 1 } },
      select: { remixCount: true },
    })
    if (template.authorId !== userId) {
      await createNotification(tx, {
        userId: template.authorId,
        kind: 'template_remix',
        title: `มีคนรีมิกซ์ดีไซน์ “${template.name}”`,
        sourceType: 'post',
        sourceId: template.id,
      })
    }

    return {
      sourceTemplateId: template.id,
      remixCount: updated.remixCount,
      project,
    }
  })
}

/** รายงานหนึ่งครั้งต่อผู้ใช้ — unique constraint + skipDuplicates กันการยิงซ้ำ */
export function reportTemplate(
  templateId: string,
  reporterId: string,
  reason: 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'other',
  detail: string | undefined,
): Promise<TemplateReportMutationRow | null> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.nailTemplate.findFirst({
      where: { id: templateId, visibility: 'public', deletedAt: null },
      select: { id: true },
    })
    if (!template) return null

    const inserted = await tx.contentReport.createMany({
      data: {
        targetType: 'template',
        targetId: template.id,
        reporterId,
        reason,
        detail: detail ?? null,
      },
      skipDuplicates: true,
    })

    let current = await tx.nailTemplate.findUniqueOrThrow({
      where: { id: template.id },
      select: { reportCount: true, visibility: true },
    })
    if (inserted.count === 1) {
      current = await tx.nailTemplate.update({
        where: { id: template.id },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true, visibility: true },
      })
      if (current.reportCount >= 5 && current.visibility !== 'hidden') {
        current = await tx.nailTemplate.update({
          where: { id: template.id },
          data: { visibility: 'hidden' },
          select: { reportCount: true, visibility: true },
        })
      }
    }

    const report = await tx.contentReport.findFirstOrThrow({
      where: { targetType: 'template', targetId: template.id, reporterId },
      select: { id: true },
    })
    return { reportId: report.id, reportCount: current.reportCount, visibility: current.visibility }
  })
}

export async function listPendingTemplateReports(limit = 50): Promise<TemplateModerationReportRow[]> {
  const reports = await prisma.contentReport.findMany({
    where: { targetType: 'template', status: 'pending' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      targetId: true,
      reason: true,
      detail: true,
      status: true,
      createdAt: true,
      reporter: { select: { id: true, displayName: true } },
    },
  })
  const templates = await prisma.nailTemplate.findMany({
    where: { id: { in: reports.map((report) => report.targetId) } },
    select: { id: true, name: true, visibility: true, reportCount: true },
  })
  const byId = new Map(templates.map((template) => [template.id, template]))
  return reports.map((report) => {
    const template = byId.get(report.targetId)
    return {
      ...report,
      template: template
        ? { name: template.name, visibility: template.visibility, reportCount: template.reportCount }
        : null,
    }
  })
}
