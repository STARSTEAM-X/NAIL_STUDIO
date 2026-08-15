import { z } from 'zod'

/**
 * นิยามกลางของ "เอกสารงานออกแบบ" — เป็นแหล่งความจริงเดียวของทั้งระบบ
 *
 * ใช้ร่วมกันทั้ง frontend (parse ก่อนโหลดเข้า editor), backend (validate ก่อนเขียน
 * ฐานข้อมูล) และในอนาคตคือ AI service (generate เป็น Pydantic + ส่วน SCHEMA ใน prompt)
 * ตาม DECISION D-13 — เขียนที่เดียว ไม่ให้หลุดจากกันเหมือนที่ซอร์สเดิมเป็น (AD-13)
 */

export const HANDS = ['left', 'right'] as const
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'] as const

/** คีย์ของเล็บทั้ง 10 นิ้ว เช่น "right.index" */
export const NAIL_KEYS = HANDS.flatMap((hand) => FINGERS.map((finger) => `${hand}.${finger}` as const))

export type NailKey = (typeof NAIL_KEYS)[number]
export type Hand = (typeof HANDS)[number]
export type Finger = (typeof FINGERS)[number]

/**
 * ตัวช่วยอ่าน/ประกอบคีย์เล็บ — มีไว้เพื่อไม่ให้การ split('.') กระจายไปทั่วโค้ด
 *
 * ถ้าวันหนึ่งรูปแบบคีย์เปลี่ยน (เช่น เพิ่มนิ้วเท้า) จุดที่ต้องแก้จะอยู่ที่นี่ที่เดียว
 */
export function nailKey(hand: Hand, finger: Finger): NailKey {
  return `${hand}.${finger}` as NailKey
}

export function handOf(key: NailKey): Hand {
  return key.split('.')[0] as Hand
}

export function fingerOf(key: NailKey): Finger {
  return key.split('.')[1] as Finger
}

export function nailKeysOfHand(hand: Hand): NailKey[] {
  return FINGERS.map((finger) => nailKey(hand, finger))
}

export const NAIL_SHAPES = ['round', 'almond', 'square', 'squoval', 'stiletto'] as const
export const NAIL_LENGTHS = ['short', 'medium', 'long', 'extra'] as const
export const FINISHES = ['glossy', 'matte', 'chrome', 'glitter'] as const
export const BRUSHES = ['round', 'flat', 'liner', 'glitter', 'airbrush'] as const
export const BLEND_MODES = ['normal', 'multiply', 'screen'] as const

export const MAX_LAYERS_PER_NAIL = 6
export const MAX_DECORATIONS_PER_NAIL = 30

/**
 * เพดานต่อเลเยอร์และต่อเส้น — กันการโตแบบควบคุมไม่ได้จากบั๊กหรือคำขอที่จงใจ
 *
 * ขอบเขตที่แท้จริงของขนาดเอกสารทั้งชิ้นคือเพดาน body 4 MB ของ API ไม่ใช่ค่าสองตัวนี้
 * (10 × 6 × 500 × 2,000 จุด เกิน 4 MB ไปมาก — ตัวเลขพวกนี้จึงไม่ใช่การรับประกันขนาดรวม)
 *
 * สิ่งที่ค่าสองตัวนี้ทำจริงคือหยุดกรณีที่ผิดปกติอย่างชัดเจนตั้งแต่ต้นทาง เช่น ลูปที่
 * ต่อเส้นทุกเฟรมเพราะเขียนพลาด หรือ payload ที่ยัดจุดมาหลักล้าน — ให้ล้มพร้อมข้อความ
 * ที่บอกสาเหตุได้ แทนที่จะปล่อยให้ไปตายที่เพดาน body ซึ่งบอกได้แค่ "ใหญ่เกินไป"
 *
 * ค่าที่ตั้งไว้สูงกว่าการใช้งานจริงหลายเท่า: งานที่วาดจนเต็มเล็บใช้ราวหลักสิบเส้น
 * ต่อเลเยอร์ และ simplifyPath ตัดจุดเหลือหลักสิบต่อเส้น
 */
export const MAX_STROKES_PER_LAYER = 500
export const MAX_POINTS_PER_STROKE = 2000

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR, 'ต้องเป็นรหัสสีรูปแบบ #rrggbb')

/** จุดบนเส้น — พิกัด UV ของผิวเล็บ ไม่ใช่พิกัดหน้าจอ จึงคงที่แม้เล็บเปลี่ยนรูป */
export const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  p: z.number().min(0).max(1),
})

