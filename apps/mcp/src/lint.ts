import { createCanvas, type Canvas } from '@napi-rs/canvas'
import {
  MAX_LAYERS_PER_NAIL,
  MAX_STROKES_PER_LAYER,
  NAIL_KEYS,
  type DesignDocument,
  type Finger,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { DECORATIONS, DENSE_PATTERN_TYPES, type Recipe } from '@nail-studio/patterns'
import { renderLayer, type Ctx2D } from '../../web/src/3d/painting/rasterizer.ts'
import { panelToTexture, textureToPanel, triangleStretch, type FlatTriangle } from '../../web/src/3d/painting/flatTriangles.ts'
import { flatNailFor, type NailShapeView } from './nailShape.ts'
import { cachedNailTexture, decorationRadiusPx, renderNailTexture, scaleStrokes, surfaceU } from './render.ts'
import { acesFilmic, linearToSrgbByte, SCENE_LIGHT_GAIN, srgbToLab, srgbToLinear } from './sceneColor.ts'

/**
 * ตรวจกฎจากคู่มือ (DESIGN_RULES) เป็นโค้ด — คืนคำเตือนที่ AI แก้ได้ก่อนบันทึก
 * เป็นคำแนะนำ ไม่ใช่การปฏิเสธ: เอกสารที่มีคำเตือนยังบันทึกได้ตามปกติ
 */

export type LintCode = 'OUTSIDE_NAIL' | 'STRETCHED' | 'LOW_CONTRAST' | 'NEAR_LIMIT' | 'DENSE_PATTERNS'

export interface LintFinding {
  code: LintCode
  /** คีย์เล็บ, ชื่อนิ้วจาก recipe หรือ 'document' */
  nail: string
  message: string
}

/** ลายชิ้นเล็ก = stroke brush ที่กรอบมีเส้นทแยงไม่เกินนี้ (หน่วย UV) */
const SMALL_STROKE_DIAGONAL = 0.2
/**
 * เล็กกว่านี้คือเกล็ด/จุดของลายพื้นผิว (กลิตเตอร์ ชิมเมอร์) ที่ตั้งใจโปรยทั่วผืนแล้วให้ขอบเล็บตัดเอง
 * ไม่นับเป็นลายชิ้น — ไม่งั้นทุก preset ที่มีกลิตเตอร์จะได้คำเตือนเป็นร้อย
 */
const MIN_MOTIF_DIAGONAL = 0.03
/** ยืดตั้งแต่นี้ขึ้นไปถือว่ารูปร่างเพี้ยนจนเห็นได้ */
const STRETCH_LIMIT = 1.5
/** ΔE76 ต่ำกว่านี้ถือว่าแทบมองไม่เห็น */
const LOW_CONTRAST_DELTA_E = 10
/** ขนาด texture ที่ใช้วัดความต่างของสี */
const CONTRAST_TEX = 96
/** ตรวจกลุ่มสีต่อนิ้วไม่เกินนี้ (เรียงจากพื้นที่ที่ปกคลุมมากไปน้อย) */
const MAX_CONTRAST_GROUPS = 12
/** กลุ่มสีที่ปกคลุมน้อยกว่านี้ (พิกเซลที่ 96²) เล็กเกินกว่าจะวัดได้น่าเชื่อถือ */
const MIN_CONTRAST_PIXELS = 4
const NEAR_LAYER_COUNT = MAX_LAYERS_PER_NAIL - 1
/**
 * เพดานจริงคือ stroke รวมต่อเล็บ (6 × 500) — นับรวม ไม่นับต่อเลเยอร์ เพราะ packLayers
 * เติมเลเยอร์จนเต็ม 500 ก่อนขึ้นเลเยอร์ใหม่ เลเยอร์ที่เกือบเต็มจึงเป็นเรื่องปกติ
 */
const NEAR_STROKE_TOTAL = Math.round(MAX_LAYERS_PER_NAIL * MAX_STROKES_PER_LAYER * 0.8)
/** API รับ body ไม่เกิน 4 MB */
const NEAR_DOCUMENT_BYTES = 3 * 1024 * 1024
const MAX_DENSE_PATTERNS = 2

const EDITOR_TEX = 1024
/** แผงขนาดคงที่สำหรับคำนวณตำแหน่ง/การยืด (ไม่ได้วาดภาพ) */
const LINT_PANEL = 256

const ctx2d = (canvas: Canvas): Ctx2D => canvas.getContext('2d') as unknown as Ctx2D

type BrushStroke = Extract<Stroke, { kind: 'brush' }>

/** กรอบของ stroke รวมรัศมีหัวแปรง → ศูนย์กลางและเส้นทแยง (หน่วย UV) */
function strokeBox(stroke: BrushStroke): { u: number; v: number; diagonal: number } {
  const radius = stroke.size / 2 / EDITOR_TEX
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }
  return {
    u: (minX + maxX) / 2,
    v: (minY + maxY) / 2,
    diagonal: Math.hypot(maxX - minX + radius * 2, maxY - minY + radius * 2),
  }
}

