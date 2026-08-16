import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import type { NailKey } from '@nail-studio/contracts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { pickNail, pointerToNdc, type Hit } from '@/3d/painting/picking.ts'
import type { Pt2 } from '@/3d/geometry/hull.ts'
import { computeNailHulls } from '@/3d/geometry/nailHulls.ts'
import { isPointInHull } from '@/3d/geometry/pointInHull.ts'
import { nearestDecoration } from '@/3d/decorations/decorationPicking.ts'

interface Props {
  parts: HandParts
}

/**
 * ต่อ pointer event เข้ากับการเลือก/ย้ายของตกแต่ง — ทำงานเฉพาะโหมด "ของตกแต่ง"
 *
 * เลือก: pointer-down หาเล็บที่โดนด้วย pipeline เดียวกับการวาด (pickNail) แล้วหาของ
 * ตกแต่งที่ใกล้จุด UV นั้นที่สุด (nearestDecoration) ถ้าเจอ = เริ่มลากทันทีในท่าเดียวกัน
 * ถ้าไม่เจอ = ยกเลิกการเลือกเดิม (คลิกพื้นที่ว่าง)
 *
 * ย้าย: pointer-move คำนวณ UV ใหม่จากเล็บเดิม ถ้าจุดใหม่หลุดนอกรูปเล็บ (isPointInHull
 * ปฏิเสธ) ค้างตำแหน่งเดิมไว้เฉย ๆ ไม่ commit ความเปลี่ยนแปลงของจุดนั้น — ผู้ใช้ลากกลับ
 * เข้ามาต่อได้ตามปกติในจังหวะถัดไป เหมือนที่ PaintController ทำกับเส้นวาดที่ลากออก
 * นอกเล็บ
 *
 * hull ของแต่ละเล็บคำนวณครั้งเดียวตอน parts พร้อม (A-01 เป็น preprocessing ที่ไม่ควร
 * รันซ้ำทุก pointermove) และไม่เปลี่ยนแม้ทรง/ความยาวเล็บจะเปลี่ยน เพราะ UV ไม่ได้ขยับ
 * ตาม morph target (มีแต่ position/normal ที่ขยับ — ดู nailMorph.ts)
 */
export function TransformController({ parts }: Props) {
  const store = useDesignStoreApi()
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const hullsRef = useRef<Map<NailKey, Pt2[]>>(new Map())

  useEffect(() => {
    hullsRef.current = computeNailHulls(parts)
  }, [parts])

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    const targets = [...parts.nails.values(), ...parts.occluders]

    let dragging: { key: NailKey; decorationId: string; mergeKey: string } | null = null

    const hit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const screen = pointerToNdc(event.clientX, event.clientY, rect)
      ndc.set(screen.x, screen.y)
      raycaster.setFromCamera(ndc, camera)
      const hits: Hit[] = raycaster.intersectObjects(targets, false).map((intersection) => ({
        object: intersection.object,
        uv: intersection.uv,
      }))
      return pickNail(hits, parts.nailOf, 1)
    }

    const onDown = (event: PointerEvent) => {
      if (store.getState().mode !== 'decorate') return
      if (dragging) return
      const target = hit(event)
      if (!target) {
        store.getState().selectDecoration(null)
        return
      }
      const decorations = store.getState().document.nails[target.key].decorations
      const found = nearestDecoration(decorations, target.point.x, target.point.y)
      if (!found) {
        store.getState().selectDecoration(null)
        return
      }
      store.getState().selectDecoration({ key: target.key, decorationId: found.id })
      dragging = { key: target.key, decorationId: found.id, mergeKey: `decoration-drag-${Date.now()}` }
      if (controls) controls.enabled = false
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ไม่มี capture ก็ยังลากได้ เพียงแต่ลากออกนอกแคนวาสแล้วจะจบเอง
      }
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging) return
      const target = hit(event)
      if (!target || target.key !== dragging.key) return
      const hull = hullsRef.current.get(dragging.key)
      if (hull && !isPointInHull(hull, { x: target.point.x, y: target.point.y })) return
      const decoration = store.getState().document.nails[dragging.key].decorations
        .find((item) => item.id === dragging!.decorationId)
      if (!decoration) return
      store.getState().moveDecoration(
        dragging.key, dragging.decorationId,
        target.point.x, target.point.y, decoration.rotation,
        dragging.mergeKey,
      )
    }

    const finish = (event: PointerEvent) => {
      dragging = null
      if (controls) controls.enabled = true
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // pointer อาจถูกปล่อยไปแล้วโดยเบราว์เซอร์
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
    }
  }, [gl, camera, controls, parts, store])

  return null
}
