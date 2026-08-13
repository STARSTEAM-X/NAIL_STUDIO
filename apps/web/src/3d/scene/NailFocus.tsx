import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'
import { HOME_POSITION, HOME_TARGET } from './cameraPresets.ts'
import { cameraForNail, nailViewOf } from './nailViews.ts'

interface Props {
  parts: HandParts
}

interface Controls {
  target: Vector3
  update: () => void
}

/** ค่าหน่วงต่อวินาที เลือกให้เข้าที่ราว 0.4 วิ: 1 - exp(-k × 0.4) ใกล้ 1 เมื่อ k = 12 */
const DAMPING = 12

/** เข้าใกล้กว่านี้ถือว่าถึงแล้ว หยุดขยับเพื่อไม่ให้ค้างคำนวณทุกเฟรมตลอดไป */
const SETTLED = 1e-4

/**
 * พากล้องไปจ่อเล็บที่เลือก
 *
 * ทำไมต้องมี: ที่ระยะมองทั้งมือ เล็บหนึ่งนิ้วกินพื้นที่จอเพียงไม่กี่พิกเซล ซึ่งเล็ก
 * เกินกว่าจะวาดลายละเอียดได้จริง การจ่อจึงไม่ใช่ลูกเล่น แต่เป็นเงื่อนไขที่ทำให้
 * เครื่องมือวาดใช้งานได้
 *
 * ระยะจ่อคำนวณจากรัศมีจริงของเล็บแต่ละนิ้ว ไม่ใช่ค่าคงที่ตัวเดียว เพราะเล็บก้อย
 * เล็กกว่าเล็บโป้งมาก ถ้าใช้ระยะเดียวกันทุกนิ้ว เล็บก้อยจะเล็กกว่าเพื่อนในเฟรม
 */
export function NailFocus({ parts }: Props) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controls = useThree((state) => state.controls) as Controls | null
  const focus = useDesign((state) => state.focus)
  const clearFocus = useDesign((state) => state.clearFocus)
  const goal = useRef<{ position: Vector3; target: Vector3 } | null>(null)

  useEffect(() => {
    if (!focus) return
    if (focus.kind === 'home') {
      goal.current = {
        position: new Vector3(...HOME_POSITION),
        target: new Vector3(...HOME_TARGET),
      }
      return
    }
    const mesh = parts.nails.get(focus.key)
    if (!mesh) return
    try {
      const view = nailViewOf(mesh)
      goal.current = {
        position: cameraForNail(view, (camera as { fov?: number }).fov ?? 35),
        target: view.center.clone(),
      }
    } catch (error) {
      // คำนวณมุมมองไม่ได้ = โมเดลไม่ตรงกับที่ pipeline รับปากไว้ ซึ่งควรรู้
      // แต่ต้องไม่ทำให้ทั้งฉากล่ม เพราะการจ่อเป็นความสะดวก ไม่ใช่แกนของการวาด
      console.error('[3d] คำนวณมุมมองเล็บไม่ได้', focus.key, error)
    }
  }, [focus, parts, camera])

  // ผู้ใช้แตะเมื่อไรยกเลิกทันที การหมุนด้วยมือต้องชนะเสมอ ไม่ใช่กล้องดึงกลับสู้กับคน
  useEffect(() => {
    const canvas = gl.domElement
    const cancel = () => {
      goal.current = null
      clearFocus()
    }
    canvas.addEventListener('pointerdown', cancel)
    canvas.addEventListener('wheel', cancel, { passive: true })
    return () => {
      canvas.removeEventListener('pointerdown', cancel)
      canvas.removeEventListener('wheel', cancel)
    }
  }, [gl, clearFocus])

  useFrame((_, delta) => {
    const destination = goal.current
    if (!destination || !controls) return
    // หน่วงแบบขึ้นกับเวลาจริง ไม่ใช่ต่อเฟรม — ความเร็วการเคลื่อนกล้องจะได้ไม่ขึ้น
    // กับ fps ของเครื่อง (เครื่องเร็วจะไม่จ่อเสร็จก่อนเครื่องช้า)
    const step = 1 - Math.exp(-DAMPING * delta)
    camera.position.lerp(destination.position, step)
    controls.target.lerp(destination.target, step)
    controls.update()
    const settled = camera.position.distanceTo(destination.position) < SETTLED
      && controls.target.distanceTo(destination.target) < SETTLED
    if (settled) {
      camera.position.copy(destination.position)
      controls.target.copy(destination.target)
      controls.update()
      goal.current = null
    }
  })

  return null
}
