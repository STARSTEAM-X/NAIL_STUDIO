import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { FINGERS, nailKey, type DesignDocument, type Hand, type NailKey } from '@nail-studio/contracts'
// ใช้ตัววาดตัวเดียวกับ editor เพื่อให้ภาพตัวอย่างตรงกับที่ผู้ใช้เห็นในเว็บ — โค้ดชุดนี้
// ขึ้นกับ contracts เท่านั้น (ไม่แตะ three.js/DOM) จึงรันบน Node กับ canvas ของ @napi-rs ได้
import { renderLayer, type Ctx2D } from '../../web/src/3d/painting/rasterizer.ts'
import { compositeLayers, type LayerSource } from '../../web/src/3d/painting/layers.ts'
import { computeHull, type Pt2 } from '../../web/src/3d/geometry/hull.ts'

/**
 * วาดภาพตัวอย่างลายเล็บแบบแบน (เหมือนแผง "แคนวาส" ใน editor) เป็น PNG
 *
 * - ใช้ texture ขนาดเล็กกว่า editor (TEX) เพื่อให้เร็ว แต่ยังคงสัดส่วนเดียวกันทุกอย่าง
 *   เพราะ stroke เก็บเป็น UV และ size ถูกย่อตามอัตราส่วนเดียวกัน
 * - ตัดภาพตามขอบเล็บจริงด้วย convex hull ของ UV จาก hand.glb — นอกขอบคือส่วนที่ผู้ใช้มองไม่เห็น
 * - ปลายเล็บอยู่ด้านบนของภาพ (กลับแกนจาก texture ที่ v = 0 อยู่ล่าง)
 * - ภาพนี้ไม่แสดงทรงเล็บ (almond/square ฯลฯ เป็น morph ของโมเดล 3 มิติ) และวาดของตกแต่ง
 *   เป็นวงกลมพร้อมป้ายชื่อเท่านั้น
 */

const EDITOR_TEX = 1024
const TEX = 512
const CELL_W = 200
const CELL_H = 226
const LABEL_H = 26

const GLB_PATH = fileURLToPath(new URL('../../web/public/models/hand.glb', import.meta.url))

let cachedHulls: Map<string, Pt2[]> | null = null

/** อ่าน UV ของ mesh เล็บทุกนิ้วจาก hand.glb แล้วหา convex hull (ทำครั้งเดียวแล้วจำไว้) */
export function nailHulls(): Map<string, Pt2[]> {
  if (cachedHulls) return cachedHulls
  const buffer = readFileSync(GLB_PATH)
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8')) as {
    nodes: { name?: string; mesh?: number }[]
    meshes: { primitives: { attributes: Record<string, number> }[] }[]
    accessors: { bufferView: number; byteOffset?: number; count: number }[]
    bufferViews: { byteOffset?: number; byteStride?: number }[]
  }
  const binary = 20 + jsonLength + 8
  const hulls = new Map<string, Pt2[]>()
  for (const node of gltf.nodes) {
    const match = /^Nail_(\w+)$/.exec(node.name ?? '')
    if (!match || node.mesh === undefined) continue
    const accessor = gltf.accessors[gltf.meshes[node.mesh]!.primitives[0]!.attributes.TEXCOORD_0!]!
    const view = gltf.bufferViews[accessor.bufferView]!
    const stride = view.byteStride ?? 8
    const start = binary + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const points: Pt2[] = []
    for (let i = 0; i < accessor.count; i++) {
      points.push({ x: buffer.readFloatLE(start + i * stride), y: buffer.readFloatLE(start + i * stride + 4) })
    }
    hulls.set(match[1]!, computeHull(points))
  }
  cachedHulls = hulls
  return hulls
}

