import type { PublicProfile, PublicProfileQuery, TemplateCard } from '@nail-studio/contracts'
import { AppError } from '../errors/AppError.ts'
import { decodeUserProfileCursor, encodeUserProfileCursor } from './cursor.ts'
import * as repository from './repository.ts'

export async function profile(userId: string, input: PublicProfileQuery): Promise<{
  data: PublicProfile
  nextCursor: string | null
}> {
  const user = await repository.findUserProfile(userId)
  if (!user) throw AppError.notFound('ไม่พบโปรไฟล์ผู้ใช้ที่ต้องการ')

  const cursor = input.cursor ? decodeUserProfileCursor(input.cursor, userId) : null
  const [templateCount, rows] = await Promise.all([
    repository.countPublicTemplates(userId),
    repository.listPublicTemplates(userId, input.limit, cursor),
  ])
  const hasNext = rows.length > input.limit
  const templates = rows.slice(0, input.limit).map(toTemplateCard)
  const last = templates.at(-1)

  return {
    data: {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      templateCount,
      templates,
    },
    nextCursor: hasNext && last
      ? encodeUserProfileCursor({ userId, createdAt: last.createdAt, id: last.id })
      : null,
  }
}

function toTemplateCard(row: repository.UserProfileTemplateRow): TemplateCard {
  return {
    id: row.id,
    name: row.name,
    caption: row.caption,
    category: row.category,
    primaryColor: row.primaryColor,
    hasThumbnail: row.thumbnailAsset !== null || row.designVersion.project.thumbnailAssetId !== null,
    origin: row.origin,
    isLiked: false,
    likeCount: row.likeCount,
    shareCount: row.shareCount,
    remixCount: row.remixCount,
    commentCount: row.commentCount,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  }
}