/** stroke ที่มองเห็นได้ (ข้ามเลเยอร์ซ่อนและยางลบ) */
function visibleStrokes(nail: DesignDocument['nails'][NailKey]): Exclude<Stroke, { kind: 'erase' }>[] {
  return nail.layers.filter((layer) => layer.visible).flatMap((layer) =>
    layer.strokes.filter((stroke): stroke is Exclude<Stroke, { kind: 'erase' }> => stroke.kind !== 'erase'))
}

/**
 * ลายตรงจุด (u, v) ถูกยืดแค่ไหนบนโมเดล: ระยะบนแผงของ ±h ตามแนว v เทียบกับตามแนว u
 * วัดข้ามระยะเท่าขนาดของลายเอง จึงไม่โดนสามเหลี่ยมเรียวชิ้นเดียวที่ขอบเล็บหลอก
 * ถ้าจุดเทียบตกนอกเล็บ (ลายชิดขอบ) ใช้ค่าของสามเหลี่ยมตรงจุดนั้นแทน
 */
function stretchAt(view: NailShapeView, key: NailKey, u: number, v: number, h: number, fallback: FlatTriangle): ReturnType<typeof triangleStretch> {
  const at = (du: number, dv: number) => textureToPanel(view, surfaceU(key, u + du), v + dv)
  const left = at(-h, 0)
  const right = at(h, 0)
  const tip = at(0, -h)
  const base = at(0, h)
  if (!left || !right || !tip || !base) return triangleStretch(fallback)
  const across = Math.hypot(right.x - left.x, right.y - left.y)
  const along = Math.hypot(base.x - tip.x, base.y - tip.y)
  if (across < 1e-9 || along < 1e-9) return triangleStretch(fallback)
  return along >= across ? { stretch: along / across, direction: 'along' } : { stretch: across / along, direction: 'across' }
}

