import type { Layer } from '@nail-studio/contracts'
import { TEX_SIZE } from './constants.ts'
import type { Ctx2D } from './rasterizer.ts'

/** โหมดผสมของเลเยอร์ ตรงกับ BLEND_MODES ใน contracts */
type BlendMode = Layer['blend']

export interface LayerSource {
  layer: Layer
  canvas: CanvasImageSource
}

const BLEND_OPS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
}

export function blendToOp(blend: BlendMode): GlobalCompositeOperation {
  return BLEND_OPS[blend] ?? 'source-over'
}

/**
 * ผสมเลเยอร์ทั้งหมดลงแคนวาสเดียวที่จะกลายเป็นเท็กซ์เจอร์ของเล็บ
 *
 * base คือสีพื้นเล็บที่ยังไม่ได้ลงสี ใส่ตรงนี้เพื่อให้ผลลัพธ์ทึบตั้งแต่ต้นทาง
 * จะได้ไม่ต้องมีแคนวาส 1024² อีกใบคอยรองพื้นก่อนส่งเข้า CanvasTexture
 *
 * ความซับซ้อน: O(จำนวนเลเยอร์ที่มองเห็น) การวาดแต่ละครั้งเป็น blit ขนาดคงที่
 * เลเยอร์ที่ซ่อนหรือความทึบศูนย์ถูกข้าม ไม่ใช่วาดแล้วมองไม่เห็น
 */
export function compositeLayers(
  ctx: Ctx2D,
  sources: LayerSource[],
  texSize = TEX_SIZE,
  base?: string,
): void {
  ctx.clearRect(0, 0, texSize, texSize)
  if (base) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = base
    ctx.fillRect(0, 0, texSize, texSize)
    ctx.restore()
  }
  for (const { layer, canvas } of sources) {
    if (!layer.visible || layer.opacity <= 0) continue
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity))
    ctx.globalCompositeOperation = blendToOp(layer.blend)
    ctx.drawImage(canvas, 0, 0, texSize, texSize)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
