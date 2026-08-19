import { z } from 'zod'
import { TEMPLATE_REPORT_REASONS } from './template.ts'

const isoDate = z.string().datetime({ offset: true })

export const startConversationSchema = z.object({ userId: z.string().uuid() })
export const conversationMessageSchema = z.object({ content: z.string().trim().min(1).max(2000) })
export const conversationMessageResponseSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid().nullable(),
  content: z.string(),
  readAt: isoDate.nullable(),
  createdAt: isoDate,
})
export const conversationPartySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  shopName: z.string().optional(),
})
export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  otherParty: conversationPartySchema,
  lastMessage: conversationMessageResponseSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: isoDate,
  blocked: z.boolean(),
})
export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(conversationMessageResponseSchema),
  hasMore: z.boolean(),
})
export const blockUserSchema = z.object({ userId: z.string().uuid() })
export const reportMessageSchema = z.object({
  reason: z.enum(TEMPLATE_REPORT_REASONS),
  detail: z.string().trim().max(2000).optional(),
})

export type StartConversationInput = z.infer<typeof startConversationSchema>
export type ConversationMessageInput = z.infer<typeof conversationMessageSchema>
export type ConversationMessageResponse = z.infer<typeof conversationMessageResponseSchema>
export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationDetail = z.infer<typeof conversationDetailSchema>
export type BlockUserInput = z.infer<typeof blockUserSchema>
export type ReportMessageInput = z.infer<typeof reportMessageSchema>