export const strokeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('brush'),
    brush: z.enum(BRUSHES),
    color: hexColorSchema,
    size: z.number().positive().max(400),
    opacity: z.number().min(0).max(1),
    softness: z.number().min(0).max(1),
    points: z.array(pointSchema).min(1).max(MAX_POINTS_PER_STROKE),
  }),
  z.object({
    kind: z.literal('erase'),
    brush: z.enum(BRUSHES),
    size: z.number().positive().max(400),
    softness: z.number().min(0).max(1),
    points: z.array(pointSchema).min(1).max(MAX_POINTS_PER_STROKE),
  }),
  z.object({
    kind: z.literal('fill'),
    color: hexColorSchema,
  }),
])

export const layerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  blend: z.enum(BLEND_MODES),
  strokes: z.array(strokeSchema).max(MAX_STROKES_PER_LAYER),
})

/**
 * ของตกแต่งเก็บเป็นพิกัด UV ไม่ใช่พิกัดโลก (DECISION D-10)
 * ถ้าเก็บเป็น world position ของจะลอยหลุดจากเล็บทันทีที่ผู้ใช้เปลี่ยนสัดส่วนมือหรือทรงเล็บ
 */
export const decorationSchema = z.object({
  id: z.string().min(1),
  catalogId: z.string().min(1),
  u: z.number().min(0).max(1),
  v: z.number().min(0).max(1),
  rotation: z.number(),
  scale: z.number().positive().max(1),
  color: hexColorSchema.optional(),
})

export const nailSchema = z.object({
  shape: z.enum(NAIL_SHAPES),
  length: z.enum(NAIL_LENGTHS),
  finish: z.enum(FINISHES),
  baseColor: hexColorSchema,
  layers: z.array(layerSchema).min(1).max(MAX_LAYERS_PER_NAIL),
  decorations: z.array(decorationSchema).max(MAX_DECORATIONS_PER_NAIL),
})

export const handSettingsSchema = z.object({
  skinTone: hexColorSchema,
  proportions: z.object({
    handScale: z.number().min(0.8).max(1.2),
    palmWidth: z.number().min(0.7).max(1.3),
    fingerLength: z.number().min(0.7).max(1.3),
    fingerWidth: z.number().min(0.7).max(1.3),
  }),
})

export const editorSettingsSchema = z.object({
  cameraMode: z.enum(['orbit', 'focus']),
  layout: z.enum(['split', 'dock']),
})

export const DESIGN_SCHEMA_VERSION = 2

export const designDocumentSchema = z.object({
  schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
  hand: handSettingsSchema,
  // ต้องมีครบทั้ง 10 นิ้วเสมอ — ไม่ยอมให้เอกสารมีเล็บหายไปบางนิ้ว
  nails: z.object(
    Object.fromEntries(NAIL_KEYS.map((key) => [key, nailSchema])) as Record<NailKey, typeof nailSchema>,
  ),
  editorSettings: editorSettingsSchema,
})

export type Point = z.infer<typeof pointSchema>
export type Stroke = z.infer<typeof strokeSchema>
export type Layer = z.infer<typeof layerSchema>
export type Decoration = z.infer<typeof decorationSchema>
export type Nail = z.infer<typeof nailSchema>
export type DesignDocument = z.infer<typeof designDocumentSchema>
export type HandSettings = z.infer<typeof handSettingsSchema>

/**
 * เล็บเปล่าหนึ่งนิ้ว — สร้างใหม่ทุกครั้งที่เรียก
 *
 * ต้องเป็นฟังก์ชัน ไม่ใช่ค่าคงที่ที่ใช้ร่วมกัน ไม่งั้นเล็บทั้ง 10 นิ้วจะชี้ไปที่
 * อ็อบเจกต์เดียวกัน แล้วการแก้เล็บนิ้วเดียวจะเปลี่ยนทุกนิ้วพร้อมกัน
 * (จงใจไม่ใช้ structuredClone เพื่อให้แพ็กเกจนี้ไม่ผูกกับ global ของ runtime ใดเลย)
 */
function createEmptyNail(): Nail {
  return {
    shape: 'round',
    length: 'medium',
    finish: 'glossy',
    baseColor: '#ffffff',
    layers: [
      { id: 'layer-1', name: 'เลเยอร์ 1', visible: true, opacity: 1, blend: 'normal', strokes: [] },
    ],
    decorations: [],
  }
}

/** เอกสารเปล่าที่ถูกต้องตาม schema — ใช้ตอนสร้างโปรเจกต์ใหม่ */
export function createEmptyDocument(): DesignDocument {
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    hand: {
      skinTone: '#e8bfa0',
      proportions: { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 },
    },
    nails: Object.fromEntries(
      NAIL_KEYS.map((key) => [key, createEmptyNail()]),
    ) as Record<NailKey, Nail>,
    editorSettings: { cameraMode: 'orbit', layout: 'split' },
  }
}
