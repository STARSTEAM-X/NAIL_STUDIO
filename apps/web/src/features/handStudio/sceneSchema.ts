import { z } from 'zod'
import { FINGERS, HANDS, hexColorSchema, type Finger, type Hand } from '@nail-studio/contracts'

export const SHAPES = ['round', 'oval', 'almond', 'square', 'squoval', 'coffin', 'stiletto'] as const
export const FINISHES = ['glossy', 'matte', 'chrome', 'jelly', 'glitter', 'cat_eye'] as const
export const POSES = ['open', 'relaxed', 'soft_fist', 'pinch', 'v'] as const
export const LIGHTS = ['studio', 'daylight', 'warm', 'cool'] as const
export const DECORATIONS = ['diamond', 'pearl', 'bow', 'flower', 'charm', 'sticker'] as const
const unit = () => z.number().min(0).max(1)
const recordOfFingers = <T extends z.ZodType>(schema: T) => z.object(
  Object.fromEntries(FINGERS.map((finger) => [finger, schema])) as Record<Finger, T>,
)

/** PNG only, with a checked IHDR before the browser can allocate image memory. */
export const nailTextureSchema = z.string().max(87_408).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/).refine((value) => {
  try {
    const header = atob(value.slice(22, 22 + 44))
    if (!header.startsWith('\x89PNG\r\n\x1a\n') || header.slice(12, 16) !== 'IHDR') return false
    const size = (at: number) => ((header.charCodeAt(at) * 0x1000000) + (header.charCodeAt(at + 1) << 16) + (header.charCodeAt(at + 2) << 8) + header.charCodeAt(at + 3))
    return size(16) > 0 && size(16) <= 2048 && size(20) > 0 && size(20) <= 2048
  } catch { return false }
}, 'PNG ต้องมีขนาดไม่เกิน 64 KB และกว้าง/สูงไม่เกิน 2048 px')

// Degrees, relative to the imported bind pose. Thumb: CMC / MCP / IP.
export const jointSchema = z.object({
  mcp: z.number().min(-10).max(85),
  pip: z.number().min(0).max(100),
  dip: z.number().min(0).max(75),
  spread: z.number().min(-18).max(18),
})
export const poseSchema = z.object({
  preset: z.enum([...POSES, 'custom']),
  joints: recordOfFingers(jointSchema),
  opposition: z.number().min(0).max(65),
  wrist: z.object({ x: z.number().min(-60).max(60), y: z.number().min(-90).max(90), z: z.number().min(-60).max(60) }),
}).superRefine((pose, context) => {
  if (pose.joints.thumb.mcp > 50) context.addIssue({ code: 'custom', path: ['joints', 'thumb', 'mcp'], message: 'Thumb CMC จำกัด 50°' })
  if (pose.joints.thumb.pip > 65) context.addIssue({ code: 'custom', path: ['joints', 'thumb', 'pip'], message: 'Thumb MCP จำกัด 65°' })
})
export const studioNailSchema = z.object({
  shape: z.enum(SHAPES), length: unit(),
  width: z.number().min(0.8).max(1.15), curvature: z.number().min(0.65).max(1.4),
  taper: unit(), tipWidth: z.number().min(0.1).max(1),
  baseColor: hexColorSchema, tipColor: hexColorSchema, opacity: z.number().min(0.15).max(1),
  finish: z.enum(FINISHES),
  texture: nailTextureSchema.nullable().default(null),
  pattern: z.object({ type: z.enum(['solid', 'french', 'ombre']), amount: z.number().min(0.08).max(0.7), softness: z.number().min(0.01).max(0.8), angle: z.number().min(-180).max(180) }),
  decorations: z.array(z.object({
    id: z.string().min(1).max(80), type: z.enum(DECORATIONS),
    u: z.number().min(0.12).max(0.88), v: z.number().min(0.12).max(0.88),
    rotation: z.number().min(-180).max(180), scale: z.number().min(0.4).max(1.6), color: hexColorSchema,
  })).max(12),
})
export const studioHandSchema = z.object({
  enabled: z.boolean(),
  skin: z.object({ tone: hexColorSchema, roughness: z.number().min(0.25).max(0.95), detail: z.number().min(0).max(2) }),
  pose: poseSchema,
  proportions: z.object({
    palmWidth: z.number().min(0.85).max(1.15), fingerWidth: z.number().min(0.85).max(1.15),
    fingerLengths: recordOfFingers(z.number().min(0.85).max(1.15)),
  }),
  nails: recordOfFingers(studioNailSchema),
})
const vectorSchema = z.tuple([z.number().min(-3).max(3), z.number().min(-3).max(3), z.number().min(-3).max(3)])
export const studioSceneSchema = z.object({
  schemaVersion: z.literal('1.0'), modelId: z.literal('realistic-hand-v1'),
  hands: z.object({ left: studioHandSchema, right: studioHandSchema }),
  presets: z.object({
    poses: z.array(z.object({ name: z.string().min(1).max(40), value: poseSchema })).max(12),
    nails: z.array(z.object({ name: z.string().min(1).max(40), value: studioNailSchema })).max(12),
  }).default({ poses: [], nails: [] }),
  scene: z.object({
    lighting: z.enum(LIGHTS), intensity: z.number().min(0.3).max(2), highlights: z.boolean(),
    background: hexColorSchema, transparent: z.boolean(),
    quality: z.enum(['low', 'high']),
    photoAspect: z.enum(['square', 'portrait', 'landscape']).default('square'),
    camera: z.object({ position: vectorSchema, target: vectorSchema }).refine(
      ({ position, target }) => Math.hypot(...position.map((value, index) => value - target[index]!)) > 0.005,
      'ตำแหน่งกล้องต้องไม่ซ้อนกับจุดเล็ง',
    ),
  }),
})
export type StudioScene = z.infer<typeof studioSceneSchema>
export type StudioHand = z.infer<typeof studioHandSchema>
export type StudioNail = z.infer<typeof studioNailSchema>
export type HandPose = z.infer<typeof poseSchema>
export type JointPose = z.infer<typeof jointSchema>
export type StudioDecoration = StudioNail['decorations'][number]