/** ลายชิ้นนอกเล็บ + ลายชิ้นที่ถูกยืด — O(M·T) ต่อเล็บ (M ลายชิ้น, T สามเหลี่ยม) */
function geometryFindings(document: DesignDocument, key: NailKey, findings: LintFinding[]): void {
  const nail = document.nails[key]
  const finger = key.split('.')[1] as Finger
  const view = flatNailFor(finger, nail.shape, nail.length, LINT_PANEL, EDITOR_TEX)
  let outside = 0
  let stretched = 0
  let worst = { stretch: 0, v: 0, direction: 'along' as 'along' | 'across' }
  const record = (stretch: { stretch: number; direction: 'along' | 'across' } | null, v: number): void => {
    if (!stretch || stretch.stretch < STRETCH_LIMIT) return
    stretched += 1
    if (stretch.stretch > worst.stretch) worst = { stretch: stretch.stretch, v, direction: stretch.direction }
  }

  for (const stroke of visibleStrokes(nail)) {
    if (stroke.kind !== 'brush') continue
    const box = strokeBox(stroke)
    if (box.diagonal > SMALL_STROKE_DIAGONAL || box.diagonal < MIN_MOTIF_DIAGONAL) continue
    const at = textureToPanel(view, surfaceU(key, box.u), box.v)
    if (!at) outside += 1
    else record(stretchAt(view, key, box.u, box.v, Math.max(box.diagonal / 2, MIN_MOTIF_DIAGONAL), at.triangle), box.v)
  }
  if (outside > 0) {
    findings.push({ code: 'OUTSIDE_NAIL', nail: key, message: `${key}: ลายชิ้นเล็ก ${outside} ชิ้นอยู่นอกเล็บ (มองไม่เห็นบนโมเดล)` })
  }

  const handScale = document.hand.proportions.handScale
  for (const decoration of nail.decorations) {
    const info = DECORATIONS.find((d) => d.id === decoration.catalogId)
    const at = textureToPanel(view, surfaceU(key, decoration.u), decoration.v)
    if (!at) {
      findings.push({ code: 'OUTSIDE_NAIL', nail: key, message: `${key}: ${decoration.catalogId} ที่ (${decoration.u.toFixed(2)}, ${decoration.v.toFixed(2)}) อยู่นอกเล็บ` })
      continue
    }
    if (info) {
      const radius = decorationRadiusPx(info, decoration.scale, handScale, view)
      const offsets: [number, number][] = [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]
      if (offsets.some(([dx, dy]) => !panelToTexture(view, at.x + dx, at.y + dy))) {
        findings.push({ code: 'OUTSIDE_NAIL', nail: key, message: `${key}: ${decoration.catalogId} ที่ (${decoration.u.toFixed(2)}, ${decoration.v.toFixed(2)}) ล้นขอบเล็บ` })
      }
    }
    const reach = info ? info.worldRadius * decoration.scale / handScale : 0
    // รัศมีจริง → หน่วย UV โดยประมาณจากความกว้างแผงต่อ UV ที่จุดนั้น (ใช้ขั้นต่ำเท่าลายชิ้น)
    record(stretchAt(view, key, decoration.u, decoration.v, Math.max(MIN_MOTIF_DIAGONAL, reach * view.scale / view.bounds.width * 0.6), at.triangle), decoration.v)
  }

  if (stretched > 0) {
    const direction = worst.direction === 'along' ? 'ตามแนวยาว' : 'ตามแนวขวาง'
    findings.push({
      code: 'STRETCHED',
      nail: key,
      message: `${key}: ลายชิ้น/ของตกแต่ง ${stretched} ชิ้นจะถูกยืด${direction}บนโมเดล (มากสุด ×${worst.stretch.toFixed(1)} ที่ v≈${worst.v.toFixed(2)} บนทรง ${nail.shape}/${nail.length})`,
    })
  }
}

/** สีที่ผู้ใช้เห็นบนโมเดล ณ ผิวที่หันหาผู้ดู → Lab (รับค่าเฉลี่ยเป็นทศนิยมได้ — ปัดเป็น byte ก่อน) */
function sceneLab(r: number, g: number, b: number): [number, number, number] {
  const linear = (c: number): number => srgbToLinear(Math.min(255, Math.max(0, Math.round(c)))) * SCENE_LIGHT_GAIN
  const mapped = acesFilmic(linear(r), linear(g), linear(b))
  return srgbToLab(linearToSrgbByte(mapped[0]!), linearToSrgbByte(mapped[1]!), linearToSrgbByte(mapped[2]!))
}

/**
 * กลุ่มสี (stroke สีเดียวกัน) ที่แทบมองไม่เห็น: เทียบสีเฉลี่ยของภาพรวม "ในบริเวณที่กลุ่มนี้ทา"
 * กับ "วงแหวนรอบบริเวณนั้น" — ถ้าใกล้กันแปลว่าทาไปแล้วกลืนกับรอบข้าง
 *
 * วาดภาพรวม 1 ครั้ง + มาสก์ของแต่ละกลุ่ม 1 ครั้ง (stroke แต่ละเส้นถูกวาดในมาสก์เดียว)
 * ความซับซ้อน: O(S + C·R²) ต่อเล็บ (S stroke, C กลุ่มสี ≤ 12, R = 96)
 */
