import { z } from 'zod'

/**
 * Spike S5 — schema สองแบบที่จะเอามาแข่งกัน
 *
 * สมมติฐานที่ต้องพิสูจน์ (DECISION D-22):
 *   "ให้ LLM ออก Recipe 8 ฟิลด์ที่เป็น enum ทั้งหมด จะได้อัตราผ่าน schema สูงกว่า
 *    การให้ออก DesignDocument เต็มรูปอย่างมีนัยสำคัญ"
 *
 * ถ้าสมมติฐานนี้ผิด ต้องกลับไปทบทวน D-22 ทั้งหมด
 */

// ---------- คลังของจริงที่ LLM ต้องเลือกจาก ----------

export const NAIL_KEYS = [
  'left.thumb', 'left.index', 'left.middle', 'left.ring', 'left.little',
  'right.thumb', 'right.index', 'right.middle', 'right.ring', 'right.little',
] as const

export const ARCHETYPES = [
  'solid', 'french-tip', 'ombre', 'accent-nail',
  'negative-space', 'marble', 'geometric', 'glitter-gradient',
] as const

export const PALETTES = [
  'pal-nude-rose', 'pal-cherry-gold', 'pal-mono-black',
  'pal-pastel-sky', 'pal-berry-cream',
] as const

export const FINISHES = ['glossy', 'matte', 'chrome', 'glitter'] as const
export const SHAPES = ['round', 'almond', 'square', 'squoval', 'stiletto'] as const
export const LENGTHS = ['short', 'medium', 'long', 'extra'] as const

export const DECORATIONS = [
  'charm-pearl-01', 'charm-bow-01', 'charm-star-01',
  'sticker-heart-01', 'sticker-flower-01',
  'sculpt-rabbit-01', 'gem-round-01', 'gem-teardrop-01',
] as const

export const ZONES = ['tip', 'center', 'cuticle-side', 'scatter'] as const
export const DENSITIES = ['sparse', 'medium', 'dense'] as const

// ---------- แบบ A: Recipe 8 ฟิลด์ (ข้อเสนอของ D-22) ----------

export const RecipeSchema = z.object({
  archetype: z.enum(ARCHETYPES),
  paletteId: z.enum(PALETTES),
  accentNails: z.array(z.enum(NAIL_KEYS)).max(4),
  finish: z.enum(FINISHES),
  shape: z.enum(SHAPES),
  length: z.enum(LENGTHS),
  decorations: z.array(z.object({
    catalogId: z.enum(DECORATIONS),
    zone: z.enum(ZONES),
    density: z.enum(DENSITIES),
  })).max(3),
}).strict()

// ---------- แบบ B: DesignDocument เต็มรูป (แนวทางของซอร์สเดิม) ----------

const HEX = /^#[0-9a-fA-F]{6}$/

const StrokeSchema = z.object({
  kind: z.literal('brush'),
  color: z.string().regex(HEX),
  size: z.number().min(1).max(200),
  opacity: z.number().min(0).max(1),
  softness: z.number().min(0).max(1),
  points: z.array(z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    p: z.number().min(0).max(1),
  })).min(2),
})

const NailSchema = z.object({
  shape: z.enum(SHAPES),
  length: z.enum(LENGTHS),
  finish: z.enum(FINISHES),
  baseColor: z.string().regex(HEX),
  layers: z.array(z.object({
    name: z.string(),
    visible: z.boolean(),
    opacity: z.number().min(0).max(1),
    strokes: z.array(StrokeSchema),
  })).min(1).max(6),
  decorations: z.array(z.object({
    catalogId: z.enum(DECORATIONS),
    uv: z.object({ u: z.number().min(0).max(1), v: z.number().min(0).max(1) }),
    rotation: z.number(),
    scale: z.number().min(0.01).max(1),
  })).max(30),
})

export const DocumentSchema = z.object({
  hand: z.object({
    skinTone: z.string().regex(HEX),
    proportions: z.object({
      handScale: z.number().min(0.8).max(1.2),
      palmWidth: z.number().min(0.7).max(1.3),
      fingerLength: z.number().min(0.7).max(1.3),
      fingerWidth: z.number().min(0.7).max(1.3),
    }),
  }),
  nails: z.object(
    Object.fromEntries(NAIL_KEYS.map((key) => [key, NailSchema])) as Record<
      (typeof NAIL_KEYS)[number], typeof NailSchema
    >,
  ),
}).strict()

export type Recipe = z.infer<typeof RecipeSchema>
