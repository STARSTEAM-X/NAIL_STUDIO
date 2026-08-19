import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConversationDetail, ConversationMessageResponse } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { BlockedComposer } from './BlockedComposer.tsx'
import { formatDateTime, formatTime } from '@/lib/datetime.ts'

interface ConversationRoomProps {
  detail: ConversationDetail
  /** ข้อความที่จะแสดงจริง — รวมประวัติที่โหลดเพิ่มแล้ว ไม่ใช่ detail.messages ตรง ๆ */
  messages: ConversationMessageResponse[]
  hasMore: boolean
  loadingOlder: boolean
  currentUserId: string | undefined
  pending: boolean
  blockedByMe: boolean
  blockPending: boolean
  onSend: (content: string) => Promise<unknown>
  onBlock: () => void
  onUnblock: () => void
  onReport: (messageId: string) => void
  onLoadOlder: () => void
}

export function ConversationRoom({
  detail, messages, hasMore, loadingOlder, currentUserId, pending,
  blockedByMe, blockPending, onSend, onBlock, onUnblock, onReport, onLoadOlder,
}: ConversationRoomProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  // เลื่อนลงล่างเมื่อมีข้อความใหม่จริงเท่านั้น ไม่ใช่ทุกครั้งที่ poll คืนข้อมูลเดิม
  // และไม่ใช่ตอนกดโหลดประวัติเก่า ซึ่งข้อความล่าสุดไม่เปลี่ยน
  useEffect(() => {
    const lastId = messages.at(-1)?.id ?? null
    if (lastId === lastIdRef.current) return
    lastIdRef.current = lastId
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  /*
    ล้างช่องพิมพ์เมื่อส่งสำเร็จเท่านั้น

    ของเดิมใน AppointmentChat เรียก onSend() แล้ว setDraft('') ทันทีโดยไม่รอผล
    ส่งไม่สำเร็จเมื่อไรข้อความที่พิมพ์หายไปเลย ส่วน catch ที่นี่มีไว้กัน
    unhandled rejection — ผู้เรียกเป็นคนแสดง toast แล้วโยน error ต่อมา
  */
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    try {
      await onSend(content)
      setDraft('')
    } catch {
      // คงข้อความไว้ให้ผู้ใช้กดส่งซ้ำได้
    }
  }

  const otherName = detail.otherParty.shopName ?? detail.otherParty.displayName

  return (
    <section className="ui-card chat-room" aria-labelledby="chat-room-title">
      <header className="chat-room-head">
        <div>
          <p className="eyebrow">CONVERSATION</p>
          <h2 id="chat-room-title">{otherName}</h2>
        </div>
        {/* อีกฝ่ายบล็อกเราอยู่ก็ยังต้องบล็อกกลับได้ จึงดูจาก blockedByMe ไม่ใช่ detail.blocked */}
        {!blockedByMe && <Button variant="ghost" icon="x" onClick={onBlock}>บล็อกผู้ใช้</Button>}
      </header>

      <div
        className="chat-room-messages"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={`ข้อความกับ${otherName}`}
      >
        {hasMore && (
          <Button variant="ghost" loading={loadingOlder} onClick={onLoadOlder}>โหลดข้อความเก่ากว่า</Button>
        )}
        {messages.length === 0 && <p className="muted chat-empty">ยังไม่มีข้อความ เริ่มบทสนทนาได้เลย</p>}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId
          return (
            <div key={message.id} className={mine ? 'chat-message chat-message-mine' : 'chat-message'}>
              <div className="chat-bubble">
                <p>{message.content}</p>
                <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
                  {formatTime(message.createdAt)}
                </time>
              </div>
              {!mine && (
                <button type="button" className="chat-report-link" onClick={() => onReport(message.id)}>
                  รายงาน
                </button>
              )}
            </div>
          )
        })}
      </div>

      {detail.blocked ? (
        <BlockedComposer blockedByMe={blockedByMe} pending={blockPending} onUnblock={onUnblock} />
      ) : (
        <form className="chat-composer" onSubmit={submit}>
          <label className="nc-visually-hidden" htmlFor="chat-message">ข้อความ</label>
          <input
            id="chat-message"
            value={draft}
            maxLength={2000}
            placeholder="พิมพ์ข้อความ…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()} loading={pending} aria-label="ส่งข้อความ">
            <Icon name="arrow-up-right" size={16} />
          </Button>
        </form>
      )}
    </section>
  )
}
