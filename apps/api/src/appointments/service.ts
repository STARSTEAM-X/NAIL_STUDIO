import type {
  AppointmentDetail,
  CreateAppointmentInput,
  ProposeAppointmentInput,
  ReviewAppointmentInput,
} from '@nail-studio/contracts'
import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'
import { AppError } from '../errors/AppError.ts'
import { createNotification } from '../notifications/repository.ts'

const appointmentInclude: Prisma.AppointmentInclude = {
  shop: { select: { shopName: true } },
  service: { select: { name: true } },
  proposals: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 },
  review: true,
}

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>

function mapAppointment(row: AppointmentRow) {
  return {
    id: row.id,
    customerId: row.customerId,
    shopId: row.shopId,
    serviceId: row.serviceId,
    designVersionId: row.designVersionId,
    status: row.status,
    agreedStartAt: row.agreedStartAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    priceQuotedThb: row.priceQuotedThb?.toString() ?? null,
    customerNote: row.customerNote,
    shopNote: row.shopNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    shopName: row.shop.shopName,
    serviceName: row.service?.name ?? null,
  }
}

function mapProposal(proposal: AppointmentRow['proposals'][number]) {
  return {
    id: proposal.id,
    appointmentId: proposal.appointmentId,
    proposedBy: proposal.proposedBy,
    proposedStartAt: proposal.proposedStartAt.toISOString(),
    durationMinutes: proposal.durationMinutes,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
  }
}

function mapMessage(message: AppointmentRow['messages'][number]) {
  return {
    id: message.id,
    appointmentId: message.appointmentId,
    senderId: message.senderId,
    content: message.content,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  }
}

function mapReview(review: AppointmentRow['review']) {
  if (!review) return null
  return {
    id: review.id,
    appointmentId: review.appointmentId,
    shopId: review.shopId,
    authorId: review.authorId,
    rating: review.rating,
    comment: review.comment,
    shopReply: review.shopReply,
    createdAt: review.createdAt.toISOString(),
  }
}

function isParticipant(row: { customerId: string; shopId: string }, userId: string): boolean {
  return row.customerId === userId || row.shopId === userId
}

async function findForParticipant(userId: string, appointmentId: string): Promise<AppointmentRow> {
  const row = await prisma.appointment.findFirst({ where: { id: appointmentId, OR: [{ customerId: userId }, { shopId: userId }] }, include: appointmentInclude })
  if (!row) throw AppError.notFound('ไม่พบการนัดหมายที่ต้องการ')
  return row
}

function actorFor(row: { customerId: string; shopId: string }, userId: string): 'customer' | 'shop' {
  if (row.customerId === userId) return 'customer'
  if (row.shopId === userId) return 'shop'
  throw AppError.notFound('ไม่พบการนัดหมายที่ต้องการ')
}

export function allowedTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'counter_offered', 'declined', 'cancelled'],
    counter_offered: ['confirmed', 'counter_offered', 'cancelled'],
    confirmed: ['completed', 'cancelled', 'no_show'],
    declined: [],
    cancelled: [],
    completed: [],
    no_show: [],
  }
  return transitions[from]?.includes(to) ?? false
}

export async function create(userId: string, input: CreateAppointmentInput): Promise<AppointmentDetail> {
  if (input.shopId === userId) throw AppError.validation('ไม่สามารถนัดหมายกับร้านของตัวเองได้')
  const shop = await prisma.shopProfile.findUnique({ where: { userId: input.shopId }, select: { userId: true, shopName: true } })
  if (!shop) throw AppError.notFound('ไม่พบร้านที่ต้องการ')

  let serviceId = input.serviceId
  let price = input.priceQuotedThb
  if (serviceId) {
    const service = await prisma.shopService.findFirst({ where: { id: serviceId, shopId: input.shopId, isActive: true }, select: { id: true, priceThb: true } })
    if (!service) throw AppError.validation('บริการนี้ไม่ใช่บริการที่เปิดอยู่ของร้าน')
    price ??= Number(service.priceThb)
  }
  if (input.designVersionId) {
    const version = await prisma.designVersion.findFirst({ where: { id: input.designVersionId, project: { userId } }, select: { id: true } })
    if (!version) throw AppError.notFound('ไม่พบดีไซน์ของคุณ')
  }

  const row = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        customerId: userId,
        shopId: input.shopId,
        serviceId: serviceId ?? null,
        designVersionId: input.designVersionId ?? null,
        durationMinutes: input.durationMinutes,
        priceQuotedThb: price ?? null,
        customerNote: input.customerNote ?? null,
        proposals: {
          create: {
            proposedBy: 'customer',
            proposedStartAt: new Date(input.proposedStartAt),
            durationMinutes: input.durationMinutes,
          },
        },
      },
      include: appointmentInclude,
    })
    await createNotification(tx, {
      userId: input.shopId,
      kind: 'appointment_status',
      title: 'มีคำขอนัดหมายใหม่',
      sourceType: 'appointment',
      sourceId: appointment.id,
    })
    return appointment
  })
  return detailFromRow(row)
}

