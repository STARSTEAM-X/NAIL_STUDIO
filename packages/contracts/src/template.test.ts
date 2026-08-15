import { describe, expect, it } from 'vitest'
import {
  listTemplatesQuerySchema,
  templateCardSchema,
  templateLikeResultSchema,
  templateRemixResultSchema,
  templateRemixSchema,
} from './template.ts'

describe('template contracts', () => {
  it('applies safe feed defaults and rejects unsupported filters', () => {
    expect(listTemplatesQuerySchema.parse({})).toEqual({ sort: 'latest', limit: 20 })
    expect(listTemplatesQuerySchema.safeParse({ sort: 'trending' }).success).toBe(false)
    expect(listTemplatesQuerySchema.safeParse({ category: 'Unknown' }).success).toBe(false)
  })

  it('validates the public card shape', () => {
    const card = {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Rose study',
      caption: null,
      category: 'Minimalistic',
      primaryColor: 'Pink',
      origin: 'original',
      likeCount: 2,
      shareCount: 1,
      remixCount: 0,
      commentCount: 3,
      viewCount: 12,
      createdAt: new Date().toISOString(),
      author: {
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Artist',
      },
    }

    expect(templateCardSchema.safeParse(card).success).toBe(true)
    expect(templateCardSchema.safeParse({ ...card, likeCount: -1 }).success).toBe(false)
  })

  it('validates the idempotent like response', () => {
    expect(templateLikeResultSchema.parse({ liked: true, likeCount: 3 })).toEqual({
      liked: true,
      likeCount: 3,
    })
    expect(templateLikeResultSchema.safeParse({ liked: false, likeCount: -1 }).success).toBe(false)
  })

  it('validates remix input and the created project result', () => {
    expect(templateRemixSchema.parse({ name: 'My remix' })).toEqual({ name: 'My remix' })
    expect(templateRemixSchema.parse({})).toEqual({})
    expect(templateRemixResultSchema.safeParse({
      sourceTemplateId: '00000000-0000-4000-8000-000000000000',
      remixCount: 1,
      project: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'My remix',
        status: 'draft',
        versionCount: 1,
        hasThumbnail: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }).success).toBe(true)
  })
})
