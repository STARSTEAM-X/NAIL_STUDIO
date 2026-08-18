import { Button } from './Button.tsx'
import { Dialog } from './Dialog.tsx'

interface ConfirmDialogProps {
  title: string
  /** อธิบายผลลัพธ์ให้ชัด โดยเฉพาะเมื่อกู้คืนไม่ได้ */
  message: string
  confirmLabel?: string | undefined
  cancelLabel?: string | undefined
  /** ใช้ปุ่มสีอันตรายเมื่อการกระทำนี้ย้อนกลับไม่ได้ */
  destructive?: boolean | undefined
  pending?: boolean | undefined
  onConfirm: () => void
  onCancel: () => void
}

/**
 * กล่องยืนยันของแอป — แทน window.confirm
 *
 * window.confirm บล็อก main thread ปรับข้อความไม่ได้ และหน้าตาไม่ตรงกับแอป
 * ที่สำคัญกว่าคือมันบอกได้แค่ข้อความเดียว จึงอธิบายผลลัพธ์ที่ซับซ้อน
 * (เช่น "งานนี้มี 5 เวอร์ชันที่จะถูกลบด้วย") ไม่ได้
 */
export function ConfirmDialog({
  title, message, confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก',
  destructive, pending, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={pending ? undefined : onCancel}
      dismissible={!pending}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={pending}
            loadingLabel="กำลังดำเนินการ…"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ui-confirm-message">{message}</p>
    </Dialog>
  )
}
