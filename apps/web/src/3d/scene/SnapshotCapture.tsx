import { forwardRef, useImperativeHandle } from 'react'
import { useThree } from '@react-three/fiber'

export interface SnapshotCaptureHandle {
  capture: () => Promise<Blob>
}

/**
 * เปิดฟังก์ชันจับภาพจาก canvas ให้ editor เรียกใช้ โดยรักษามุมกล้องที่ผู้ใช้กำลังดูอยู่
 */
export const SnapshotCapture = forwardRef<SnapshotCaptureHandle>((_props, ref) => {
  const gl = useThree((state) => state.gl)

  useImperativeHandle(ref, () => ({
    capture: async () => {
      const blob = await new Promise<Blob | null>((resolve) => {
        gl.domElement.toBlob(resolve, 'image/png')
      })
      if (!blob) throw new Error('สร้างภาพไม่สำเร็จ')
      return blob
    },
  }), [gl])

  return null
})
SnapshotCapture.displayName = 'SnapshotCapture'