export function createPose(preset: typeof POSES[number] = 'open'): HandPose {
  const joints = Object.fromEntries(FINGERS.map((finger) => [finger, { mcp: 0, pip: 0, dip: 0, spread: 0 }])) as HandPose['joints']
  const pose: HandPose = { preset, joints, opposition: 0, wrist: { x: 0, y: 0, z: 0 } }
  const curl = (finger: Finger, mcp: number, pip: number, dip: number) => { joints[finger] = { ...joints[finger], mcp, pip, dip } }
  if (preset === 'relaxed') {
    FINGERS.forEach((finger, index) => curl(finger, 8 + index * 2, 12 + index * 2, 6 + index))
  } else if (preset === 'soft_fist') {
    FINGERS.forEach((finger) => curl(finger, 48, 65, 38))
    curl('thumb', 12, 20, 12)
    pose.opposition = 28
  } else if (preset === 'pinch') {
    curl('thumb', 35, 12, 6)
    curl('index', 20, 80, 35)
    for (const finger of ['middle', 'ring', 'little'] as const) curl(finger, 16, 24, 12)
    joints.thumb.spread = -12
    pose.opposition = 45
  } else if (preset === 'v') {
    curl('thumb', 16, 25, 18)
    curl('ring', 52, 72, 42)
    curl('little', 55, 76, 45)
    joints.index.spread = 10
    joints.middle.spread = -8
    pose.opposition = 22
  }
  return pose
}

export function createStudioScene(): StudioScene {
  const hand = (): StudioHand => ({
    enabled: true,
    skin: { tone: '#e8bfa0', roughness: 0.58, detail: 0.65 },
    pose: createPose(),
    proportions: { palmWidth: 1, fingerWidth: 1, fingerLengths: Object.fromEntries(FINGERS.map((finger) => [finger, 1])) as Record<Finger, number> },
    nails: recordOfFingers(studioNailSchema).parse(Object.fromEntries(FINGERS.map((finger) => [finger, {
      shape: 'round', length: 0.12, width: 1, curvature: 1, taper: 0.25, tipWidth: 0.65,
      baseColor: '#e3b1ad', tipColor: '#fff5ec', opacity: 0.8, finish: 'glossy',
      pattern: { type: 'solid', amount: 0.25, softness: 0.25, angle: 0 }, texture: null, decorations: [],
    }]))),
  })
  const left = hand()
  left.enabled = false
  return {
    schemaVersion: '1.0', modelId: 'realistic-hand-v1', hands: { left, right: hand() }, presets: { poses: [], nails: [] },
    scene: { lighting: 'studio', intensity: 1, highlights: true, background: '#e8e2dc', transparent: false, quality: 'high', photoAspect: 'square', camera: { position: [0, 0.032, 0.57], target: [0, 0.032, 0] } },
  }
}

export type NailScope = 'nail' | 'hand' | 'both'
/** Immutable O(10) update; retain every unaffected hand/nail identity. */
export function updateNails(scene: StudioScene, hand: Hand, finger: Finger, scope: NailScope, patch: Partial<StudioNail>): StudioScene {
  const hands = { ...scene.hands }
  for (const side of scope === 'both' ? HANDS : [hand]) {
    const nails = { ...hands[side].nails }
    for (const digit of scope === 'nail' ? [finger] : FINGERS) {
      nails[digit] = studioNailSchema.parse({ ...nails[digit], ...patch })
    }
    hands[side] = { ...hands[side], nails }
  }
  return { ...scene, hands }
}

export const MAX_SCENE_BYTES = 2_097_152
export function parseStudioJson(text: string): StudioScene {
  if (new TextEncoder().encode(text).length > MAX_SCENE_BYTES) throw new Error('ไฟล์ฉากต้องมีขนาดไม่เกิน 2 MB')
  return studioSceneSchema.parse(JSON.parse(text))
}
