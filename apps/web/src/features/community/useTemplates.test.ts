import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, type TemplateCard, type TemplateDetail } from '@nail-studio/contracts'
import type { ApiPage } from '@/api/client.ts'
import {
  patchTemplateLikeCaches,
  patchTemplateRemixCaches,
  patchTemplateShareCaches,
  templateKeys,
  type TemplateFilters,
} from './useTemplates.ts'

describe('patchTemplateLikeCaches', () => {
  it('updates feed and detail caches without treating the detail as infinite data', () => {
    const queryClient = new QueryClient()
    const templateId = '00000000-0000-0000-0000-000000000000'
    const filters = { sort: 'latest' } satisfies TemplateFilters
    const card = {
      id: templateId,
      name: 'Rose study',
      caption: null,
      category: null,
      primaryColor: null,
      hasThumbnail: false,
      origin: 'original',
      isLiked: false,
      likeCount: 1,
      shareCount: 0,
      remixCount: 0,
      commentCount: 0,
      viewCount: 0,
      createdAt: '2026-08-18T00:00:00.000Z',
      author: {
        id: '00000000-0000-4000-8000-000000000001',
        displayName: 'Artist',
      },
    } satisfies TemplateCard
    const detail = {
      ...card,
      document: createEmptyDocument(),
      comments: [],
    } satisfies TemplateDetail
    const feed: InfiniteData<ApiPage<TemplateCard[]>> = {
      pages: [{ data: [card], nextCursor: null }],
      pageParams: [null],
    }

    queryClient.setQueryData(templateKeys.feed(filters), feed)
    queryClient.setQueryData(templateKeys.detail(templateId), detail)

    expect(() => patchTemplateLikeCaches(queryClient, templateId, { liked: true, likeCount: 2 })).not.toThrow()

    expect(queryClient.getQueryData<InfiniteData<ApiPage<TemplateCard[]>>>(templateKeys.feed(filters))?.pages[0]?.data[0]).toMatchObject({
      likeCount: 2,
      isLiked: true,
    })
    expect(queryClient.getQueryData<TemplateDetail>(templateKeys.detail(templateId))).toMatchObject({
      likeCount: 2,
      isLiked: true,
    })
  })
})

describe('template share and remix cache patches', () => {
  it('updates share counts in feed and detail caches without throwing', () => {
    const { queryClient, templateId, feedKey, detailKey } = seedTemplateCaches()

    expect(() => patchTemplateShareCaches(queryClient, templateId, { shareCount: 3 })).not.toThrow()

    expect(queryClient.getQueryData<InfiniteData<ApiPage<TemplateCard[]>>>(feedKey)?.pages[0]?.data[0]).toMatchObject({
      shareCount: 3,
    })
    expect(queryClient.getQueryData<TemplateDetail>(detailKey)).toMatchObject({ shareCount: 3 })
  })

  it('updates remix counts in feed and detail caches without throwing', () => {
    const { queryClient, templateId, feedKey, detailKey } = seedTemplateCaches()

    expect(() => patchTemplateRemixCaches(queryClient, templateId, {
      sourceTemplateId: templateId,
      remixCount: 4,
      project: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Rose remix',
        status: 'draft',
        versionCount: 1,
        hasThumbnail: false,
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
      },
    })).not.toThrow()

    expect(queryClient.getQueryData<InfiniteData<ApiPage<TemplateCard[]>>>(feedKey)?.pages[0]?.data[0]).toMatchObject({
      remixCount: 4,
    })
    expect(queryClient.getQueryData<TemplateDetail>(detailKey)).toMatchObject({ remixCount: 4 })
  })
})

function seedTemplateCaches() {
  const queryClient = new QueryClient()
  const templateId = '00000000-0000-0000-0000-000000000000'
  const filters = { sort: 'latest' } satisfies TemplateFilters
  const card = {
    id: templateId,
    name: 'Rose study',
    caption: null,
    category: null,
    primaryColor: null,
    hasThumbnail: false,
    origin: 'original',
    isLiked: false,
    likeCount: 1,
    shareCount: 0,
    remixCount: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: '2026-08-18T00:00:00.000Z',
    author: {
      id: '00000000-0000-4000-8000-000000000001',
      displayName: 'Artist',
    },
  } satisfies TemplateCard
  const detail = {
    ...card,
    document: createEmptyDocument(),
    comments: [],
  } satisfies TemplateDetail
  const feed: InfiniteData<ApiPage<TemplateCard[]>> = {
    pages: [{ data: [card], nextCursor: null }],
    pageParams: [null],
  }
  const feedKey = templateKeys.feed(filters)
  const detailKey = templateKeys.detail(templateId)

  queryClient.setQueryData(feedKey, feed)
  queryClient.setQueryData(detailKey, detail)

  return { queryClient, templateId, feedKey, detailKey }
}
