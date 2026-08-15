import { z } from 'zod'
import { templateCardSchema } from './template.ts'

export const publicProfileQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().trim().min(1).max(512).optional(),
})

export const publicProfileTemplateSchema = templateCardSchema

export const publicProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  role: z.enum(['user', 'shop', 'admin']),
  createdAt: z.string(),
  templateCount: z.number().int().nonnegative(),
  templates: z.array(publicProfileTemplateSchema),
})

export type PublicProfileQuery = z.infer<typeof publicProfileQuerySchema>
export type PublicProfileTemplate = z.infer<typeof publicProfileTemplateSchema>
export type PublicProfile = z.infer<typeof publicProfileSchema>