/** stroke ใน editor ใช้ขนาดพิกเซลบน texture 1024 — ย่อให้พอดีกับ texture ภาพตัวอย่าง */
function scaleDocumentStrokes(nail: DesignDocument['nails'][NailKey]): DesignDocument['nails'][NailKey] {
  const ratio = TEX / EDITOR_TEX
  return {
    ...nail,
    layers: nail.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.map((stroke) => (stroke.kind === 'fill' ? stroke : { ...stroke, size: Math.max(0.5, stroke.size * ratio) })),
    })),
  }
}

const ctx2d = (canvas: Canvas): Ctx2D => canvas.getContext('2d') as unknown as Ctx2D

/** วาดเล็บหนึ่งนิ้วลง canvas ขนาด TEX×TEX (พิกัด texture จริง: v = 0 อยู่ล่าง) */
function renderNailTexture(nail: DesignDocument['nails'][NailKey]): Canvas {
  const scaled = scaleDocumentStrokes(nail)
  const sources: LayerSource[] = scaled.layers.map((layer) => {
    const canvas = createCanvas(TEX, TEX)
    renderLayer(ctx2d(canvas), layer, TEX)
    return { layer, canvas: canvas as unknown as CanvasImageSource }
  })
  const out = createCanvas(TEX, TEX)
  compositeLayers(ctx2d(out), sources, TEX, nail.baseColor)
  return out
}

function drawCell(ctx: SKRSContext2D, document: DesignDocument, key: NailKey, x: number, y: number): void {
  const nail = document.nails[key]
  const finger = key.split('.')[1]!
  const hull = nailHulls().get(finger) ?? []
  const texture = renderNailTexture(nail)

  // พื้นที่วาด: ย่อ texture ให้พอดีช่อง แล้วกลับแนวตั้งให้ปลายเล็บอยู่บน
  const size = Math.min(CELL_W - 16, CELL_H - LABEL_H - 12)
  const ox = x + (CELL_W - size) / 2
  const oy = y + 6
  const toPx = (p: Pt2): [number, number] => [ox + p.x * size, oy + p.y * size]

  ctx.save()
  ctx.beginPath()
  hull.forEach((p, i) => { const [px, py] = toPx(p); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) })
  ctx.closePath()
  ctx.clip()
  // texture: แถว y = (1 − v)·TEX → กลับแนวตั้งเพื่อให้ v = 0 (ปลายเล็บ) อยู่บน
  ctx.translate(ox, oy + size)
  ctx.scale(1, -1)
  ctx.drawImage(texture, 0, 0, size, size)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = '#8a7f7a'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  hull.forEach((p, i) => { const [px, py] = toPx(p); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) })
  ctx.closePath()
  ctx.stroke()
  for (const decoration of nail.decorations) {
    const [px, py] = toPx({ x: decoration.u, y: decoration.v })
    ctx.beginPath()
    ctx.arc(px, py, 4 + decoration.scale * 10, 0, Math.PI * 2)
    ctx.fillStyle = decoration.color ?? '#e8f4ff'
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()

  ctx.fillStyle = '#333'
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${key} · ${nail.shape}/${nail.length}`, x + CELL_W / 2, y + CELL_H - 8)
}

export type PreviewScope = 'right' | 'left' | 'both'

/** ภาพตัวอย่างทั้งมือ (หรือสองมือ) เป็น PNG — แถวละหนึ่งมือ เรียงโป้ง → ก้อย */
export function renderPreviewPng(document: DesignDocument, scope: PreviewScope = 'right', only?: NailKey[]): Buffer {
  const hands: Hand[] = scope === 'both' ? ['right', 'left'] : [scope]
  const rows = hands.map((hand) => FINGERS.map((finger) => nailKey(hand, finger)).filter((key) => !only || only.includes(key)))
    .filter((row) => row.length > 0)
  const columns = Math.max(1, ...rows.map((row) => row.length))
  const canvas = createCanvas(columns * CELL_W, Math.max(1, rows.length) * CELL_H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4efec'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  rows.forEach((row, r) => row.forEach((key, c) => drawCell(ctx, document, key, c * CELL_W, r * CELL_H)))
  return canvas.toBuffer('image/png')
}
