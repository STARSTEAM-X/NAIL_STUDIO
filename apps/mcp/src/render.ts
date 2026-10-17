import { createHash } from 'node:crypto'
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { FINGERS, nailKey, type DesignDocument, type Finger, type Hand, type NailKey } from '@nail-studio/contracts'
import { DECORATIONS, type DecorationInfo } from '@nail-studio/patterns'
// ใช้ตัววาดตัวเดียวกับ editor เพื่อให้ภาพตัวอย่างตรงกับที่ผู้ใช้เห็นในเว็บ — โค้ดชุดนี้
// ขึ้นกับ contracts เท่านั้น (ไม่แตะ three.js/DOM) จึงรันบน Node กับ canvas ของ @napi-rs ได้
import { renderLayer, type Ctx2D } from '../../web/src/3d/painting/rasterizer.ts'
import { compositeLayers, type LayerSource } from '../../web/src/3d/painting/layers.ts'
import { textureToPanel, textureToPanelTransform } from '../../web/src/3d/painting/flatTriangles.ts'
import { flatNailFor, type NailShapeView } from './nailShape.ts'
import { acesFilmic, AMBIENT, KEY, LIGHT_DIR, linearToSrgbByte, srgbToLinear } from './sceneColor.ts'

/**
 * วาดภาพตัวอย่างลายเล็บเป็น PNG — รูปเล็บตามทรง/ความยาวจริง (morph เดียวกับโมเดล 3 มิติ)
 *
 * - texture วาดด้วย rasterizer ของ editor แล้ววางลงรูปเล็บที่คลี่แล้วทีละสามเหลี่ยม
 *   (วิธีเดียวกับแผงวาด 2 มิติ) ลายที่ถูกยืดบนโมเดลจึงยืดแบบเดียวกันในภาพนี้
 * - lighting 'scene' ลงแสงตามความโค้งของเล็บ + ACES tone mapping ให้สีใกล้กับฉากในเว็บ
 *   'flat' แสดงสีตรงตัว (ไว้ดูค่า hex)
 * - ปลายเล็บอยู่ด้านบน มือซ้ายเป็นภาพกระจกของมือขวา (editor มีแต่โมเดลมือขวา)
 * - ผิว (finish) และของตกแต่งเป็นค่าประมาณแบบ 2.5D ไม่ใช่ PBR ของฉากจริง
 */

const EDITOR_TEX = 1024
const BACKGROUND = '#f4efec'
/** ขยายขอบสามเหลี่ยมตอน clip กันรอยต่อ — ค่าเดียวกับ NailCanvas2D.tsx */
const SEAM_BLEED = 0.5

interface Layout {
  tex: number
  cellW: number
  cellH: number
  panel: number
  labelSize: number
}

const LAYOUTS: Record<PreviewZoom, Layout> = {
  hand: { tex: 512, cellW: 200, cellH: 226, panel: 184, labelSize: 13 },
  nail: { tex: 1024, cellW: 512, cellH: 560, panel: 512, labelSize: 16 },
}

/** zoom 'nail' ใช้ texture 1024 ต่อนิ้ว — จำกัดจำนวนเพื่อคุมเวลาและขนาดภาพ */
export const MAX_ZOOMED_NAILS = 3

export type PreviewScope = 'right' | 'left' | 'both'
export type PreviewZoom = 'hand' | 'nail'
export type PreviewLighting = 'scene' | 'flat'

export interface PreviewOptions {
  /** ไม่ระบุ: ใช้มือของนิ้วใน only (ถ้ามี) ไม่งั้นมือขวา */
  scope?: PreviewScope
  only?: NailKey[]
  zoom?: PreviewZoom
  lighting?: PreviewLighting
}

type NailData = DesignDocument['nails'][NailKey]

const ctx2d = (canvas: Canvas): Ctx2D => canvas.getContext('2d') as unknown as Ctx2D

/** stroke ใน editor ใช้ขนาดพิกเซลบน texture 1024 — ย่อให้พอดีกับ texture ภาพตัวอย่าง */
export function scaleStrokes(nail: NailData, tex: number): NailData {
  if (tex === EDITOR_TEX) return nail
  const ratio = tex / EDITOR_TEX
  return {
    ...nail,
    layers: nail.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.map((stroke) => (stroke.kind === 'fill' ? stroke : { ...stroke, size: Math.max(0.5, stroke.size * ratio) })),
    })),
  }
}

