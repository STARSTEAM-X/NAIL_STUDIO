import type { ConversationDetail, ConversationMessageResponse, ConversationSummary, ReportMessageInput } from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

export function fetchConversations(): Promise<ConversationSummary[]> { return apiFetch<ConversationSummary[]>('/conversations') }
export function fetchConversation(id: string, before?: string, limit = 50): Promise<ConversationDetail> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return apiFetch<ConversationDetail>('/conversations/' + id + '?' + params.toString())
}
export function startConversation(userId: string): Promise<ConversationSummary> { return apiFetch<ConversationSummary>('/conversations', { method: 'POST', body: { userId } }) }
export function sendMessage(id: string, content: string): Promise<ConversationMessageResponse> { return apiFetch<ConversationMessageResponse>('/conversations/' + id + '/messages', { method: 'POST', body: { content } }) }
export function markConversationRead(id: string): Promise<{ ok: true }> { return apiFetch<{ ok: true }>('/conversations/' + id + '/read', { method: 'POST' }) }
export function blockUser(userId: string): Promise<{ ok: true }> { return apiFetch<{ ok: true }>('/blocks', { method: 'POST', body: { userId } }) }
export function unblockUser(userId: string): Promise<{ ok: true }> { return apiFetch<{ ok: true }>('/blocks/' + userId, { method: 'DELETE' }) }
export function fetchBlocks(): Promise<Array<{ userId: string; createdAt: string; user: { id: string; displayName: string; shopName?: string } }>> { return apiFetch('/blocks') }
export function reportMessage(id: string, input: ReportMessageInput): Promise<{ reportId: string }> { return apiFetch<{ reportId: string }>('/conversations/messages/' + id + '/report', { method: 'POST', body: input }) }
