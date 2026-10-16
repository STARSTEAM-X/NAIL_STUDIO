import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiTokenSummary, CreateApiTokenInput, CreatedApiToken } from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

const tokenKeys = { list: () => ['api-tokens'] as const }

/** API token ส่วนตัวสำหรับเชื่อม AI (NailStudio MCP server) — เห็นได้เฉพาะเจ้าของบัญชี */
export function useApiTokens(enabled: boolean) {
  return useQuery({
    queryKey: tokenKeys.list(),
    queryFn: () => apiFetch<ApiTokenSummary[]>('/tokens'),
    enabled,
  })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateApiTokenInput) => apiFetch<CreatedApiToken>('/tokens', { method: 'POST', body: input }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: tokenKeys.list() }) },
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: tokenKeys.list() }) },
  })
}