/**
 * texture ที่วาดแล้ว (LRU) — tool ที่บันทึกวาดภาพตัวอย่างแล้ว lint ต่อทันทีด้วยเอกสารเดียวกัน
 * การวาด stroke เป็นงานหนักสุดของทั้งสายงาน จึงไม่วาดซ้ำ — จำกัดตามขนาดพิกเซลรวม
 * (512² ≈ 1 MB, 1024² ≈ 4 MB) ไม่ให้ service บน instance เล็กกิน RAM เกิน ~32 MB
 */
const TEXTURE_CACHE_BYTES = 32 * 1024 * 1024
const textureCache = new Map<string, Canvas>()
let textureCacheBytes = 0
const textureBytes = (canvas: Canvas): number => canvas.width * canvas.height * 4

/** วาดเล็บหนึ่งนิ้วลง canvas ขนาด tex×tex (พิกัด texture จริง: แถว y = (1 − v)·tex) — อย่าแก้ canvas ที่ได้ */
export function renderNailTexture(nail: NailData, tex: number): Canvas {
  const key = `${tex}|${textureHash(nail)}`
  const hit = textureCache.get(key)
  if (hit) {
    textureCache.delete(key)
    textureCache.set(key, hit)
    return hit
  }
  const out = drawNailTexture(nail, tex)
  textureCache.set(key, out)
  textureCacheBytes += textureBytes(out)
  while (textureCacheBytes > TEXTURE_CACHE_BYTES && textureCache.size > 1) {
    const [oldest, canvas] = textureCache.entries().next().value!
    textureCache.delete(oldest)
    textureCacheBytes -= textureBytes(canvas)
  }
  return out
}

function textureHash(nail: NailData): string {
  return createHash('sha1').update(JSON.stringify([nail.baseColor, nail.layers])).digest('hex')
}

/** texture ของเล็บนี้ที่วาดไว้แล้วในแคช (ขนาดใดก็ได้, ใหญ่ก่อน) — ไม่มีคืน undefined โดยไม่วาดใหม่ */
export function cachedNailTexture(nail: NailData): Canvas | undefined {
  const hash = textureHash(nail)
  return textureCache.get(`${EDITOR_TEX}|${hash}`) ?? textureCache.get(`${LAYOUTS.hand.tex}|${hash}`)
}

function drawNailTexture(nail: NailData, tex: number): Canvas {
  const scaled = scaleStrokes(nail, tex)
  const sources: LayerSource[] = scaled.layers.map((layer) => {
    const canvas = createCanvas(tex, tex)
    renderLayer(ctx2d(canvas), layer, tex)
    return { layer, canvas: canvas as unknown as CanvasImageSource }
  })
  const out = createCanvas(tex, tex)
  compositeLayers(ctx2d(out), sources, tex, nail.baseColor)
  return out
}

/** วาง texture ลงรูปเล็บทีละสามเหลี่ยม (affine ต่อชิ้น) — แบบเดียวกับแผงวาด 2 มิติ */
function drawTriangles(ctx: SKRSContext2D, view: NailShapeView, texture: Canvas): void {
  for (const triangle of view.triangles) {
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
    ctx.moveTo(...grow(x0, y0))
    ctx.lineTo(...grow(x1, y1))
    ctx.lineTo(...grow(x2, y2))
    ctx.closePath()
    ctx.clip()
    ctx.setTransform(...transform)
    ctx.drawImage(texture, 0, 0)
    ctx.restore()
  }
}

/**
 * normal ต่อพิกเซลด้วย barycentric ของสามเหลี่ยมบนแผง (Gouraud ของ normal)
 * พิกเซลขอบที่ถูกระบายจาก SEAM_BLEED แต่จุดกลางไม่ตกในสามเหลี่ยมใด ยืม normal ของเพื่อนบ้าน
 *
 * ความซับซ้อน: O(T + พิกเซลในกรอบของสามเหลี่ยม) ≈ O(T + P)
 */
