import { HandModel, type HandParts } from '@/3d/models/HandModel.tsx'
import { PaintController } from '@/3d/painting/PaintController.tsx'
import type { NailTextureSet } from '@/3d/painting/NailTextureSet.ts'
import { DecorationInstances } from '@/3d/decorations/DecorationInstances.tsx'
import { NailFocus } from './NailFocus.tsx'

interface Props {
  scale: number
  parts: HandParts | null
  textures: NailTextureSet | null
  onReady: (parts: HandParts) => void
}

/**
 * เนื้อหาที่วางอยู่บนเวที 3 มิติ — มือ กล้องจ่อเล็บ และการวาดบนโมเดล
 *
 * ชุดเท็กซ์เจอร์ถูกสร้างไว้ข้างนอก <Canvas> แล้วส่งเข้ามา เพราะแผงวาดแบบแบนซึ่งเป็น
 * DOM ธรรมดาต้องใช้ชุดเดียวกันนี้ ถ้าสร้างไว้ข้างในจะเข้าถึงจากข้างนอกไม่ได้
 * และการมีสองชุดแปลว่าวาดในโหมดหนึ่งแล้วอีกโหมดไม่เห็น
 */
export function DesignScene({ scale, parts, textures, onReady }: Props) {
  return (
    <>
      <HandModel scale={scale} onReady={onReady} />
      {parts && <NailFocus parts={parts} />}
      {parts && textures && <PaintController parts={parts} textures={textures} />}
      {parts && <DecorationInstances parts={parts} />}
    </>
  )
}
