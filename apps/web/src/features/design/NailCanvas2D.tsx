import { useEffect, useMemo, useRef } from 'react'
import { fingerOf, type NailKey, type Point } from '@nail-studio/contracts'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { settingsToDabs, settingsToStroke } from '@/3d/painting/brush.ts'
import { TEX_SIZE } from '@/3d/painting/constants.ts'
import { flattenNail, panelToTexture, textureToPanelTransform } from '@/3d/painting/nailFlatten.ts'
import type { NailTextureSet } from '@/3d/painting/NailTextureSet.ts'
import { simplifyPath } from '@/3d/painting/simplify.ts'
import { pixelToUv, toPaintPoint } from '@/3d/painting/uvMapping.ts'
import { primaryOf } from './designStore.ts'
import { useDesign, useDesignStoreApi } from './DesignStoreProvider.tsx'

interface Props {
  parts: HandParts
  textures: NailTextureSet
}

/** ขนาดที่วาดจริงของแผง — เล็กกว่าเท็กซ์เจอร์ได้ เพราะเป็นแค่การแสดงผล */
const VIEW = 512

/** ชื่อเจ้าของเส้น — แยกจากตัวควบคุมการวาดบนโมเดล 3 มิติ */
const OWNER = '2d'

/**
 * ขยายสามเหลี่ยมออกจากจุดกึ่งกลางเล็กน้อยก่อนตัดขอบ
 *
 * ถ้าตัดตามขอบพอดี รอยต่อระหว่างสามเหลี่ยมจะเหลือเส้นบางโปร่งใสคั่น เพราะการลบรอยหยัก
 * ทำให้พิกเซลริมขอบของทั้งสองฝั่งจางลงคนละครึ่ง ผลคือเห็นเป็นตาข่ายจาง ๆ ทั่วเล็บ
 */
const SEAM_BLEED = 0.5

const FINGER_LABELS: Record<string, string> = {
  thumb: 'โป้ง', index: 'ชี้', middle: 'กลาง', ring: 'นาง', little: 'ก้อย',
}

/**
 * แผงวาดแบบแบน — มองเล็บตรง ๆ แล้วกดให้แบน
 *
 * ทำไมต้องมีทั้งที่วาดบนโมเดล 3 มิติได้อยู่แล้ว: บนโมเดล เล็บกินพื้นที่จอไม่กี่สิบพิกเซล
 * และมีมุมกล้องมาบิดอีกชั้น การลากเส้นละเอียดจึงทำได้ยากมาก แผงนี้ให้พื้นที่เต็ม
 *
 * ทำไมไม่แสดงผืนเท็กซ์เจอร์ตรง ๆ: ผืนเท็กซ์เจอร์ถูกกางเต็มสี่เหลี่ยม การแสดงตรง ๆ
 * คือการยืดรูปเล็บให้เต็มจัตุรัส วงกลมที่วาดจะไปโผล่บนเล็บเป็นรูปรีที่บิดตามความโค้ง
 * แผงนี้จึงวาดผ่านการคลี่ (nailFlatten) ให้รูปบนแผงตรงกับรูปบนเล็บจริง
 *
 * สำคัญ: ทั้งสองโหมดเขียนลง **เอกสารงานชุดเดียวกัน** ผ่านเส้นทางเดียวกันทุกประการ
 * ไม่ใช่ระบบวาดคนละระบบที่ต้องคอยซิงก์กัน — ซึ่งเป็นข้อบกพร่องของซอร์สเดิม
 */