export async function list(userId: string, status?: string, limit = 20) {
  const rows = await prisma.appointment.findMany({
    where: { ...(status ? { status: status as never } : {}), OR: [{ customerId: userId }, { shopId: userId }] },
    include: appointmentInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  })
  return rows.map(mapAppointment)
}

export async function detail(userId: string, appointmentId: string): Promise<AppointmentDetail> {
  return detailFromRow(await findForParticipant(userId, appointmentId))
}

function detailFromRow(row: AppointmentRow): AppointmentDetail {
  return {
    ...mapAppointment(row),
    proposals: row.proposals.map(mapProposal),
    messages: row.messages.map(mapMessage),
    review: mapReview(row.review),
  }
}

export async function accept(userId: string, appointmentId: string): Promise<AppointmentDetail> {
  const row = await findForParticipant(userId, appointmentId)
  const actor = actorFor(row, userId)
  const proposal = row.proposals.find((item) => item.status === 'pending')
  if (!proposal) throw AppError.conflict('ไม่มีข้อเสนอเวลาที่รอการตอบรับ')
  if (!allowedTransition(row.status, 'confirmed') || proposal.proposedBy === actor) throw AppError.conflict('คุณไม่สามารถตอบรับข้อเสนอนี้ได้ในสถานะปัจจุบัน')

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appointmentProposal.update({ where: { id: proposal.id }, data: { status: 'accepted' } })
    await tx.appointmentProposal.updateMany({ where: { appointmentId, status: 'pending', id: { not: proposal.id } }, data: { status: 'superseded' } })
    const appointment = await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'confirmed', agreedStartAt: proposal.proposedStartAt, durationMinutes: proposal.durationMinutes }, include: appointmentInclude })
    await createNotification(tx, {
      userId: actor === 'customer' ? row.shopId : row.customerId,
      kind: 'appointment_status',
      title: 'การนัดหมายได้รับการยืนยันแล้ว',
      sourceType: 'appointment',
      sourceId: appointmentId,
    })
    return appointment
  })
  return detailFromRow(updated)
}

export async function propose(userId: string, appointmentId: string, input: ProposeAppointmentInput): Promise<AppointmentDetail> {
  const row = await findForParticipant(userId, appointmentId)
  const actor = actorFor(row, userId)
  if (!allowedTransition(row.status, 'counter_offered')) throw AppError.conflict('สถานะนี้ไม่เปิดให้ต่อรองเวลาแล้ว')
  const pending = row.proposals.find((item) => item.status === 'pending')
  if (row.status === 'pending' && actor !== 'shop') throw AppError.conflict('ร้านต้องเป็นฝ่ายเสนอเวลาใหม่ในขั้นตอนนี้')
  if (pending && pending.proposedBy === actor) throw AppError.conflict('กรุณารออีกฝ่ายตอบข้อเสนอก่อน')

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appointmentProposal.updateMany({ where: { appointmentId, status: 'pending' }, data: { status: 'superseded' } })
    await tx.appointmentProposal.create({
      data: {
        appointmentId,
        proposedBy: actor,
        proposedStartAt: new Date(input.proposedStartAt),
        durationMinutes: input.durationMinutes,
        message: input.message ?? null,
      },
    })
    const appointment = await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'counter_offered' }, include: appointmentInclude })
    await createNotification(tx, {
      userId: actor === 'customer' ? row.shopId : row.customerId,
      kind: 'appointment_status',
      title: 'มีข้อเสนอเวลาใหม่สำหรับการนัดหมาย',
      sourceType: 'appointment',
      sourceId: appointmentId,
    })
    return appointment
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflict('มีข้อเสนอเวลาที่กำลังรอการตอบรับอยู่แล้ว')
    }
    throw error
  })
  return detailFromRow(updated)
}