function normalBuffer(view: NailShapeView, size: number, alpha: Uint8ClampedArray): Float32Array {
  const normals = new Float32Array(size * size * 3)
  const filled = new Uint8Array(size * size)
  const { normals: vertex, indices } = view
  view.triangles.forEach((triangle, t) => {
    const [x0, y0, x1, y1, x2, y2] = triangle.screen
    const denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if (Math.abs(denominator) < 1e-12) return
    const a = indices[t * 3]! * 3
    const b = indices[t * 3 + 1]! * 3
    const c = indices[t * 3 + 2]! * 3
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)))
    const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)))
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)))
    const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)))
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const x = px + 0.5
        const y = py + 0.5
        const w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denominator
        const w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denominator
        const w2 = 1 - w0 - w1
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
        const i = py * size + px
        for (let k = 0; k < 3; k++) normals[i * 3 + k] = w0 * vertex[a + k]! + w1 * vertex[b + k]! + w2 * vertex[c + k]!
        filled[i] = 1
      }
    }
  })
  // เติมขอบ 2 รอบ: พิกเซลที่มีสีแต่ยังไม่มี normal ยืมจากเพื่อนบ้านที่มีแล้ว
  for (let pass = 0; pass < 2; pass++) {
    const next = filled.slice()
    for (let i = 0; i < filled.length; i++) {
      if (filled[i] || alpha[i * 4 + 3] === 0) continue
      const x = i % size
      const y = (i - x) / size
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const j = ny * size + nx
        if (!filled[j]) continue
        normals[i * 3] = normals[j * 3]!
        normals[i * 3 + 1] = normals[j * 3 + 1]!
        normals[i * 3 + 2] = normals[j * 3 + 2]!
        next[i] = 1
        break
      }
    }
    filled.set(next)
  }
  return normals
}

/** hash ตำแหน่งพิกเซล → 0–1 (คงที่ทุกครั้ง ภาพเดิมได้ประกายเดิม) */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * ลงแสงต่อพิกเซล: linear × (AMBIENT + KEY·max(0, N·L)) + specular ตาม finish → ACES → sRGB
 * ค่าความแรงของ specular แต่ละผิวเป็นค่าประมาณให้ "อ่านออก" ว่าเป็นผิวอะไร ไม่ใช่ PBR
 */
