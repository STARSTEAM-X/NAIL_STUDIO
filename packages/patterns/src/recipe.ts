import { z } from 'zod'
import {
  FINGERS,
  FINISHES,
  MAX_DECORATIONS_PER_NAIL,
  MAX_LAYERS_PER_NAIL,
  MAX_STROKES_PER_LAYER,
  NAIL_KEYS,
  NAIL_LENGTHS,
  NAIL_SHAPES,
  createEmptyDocument,
  designDocumentSchema,
  fingerOf,
  handOf,
  hexColorSchema,
  type Decoration,
  type DesignDocument,
  type Layer,
  type Nail,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { patternSchema, renderPattern } from './patterns.ts'

/**
 * Recipe — สิ่งที่ AI ตอบ: "นิ้วไหน ใช้ลายอะไร ค่าเท่าไร" ไม่ใช่พิกัดทีละจุด
 *
 * คีย์ของ nails รับได้ทั้งชื่อนิ้ว ("index") ซึ่งใช้กับทั้งสองมือ และคีย์เต็ม
 * ("right.index") ซึ่งชนะคีย์ชื่อนิ้วเสมอ — นิ้วที่ไม่ได้ระบุจะคงของเดิมในเอกสาร
 */

export const decorationSpecSchema = z.object({
  catalogId: z.string().min(1).describe('id จาก list_decorations เช่น gem-round'),
  u: z.number().min(0).max(1).default(0.5),
  v: z.number().min(0).max(1).default(0.5),
  rotation: z.number().default(0).describe('เรเดียน'),
  scale: z.number().positive().max(1).default(0.4),
  color: hexColorSchema.optional(),
})

export const nailRecipeSchema = z.object({
  shape: z.enum(NAIL_SHAPES).optional(),
  length: z.enum(NAIL_LENGTHS).optional(),
  finish: z.enum(FINISHES).optional(),
  base: hexColorSchema.optional().describe('สีพื้นของเล็บ'),
  patterns: z.array(patternSchema).max(24).default([]).describe('ลายเรียงจากล่างขึ้นบน'),
  decorations: z.array(decorationSpecSchema).max(MAX_DECORATIONS_PER_NAIL).default([]),
})

const fingerKey = z.enum(FINGERS)
const fullKey = z.enum(NAIL_KEYS as unknown as [NailKey, ...NailKey[]])

export const recipeSchema = z.object({
  defaults: z.object({
    shape: z.enum(NAIL_SHAPES).optional(),
    length: z.enum(NAIL_LENGTHS).optional(),
    finish: z.enum(FINISHES).optional(),
    base: hexColorSchema.optional(),
  }).default({}).describe('ค่าที่ใช้กับทุกนิ้วที่ไม่ได้ระบุเอง'),
  skinTone: hexColorSchema.optional(),
  nails: z.partialRecord(z.union([fingerKey, fullKey]), nailRecipeSchema).default({}),
  mirrorLeft: z.boolean().default(true).describe('คีย์ชื่อนิ้วใช้กับมือซ้ายแบบกลับซ้าย-ขวาให้สมมาตร'),
})

export type Recipe = z.input<typeof recipeSchema>
export type NailRecipe = z.input<typeof nailRecipeSchema>

/** กลับซ้าย-ขวา (u → 1 − u) — ใช้ทำลายมือซ้ายให้สมมาตรกับมือขวา */
export function mirrorStroke(stroke: Stroke): Stroke {
  if (stroke.kind === 'fill') return stroke
  return { ...stroke, points: stroke.points.map((p) => ({ ...p, x: Math.round((1 - p.x) * 1000) / 1000 })) }
}

export function mirrorDecoration(decoration: Decoration): Decoration {
  return { ...decoration, u: 1 - decoration.u, rotation: Math.PI - decoration.rotation }
}

/** แบ่ง stroke ลงเลเยอร์ละไม่เกินเพดาน — เกิน 6 เลเยอร์ถือว่าลายหนาแน่นเกินไป */
export function packLayers(strokes: Stroke[], prefix = 'layer'): Layer[] {
  const layers: Layer[] = []
  for (let i = 0; i < strokes.length; i += MAX_STROKES_PER_LAYER) {
    layers.push({
      id: `${prefix}-${layers.length + 1}`,
      name: `เลเยอร์ ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      blend: 'normal',
      strokes: strokes.slice(i, i + MAX_STROKES_PER_LAYER),
    })
  }
  if (layers.length === 0) layers.push({ id: `${prefix}-1`, name: 'เลเยอร์ 1', visible: true, opacity: 1, blend: 'normal', strokes: [] })
  if (layers.length > MAX_LAYERS_PER_NAIL) {
    throw new Error(`ลายหนาแน่นเกินไป: ต้องใช้ ${layers.length} เลเยอร์ (สูงสุด ${MAX_LAYERS_PER_NAIL}) — ลด density หรือจำนวนลาย`)
  }
  return layers
}

/** สร้างเล็บหนึ่งนิ้วจาก recipe (ทับทั้งนิ้ว ไม่ต่อของเดิม) */
export function buildNail(
  recipe: NailRecipe,
  defaults: z.infer<typeof recipeSchema>['defaults'],
  fallback: Nail,
  mirror: boolean,
): Nail {
  const parsed = nailRecipeSchema.parse(recipe)
  let strokes = parsed.patterns.flatMap((pattern) => renderPattern(pattern))
  let decorations: Decoration[] = parsed.decorations.map((d, i) => ({
    id: `ai-${d.catalogId}-${i + 1}`,
    catalogId: d.catalogId,
    u: d.u,
    v: d.v,
    rotation: d.rotation,
    scale: d.scale,
    ...(d.color === undefined ? {} : { color: d.color }),
  }))
  if (mirror) {
    strokes = strokes.map(mirrorStroke)
    decorations = decorations.map(mirrorDecoration)
  }
  return {
    shape: parsed.shape ?? defaults.shape ?? fallback.shape,
    length: parsed.length ?? defaults.length ?? fallback.length,
    finish: parsed.finish ?? defaults.finish ?? fallback.finish,
    baseColor: parsed.base ?? defaults.base ?? fallback.baseColor,
    layers: packLayers(strokes),
    decorations,
  }
}

export interface BuildResult {
  document: DesignDocument
  /** นิ้วที่ถูกเปลี่ยนจาก recipe นี้ */
  changed: NailKey[]
}

/**
 * ลง recipe บนเอกสาร (หรือเอกสารเปล่า) — คืนเอกสารใหม่ที่ผ่าน schema แล้วเสมอ
 *
 * นิ้วที่ recipe ไม่ได้พูดถึงจะคงของเดิม แต่ถ้ามี defaults จะได้ทรง/สีพื้นตาม defaults
 * (ลายเดิมของนิ้วนั้นยังอยู่) เพื่อให้สั่ง "เปลี่ยนทุกนิ้วเป็นทรง almond" ได้ในคำสั่งเดียว
 */
export function buildFromRecipe(recipeInput: Recipe, base?: DesignDocument): BuildResult {
  const recipe = recipeSchema.parse(recipeInput)
  const source = base ?? createEmptyDocument()
  const nails = { ...source.nails }
  const changed: NailKey[] = []

  for (const key of NAIL_KEYS) {
    const hand = handOf(key)
    const finger = fingerOf(key)
    const direct = recipe.nails[key]
    const shared = recipe.nails[finger]
    if (direct) {
      nails[key] = buildNail(direct, recipe.defaults, source.nails[key], false)
      changed.push(key)
    } else if (shared) {
      nails[key] = buildNail(shared, recipe.defaults, source.nails[key], hand === 'left' && recipe.mirrorLeft)
      changed.push(key)
    } else if (Object.keys(recipe.defaults).length > 0) {
      const old = source.nails[key]
      nails[key] = {
        ...old,
        shape: recipe.defaults.shape ?? old.shape,
        length: recipe.defaults.length ?? old.length,
        finish: recipe.defaults.finish ?? old.finish,
        baseColor: recipe.defaults.base ?? old.baseColor,
      }
      changed.push(key)
    }
  }

  const document = designDocumentSchema.parse({
    ...source,
    hand: recipe.skinTone ? { ...source.hand, skinTone: recipe.skinTone } : source.hand,
    nails,
  })
  return { document, changed }
}

