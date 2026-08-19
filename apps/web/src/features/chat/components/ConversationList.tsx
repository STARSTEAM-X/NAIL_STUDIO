import type { ConversationSummary } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatRelativeTime } from '@/lib/datetime.ts'

export function ConversationList({ conversations, selectedId, onSelect }: { conversations: ConversationSummary[]; selectedId: string | undefined; onSelect: (id: string) => void }) {
  return (
    <section className="ui-card chat-list" aria-labelledby="chat-list-title">
      <h2 id="chat-list-title"><Icon name="comment" size={16} /> ข้อความ</h2>
      {conversations.length === 0 ? <p className="muted chat-empty">ยังไม่มีห้องสนทนา</p> : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button type="button" className={selectedId === conversation.id ? 'chat-list-item chat-list-item-active' : 'chat-list-item'} onClick={() => onSelect(conversation.id)}>
                <span className="chat-list-copy">
                  <strong>{conversation.otherParty.shopName ?? conversation.otherParty.displayName}</strong>
                  <span>{conversation.lastMessage?.content ?? 'เริ่มบทสนทนา'}</span>
                </span>
                <span className="chat-list-meta">
                  <time dateTime={conversation.lastMessageAt}>{formatRelativeTime(conversation.lastMessageAt)}</time>
                  {conversation.unreadCount > 0 && <b aria-label={'ยังไม่อ่าน ' + conversation.unreadCount + ' ข้อความ'}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
