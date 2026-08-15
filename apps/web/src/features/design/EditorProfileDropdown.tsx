import { useEffect, useRef, useState } from 'react'
import type { PublicUser } from '@nail-studio/contracts'

interface EditorProfileDropdownProps {
  user: PublicUser | null | undefined
  isLoggingOut: boolean
  onLogout: () => void
  onEditProfile?: () => void
  onUnavailableAction?: (label: string) => void
}

const ROLE_LABELS: Record<PublicUser['role'], string> = {
  user: 'ผู้ใช้งาน',
  shop: 'ร้านทำเล็บ',
  admin: 'ผู้ดูแลระบบ',
}

function getInitials(displayName: string | undefined) {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}

export function EditorProfileDropdown({
  user,
  isLoggingOut,
  onLogout,
  onEditProfile,
  onUnavailableAction,
}: EditorProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const closeWhenOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeWhenOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const runUnavailableAction = (label: string) => {
    setOpen(false)
    onUnavailableAction?.(label)
  }

  return (
    <div ref={rootRef} className="editor-profile">
      <button
        ref={triggerRef}
        type="button"
        className="editor-profile-trigger"
        aria-label={user ? `เมนูโปรไฟล์ ${user.displayName}` : 'เมนูโปรไฟล์'}
        aria-haspopup="menu"
        aria-expanded={open}
        title="เมนูโปรไฟล์"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="editor-profile-avatar" aria-hidden="true">{getInitials(user?.displayName)}</span>
        <span className="editor-profile-trigger-copy">
          <strong>{user?.displayName ?? 'ผู้ใช้งาน'}</strong>
          <small>{user ? ROLE_LABELS[user.role] : 'บัญชีของฉัน'}</small>
        </span>
        <span className="editor-profile-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="editor-profile-menu" role="menu" aria-label="เมนูโปรไฟล์">
          <div className="editor-profile-summary">
            <span className="editor-profile-avatar editor-profile-avatar-large" aria-hidden="true">
              {getInitials(user?.displayName)}
            </span>
            <div className="editor-profile-summary-copy">
              <strong>{user?.displayName ?? 'ผู้ใช้งาน'}</strong>
              <span>{user ? ROLE_LABELS[user.role] : 'บัญชีของฉัน'}</span>
              {user?.email && <small>{user.email}</small>}
            </div>
          </div>

          <div className="editor-profile-divider" />

          <button
            type="button"
            role="menuitem"
            className="editor-profile-menu-item"
            onClick={() => {
              setOpen(false)
              if (onEditProfile) onEditProfile()
              else runUnavailableAction('แก้ไขโปรไฟล์')
            }}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true">♙</span>
            <span>แก้ไขโปรไฟล์</span>
            <kbd>⌘ E</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            className="editor-profile-menu-item"
            onClick={() => runUnavailableAction('ตั้งค่าเครื่องมือ')}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true">⚙</span>
            <span>ตั้งค่าเครื่องมือ</span>
            <kbd>⌘ W</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            className="editor-profile-menu-item"
            onClick={() => runUnavailableAction('อัปเกรดเป็นมืออาชีพ')}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true">✦</span>
            <span>อัปเกรดเป็นมืออาชีพ</span>
          </button>

          <div className="editor-profile-divider" />

          <button
            type="button"
            role="menuitem"
            className="editor-profile-menu-item editor-profile-menu-item-danger"
            disabled={isLoggingOut}
            onClick={onLogout}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true">↪</span>
            <span>{isLoggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
