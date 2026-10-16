import {
  FINGERS,
  MAX_DECORATIONS_PER_NAIL,
  designDocumentSchema,
  nailKey,
  type Decoration,
  type DesignDocument,
  type Hand,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { mirrorDecoration, mirrorStroke, packLayers } from './recipe.ts'

/**
 * การแก้เอกสารแบบละเอียด (ระดับต่ำ) — ทุกฟังก์ชันคืนเอกสารใหม่ที่ผ่าน schema แล้ว
 * และไม่แก้ก้อนต้นฉบับ เพื่อให้เรียกต่อกันได้และตรวจผลได้ก่อนบันทึก
 */

function finish(document: DesignDocument): DesignDocument {
  return designDocumentSchema.parse(document)
}

/** คัดลอกเล็บนิ้วหนึ่งไปยังนิ้วอื่น (mirror = กลับซ้าย-ขวา) */
export function copyNail(document: DesignDocument, from: NailKey, to: NailKey[], mirror = false): DesignDocument {
  const source = document.nails[from]
  const nails = { ...document.nails }
  for (const key of to) {
    nails[key] = {
      ...source,
      layers: source.layers.map((layer) => ({
        ...layer,
        strokes: mirror ? layer.strokes.map(mirrorStroke) : [...layer.strokes],
      })),
      decorations: mirror ? source.decorations.map(mirrorDecoration) : [...source.decorations],
    }
  }
  return finish({ ...document, nails })
}

/** ทำมืออีกข้างให้เหมือนมือที่ระบุ แบบกลับซ้าย-ขวาให้สมมาตร */
export function mirrorHand(document: DesignDocument, from: Hand): DesignDocument {
  const to: Hand = from === 'right' ? 'left' : 'right'
  let next = document
  for (const finger of FINGERS) next = copyNail(next, nailKey(from, finger), [nailKey(to, finger)], true)
  return next
}

/** เพิ่ม stroke ดิบต่อท้ายเลเยอร์บนสุด (หรือสร้างเลเยอร์ใหม่ถ้าเต็ม) */
export function addStrokes(document: DesignDocument, key: NailKey, strokes: Stroke[]): DesignDocument {
  const nail = document.nails[key]
  const existing = nail.layers.flatMap((layer) => layer.strokes)
  const layers = packLayers([...existing, ...strokes])
  return finish({ ...document, nails: { ...document.nails, [key]: { ...nail, layers } } })
}

export function addDecorations(document: DesignDocument, key: NailKey, decorations: Decoration[]): DesignDocument {
  const nail = document.nails[key]
  const all = [...nail.decorations, ...decorations]
  if (all.length > MAX_DECORATIONS_PER_NAIL) {
    throw new Error(`ของตกแต่งบน ${key} จะเกิน ${MAX_DECORATIONS_PER_NAIL} ชิ้น`)
  }
  return finish({ ...document, nails: { ...document.nails, [key]: { ...nail, decorations: all } } })
}

/** ล้างลาย (และของตกแต่งถ้าสั่ง) แต่คงทรง ความยาว ผิว และสีพื้น */
export function clearNail(document: DesignDocument, key: NailKey, clearDecorations = true): DesignDocument {
  const nail = document.nails[key]
  return finish({
    ...document,
    nails: {
      ...document.nails,
      [key]: { ...nail, layers: packLayers([]), decorations: clearDecorations ? [] : nail.decorations },
    },
  })
}
