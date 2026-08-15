import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import type { NailKey, Point } from '@nail-studio/contracts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { createDabAccumulator, settingsToStroke, type DabAccumulator } from './brush.ts'
import type { NailTextureSet } from './NailTextureSet.ts'
import { pickNail, pointerToNdc } from './picking.ts'
import { simplifyPath } from './simplify.ts'

interface Props {
  parts: HandParts
  textures: NailTextureSet
}

/** ชื่อเจ้าของเส้น — แยกจากแผงวาด 2 มิติที่ใช้แคนวาสเส้นสดใบเดียวกัน */
const OWNER = '3d'

/**
 * ต่อ pointer event เข้ากับระบบวาด
 *
 * component นี้ตั้งใจให้ "ไม่มีการตัดสินใจ" อยู่ในตัวเอง — กฎการเล็งเป้าอยู่ใน
 * picking.ts กฎการสร้างแต้มอยู่ใน brush.ts กฎการเก็บอยู่ใน store สิ่งที่เหลือ
 * ตรงนี้คือการต่อสายและการจัดการวงจรชีวิตของเส้นหนึ่งเส้น
 *
 * อ่านค่าจาก store ด้วย getState() ไม่ใช่ subscribe เพราะทุกค่าที่ใช้ถูกอ่าน
 * ณ ตอนที่ event เกิดเท่านั้น การ subscribe จะทำให้ effect นี้ผูก/ถอด listener ใหม่
 * ทุกครั้งที่ผู้ใช้ขยับสไลเดอร์ ซึ่งอาจตัดเส้นที่กำลังลากค้างอยู่ทิ้ง
 */
