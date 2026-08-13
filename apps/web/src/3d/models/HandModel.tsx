import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Material } from 'three'
import { EDITABLE_HAND } from '@/features/design/designStore.ts'
import { buildPartsRegistry, type HandParts } from './PartsRegistry.ts'

export const HAND_MODEL_URL = '/models/hand.glb'

interface Props {
  onReady: (parts: HandParts) => void
  scale?: number
}

/**
 * โหลดโมเดลมือแล้วส่ง registry ของชิ้นส่วนออกไป
 *
 * ตอนนี้แสดงมือขวาข้างเดียว (ดู EDITABLE_HAND) — การแสดงมือซ้ายด้วยการกลับด้านโมเดล
 * ถูกถอดออกไปก่อน เหตุผลและวิธีทำที่ประเมินไว้อยู่ใน architecture.md D-23
 */
export function HandModel({ onReady, scale = 1 }: Props) {
  const { scene } = useGLTF(HAND_MODEL_URL)

  // useGLTF แคช scene ก้อนเดิมไว้ พอ component remount (กด retry หลัง WebGL error
  // หรือ fast refresh) memo ด้านล่างจะ clone material ทับของที่ตัวเองเคย clone ไว้
  // ถ้าไม่ทิ้งอันเก่า GPU จะค้าง texture/program ของ clone เดิมไว้ทุกรอบที่ retry
  const clonedSkin = useRef<Material | null>(null)
  // ต้นฉบับจาก GLTF — ต้อง clone จากตัวนี้เสมอ
  //
  // ถ้า clone จาก skin.material ที่อยู่บน mesh ตอนนั้น รอบที่สองจะเป็นการ clone
  // จาก clone รอบแรกที่เพิ่งถูก dispose ไป ผลคือได้วัสดุที่เท็กซ์เจอร์ถูกคืนไปแล้ว
  // แล้วมือทั้งข้างกลายเป็นสีดำ
  const originalSkin = useRef<Material | null>(null)

  const parts = useMemo<HandParts>(() => {
    const registry = buildPartsRegistry(scene, EDITABLE_HAND)
    originalSkin.current ??= registry.skin.material as Material
    const previous = clonedSkin.current
    const cloned = originalSkin.current.clone()
    clonedSkin.current = cloned
    registry.skin.material = cloned
    if (previous) previous.dispose()
    return registry
  }, [scene])

  useEffect(() => {
    onReady(parts)
  }, [parts, onReady])

  useEffect(() => () => {
    const material = clonedSkin.current
    if (material) {
      material.dispose()
      clonedSkin.current = null
    }
  }, [])

  return <primitive object={scene} scale={[scale, scale, scale]} />
}

useGLTF.preload(HAND_MODEL_URL)

export type { HandParts }
