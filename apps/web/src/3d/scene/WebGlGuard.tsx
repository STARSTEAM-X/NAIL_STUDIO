import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'

/**
 * ตรวจว่าเบราว์เซอร์รองรับ WebGL และดักข้อผิดพลาดของฉาก 3D
 *
 * ต้องมีทั้งสองอย่าง: เครื่องที่ไม่รองรับ WebGL เลย (ตรวจล่วงหน้าได้) กับเครื่องที่
 * รองรับแต่สร้าง context ไม่สำเร็จตอนใช้งานจริง (ดักได้เฉพาะตอนเกิด)
 * ถ้าไม่ดัก ผู้ใช้จะเห็นหน้าขาวโดยไม่รู้สาเหตุ ซึ่งขัดเกณฑ์ P2
 */
function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    // เบราว์เซอร์จำกัดจำนวน WebGL context ที่เปิดพร้อมกัน (ราว 16) และ StrictMode
    // เรียกฟังก์ชันนี้สองรอบต่อการ mount — ต้องคืน context ที่ใช้แค่ตรวจว่ารองรับไหม
    // ไม่งั้นฉากจริงอาจสร้าง context ไม่ได้
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[3d] ฉากล้มเหลว', error, info.componentStack)
    this.props.onError(error.message)
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}

export function WebGlGuard({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const hasWebGl = useMemo(supportsWebGl, [])

  if (!hasWebGl) {
    return (
      <div className="center stack">
        <p className="error">เบราว์เซอร์นี้ไม่รองรับ WebGL จึงแสดงโมเดล 3 มิติไม่ได้</p>
        <p className="muted">ลองใช้ Chrome, Edge หรือ Firefox รุ่นล่าสุด</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="center stack">
        <p className="error">แสดงฉาก 3 มิติไม่สำเร็จ — {error}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setError(null)
            setAttempt((value) => value + 1)
          }}
        >
          ลองใหม่
        </button>
      </div>
    )
  }

  // key บังคับให้สร้างฉากใหม่ทั้งก้อนตอนกดลองใหม่ ไม่ใช่ใช้ของเดิมที่พังไปแล้ว
  return (
    <SceneBoundary key={attempt} onError={setError}>
      {children}
    </SceneBoundary>
  )
}
