import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationPage } from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => apiFetch<NotificationPage>('/notifications?limit=20'),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(), exact: true })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(), exact: true })
    },
  })
}
