import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'
import type { UserProfileCursor } from './cursor.ts'

const userProfileSelect = {
  id: true,
  displayName: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect

const templateSelect = {
  id: true,
  name: true,
  caption: true,
  category: true,
  primaryColor: true,
  thumbnailAsset: { select: { id: true } },
  designVersion: { select: { project: { select: { thumbnailAssetId: true } } } },
  origin: true,
  likeCount: true,
  shareCount: true,
  remixCount: true,
  commentCount: true,
  viewCount: true,
  createdAt: true,
  author: { select: { id: true, displayName: true } },
} satisfies Prisma.NailTemplateSelect

export type UserProfileRow = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>
export type UserProfileTemplateRow = Prisma.NailTemplateGetPayload<{ select: typeof templateSelect }>

export function findUserProfile(userId: string): Promise<UserProfileRow | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: userProfileSelect })
}

export function countPublicTemplates(userId: string): Promise<number> {
  return prisma.nailTemplate.count({
    where: { authorId: userId, visibility: 'public', deletedAt: null },
  })
}

export function listPublicTemplates(
  userId: string,
  limit: number,
  cursor: UserProfileCursor | null,
): Promise<UserProfileTemplateRow[]> {
  const where: Prisma.NailTemplateWhereInput = {
    authorId: userId,
    visibility: 'public',
    deletedAt: null,
  }

  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ]
  }

  return prisma.nailTemplate.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: templateSelect,
    take: limit + 1,
  })
}
