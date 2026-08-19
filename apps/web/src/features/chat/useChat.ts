import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ConversationDetail, ConversationMessageResponse, ReportMessageInput } from '@nail-studio/contracts'
import { blockUser, fetchBlocks, fetchConversation, fetchConversations, markConversationRead, reportMessage, sendMessage, startConversation, unblockUser } from './client.ts'

export const chatKeys = {
  all: ['chat'] as const,
  list: () => [...chatKeys.all, 'list'] as const,
  detail: (id: string) => [...chatKeys.all, 'detail', id] as const,
  blocks: () => [...chatKeys.all, 'blocks'] as const,
}
/*
  ทั้งสองคิวรีนี้ดึงซ้ำเป็นระยะแทนการต่อ WebSocket ตามที่ทั้งแอปทำอยู่แล้ว
  (นัดหมาย 15 วิ แจ้งเตือน 60 วิ) และหยุดเมื่อผู้ใช้สลับแท็บไปที่อื่น

  ข้อควรระวัง: useConversation คืน "หน้าล่าสุด" เสมอ การเอาข้อความเก่าไปยัดใน
  แคชนี้จะถูก poll รอบถัดไปเขียนทับ ประวัติย้อนหลังจึงต้องเก็บนอกแคช — ดู ChatPage
*/
export function useConversations() {
  return useQuery({ queryKey: chatKeys.list(), queryFn: fetchConversations, refetchInterval: 30_000, refetchIntervalInBackground: false })
}
export function useConversation(id: string | undefined) {
  return useQuery({ queryKey: chatKeys.detail(id ?? ''), queryFn: () => fetchConversation(id!), enabled: Boolean(id), refetchInterval: (query) => query.state.error ? false : 10_000, refetchIntervalInBackground: false })
}
export function useBlocks() { return useQuery({ queryKey: chatKeys.blocks(), queryFn: fetchBlocks }) }
export function useStartConversation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (userId: string) => startConversation(userId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: chatKeys.list() }) } })
}
export function useSendMessage(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (content: string) => sendMessage(id!, content), onSuccess: (message: ConversationMessageResponse) => { queryClient.setQueryData<ConversationDetail>(chatKeys.detail(id ?? ''), (current) => current ? { ...current, messages: [...current.messages, message], lastMessage: message, lastMessageAt: message.createdAt } : current); void queryClient.invalidateQueries({ queryKey: chatKeys.list() }) } })
}
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (id: string) => markConversationRead(id), onSuccess: (_result, id) => { void queryClient.invalidateQueries({ queryKey: chatKeys.detail(id) }); void queryClient.invalidateQueries({ queryKey: chatKeys.list() }); void queryClient.invalidateQueries({ queryKey: ['notifications'] }) } })
}
export function useBlockUser() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (userId: string) => blockUser(userId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: chatKeys.all }) } })
}
export function useUnblockUser() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (userId: string) => unblockUser(userId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: chatKeys.all }) } })
}
export function useReportMessage() { return useMutation({ mutationFn: ({ id, input }: { id: string; input: ReportMessageInput }) => reportMessage(id, input) }) }