async function transition(userId: string, appointmentId: string, to: 'declined' | 'cancelled' | 'completed' | 'no_show') {
  const row = await findForParticipant(userId, appointmentId)
  const actor = actorFor(row, userId)
  if (!allowedTransition(row.status, to)) throw AppError.conflict('ไม่สามารถเปลี่ยนสถานะการนัดหมายนี้ได้')
  if (to === 'declined' && actor !== 'shop') throw AppError.forbidden('เฉพาะร้านเท่านั้นที่ปฏิเสธคำขอได้')
  if (to === 'completed' && actor !== 'shop') throw AppError.forbidden('เฉพาะร้านเท่านั้นที่ปิดงานได้')
  if (to === 'no_show' && actor !== 'shop') throw AppError.forbidden('เฉพาะร้านเท่านั้นที่บันทึก no-show ได้')
  const updated = await prisma.$transaction(async (tx) => {
    await tx.appointmentProposal.updateMany({ where: { appointmentId, status: 'pending' }, data: { status: 'rejected' } })
    const appointment = await tx.appointment.update({ where: { id: appointmentId }, data: { status: to }, include: appointmentInclude })
    await createNotification(tx, {
      userId: actor === 'customer' ? row.shopId : row.customerId,
      kind: 'appointment_status',
      title: `สถานะการนัดหมายเปลี่ยนเป็น ${to}`,
      sourceType: 'appointment',
      sourceId: appointmentId,
    })
    return appointment
  })
  return detailFromRow(updated)
}

export const decline = (userId: string, appointmentId: string) => transition(userId, appointmentId, 'declined')
export const cancel = (userId: string, appointmentId: string) => transition(userId, appointmentId, 'cancelled')
export const complete = (userId: string, appointmentId: string) => transition(userId, appointmentId, 'completed')

export async function review(userId: string, appointmentId: string, input: ReviewAppointmentInput): Promise<AppointmentDetail> {
  const row = await findForParticipant(userId, appointmentId)
  if (row.customerId !== userId) throw AppError.forbidden('เฉพาะลูกค้าที่นัดหมายเท่านั้นที่รีวิวได้')
  if (row.status !== 'completed') throw AppError.conflict('รีวิวได้หลังจากร้านทำรายการเสร็จแล้วเท่านั้น')
  if (row.review) throw AppError.conflict('การนัดหมายนี้มีรีวิวแล้ว')

  const updated = await prisma.$transaction(async (tx) => {
    await tx.shopReview.create({ data: { appointmentId, shopId: row.shopId, authorId: userId, rating: input.rating, comment: input.comment ?? null } })
    const profile = await tx.shopProfile.findUnique({ where: { userId: row.shopId }, select: { ratingAvg: true, ratingCount: true } })
    if (profile) {
      const nextCount = profile.ratingCount + 1
      const nextAverage = ((Number(profile.ratingAvg) * profile.ratingCount + input.rating) / nextCount).toFixed(2)
      await tx.shopProfile.update({ where: { userId: row.shopId }, data: { ratingCount: nextCount, ratingAvg: nextAverage } })
    }
    await createNotification(tx, { userId: row.shopId, kind: 'appointment_status', title: 'ลูกค้ารีวิวร้านของคุณแล้ว', sourceType: 'appointment', sourceId: appointmentId })
    return tx.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: appointmentInclude })
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw AppError.conflict('การนัดหมายนี้มีรีวิวแล้ว')
    throw error
  })
  return detailFromRow(updated)
}

export async function listMessages(userId: string, appointmentId: string) {
  const row = await findForParticipant(userId, appointmentId)
  return row.messages.map(mapMessage)
}

export async function sendMessage(userId: string, appointmentId: string, content: string) {
  const row = await findForParticipant(userId, appointmentId)
  const recipientId = row.customerId === userId ? row.shopId : row.customerId
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.appointmentMessage.create({ data: { appointmentId, senderId: userId, content } })
    await createNotification(tx, { userId: recipientId, kind: 'appointment_message', title: 'มีข้อความใหม่ในการนัดหมาย', sourceType: 'appointment', sourceId: appointmentId })
    return created
  })
  return mapMessage(message)
}

export async function markMessagesRead(userId: string, appointmentId: string): Promise<void> {
  const row = await findForParticipant(userId, appointmentId)
  if (!isParticipant(row, userId)) throw AppError.notFound('ไม่พบการนัดหมายที่ต้องการ')
  await prisma.appointmentMessage.updateMany({ where: { appointmentId, senderId: { not: userId }, readAt: null }, data: { readAt: new Date() } })
}
