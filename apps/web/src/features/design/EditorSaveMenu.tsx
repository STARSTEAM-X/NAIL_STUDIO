import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon.tsx'

interface EditorSaveMenuProps {
  saving: boolean
  shareDisabled: boolean
  onSave: () => void
  onExportPng: () => void
  onExportJson: () => void
  onShare: () => void
}

/**
 * ปุ่มบันทึกแบบ split — ซ้ายบันทึก ขวาเปิดเมนูส่งออกและแชร์
 *
 * PNG กับ JSON อ่านจาก canvas และ store ตรงๆ จึงกดได้แม้กำลังบันทึกอยู่
 * ต่างจากแชร์ที่ต้องบันทึกให้เสร็จก่อน
 */
export function EditorSaveMenu({
  saving,
  shareDisabled,
  onSave,
  onExportPng,
  onExportJson,
  onShare,
}: EditorSaveMenuProps) {
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

  const runAction = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="editor-save-split">
      <button
        type="button"
        className="editor-topbar-primary editor-save-main"
        disabled={saving}
        onClick={onSave}
      >
        <Icon name="check" size={15} />
        <span>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</span>
      </button>
      <button
        ref={triggerRef}
        type="button"
        className="editor-topbar-primary editor-save-caret"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="เมนูส่งออกและแชร์"
        title="ส่งออกและแชร์"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="chevron-down" size={14} />
      </button>

      {open && (
        <div className="editor-save-menu" role="menu" aria-label="ส่งออกและแชร์">
          <button
            type="button"
            role="menuitem"
            className="editor-save-menu-item"
            onClick={() => runAction(onExportPng)}
          >
            <span className="editor-save-menu-icon" aria-hidden="true"><Icon name="image" size={15} /></span>
            <span>ส่งออกเป็นภาพ PNG</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="editor-save-menu-item"
            onClick={() => runAction(onExportJson)}
          >
            <span className="editor-save-menu-icon" aria-hidden="true"><Icon name="layers" size={15} /></span>
            <span>ส่งออกไฟล์งาน JSON</span>
          </button>

          <div className="editor-save-menu-divider" />

          <button
            type="button"
            role="menuitem"
            className="editor-save-menu-item"
            disabled={shareDisabled}
            onClick={() => runAction(onShare)}
          >
            <span className="editor-save-menu-icon" aria-hidden="true"><Icon name="arrow-up-right" size={15} /></span>
            <span>แชร์ลงชุมชน</span>
          </button>
        </div>
      )}
    </div>
  )
}
