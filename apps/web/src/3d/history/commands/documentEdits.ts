import type { DesignDocument, Layer, Nail, NailKey } from '@nail-studio/contracts'
import type { CommandResult } from '../Command.ts'

/**
 * เครื่องมือร่วมของทุกคำสั่งที่แก้เอกสารงาน
 *
 * ทุกตัวในไฟล์นี้รักษาข้อตกลงเดียวกัน: **ไม่เปลี่ยนอะไรก็ต้องคืน object เดิม**
 * ไม่ใช่ object ใหม่ที่มีค่าเท่ากัน เพราะทั้งระบบตัดสินใจด้วย identity —
 * `HistoryStack` ใช้รู้ว่าคำสั่งทำงานได้จริงไหม (`recorded` / `applied`)
 * และ `useNailTextures` ใช้รู้ว่าเล็บนิ้วไหนต้องวาดใหม่ ถ้าเผลอคืน object ใหม่
 * ทุกครั้ง ประวัติจะบันทึกรายการเปล่า และเท็กซ์เจอร์จะถูกสร้างใหม่ทั้งมือทุกครั้ง
 */

export const NO_AFFECTS: ReadonlySet<NailKey> = new Set<NailKey>()

export function result(document: DesignDocument, key: NailKey, changed: boolean): CommandResult {
  return { document, affects: changed ? new Set([key]) : NO_AFFECTS }
}

/** แทนที่เล็บหนึ่งนิ้ว โดยเล็บนิ้วอื่นคง identity เดิมไว้ทุกนิ้ว */
export function replaceNail(
  document: DesignDocument,
  key: NailKey,
  update: (nail: Nail) => Nail,
): CommandResult {
  const current = document.nails[key]
  const next = update(current)
  if (next === current) return result(document, key, false)
  return result({ ...document, nails: { ...document.nails, [key]: next } }, key, true)
}

/** แทนที่เลเยอร์หนึ่งชั้นในเล็บ — หาไม่เจอถือว่าไม่เปลี่ยนอะไร ไม่ใช่ข้อผิดพลาด */
export function replaceLayer(
  nail: Nail,
  layerId: string,
  update: (layer: Layer) => Layer,
): Nail {
  const index = nail.layers.findIndex((layer) => layer.id === layerId)
  const current = nail.layers[index]
  if (!current) return nail
  const next = update(current)
  if (next === current) return nail
  const layers = [...nail.layers]
  layers[index] = next
  return { ...nail, layers }
}

/** สำเนาลึกพอที่ผู้รับจะแก้ต่อได้โดยไม่กระทบต้นทาง (อาร์เรย์ทุกชั้นเป็นก้อนใหม่) */
export function cloneNail(nail: Nail): Nail {
  return {
    ...nail,
    layers: nail.layers.map((layer) => ({ ...layer, strokes: [...layer.strokes] })),
    decorations: nail.decorations.map((decoration) => ({ ...decoration })),
  }
}

/**
 * เล็บสองนิ้วมีเนื้อหาเหมือนกันหรือไม่
 *
 * ใช้ตัดสินว่า "คัดลอกไปแล้วไม่มีอะไรเปลี่ยน" เพื่อไม่บันทึกรายการเปล่าลงประวัติ
 * เทียบฟิลด์ถูก ๆ ก่อนแล้วค่อยตกลงไปที่ JSON เพื่อไม่ต้อง serialize ในกรณีทั่วไป
 */
export function nailsMatch(first: Nail, second: Nail): boolean {
  if (
    first.shape !== second.shape
    || first.length !== second.length
    || first.finish !== second.finish
    || first.baseColor !== second.baseColor
    || first.layers.length !== second.layers.length
    || first.decorations.length !== second.decorations.length
  ) return false
  return JSON.stringify(first.layers) === JSON.stringify(second.layers)
    && JSON.stringify(first.decorations) === JSON.stringify(second.decorations)
}
