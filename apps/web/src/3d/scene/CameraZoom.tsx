import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'
import { MAX_DISTANCE, MIN_DISTANCE } from './cameraPresets.ts'

interface Controls {
  target: Vector3
  update: () => void
}

/** หนึ่งครั้งที่กด = ระยะกล้องเปลี่ยน 25% — พอให้รู้สึกว่าขยับ แต่ไม่กระโดดจนหลงทาง */
const STEP = 0.75

/** ค่าหน่วงเดียวกับ NailFocus เพื่อให้การเคลื่อนกล้องทั้งสองแบบรู้สึกเป็นตัวเดียวกัน */
const DAMPING = 12

const SETTLED = 1e-4

/**
 * ปุ่มซูมบนหน้าจอ
 *
 * ปุ่มเป็น HTML อยู่นอก Canvas จึงแตะกล้องเองไม่ได้ — ส่งคำขอผ่าน store แทน
 * แบบเดียวกับที่ NailFocus รับคำสั่ง "จ่อเล็บ" ทำให้มีทางเข้าถึงกล้องทางเดียว
 */
export function CameraZoom() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const controls = useThree((state) => state.controls) as Controls | null
  const zoom = useDesign((state) => state.zoom)
  const clearZoom = useDesign((state) => state.clearZoom)
  const focus = useDesign((state) => state.focus)
  const goal = useRef<number | null>(null)

  // มีคนขอจ่อเล็บหรือกลับไปมองทั้งมือ = ยกเลิกการซูมที่ค้างอยู่
  //
  // zoomBy เคลียร์ focus ให้อยู่แล้ว แต่ทางกลับกันไม่มี — ปุ่มเลือกนิ้วกับ "ดูทั้งมือ"
  // เป็น HTML นอก Canvas จึงไม่ทริกเกอร์ pointerdown ที่ใช้ยกเลิกด้านล่าง ผลคือ
  // NailFocus กับตัวนี้เขียน camera.position ในเฟรมเดียวกันทั้งคู่
  useEffect(() => {
    if (focus) goal.current = null
  }, [focus])

  // ผู้ใช้แตะฉากเมื่อไรยกเลิกทันที — เหตุผลเดียวกับ NailFocus: การควบคุมด้วยมือ
  // ต้องชนะเสมอ ไม่ใช่กล้องเคลื่อนสู้กับคน
  useEffect(() => {
    const canvas = gl.domElement
    const cancel = () => { goal.current = null }
    canvas.addEventListener('pointerdown', cancel)
    canvas.addEventListener('wheel', cancel, { passive: true })
    return () => {
      canvas.removeEventListener('pointerdown', cancel)
      canvas.removeEventListener('wheel', cancel)
    }
  }, [gl])

  useEffect(() => {
    if (!zoom || !controls) return
    const distance = camera.position.distanceTo(controls.target)
    const scaled = zoom.direction === 1 ? distance * STEP : distance / STEP
    goal.current = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, scaled))
    clearZoom()
  }, [zoom, controls, camera, clearZoom])

  useFrame((_, delta) => {
    const destination = goal.current
    if (destination === null || !controls) return

    const offset = camera.position.clone().sub(controls.target)
    const current = offset.length()
    if (current < 1e-6) {
      goal.current = null
      return
    }

    const step = 1 - Math.exp(-DAMPING * delta)
    const next = current + (destination - current) * step
    camera.position.copy(controls.target).add(offset.multiplyScalar(next / current))
    controls.update()

    if (Math.abs(next - destination) < SETTLED) goal.current = null
  })

  return null
}
