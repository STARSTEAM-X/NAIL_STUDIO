import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from '../Icon.tsx'

interface DialogProps {
  title: string
  /** คำอธิบายใต้หัวข้อ — ผูกกับ aria-describedby ให้อัตโนมัติ */
  description?: string | undefined
  /** ปิดไม่ได้ระหว่างที่งานกำลังทำอยู่ หรือเมื่อผู้ใช้ต้องเลือกอย่างใดอย่างหนึ่ง */
  onClose?: (() => void) | undefined
  /** ซ่อนปุ่มปิดสำหรับ dialog ที่บังคับให้ตัดสินใจ เช่น เวอร์ชันชนกัน */
  dismissible?: boolean | undefined
  size?: 'sm' | 'md' | 'lg' | undefined
  children: ReactNode
  footer?: ReactNode | undefined
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog กลางของแอป
 *
 * เดิมมี dialog สามตัว (Conflict, Recovery, ShareTemplate) ที่ประกาศ aria-modal="true"
 * แต่ไม่มีตัวไหนดักโฟกัสหรือปิดด้วย Escape ได้ — เท่ากับบอก screen reader
 * ในสิ่งที่ไม่จริง เพราะผู้ใช้ยัง tab หลุดออกไปหลัง dialog ได้
 *
 * ตัวนี้จัดการสามอย่างที่ dialog ทุกตัวต้องทำเหมือนกัน:
 *   1. ย้ายโฟกัสเข้ามาเมื่อเปิด และคืนกลับที่เดิมเมื่อปิด
 *   2. วน Tab อยู่ภายใน dialog
 *   3. ปิดด้วย Escape (เมื่ออนุญาต)
 */
export function Dialog({
  title, description, onClose, dismissible = true, size = 'md', children, footer,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible && onClose) {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.offsetParent !== null)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && (active === firstItem || active === panel)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [dismissible, onClose])

  return (
    <div
      className="ui-dialog-backdrop"
      onPointerDown={(event) => {
        if (dismissible && onClose && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`ui-dialog ui-dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ui-dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          {dismissible && onClose && (
            <button type="button" className="ui-dialog-close" aria-label="ปิด" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          )}
        </header>
        <div className="ui-dialog-body">{children}</div>
        {footer && <footer className="ui-dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}
