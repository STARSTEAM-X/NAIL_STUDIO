import { useInfiniteQuery } from '@tanstack/react-query'
import type { PublicProfile } from '@nail-studio/contracts'
import { apiFetchPage, type ApiPage } from '@/api/client.ts'

export const publicProfileKeys = {
  all: ['public-profiles'] as const,
  detail: (userId: string) => [...publicProfileKeys.all, userId] as const,
}

function profilePath(userId: string, cursor: string | null): string {
  const params = new URLSearchParams({ limit: '12' })
  if (cursor) params.set('cursor', cursor)
  return `/users/${userId}/profile?${params.toString()}`
}

export function usePublicProfile(userId: string | undefined) {
  const query = useInfiniteQuery<ApiPage<PublicProfile>>({
    queryKey: publicProfileKeys.detail(userId ?? ''),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiFetchPage<PublicProfile>(profilePath(userId ?? '', pageParam as string | null)),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(userId),
  })

  return {
    ...query,
    profile: query.data?.pages[0]?.data,
    templates: query.data?.pages.flatMap((page) => page.data.templates) ?? [],
  }
}