function contrastFindings(document: DesignDocument, key: NailKey, findings: LintFinding[]): void {
  const nail = scaleStrokes(document.nails[key], CONTRAST_TEX)
  const groups = new Map<string, Exclude<Stroke, { kind: 'erase' }>[]>()
  for (const stroke of visibleStrokes(nail)) {
    const color = stroke.color.toLowerCase()
    const list = groups.get(color)
    if (list) list.push(stroke)
    else groups.set(color, [stroke])
  }
  if (groups.size === 0) return

  const size = CONTRAST_TEX
  // ถ้าภาพตัวอย่างวาด texture ไว้แล้ว (แคชใน render.ts) ย่อจากอันนั้น ไม่งั้นวาดใหม่ที่ขนาดเล็ก
  const scaledDown = createCanvas(size, size)
  const source = cachedNailTexture(document.nails[key]) ?? renderNailTexture(document.nails[key], size)
  scaledDown.getContext('2d').drawImage(source, 0, 0, size, size)
  const composite = scaledDown.getContext('2d').getImageData(0, 0, size, size).data
  const masks: { color: string; mask: Uint8Array; covered: number }[] = []
  const canvas = createCanvas(size, size)
  for (const [color, strokes] of groups) {
    renderLayer(ctx2d(canvas), { id: 'lint', name: 'lint', visible: true, opacity: 1, blend: 'normal', strokes }, size)
    const alpha = canvas.getContext('2d').getImageData(0, 0, size, size).data
    const mask = new Uint8Array(size * size)
    let covered = 0
    for (let i = 0; i < mask.length; i++) {
      if (alpha[i * 4 + 3]! > 127) { mask[i] = 1; covered += 1 }
    }
    masks.push({ color, mask, covered })
  }
  masks.sort((a, b) => b.covered - a.covered)

  const checked = masks.slice(0, MAX_CONTRAST_GROUPS)
  const faint: { color: string; deltaE: number }[] = []
  for (const { color, mask, covered } of checked) {
    if (covered < MIN_CONTRAST_PIXELS) continue
    const inside: [number, number, number] = [0, 0, 0]
    const ring: [number, number, number] = [0, 0, 0]
    let ringCount = 0
    for (let i = 0; i < mask.length; i++) {
      const x = i % size
      const y = (i - x) / size
      if (mask[i]) {
        inside[0] += composite[i * 4]!
        inside[1] += composite[i * 4 + 1]!
        inside[2] += composite[i * 4 + 2]!
        continue
      }
      // วงแหวน: พิกเซลนอกมาสก์ที่ห่างจากมาสก์ไม่เกิน 2 พิกเซล
      let near = false
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && mask[ny * size + nx]) { near = true; break }
        }
      }
      if (!near) continue
      ring[0] += composite[i * 4]!
      ring[1] += composite[i * 4 + 1]!
      ring[2] += composite[i * 4 + 2]!
      ringCount += 1
    }
    // กลุ่มที่คลุมทั้งเล็บ (พื้น/ไล่สี) ไม่มีรอบข้างให้เทียบ
    if (ringCount < MIN_CONTRAST_PIXELS) continue
    const a = sceneLab(inside[0]! / covered, inside[1]! / covered, inside[2]! / covered)
    const b = sceneLab(ring[0]! / ringCount, ring[1]! / ringCount, ring[2]! / ringCount)
    const deltaE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    if (deltaE < LOW_CONTRAST_DELTA_E) faint.push({ color, deltaE })
  }
  // รวมเป็นรายการเดียวต่อเล็บ — ลายที่ไล่เฉดใกล้กันโดยตั้งใจ (กลีบดอก เงา) มีได้หลายสี
  if (faint.length > 0) {
    faint.sort((a, b) => a.deltaE - b.deltaE)
    const examples = faint.slice(0, 3).map((f) => `${f.color} (ΔE ${f.deltaE.toFixed(1)})`).join(', ')
    const more = faint.length > 3 ? ` และอีก ${faint.length - 3} สี` : ''
    const scope = masks.length > MAX_CONTRAST_GROUPS ? ` — ตรวจ ${MAX_CONTRAST_GROUPS} จาก ${masks.length} สีที่ทาพื้นที่มากสุด` : ''
    findings.push({ code: 'LOW_CONTRAST', nail: key, message: `${key}: สีที่แทบมองไม่เห็นบนพื้นรอบข้าง ${examples}${more}${scope}` })
  }
}

