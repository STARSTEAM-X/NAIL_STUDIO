import { NAIL_KEYS, type DesignDocument } from '@nail-studio/contracts'

/**
 * สรุปเอกสารเป็นข้อความสั้นต่อนิ้ว — ให้ AI อ่านภาพรวมได้โดยไม่ต้องกิน token กับ
 * พิกัดเป็นพันจุด (เอกสารเต็มหนึ่งชิ้นอาจใหญ่หลายร้อย KB)
 */
export function summarizeDocument(document: DesignDocument): string {
  const lines = [`schemaVersion ${document.schemaVersion} · skinTone ${document.hand.skinTone}`]
  for (const key of NAIL_KEYS) {
    const nail = document.nails[key]
    const strokes = nail.layers.reduce((sum, layer) => sum + layer.strokes.length, 0)
    const colors = new Set<string>()
    for (const layer of nail.layers) {
      for (const stroke of layer.strokes) if (stroke.kind !== 'erase') colors.add(stroke.color.toLowerCase())
    }
    const palette = [...colors].slice(0, 6).join(' ')
    const decorations = nail.decorations.map((d) => d.catalogId).join(', ')
    lines.push(
      `${key.padEnd(13)} ${nail.shape}/${nail.length}/${nail.finish} base ${nail.baseColor}`
      + ` · ${nail.layers.length} layer, ${strokes} stroke${palette ? ` · สี ${palette}` : ''}`
      + `${decorations ? ` · ตกแต่ง ${decorations}` : ''}`,
    )
  }
  return lines.join('\n')
}
