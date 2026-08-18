import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AppointmentMessage } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { formatDateTime, formatTime } from '@/lib/datetime.ts'

interface AppointmentChatProps {
  messages: AppointmentMessage[]
  currentUserId: string | undefined
  pending: boolean
  onSend: (content: string) => void
}

const MESSAGE_LIMIT = 2000

/**
 * บทสนทนากับร้าน
 *
 * แยกฝั่งซ้าย/ขวาตามผู้ส่ง — ของเดิมข้อความทุกคนหน้าตาเหมือนกันหมด
 * จึงอ่านไม่ออกว่าใครพูดอะไร ข้อความจากระบบ (senderId เป็น null) แสดงกลางแบบไม่มีฟอง
 */
export function AppointmentChat({ messages, currentUserId, pending, onSend }: AppointmentChatProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  // เลื่อนลงล่างเมื่อมีข้อความใหม่จริงๆ เท่านั้น ไม่ใช่ทุกครั้งที่ refetch คืนข้อมูลเดิม
  useEffect(() => {
    const lastId = messages.at(-1)?.id ?? null
    if (lastId === lastIdRef.current) return
    lastIdRef.current = lastId
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    onSend(content)
    setDraft('')
  }

  return (
    <div className="ap-chat">
      <div className="ap-chat-messages" ref={listRef} role="log" aria-live="polite" aria-label="ข้อความกับร้าน">
        {messages.length === 0 && <p className="muted ap-chat-empty">ยังไม่มีข้อความ เริ่มบทสนทนาได้เลย</p>}
        {messages.map((message) => {
          if (!message.senderId) {
            return (
              <p key={message.id} className="ap-chat-system">
                {message.content}
              </p>
            )
          }
          const mine = message.senderId === currentUserId
          return (
            <div key={message.id} className={`ap-chat-row ${mine ? 'ap-chat-mine' : ''}`}>
              <div className="ap-chat-bubble">
                <p>{message.content}</p>
                <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
                  {formatTime(message.createdAt)}
                </time>
              </div>
            </div>
          )
        })}
      </div>

      <form className="ap-chat-form" onSubmit={submit}>
        <label className="nc-visually-hidden" htmlFor="appointment-message">ข้อความถึงร้าน</label>
        <input
          id="appointment-message"
          value={draft}
          maxLength={MESSAGE_LIMIT}
          placeholder="พิมพ์ข้อความ…"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={!draft.trim()} loading={pending} aria-label="ส่งข้อความ">
          <Icon name="arrow-up-right" size={16} />
        </Button>
      </form>
    </div>
  )
}
