import { Prisma } from '../generated/prisma/client.ts'
import type {
  CreateShopServiceInput,
  ShopDetail,
  UpdateShopProfileInput,
  UpdateShopServiceInput,
} from '@nail-studio/contracts'
import { prisma } from '../db.ts'
import { AppError } from '../errors/AppError.ts'

function mapService(service: {
  id: string
  shopId: string
  name: string
  description: string | null
  priceThb: { toString(): string }
  durationMinutes: number
  isActive: boolean
  sortOrder: number
}) {
  return {
    id: service.id,
    shopId: service.shopId,
    name: service.name,
    description: service.description,
    priceThb: service.priceThb.toString(),
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  }
}

const profileInclude = {
  services: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  reviews: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  },
} satisfies Prisma.ShopProfileInclude

type ShopProfileRow = Prisma.ShopProfileGetPayload<{ include: typeof profileInclude }>

export async function list(search: string | undefined, limit: number): Promise<ShopDetail[]> {
  const where: Prisma.ShopProfileWhereInput = search
    ? { OR: [{ shopName: { contains: search, mode: 'insensitive' } }, { locationText: { contains: search, mode: 'insensitive' } }] }
    : {}
  const profiles = await prisma.shopProfile.findMany({
    where,
    include: profileInclude,
    orderBy: [{ isVerified: 'desc' }, { ratingAvg: 'desc' }, { ratingCount: 'desc' }, { userId: 'asc' }],
    take: limit,
  })
  return (profiles as ShopProfileRow[]).map(mapDetail)
}

export async function detail(userId: string): Promise<ShopDetail> {
  const profile = await prisma.shopProfile.findUnique({ where: { userId }, include: profileInclude })
  if (!profile) throw AppError.notFound('ไม่พบร้านที่ต้องการ')
  return mapDetail(profile as ShopProfileRow)
}

function mapDetail(profile: ShopProfileRow): ShopDetail {
  return {
    userId: profile.userId,
    shopName: profile.shopName,
    description: profile.description,
    locationText: profile.locationText,
    phoneNumbers: profile.phoneNumbers,
    openingHours: profile.openingHours as Record<string, unknown> | null,
    isVerified: profile.isVerified,
    ratingAvg: profile.ratingAvg.toString(),
    ratingCount: profile.ratingCount,
    services: profile.services.map(mapService),
    reviews: profile.reviews.map((review) => ({
      id: review.id,
      appointmentId: review.appointmentId,
      shopId: review.shopId,
      authorId: review.authorId,
      rating: review.rating,
      comment: review.comment,
      shopReply: review.shopReply,
      createdAt: review.createdAt.toISOString(),
    })),
  }
}

async function assertShop(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, displayName: true } })
  if (!user || user.role !== 'shop') throw AppError.forbidden('ต้องใช้บัญชีร้านเพื่อจัดการข้อมูลร้าน')
  return prisma.shopProfile.upsert({
    where: { userId },
    create: { userId, shopName: user.displayName, phoneNumbers: [] },
    update: {},
  })
}

export async function updateProfile(userId: string, input: UpdateShopProfileInput): Promise<ShopDetail> {
  await assertShop(userId)
  const data: Prisma.ShopProfileUpdateInput = {}
  if (input.shopName !== undefined) data.shopName = input.shopName
  if (input.description !== undefined) data.description = input.description
  if (input.locationText !== undefined) data.locationText = input.locationText
  if (input.phoneNumbers !== undefined) data.phoneNumbers = input.phoneNumbers
  if (input.openingHours !== undefined) data.openingHours = input.openingHours === null ? Prisma.JsonNull : input.openingHours as Prisma.InputJsonValue
  await prisma.shopProfile.update({ where: { userId }, data })
  return detail(userId)
}

export async function createService(userId: string, input: CreateShopServiceInput) {
  await assertShop(userId)
  const service = await prisma.shopService.create({
    data: {
      shopId: userId,
      name: input.name,
      description: input.description ?? null,
      priceThb: input.priceThb,
      durationMinutes: input.durationMinutes,
      sortOrder: input.sortOrder ?? 0,
    },
  })
  return mapService(service)
}

export async function updateService(userId: string, serviceId: string, input: UpdateShopServiceInput) {
  await assertShop(userId)
  const owned = await prisma.shopService.findFirst({ where: { id: serviceId, shopId: userId } })
  if (!owned) throw AppError.notFound('ไม่พบบริการของร้านนี้')
  const data: Prisma.ShopServiceUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.description !== undefined) data.description = input.description
  if (input.priceThb !== undefined) data.priceThb = input.priceThb
  if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  const service = await prisma.shopService.update({ where: { id: serviceId }, data })
  return mapService(service)
}

export async function removeService(userId: string, serviceId: string): Promise<void> {
  await assertShop(userId)
  const result = await prisma.shopService.updateMany({ where: { id: serviceId, shopId: userId }, data: { isActive: false } })
  if (result.count === 0) throw AppError.notFound('ไม่พบบริการของร้านนี้')
}

export async function replyToReview(userId: string, reviewId: string, reply: string): Promise<void> {
  await assertShop(userId)
  const result = await prisma.shopReview.updateMany({ where: { id: reviewId, shopId: userId, deletedAt: null }, data: { shopReply: reply } })
  if (result.count === 0) throw AppError.notFound('ไม่พบรีวิวของร้านนี้')
}
