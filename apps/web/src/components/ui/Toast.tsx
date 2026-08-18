import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../Icon.tsx'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONE_ICONS: Record<ToastTone, IconName> = { success: 'check', error: 'alert', info: 'sparkle' }
const DISMISS_MS = 4500

/**
 * ข้อความยืนยันชั่วคราว
 *
 * เดิมข้อความอย่าง "บันทึกโปรไฟล์แล้ว" หรือ "ส่งคำขอนัดหมายแล้ว" ถูกฝังไว้ในหน้าแบบถาวร
 * ผู้ใช้ต้องมองหาเองว่ามันโผล่ตรงไหน และมันไม่หายไปจนกว่าจะเปลี่ยนหน้า
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = (nextId.current += 1)
    setToasts((current) => [...current, { id, tone, message }])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="ui-toast-viewport" role="region" aria-label="การแจ้งเตือนของระบบ">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.id])

  return (
    <div className={`ui-toast ui-toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon name={TONE_ICONS[toast.tone]} size={16} />
      <span>{toast.message}</span>
      <button type="button" aria-label="ปิดข้อความ" onClick={() => onDismiss(toast.id)}>
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}

/**
 * เรียกใช้ toast จากคอมโพเนนต์ใดก็ได้
 * คืน API เปล่าเมื่ออยู่นอก provider เพื่อให้เทสที่ render คอมโพเนนต์เดี่ยวๆ ไม่ล้ม
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  return context ?? { success: () => {}, error: () => {}, info: () => {} }
}
