import { useEffect, useRef, useState } from 'react'
import type { PublicUser } from '@nail-studio/contracts'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { avatarGradient, getInitials, ROLE_SHORT_LABELS } from '@/lib/user.ts'

interface EditorProfileDropdownProps {
  user: PublicUser | null | undefined
  isLoggingOut: boolean
  onLogout: () => void
  onViewProfile?: () => void
  onUnavailableAction?: (label: string) => void
}

export function EditorProfileDropdown({
  user,
  isLoggingOut,
  onLogout,
  onViewProfile,
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
        <span
          className="editor-profile-avatar"
          style={user ? { backgroundImage: avatarGradient(user.id) } : undefined}
          aria-hidden="true"
        >
          {getInitials(user?.displayName)}
        </span>
        <span className="editor-profile-trigger-copy">
          <strong>{user?.displayName ?? 'ผู้ใช้งาน'}</strong>
          <small>{user ? ROLE_SHORT_LABELS[user.role] : 'บัญชีของฉัน'}</small>
        </span>
        <span className="editor-profile-chevron" aria-hidden="true"><Icon name="chevron-down" size={14} /></span>
      </button>

      {open && (
        <div className="editor-profile-menu" role="menu" aria-label="เมนูโปรไฟล์">
          <div className="editor-profile-summary">
            <span className="editor-profile-avatar editor-profile-avatar-large" aria-hidden="true">
              {getInitials(user?.displayName)}
            </span>
            <div className="editor-profile-summary-copy">
              <strong>{user?.displayName ?? 'ผู้ใช้งาน'}</strong>
              <span>{user ? ROLE_SHORT_LABELS[user.role] : 'บัญชีของฉัน'}</span>
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
              if (onViewProfile) onViewProfile()
              else runUnavailableAction('ดูโปรไฟล์')
            }}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true"><Icon name="user" size={15} /></span>
            <span>ดูโปรไฟล์</span>
            <kbd>⌘ E</kbd>
          </button>
          <Link to="/projects" role="menuitem" className="editor-profile-menu-item" onClick={() => setOpen(false)}>
            <span className="editor-profile-menu-icon" aria-hidden="true"><Icon name="folder" size={15} /></span>
            <span>งานของฉัน</span>
          </Link>

          <div className="editor-profile-divider" />

          <button
            type="button"
            role="menuitem"
            className="editor-profile-menu-item editor-profile-menu-item-danger"
            disabled={isLoggingOut}
            onClick={onLogout}
          >
            <span className="editor-profile-menu-icon" aria-hidden="true"><Icon name="logout" size={15} /></span>
            <span>{isLoggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