export function PaintController({ parts, textures }: Props) {
  const store = useDesignStoreApi()
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    // ใส่ mesh มือเข้าไปด้วย ไม่งั้นรังสีจะทะลุนิ้วที่บังอยู่ไปโดนหลังเล็บที่มองไม่เห็น
    const targets = [...parts.nails.values(), ...parts.occluders]

    let painting: NailKey | null = null
    let points: Point[] = []
    let strokeSettings: ReturnType<typeof store.getState>['settings'] | null = null
    let dabs: DabAccumulator | null = null

    const hit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const screen = pointerToNdc(event.clientX, event.clientY, rect)
      ndc.set(screen.x, screen.y)
      raycaster.setFromCamera(ndc, camera)
      return pickNail(
        raycaster.intersectObjects(targets, false),
        parts.nailOf,
        // เมาส์รายงานแรงกดเป็น 0 เสมอ ซึ่งจะทำให้แปรงเล็กผิดปกติ
        event.pressure > 0 ? event.pressure : 0.5,
      )
    }

    /** ส่งเฉพาะแต้มที่ยังไม่เคยส่ง — ไม่งั้นส่วนต้นของเส้นจะถูกทับซ้ำจนสีเข้มขึ้นเรื่อย ๆ */
    const emit = (point: Point) => {
      const settings = strokeSettings
      const fresh = dabs?.append(point) ?? []
      if (!settings || fresh.length === 0) return
      textures.paintDabs(
        fresh,
        settings.tool === 'erase' ? '#000000' : settings.color,
        settings.softness,
      )
    }

    const finish = (event: PointerEvent, commit: boolean) => {
      // ปิดเส้นฝั่งเท็กซ์เจอร์ก่อนเสมอ ไม่ผูกกับเงื่อนไขใด ๆ
      //
      // สถานะ "กำลังลากเส้น" ถูกเก็บสองที่ (ตัวแปรของ controller กับใน NailTextureSet)
      // ถ้าสองฝั่งหลุดจากกันเมื่อไร แล้วการปิดเส้นดันไปขึ้นกับฝั่ง controller
      // เท็กซ์เจอร์จะค้างสถานะลากอยู่ตลอดไป แล้ว beginStroke ครั้งต่อ ๆ ไปจะถูกปฏิเสธหมด
      // ผลคือ "วาดไม่ได้อีกเลยจนกว่าจะรีโหลด" โดยไม่มีข้อความผิดพลาดใด ๆ ให้ผู้ใช้เห็น
      // — เป็นความล้มเหลวแบบที่ผู้ใช้ไม่มีทางรู้สาเหตุและกู้เองไม่ได้ จึงต้องกันไว้ที่นี่
      textures.endStroke(OWNER)
      if (!painting) return
      if (commit && points.length > 0) {
        store.getState().addStroke(settingsToStroke(
          strokeSettings ?? store.getState().settings,
          simplifyPath(points),
        ))
      }
      painting = null
      points = []
      strokeSettings = null
      dabs?.reset()
      dabs = null
      if (controls) controls.enabled = true
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // pointer อาจถูกปล่อยไปแล้วโดยเบราว์เซอร์ — ไม่ใช่ความผิดพลาดที่ต้องแจ้ง
        }
      }
    }

    const onDown = (event: PointerEvent) => {
      if (painting) return
      // ถ้าเส้นที่ค้างอยู่เป็น "ของเราเอง" แปลว่าเส้นก่อนหน้าจบไม่สมบูรณ์ — เก็บกวาดแล้วไปต่อ
      // ดีกว่าปฏิเสธจนผู้ใช้วาดไม่ได้อีกเลย ส่วนเส้นของแผง 2 มิติที่กำลังลากอยู่ต้องไม่ไปแตะ
      if (textures.strokeOwner() === OWNER) textures.endStroke(OWNER)
      if (textures.isPainting()) return
      const target = hit(event)
      if (!target) return

      const state = store.getState()
      // แตะเล็บที่ยังไม่ได้เลือก = เลือกนิ้วนั้นแทน ส่วนการกดค้าง Shift คือเลือกเพิ่ม
      if (!state.selection.has(target.key)) {
        state.selectNail(target.key, event.shiftKey ? 'toggle' : 'replace')
      }
      const paintState = store.getState()
      // เลเยอร์ที่ซ่อนหรือเต็มแล้วต้องหยุดตั้งแต่ตรงนี้ พร้อมข้อความบอกเหตุผล
      // ไม่ใช่ปล่อยให้ลากจนจบแล้วค่อยพบว่าไม่มีอะไรปรากฏบนเล็บ
      const layerIndexes = paintState.beginPaint()
      if (!layerIndexes) return
      if (!textures.beginStroke(
        paintState.selection,
        layerIndexes,
        paintState.settings.tool === 'erase',
        OWNER,
      )) {
        return
      }

      painting = target.key
      points = [target.point]
      strokeSettings = paintState.settings
      dabs = createDabAccumulator(strokeSettings)
      // ปิดการหมุนกล้องระหว่างลาก ไม่งั้นเส้นจะเบี้ยวเพราะฉากขยับไปพร้อมนิ้ว
      if (controls) controls.enabled = false
      // การจับ pointer ล้มเหลวได้จริง (pointer ถูกจับไว้ที่อื่น หรือถูกยกเลิกไปแล้ว)
      // ปล่อยให้ข้อผิดพลาดหลุดออกไปไม่ได้ เพราะจะข้ามบรรทัดที่เหลือแล้วทิ้งกล้องไว้
      // ในสถานะหมุนไม่ได้ถาวร — เสียหายกว่าการวาดเส้นนี้ไม่ได้มาก
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ไม่มี capture ก็ยังวาดได้ เพียงแต่ลากออกนอกแคนวาสแล้วเส้นจะจบเอง
      }
      emit(target.point)
    }

    const onMove = (event: PointerEvent) => {
      if (!painting) return
      const target = hit(event)
      // ลากออกนอกเล็บที่เริ่มไว้แล้วเงียบไว้ ไม่ใช่จบเส้น — ผู้ใช้ลากกลับเข้ามาต่อได้
      if (!target || target.key !== painting) return
      points.push(target.point)
      emit(target.point)
    }

    const onUp = (event: PointerEvent) => finish(event, true)
    const onCancel = (event: PointerEvent) => finish(event, false)

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('lostpointercapture', onCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('lostpointercapture', onCancel)
      // ถอด listener ระหว่างที่ยังลากค้างอยู่ต้องไม่ทิ้งเส้นสดค้างบนแคนวาส
      if (painting) textures.endStroke()
    }
  }, [gl, camera, controls, parts, textures, store])

  return null
}
