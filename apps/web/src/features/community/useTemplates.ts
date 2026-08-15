import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type {
  CreateTemplateCommentInput,
  TemplateCard,
  TemplateCommentResult,
  TemplateDetail,
  TemplateLikeResult,
  TemplateRemixResult,
} from '@nail-studio/contracts'
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_PRIMARY_COLORS,
  TEMPLATE_SORTS,
} from '@nail-studio/contracts'
import { apiFetch, apiFetchPage, type ApiPage } from '@/api/client.ts'
import { projectKeys } from '@/features/projects/useProjects.ts'

export type TemplateSort = (typeof TEMPLATE_SORTS)[number]
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]
export type TemplatePrimaryColor = (typeof TEMPLATE_PRIMARY_COLORS)[number]

export interface TemplateFilters {
  sort: TemplateSort
  category?: TemplateCategory
  color?: TemplatePrimaryColor
}

export const templateKeys = {
  all: ['templates'] as const,
  feed: (filters: TemplateFilters) => [...templateKeys.all, 'feed', filters] as const,
  detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
}

function templateFeedPath(filters: TemplateFilters, cursor: string | null): string {
  const params = new URLSearchParams({ sort: filters.sort, limit: '12' })
  if (filters.category) params.set('category', filters.category)
  if (filters.color) params.set('color', filters.color)
  if (cursor) params.set('cursor', cursor)
  return `/templates?${params.toString()}`
}

export function useTemplates(filters: TemplateFilters) {
  return useInfiniteQuery({
    queryKey: templateKeys.feed(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetchPage<TemplateCard[]>(templateFeedPath(filters, pageParam)),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn: () => apiFetch<TemplateDetail>(`/templates/${id}`),
    enabled: Boolean(id),
  })
}

export interface TemplateLikeInput {
  templateId: string
  liked: boolean
}

export function useTemplateLike() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, liked }: TemplateLikeInput) =>
      apiFetch<TemplateLikeResult>(`/templates/${templateId}/like`, {
        method: liked ? 'DELETE' : 'PUT',
      }),
    onSuccess: (result, { templateId }) => {
      queryClient.setQueriesData<InfiniteData<ApiPage<TemplateCard[]>>>({ queryKey: templateKeys.all }, (current) => {
        if (!current) return current
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.map((template) =>
              template.id === templateId ? { ...template, likeCount: result.likeCount } : template,
            ),
          })),
        }
      })
    },
  })
}

export interface TemplateRemixInput {
  templateId: string
  name?: string
}

export function useTemplateRemix() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, name }: TemplateRemixInput) =>
      apiFetch<TemplateRemixResult>(`/templates/${templateId}/remix`, {
        method: 'POST',
        body: name ? { name } : {},
      }),
    onSuccess: (result, { templateId }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.list(), exact: true })
      queryClient.setQueriesData<InfiniteData<ApiPage<TemplateCard[]>>>({ queryKey: templateKeys.all }, (current) => {
        if (!current) return current
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.map((template) =>
              template.id === templateId ? { ...template, remixCount: result.remixCount } : template,
            ),
          })),
        }
      })
    },
  })
}

export interface TemplateCommentInput extends CreateTemplateCommentInput {
  templateId: string
}

export function useCreateTemplateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, content }: TemplateCommentInput) =>
      apiFetch<TemplateCommentResult>(`/templates/${templateId}/comments`, {
        method: 'POST',
        body: { content },
      }),
    onSuccess: (_result, { templateId }) => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId), exact: true })
      void queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
  })
}