function limitFindings(document: DesignDocument, key: NailKey, findings: LintFinding[]): void {
  const nail = document.nails[key]
  const strokes = nail.layers.reduce((sum, layer) => sum + layer.strokes.length, 0)
  // แจ้งข้อเดียวต่อเล็บ: stroke รวมเกือบเต็มบอกได้มากกว่าจำนวนเลเยอร์
  if (strokes >= NEAR_STROKE_TOTAL) {
    findings.push({ code: 'NEAR_LIMIT', nail: key, message: `${key}: ใช้ ${strokes}/${MAX_LAYERS_PER_NAIL * MAX_STROKES_PER_LAYER} stroke — ใกล้เพดาน` })
  } else if (nail.layers.length >= NEAR_LAYER_COUNT) {
    findings.push({ code: 'NEAR_LIMIT', nail: key, message: `${key}: ใช้ ${nail.layers.length}/${MAX_LAYERS_PER_NAIL} เลเยอร์ — ใกล้เพดาน` })
  }
}

/** recipe ที่ใช้ลายหนาแน่นเกิน 2 ลายในเล็บเดียว */
function denseFindings(recipe: Recipe, findings: LintFinding[]): void {
  for (const [key, nail] of Object.entries(recipe.nails ?? {})) {
    const dense = (nail?.patterns ?? []).filter((pattern) => DENSE_PATTERN_TYPES.has(pattern.type)).map((pattern) => pattern.type)
    if (dense.length > MAX_DENSE_PATTERNS) {
      findings.push({ code: 'DENSE_PATTERNS', nail: key, message: `${key}: ลายหนาแน่น ${dense.length} ลาย (${dense.join(', ')}) แนะนำไม่เกิน ${MAX_DENSE_PATTERNS}` })
    }
  }
}

export interface LintOptions {
  /** ตรวจเฉพาะนิ้วเหล่านี้ (ไม่ใส่ = ทุกนิ้ว) */
  nails?: readonly NailKey[]
  /** recipe ที่ใช้สร้างเอกสาร — ใช้ตรวจจำนวนลายหนาแน่น */
  recipe?: Recipe
}

export function lintDesign(document: DesignDocument, options: LintOptions = {}): LintFinding[] {
  const findings: LintFinding[] = []
  const keys = options.nails ?? NAIL_KEYS
  for (const key of keys) {
    geometryFindings(document, key, findings)
    contrastFindings(document, key, findings)
    limitFindings(document, key, findings)
  }
  if (options.recipe) denseFindings(options.recipe, findings)
  const bytes = Buffer.byteLength(JSON.stringify(document))
  if (bytes >= NEAR_DOCUMENT_BYTES) {
    findings.push({ code: 'NEAR_LIMIT', nail: 'document', message: `เอกสารใหญ่ ${(bytes / 1024 / 1024).toFixed(1)} MB — API รับไม่เกิน 4 MB` })
  }
  return findings
}

/** คำเตือนต่อท้ายผลของ tool — ไม่มีคำเตือนคืน null */
export function formatFindings(findings: readonly LintFinding[], max = 15): string | null {
  if (findings.length === 0) return null
  const lines = findings.slice(0, max).map((finding) => `- [${finding.code}] ${finding.message}`)
  if (findings.length > max) lines.push(`…และอีก ${findings.length - max} รายการ`)
  return `คำเตือน:\n${lines.join('\n')}`
}
