import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * กันจอขาวทั้งหน้า
 *
 * ก่อนหน้านี้ error ที่ไม่ถูกจับในคอมโพเนนต์ใดก็ตามจะทำให้ React ถอด tree ทั้งหมดออก
 * ผู้ใช้เห็นหน้าขาวเปล่าโดยไม่รู้ว่าเกิดอะไรขึ้นและทำอะไรต่อไม่ได้
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary] คอมโพเนนต์ล้มเหลว', error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="nc-state nc-state-error app-crash" role="alert">
        <span className="nc-state-icon" aria-hidden="true"><Icon name="alert" size={22} /></span>
        <h3>หน้านี้ทำงานผิดพลาด</h3>
        <p>ระบบไม่สามารถแสดงเนื้อหาส่วนนี้ได้ ลองโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหาให้กลับไปหน้าหลัก</p>
        <div className="nc-state-actions">
          <button type="button" className="ui-btn ui-btn-primary ui-btn-md" onClick={() => window.location.reload()}>
            โหลดหน้าใหม่
          </button>
          <a href="/projects" className="ui-btn ui-btn-ghost ui-btn-md">กลับไปงานของฉัน</a>
        </div>
      </div>
    )
  }
}
