import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'

export interface ThumbnailCaptureHandle {
  capture: () => Promise<Blob>
}

// > 500ms ที่ NailFocus.tsx ใช้ถึง ~99.75% ของระยะทางกล้อง (exponential damping,
// k=12: 1 - exp(-12 × 0.5) ≈ 0.9975) ไม่ขึ้นกับระยะเริ่มต้นของกล้อง — ดู
// docs/superpowers/specs/2026-08-15-thumbnail-design.md §4.1
const SETTLE_TIMEOUT_MS = 800

function waitForCameraSettled(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, SETTLE_TIMEOUT_MS))
  })
}

/**
 * Component ลูกใน <NailScene> — ไม่ render อะไรเอง แค่ expose ฟังก์ชัน capture ผ่าน ref
 * ให้ component นอก R3F tree (เช่น NailEditor.tsx) เรียกได้ (แพทเทิร์นเดียวกับที่
 * NailFocus.tsx ใช้ useThree เพื่อเข้าถึง canvas/renderer จากใน scene tree)
 */
export const ThumbnailCapture = forwardRef<ThumbnailCaptureHandle>((_props, ref) => {
  const gl = useThree((state) => state.gl)
  const focusHome = useDesign((state) => state.focusHome)

  useImperativeHandle(ref, () => ({
    capture: async () => {
      focusHome()
      await waitForCameraSettled()
      const canvas = gl.domElement
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.85)
      })
      if (!blob) throw new Error('สร้างภาพตัวอย่างไม่สำเร็จ')
      return blob
    },
  }), [gl, focusHome])

  return null
})
ThumbnailCapture.displayName = 'ThumbnailCapture'