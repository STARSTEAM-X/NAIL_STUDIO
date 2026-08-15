import { z } from 'zod'

export const TEMPLATE_SORTS = ['latest', 'popular'] as const
export const TEMPLATE_CATEGORIES = ['Minimalistic', 'Modern', 'Festive', 'Geometric', 'Luxury'] as const
export const TEMPLATE_PRIMARY_COLORS = ['Red', 'Pink', 'Nude', 'Black', 'White'] as const
export const TEMPLATE_ORIGINS = ['original', 'ai', 'remix'] as const

export const listTemplatesQuerySchema = z.object({
  sort: z.enum(TEMPLATE_SORTS).default('latest'),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  color: z.enum(TEMPLATE_PRIMARY_COLORS).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const templateAuthorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
})

export const templateCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  caption: z.string().nullable(),
  category: z.string().nullable(),
  primaryColor: z.string().nullable(),
  origin: z.enum(TEMPLATE_ORIGINS),
  likeCount: z.number().int().nonnegative(),
  shareCount: z.number().int().nonnegative(),
  remixCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  author: templateAuthorSchema,
})

export const templateLikeResultSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int().nonnegative(),
})

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>
export type TemplateCard = z.infer<typeof templateCardSchema>
export type TemplateLikeResult = z.infer<typeof templateLikeResultSchema>