export function NailCanvas2D({ parts, textures }: Props) {
  const store = useDesignStoreApi()
  const selection = useDesign((state) => state.selection)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const activeKey: NailKey = primaryOf(selection)

  const flat = useMemo(() => {
    const mesh = parts.nails.get(activeKey)
    return mesh ? flattenNail(mesh, VIEW, TEX_SIZE) : null
  }, [parts, activeKey])

  // เก็บไว้ใน ref ให้ตัวจัดการ pointer อ่านค่าล่าสุดได้ โดยไม่ต้องผูก listener ใหม่
  // ทุกครั้งที่เปลี่ยนนิ้ว ซึ่งจะตัดเส้นที่กำลังลากค้างอยู่ทิ้ง
  const flatRef = useRef(flat)
  flatRef.current = flat

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !flat) return undefined

    const source = textures.composite(activeKey)
    const paint = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, VIEW, VIEW)
      for (const triangle of flat.triangles) {
        const transform = textureToPanelTransform(triangle)
        if (!transform) continue
        const [x0, y0, x1, y1, x2, y2] = triangle.screen
        const cx = (x0 + x1 + x2) / 3
        const cy = (y0 + y1 + y2) / 3
        const grow = (x: number, y: number): [number, number] => {
          const dx = x - cx
          const dy = y - cy
          const length = Math.hypot(dx, dy) || 1
          return [x + (dx / length) * SEAM_BLEED, y + (dy / length) * SEAM_BLEED]
        }
        ctx.save()
        ctx.beginPath()
        const [gx0, gy0] = grow(x0, y0)
        const [gx1, gy1] = grow(x1, y1)
        const [gx2, gy2] = grow(x2, y2)
        ctx.moveTo(gx0, gy0)
        ctx.lineTo(gx1, gy1)
        ctx.lineTo(gx2, gy2)
        ctx.closePath()
        ctx.clip()
        ctx.transform(...transform)
        ctx.drawImage(source, 0, 0)
        ctx.restore()
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    paint()
    return textures.onUpdate((key) => {
      if (key === activeKey) paint()
    })
  }, [textures, activeKey, flat])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let points: Point[] = []
    let emitted = 0
    let drawing = false

    const toPoint = (event: PointerEvent): Point | null => {
      const shape = flatRef.current
      if (!shape) return null
      const rect = canvas.getBoundingClientRect()
      // แผงถูกย่อด้วย CSS ได้ จึงต้องแปลงกลับเป็นพิกัดภายในของแคนวาสก่อนเสมอ
      const x = ((event.clientX - rect.left) / (rect.width || 1)) * VIEW
      const y = ((event.clientY - rect.top) / (rect.height || 1)) * VIEW
      const texel = panelToTexture(shape, x, y)
      if (!texel) return null
      const { u, v } = pixelToUv(texel.u, texel.v, TEX_SIZE)
      return toPaintPoint(u, v, event.pressure > 0 ? event.pressure : 0.5)
    }

    const emit = () => {
      const settings = store.getState().settings
      // ใช้ TEX_SIZE ไม่ใช่ VIEW — แต้มต้องอยู่ในพิกัดของเท็กซ์เจอร์จริง
      // ไม่ใช่พิกัดของแผงที่บังเอิญย่อไว้ ไม่งั้นเส้นจะเล็กลงตามขนาดแผง
      const dabs = settingsToDabs(points, settings, TEX_SIZE)
      const fresh = dabs.slice(emitted)
      emitted = dabs.length
      textures.paintDabs(
        fresh,
        settings.tool === 'erase' ? '#000000' : settings.color,
        settings.softness,
      )
    }

    const finish = (event: PointerEvent, commit: boolean) => {
      textures.endStroke(OWNER)
      if (!drawing) return
      drawing = false
      if (commit && points.length > 0) {
        store.getState().addStroke(settingsToStroke(store.getState().settings, simplifyPath(points)))
      }
      points = []
      emitted = 0
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // เบราว์เซอร์อาจปล่อยไปแล้ว — ไม่ใช่ความผิดพลาดที่ต้องแจ้ง
        }
      }
    }

    const onDown = (event: PointerEvent) => {
      if (drawing) return
      if (textures.strokeOwner() === OWNER) textures.endStroke(OWNER)
      if (textures.isPainting()) return
      const point = toPoint(event)
      // แตะนอกรูปเล็บไม่เริ่มเส้น — นอกรูปเล็บไม่มีผิวให้ทา
      if (!point) return
      const state = store.getState()
      if (!textures.beginStroke(
        state.selection, state.activeLayerIndex, state.settings.tool === 'erase', OWNER,
      )) {
        return
      }
      drawing = true
      points = [point]
      emitted = 0
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ไม่มี capture ก็ยังวาดได้ เพียงแต่ลากออกนอกแผงแล้วเส้นจะจบเอง
      }
      emit()
    }

    const onMove = (event: PointerEvent) => {
      if (!drawing) return
      const point = toPoint(event)
      // ลากเลยขอบเล็บแล้วเงียบไว้ ไม่ใช่จบเส้น — ผู้ใช้ลากกลับเข้ามาต่อได้
      if (!point) return
      points.push(point)
      emit()
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
      if (drawing) textures.endStroke(OWNER)
    }
  }, [store, textures])

  const label = FINGER_LABELS[fingerOf(activeKey)] ?? activeKey

  return (
    <aside className="canvas2d-panel" aria-label="แผงวาดแบบแบน">
      <p className="canvas2d-title">
        นิ้ว{label}
        {selection.size > 1 ? ` · ลงพร้อมกัน ${selection.size} นิ้ว` : ''}
      </p>
      <canvas
        ref={canvasRef}
        width={VIEW}
        height={VIEW}
        className="canvas2d"
        aria-label={`พื้นที่วาดเล็บนิ้ว${label}`}
      />
      <p className="hint">รูปบนแผงตรงกับรูปบนเล็บจริง วาดนอกรูปเล็บจะไม่ติด</p>
    </aside>
  )
}