function applyLighting(ctx: SKRSContext2D, view: NailShapeView, size: number, finish: NailData['finish']): void {
  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  const normals = normalBuffer(view, size, data)
  const [lx, ly, lz] = LIGHT_DIR
  // half vector ของแสงกับทิศมอง V = (0, 0, 1)
  const hLength = Math.hypot(lx, ly, lz + 1)
  const hx = lx / hLength
  const hy = ly / hLength
  const hz = (lz + 1) / hLength
  const key = finish === 'matte' ? KEY * 0.9 : KEY
  // แถบตาแมว: เส้นเฉียง −30° ผ่านกลางเล็บ (ตาม anisotropyRotation ของเว็บ)
  const centerX = view.bounds.x + view.bounds.width / 2
  const centerY = view.bounds.y + view.bounds.height / 2
  const bandSin = Math.sin(-Math.PI / 6)
  const bandCos = Math.cos(-Math.PI / 6)
  const bandWidth = Math.max(1, view.bounds.width * 0.12)
  const mapped = [0, 0, 0]

  for (let i = 0; i < size * size; i++) {
    const o = i * 4
    if (data[o + 3] === 0) continue
    let nx = normals[i * 3]!
    let ny = normals[i * 3 + 1]!
    let nz = normals[i * 3 + 2]!
    const nLength = Math.hypot(nx, ny, nz)
    if (nLength < 1e-6) { nx = 0; ny = 0; nz = 1 } else { nx /= nLength; ny /= nLength; nz /= nLength }
    const diffuse = AMBIENT + key * Math.max(0, nx * lx + ny * ly + nz * lz)
    const nh = Math.max(0, nx * hx + ny * hy + nz * hz)
    let r = srgbToLinear(data[o]!) * diffuse
    let g = srgbToLinear(data[o + 1]!) * diffuse
    let b = srgbToLinear(data[o + 2]!) * diffuse
    let specular = 0
    switch (finish) {
      case 'glossy':
        specular = 0.6 * nh ** 80
        break
      case 'chrome': {
        // โลหะสะท้อนสภาพแวดล้อม: สีพื้นจางเข้าหาเทาตามมุม + ไฮไลต์กว้าง
        const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const mix = 0.5 * (1 - nz)
        r += (grey - r) * mix
        g += (grey - g) * mix
        b += (grey - b) * mix
        specular = 1.2 * nh ** 20
        break
      }
      case 'glitter': {
        const x = i % size
        specular = 0.6 * nh ** 60 + (hash(x, (i - x) / size) > 0.985 ? 0.8 * (0.5 + 0.5 * nh) : 0)
        break
      }
      case 'pearl': {
        specular = 0.35 * nh ** 12
        // เหลือบรุ้งอ่อน ๆ: hue เลื่อนตามมุมที่ผิวหันออกจากผู้ดู
        const t = 6 * (1 - nz)
        r += 0.06 * Math.sin(t)
        g += 0.06 * Math.sin(t + 2.1)
        b += 0.06 * Math.sin(t + 4.2)
        break
      }
      case 'cat_eye': {
        const x = (i % size) + 0.5 - centerX
        const y = Math.floor(i / size) + 0.5 - centerY
        const distance = (x * bandSin + y * bandCos) / bandWidth
        const band = Math.exp(-distance * distance)
        r += band * 0.6 * (r + 0.15)
        g += band * 0.6 * (g + 0.15)
        b += band * 0.6 * (b + 0.15)
        specular = 0.4 * nh ** 80
        break
      }
      case 'matte':
        break
    }
    acesFilmic(r + specular, g + specular, b + specular, mapped)
    data[o] = linearToSrgbByte(mapped[0]!)
    data[o + 1] = linearToSrgbByte(mapped[1]!)
    data[o + 2] = linearToSrgbByte(mapped[2]!)
  }
  ctx.putImageData(image, 0, 0)
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  const channel = (shift: number): number => {
    const c = (value >> shift) & 255
    return Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  }
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

/** ของตกแต่งแบบ sprite ตามหมวด (2.5D) — ขนาดจากรัศมีจริงของ geometry ในเว็บ */
function drawDecorationSprite(ctx: SKRSContext2D, info: DecorationInfo, color: string, x: number, y: number, radius: number, rotation: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  switch (info.category) {
    case 'gemstone': {
      for (let k = 0; k < 8; k++) {
        const angle = (Math.PI / 4) * k + Math.PI / 8
        if (k === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      }
      ctx.closePath()
      const facets = ctx.createLinearGradient(-radius, -radius, radius, radius)
      facets.addColorStop(0, shade(color, 0.7))
      facets.addColorStop(0.45, color)
      facets.addColorStop(0.55, shade(color, -0.35))
      facets.addColorStop(1, shade(color, 0.4))
      ctx.fillStyle = facets
      ctx.fill()
      ctx.strokeStyle = shade(color, -0.5)
      ctx.lineWidth = Math.max(0.5, radius * 0.08)
      ctx.stroke()
      // ประกาย
      ctx.beginPath()
      ctx.arc(-radius * 0.3, -radius * 0.3, Math.max(0.6, radius * 0.18), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fill()
      break
    }
    case 'pearl': {
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.05, 0, 0, radius)
      body.addColorStop(0, '#ffffff')
      body.addColorStop(0.35, color)
      body.addColorStop(1, shade(color, -0.35))
      ctx.fillStyle = body
      ctx.fill()
      break
    }
    case 'metal': {
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      const metal = ctx.createLinearGradient(0, -radius, 0, radius)
      metal.addColorStop(0, shade(color, 0.6))
      metal.addColorStop(0.5, color)
      metal.addColorStop(1, shade(color, -0.45))
      ctx.fillStyle = metal
      ctx.fill()
      ctx.strokeStyle = shade(color, -0.55)
      ctx.lineWidth = Math.max(0.5, radius * 0.1)
      ctx.stroke()
      break
    }
    case 'motif':
    case 'ribbon': {
      const r = radius * 0.3
      ctx.moveTo(-radius + r, -radius * 0.8)
      ctx.arcTo(radius, -radius * 0.8, radius, radius * 0.8, r)
      ctx.arcTo(radius, radius * 0.8, -radius, radius * 0.8, r)
      ctx.arcTo(-radius, radius * 0.8, -radius, -radius * 0.8, r)
      ctx.arcTo(-radius, -radius * 0.8, radius, -radius * 0.8, r)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = shade(color, -0.5)
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(-radius * 0.3, -radius * 0.35, radius * 0.4, radius * 0.18, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.fill()
      break
    }
  }
  ctx.restore()
}

/**
 * u บนผิวของโมเดลมือขวา สำหรับข้อมูลของนิ้วนี้
 *
 * ข้อมูลมือซ้ายเก็บแบบกลับซ้ายขวาไว้แล้ว (mirrorStroke: u → 1 − u) ส่วน editor มีแต่โมเดลมือขวา
 * ภาพมือซ้ายจึงได้จาก "กลับ u ของข้อมูลกลับมา → วางบนรูปทรงมือขวา → กลับภาพทั้งรูป"
 * ซึ่งเท่ากับภาพกระจกของมือขวาพอดีเมื่อข้อมูลสองมือสมมาตรกัน (UV ของ mesh ไม่สมมาตร
 * จึงข้ามขั้นกลับ u ไม่ได้)
 */
export function surfaceU(key: NailKey, u: number): number {
  return key.startsWith('left.') ? 1 - u : u
}

/** texture ของมือซ้ายกลับแนวนอน (u → 1 − u) ให้ตรงกับ surfaceU */
function flipHorizontal(texture: Canvas): Canvas {
  const out = createCanvas(texture.width, texture.height)
  const ctx = out.getContext('2d')
  ctx.translate(texture.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(texture, 0, 0)
  return out
}

/** รัศมีของตกแต่งบนแผง: รัศมีจริง × scale ÷ สเกลมือ × (พิกเซลต่อหน่วย) */
export function decorationRadiusPx(info: DecorationInfo, scale: number, handScale: number, view: NailShapeView): number {
  return (info.worldRadius * scale / handScale) * view.scale
}

/** เล็บหนึ่งนิ้วบน canvas ขนาด panel × panel (พื้นโปร่งใสนอกเล็บ) */
function renderNailPanel(document: DesignDocument, key: NailKey, layout: Layout, lighting: PreviewLighting): Canvas {
  const nail = document.nails[key]
  const [hand, finger] = key.split('.') as [Hand, Finger]
  const view = flatNailFor(finger, nail.shape, nail.length, layout.panel, layout.tex, hand === 'left')
  const panel = createCanvas(layout.panel, layout.panel)
  const ctx = panel.getContext('2d')
  const texture = renderNailTexture(nail, layout.tex)
  drawTriangles(ctx, view, hand === 'left' ? flipHorizontal(texture) : texture)
  if (lighting === 'scene') applyLighting(ctx, view, layout.panel, nail.finish)

  const handScale = document.hand.proportions.handScale
  for (const decoration of nail.decorations) {
    const info = DECORATIONS.find((d) => d.id === decoration.catalogId)
    const at = textureToPanel(view, surfaceU(key, decoration.u), decoration.v)
    if (!info || !at) continue
    const radius = Math.max(1.5, decorationRadiusPx(info, decoration.scale, handScale, view))
    drawDecorationSprite(ctx, info, decoration.color ?? info.defaultColor, at.x, at.y, radius, decoration.rotation)
  }
  return panel
}

/**
 * ภาพตัวอย่างเป็น PNG — แถวละหนึ่งมือ เรียงโป้ง → ก้อย
 * zoom 'nail' ใช้ texture 1024 และได้ไม่เกิน MAX_ZOOMED_NAILS นิ้ว
 */
export function renderPreviewPng(document: DesignDocument, options: PreviewOptions = {}): Buffer {
  const { scope, only, zoom = 'hand', lighting = 'scene' } = options
  const layout = LAYOUTS[zoom]
  const hands: Hand[] = scope === 'both' ? ['right', 'left']
    : scope ? [scope]
    : only ? (['right', 'left'] as const).filter((hand) => only.some((key) => key.startsWith(`${hand}.`)))
    : ['right']
  const rows = hands.map((hand) => FINGERS.map((finger) => nailKey(hand, finger)).filter((key) => !only || only.includes(key)))
    .filter((row) => row.length > 0)
  const total = rows.reduce((sum, row) => sum + row.length, 0)
  if (total === 0) throw new Error('ไม่มีนิ้วที่ตรงกับ hands/nails ที่ระบุ')
  if (zoom === 'nail' && total > MAX_ZOOMED_NAILS) {
    throw new Error(`zoom: 'nail' แสดงได้ครั้งละไม่เกิน ${MAX_ZOOMED_NAILS} นิ้ว (ได้ ${total}) — ระบุ nails ให้แคบลง`)
  }
  // zoom 'nail' เรียงทุกนิ้วเป็นแถวเดียว (มีไม่เกิน 3 นิ้วอยู่แล้ว)
  const grid = zoom === 'nail' ? [rows.flat()] : rows
  const columns = Math.max(1, ...grid.map((row) => row.length))
  const canvas = createCanvas(columns * layout.cellW, Math.max(1, grid.length) * layout.cellH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  grid.forEach((row, r) => row.forEach((key, c) => {
    const x = c * layout.cellW
    const y = r * layout.cellH
    ctx.drawImage(renderNailPanel(document, key, layout, lighting), x + (layout.cellW - layout.panel) / 2, y + 6)
    const nail = document.nails[key]
    ctx.fillStyle = '#333'
    ctx.font = `${layout.labelSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${key} · ${nail.shape}/${nail.length} · ${nail.finish}`, x + layout.cellW / 2, y + layout.cellH - 8, layout.cellW - 8)
  }))
  return canvas.toBuffer('image/png')
}
