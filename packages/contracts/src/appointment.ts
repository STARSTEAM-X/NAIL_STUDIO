import { z } from 'zod'

export const APPOINTMENT_STATUSES = [
  'pending',
  'counter_offered',
  'confirmed',
  'declined',
  'cancelled',
  'completed',
  'no_show',
] as const

export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected', 'superseded'] as const
export const PROPOSAL_ACTORS = ['customer', 'shop'] as const

const isoDate = z.string().datetime({ offset: true })

export const createAppointmentSchema = z.object({
  shopId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  designVersionId: z.string().uuid().optional(),
  proposedStartAt: isoDate,
  durationMinutes: z.number().int().min(15).max(480),
  priceQuotedThb: z.number().finite().nonnegative().max(1_000_000).optional(),
  customerNote: z.string().trim().max(1000).optional(),
})

export const proposeAppointmentSchema = z.object({
  proposedStartAt: isoDate,
  durationMinutes: z.number().int().min(15).max(480),
  message: z.string().trim().max(500).optional(),
})

export const reviewAppointmentSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
})

export const appointmentMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
})

export const listAppointmentsQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  shopId: z.string().uuid(),
  serviceId: z.string().uuid().nullable(),
  designVersionId: z.string().uuid().nullable(),
  status: z.enum(APPOINTMENT_STATUSES),
  agreedStartAt: z.string().datetime({ offset: true }).nullable(),
  durationMinutes: z.number().int().positive(),
  priceQuotedThb: z.string().nullable(),
  customerNote: z.string().nullable(),
  shopNote: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  shopName: z.string(),
  serviceName: z.string().nullable(),
})

export const appointmentProposalSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  proposedBy: z.enum(PROPOSAL_ACTORS),
  proposedStartAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive(),
  message: z.string().nullable(),
  status: z.enum(PROPOSAL_STATUSES),
  createdAt: z.string().datetime({ offset: true }),
})

export const appointmentMessageResponseSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  senderId: z.string().uuid().nullable(),
  content: z.string(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
})

export const shopReviewSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  shopId: z.string().uuid(),
  authorId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  shopReply: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
})

export const appointmentDetailSchema = appointmentSchema.extend({
  proposals: z.array(appointmentProposalSchema),
  messages: z.array(appointmentMessageResponseSchema),
  review: shopReviewSchema.nullable(),
})

export const updateShopProfileSchema = z.object({
  shopName: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  locationText: z.string().trim().max(500).nullable().optional(),
  phoneNumbers: z.array(z.string().trim().min(3).max(32)).max(5).optional(),
  openingHours: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const createShopServiceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  priceThb: z.number().finite().nonnegative().max(1_000_000),
  durationMinutes: z.number().int().min(15).max(480),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

export const updateShopServiceSchema = createShopServiceSchema.partial()

export const shopProfileSchema = z.object({
  userId: z.string().uuid(),
  shopName: z.string().min(1).max(160),
  description: z.string().nullable(),
  locationText: z.string().nullable(),
  phoneNumbers: z.array(z.string()),
  openingHours: z.record(z.string(), z.unknown()).nullable(),
  isVerified: z.boolean(),
  ratingAvg: z.string(),
  ratingCount: z.number().int().nonnegative(),
})

export const shopServiceSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceThb: z.string(),
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
})

export const shopDetailSchema = shopProfileSchema.extend({
  services: z.array(shopServiceSchema),
  reviews: z.array(shopReviewSchema),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type ProposeAppointmentInput = z.infer<typeof proposeAppointmentSchema>
export type ReviewAppointmentInput = z.infer<typeof reviewAppointmentSchema>
export type AppointmentMessageInput = z.infer<typeof appointmentMessageSchema>
export type Appointment = z.infer<typeof appointmentSchema>
export type AppointmentProposal = z.infer<typeof appointmentProposalSchema>
export type AppointmentMessage = z.infer<typeof appointmentMessageResponseSchema>
export type ShopReview = z.infer<typeof shopReviewSchema>
export type AppointmentDetail = z.infer<typeof appointmentDetailSchema>
export type UpdateShopProfileInput = z.infer<typeof updateShopProfileSchema>
export type CreateShopServiceInput = z.infer<typeof createShopServiceSchema>
export type UpdateShopServiceInput = z.infer<typeof updateShopServiceSchema>
export type ShopDetail = z.infer<typeof shopDetailSchema>
