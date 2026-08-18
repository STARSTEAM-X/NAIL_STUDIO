import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '@nail-studio/contracts'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/useNotifications.ts'
import { formatRelativeTime } from '@/lib/datetime.ts'
import { Icon } from './Icon.tsx'
import { InlineLoading } from './Loading.tsx'

/**
 * ปลายทางของการแจ้งเตือนแต่ละชนิด
 *
 * เดิมรองรับเฉพาะ sourceType 'post' ทำให้การแจ้งเตือนเรื่องนัดหมายทั้งหกชนิด
 * (ที่ backend สร้างด้วย sourceType 'appointment') กดแล้วไม่พาไปไหนเลย
 */
function notificationHref(notification: Notification): string | null {
  if (notification.sourceType === 'post') return `/community/templates/${notification.sourceId}`
  if (notification.sourceType === 'appointment') return `/appointments/${notification.sourceId}`
  return null
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const unreadCount = notifications.data?.unreadCount ?? 0

  // ปิดเมื่อคลิกนอกหรือกด Escape — พฤติกรรมที่ผู้ใช้คาดหวังจาก popover ทุกตัว
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        ref={triggerRef}
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
          {notifications.isPending && <InlineLoading label="กำลังโหลด…" />}
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
                    const href = notificationHref(notification)
                    if (href) navigate(href)
                    setOpen(false)
                  }}
                >
                  <span>{notification.title}</span>
                  <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
