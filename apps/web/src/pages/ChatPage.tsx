import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { TemplateReportInput } from '@nail-studio/contracts'
import { BackLink } from '@/components/ui/BackLink.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { ReportDialog } from '@/components/ui/ReportDialog.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { fetchConversation } from '@/features/chat/client.ts'
import { cursorOf, historyFor, mergeMessages, type HistoryPage } from '@/features/chat/chatHistory.ts'
import { ConversationList } from '@/features/chat/components/ConversationList.tsx'
import { ConversationRoom } from '@/features/chat/components/ConversationRoom.tsx'
import { useBlockUser, useBlocks, useConversation, useConversations, useMarkRead, useReportMessage, useSendMessage, useStartConversation, useUnblockUser } from '@/features/chat/useChat.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const [params] = useSearchParams()
  const targetUserId = params.get('userId')
  const navigate = useNavigate()
  const toast = useToast()
  const { data: currentUser } = useCurrentUser()
  const conversations = useConversations()
  const detail = useConversation(conversationId)
  const blocks = useBlocks()
  const start = useStartConversation()
  const send = useSendMessage(conversationId)
  const markRead = useMarkRead()
  const block = useBlockUser()
  const unblock = useUnblockUser()
  const report = useReportMessage()
  usePageTitle('ข้อความ')

  /*
    ประวัติเก่าต้องอยู่นอกแคชของ react-query

    ห้องที่เปิดอยู่ถูก refetch ทุก 10 วินาที ถ้าเอาข้อความเก่าไปต่อไว้ใน setQueryData
    การ poll รอบถัดไปจะเขียนทับด้วยหน้าล่าสุดหน้าเดียว ปุ่ม "โหลดข้อความเก่ากว่า"
    จึงใช้ได้ไม่ถึงสิบวินาทีแล้วประวัติหายไปเอง
  */
  const [older, setOlder] = useState<HistoryPage | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (!conversationId && targetUserId && !start.isPending) {
      start.mutate(targetUserId, {
        onSuccess: (room) => navigate('/chat/' + room.id, { replace: true }),
        onError: (error) => toast.error(error instanceof Error ? error.message : 'เปิดห้องแชทไม่สำเร็จ'),
      })
    }
  }, [conversationId, navigate, start, targetUserId, toast])

  const markReadMutate = markRead.mutate
  useEffect(() => {
    if (conversationId) markReadMutate(conversationId)
  }, [conversationId, markReadMutate])

  const currentDetail = detail.data

  // ตรรกะการรวมและตัดหน้าอยู่ใน chatHistory.ts เพื่อให้เทสต์ได้โดยไม่ต้องเรนเดอร์หน้าจอ
  const history = historyFor(older, conversationId)
  const messages = useMemo(
    () => mergeMessages(history?.messages ?? [], currentDetail?.messages ?? []),
    [history, currentDetail?.messages],
  )
  const hasMore = history ? history.hasMore : Boolean(currentDetail?.hasMore)
  const otherId = currentDetail?.otherParty.id
  const blockedByMe = Boolean(otherId && blocks.data?.some((item) => item.userId === otherId))

  const loadOlder = async () => {
    const first = messages[0]
    if (!conversationId || !first || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await fetchConversation(conversationId, cursorOf(first))
      setOlder((current) => ({
        roomId: conversationId,
        messages: [...page.messages, ...(historyFor(current, conversationId)?.messages ?? [])],
        hasMore: page.hasMore,
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'โหลดข้อความเก่าไม่สำเร็จ')
    } finally {
      setLoadingOlder(false)
    }
  }

  /* โยน error ต่อเพื่อให้ห้องแชทเก็บข้อความที่พิมพ์ไว้ ส่วน toast ออกจากที่นี่ที่เดียว */
  const handleSend = async (content: string) => {
    try {
      await send.mutateAsync(content)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ส่งข้อความไม่สำเร็จ')
      throw error
    }
  }

  const submitReport = (input: TemplateReportInput) => {
    if (!reportTargetId) return
    report.mutate({ id: reportTargetId, input }, {
      onSuccess: () => { toast.success('ส่งรายงานแล้ว ทีมงานจะตรวจสอบให้'); setReportTargetId(null) },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'ส่งรายงานไม่สำเร็จ'),
    })
  }

  if (conversations.isPending) return <section className="page chat-page"><ListSkeleton count={3} lines={3} /></section>
  if (conversations.error) return <section className="page chat-page"><ErrorState title="โหลดกล่องข้อความไม่สำเร็จ" error={conversations.error} onRetry={() => void conversations.refetch()} /></section>

  return (
    <section className="page chat-page">
      <BackLink to="/projects">กลับหน้าแรก</BackLink>
      <header className="ap-header">
        <div>
          <p className="eyebrow">MESSAGES</p>
          <h1>ข้อความ</h1>
          <p className="muted">พูดคุยกับผู้ใช้และร้านได้โดยตรง</p>
        </div>
      </header>
      <div className="chat-layout">
        <ConversationList
          conversations={conversations.data ?? []}
          selectedId={conversationId}
          onSelect={(id) => navigate('/chat/' + id)}
        />
        {!conversationId ? (
          <EmptyState icon="comment" title="เลือกห้องสนทนา" description="เลือกห้องทางซ้ายหรือเริ่มจากหน้าร้านและโปรไฟล์ผู้ใช้" />
        ) : detail.isPending ? (
          <ListSkeleton count={2} lines={4} />
        ) : detail.error ? (
          <ErrorState title="โหลดห้องสนทนาไม่สำเร็จ" error={detail.error} onRetry={() => void detail.refetch()} />
        ) : currentDetail ? (
          <ConversationRoom
            detail={currentDetail}
            messages={messages}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            currentUserId={currentUser?.id}
            pending={send.isPending}
            blockedByMe={blockedByMe}
            blockPending={block.isPending || unblock.isPending}
            onSend={handleSend}
            onBlock={() => block.mutate(currentDetail.otherParty.id, {
              onSuccess: () => toast.success('บล็อกผู้ใช้แล้ว'),
              onError: (error) => toast.error(error instanceof Error ? error.message : 'บล็อกไม่สำเร็จ'),
            })}
            onUnblock={() => unblock.mutate(currentDetail.otherParty.id, {
              onSuccess: () => toast.success('เลิกบล็อกแล้ว'),
              onError: (error) => toast.error(error instanceof Error ? error.message : 'เลิกบล็อกไม่สำเร็จ'),
            })}
            onReport={setReportTargetId}
            onLoadOlder={() => void loadOlder()}
          />
        ) : null}
      </div>

      {reportTargetId && (
        <ReportDialog
          title="รายงานข้อความนี้"
          description="ทีมงานจะเห็นเฉพาะข้อความที่คุณรายงาน ไม่ได้เปิดดูบทสนทนาทั้งห้อง"
          pending={report.isPending}
          onClose={() => setReportTargetId(null)}
          onSubmit={submitReport}
        />
      )}
    </section>
  )
}
