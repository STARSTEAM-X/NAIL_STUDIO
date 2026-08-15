import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/useNotifications.ts'
import { Icon } from './Icon.tsx'

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const unreadCount = notifications.data?.unreadCount ?? 0

  return (
    <div className="notification-menu">
      <button
        type="button"
        className="notification-trigger"
        aria-label={unreadCount > 0 ? `มีแจ้งเตือนใหม่ ${unreadCount} รายการ` : 'การแจ้งเตือน'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="bell" size={17} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-popover" role="dialog" aria-label="การแจ้งเตือน">
          <div className="notification-head">
            <strong>การแจ้งเตือน</strong>
            <button
              type="button"
              className="notification-read-all"
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              อ่านทั้งหมด
            </button>
          </div>
          {notifications.isPending && <p className="muted notification-empty">กำลังโหลด…</p>}
          {notifications.error && <p className="error notification-empty">โหลดแจ้งเตือนไม่สำเร็จ</p>}
          {!notifications.isPending && !notifications.error && notifications.data?.items.length === 0 && (
            <p className="muted notification-empty">ยังไม่มีการแจ้งเตือน</p>
          )}
          <ul className="notification-list">
            {notifications.data?.items.map((notification) => (
              <li key={notification.id} className={notification.isRead ? 'notification-item' : 'notification-item notification-unread'}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) markRead.mutate(notification.id)
                    if (notification.sourceType === 'post') navigate(`/community/templates/${notification.sourceId}`)
                    setOpen(false)
                  }}
                >
                  <span>{notification.title}</span>
                  <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('th-TH')}</time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
