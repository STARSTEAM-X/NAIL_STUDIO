import {
  FINGERS,
  FINISHES,
  MAX_DECORATIONS_PER_NAIL,
  NAIL_LENGTHS,
  NAIL_SHAPES,
  type Decoration,
  type Nail,
  type NailKey,
} from '@nail-studio/contracts'
import type { AiRecipe } from '@/features/ai/aiClient.ts'
import { catalogEntry } from '@/3d/decorations/decorationCatalog.ts'
import type { Pt2 } from '@/3d/geometry/hull.ts'
import { evaluateColorHarmony } from './colorRules.ts'
import { poissonDiskInHull } from './scatter.ts'

const PALETTES: Readonly<Record<string, readonly string[]>> = {
  'pal-nude-rose': ['#E0A884', '#E8B7A8', '#D98C9A', '#D4AF37'],
  'pal-berry-night': ['#B3122E', '#A96478', '#1D1D2C', '#F8F6F2'],
  'pal-sage-sky': ['#A7B59A', '#3D7EA6', '#F8F6F2'],
  'pal-sunset-coral': ['#E26D5A', '#E98B4A', '#F3D56B'],
  'pal-lavender-milk': ['#A58CBD', '#F3C7CF', '#F8F6F2'],
  'pal-mocha-gold': ['#9A6A53', '#7A4B3A', '#E5C07B'],
  'pal-monochrome-ink': ['#1A1A1A', '#2E3540', '#5A6472', '#F8F6F2'],
  'pal-clear-gold': ['#FFFDF8', '#C8A24A', '#E5C07B', '#1A1A1A'],
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const DEFAULT_DECORATION_SCALE = 0.3
const BASE_DECORATION_RADIUS = 0.08
const MIN_DECORATION_RADIUS = 0.02
const NEGATIVE_SPACE_POINT_RATIO = 0.5
const ACCENT_SATURATION = 0.65
const DARK_COMPLEMENT_LIGHTNESS = 0.28
const LIGHT_COMPLEMENT_LIGHTNESS = 0.72
const RECIPE_ZONES = new Set(['nail-plate', 'free-edge', 'accent-nail', 'negative-space'])

export interface ComposedNailChange {
  baseColor: string
  finish: Nail['finish']
  shape: Nail['shape']
  length: Nail['length']
  decorations: Decoration[]
}

export interface ComposeResult extends Map<NailKey, ComposedNailChange> {
  readonly warnings: string[]
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seedFromRecipe(recipe: Pick<AiRecipe, 'archetype' | 'paletteId' | 'baseColor'>): number {
  return hashString(`${recipe.archetype}|${recipe.paletteId}|${recipe.baseColor}`)
}

function mixSeed(seed: number, key: NailKey, decorationIndex: number): number {
  return hashString(`${seed}|${key}|${decorationIndex}`)
}

function clampDensity(density: number): number {
  return Number.isFinite(density) ? Math.min(1, Math.max(0, density)) : 0
}

function centroid(hull: readonly Pt2[]): Pt2 {
  let x = 0
  let y = 0
  for (const point of hull) {
    x += point.x
    y += point.y
  }
  return { x: x / hull.length, y: y / hull.length }
}

function hslFromHex(hex: string): [number, number, number] {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return [0, 0, lightness]
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = max === red
    ? ((green - blue) / delta) % 6
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4
  hue = (hue * 60 + 360) % 360
  return [hue, saturation, lightness]
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const second = chroma * (1 - Math.abs((section % 2) - 1))
  const match = lightness - chroma / 2
  const [red, green, blue] = section < 1
    ? [chroma, second, 0]
    : section < 2
      ? [second, chroma, 0]
      : section < 3
        ? [0, chroma, second]
        : section < 4
          ? [0, second, chroma]
          : section < 5
            ? [second, 0, chroma]
            : [chroma, 0, second]
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function complementaryColor(hex: string): string {
  const [hue, saturation, lightness] = hslFromHex(hex)
  const safeSaturation = saturation < 0.01 ? ACCENT_SATURATION : saturation
  const safeLightness = saturation < 0.01
    ? lightness < 0.5 ? LIGHT_COMPLEMENT_LIGHTNESS : DARK_COMPLEMENT_LIGHTNESS
    : lightness
  return hslToHex((hue + 180) % 360, safeSaturation, safeLightness)
}

function typedOption<T extends readonly string[]>(value: string, options: T, fallback: T[number]): T[number] {
  return (options as readonly string[]).includes(value) ? value as T[number] : fallback
}

function modelShapeFromRecipe(shape: string): string {
  // hand.glb has no oval/coffin morph targets, so use the closest supported model shape.
  if (shape === 'oval') return 'round'
  if (shape === 'coffin') return 'square'
  return shape
}

function warningForColor(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message)
}

function decorationFor(
  id: string,
  catalogId: string,
  point: Pt2,
  scale: number,
): Decoration {
  return { id, catalogId, u: point.x, v: point.y, rotation: 0, scale }
}

function addScatterDecorations(
  decorations: Decoration[],
  hull: readonly Pt2[] | undefined,
  recipeDecoration: AiRecipe['decorations'][number],
  entryIndex: number,
  nailKey: NailKey,
  seed: number,
  maxPoints: number,
  warnings: string[],
): void {
  if (!hull || maxPoints <= 0) return
  const density = clampDensity(recipeDecoration.density)
  const radius = Math.max(MIN_DECORATION_RADIUS, BASE_DECORATION_RADIUS * (1 - density * 0.5))
  const vRange = recipeDecoration.zone === 'free-edge'
    ? [0.75, 1] as [number, number]
    : recipeDecoration.zone === 'negative-space'
      ? [0, 0.25] as [number, number]
      : undefined
  const scatterOptions = {
    radius,
    maxPoints,
    seed: mixSeed(seed, nailKey, entryIndex),
    ...(vRange === undefined ? {} : { vRange }),
  }
  const points = poissonDiskInHull(hull, scatterOptions)
  for (const [pointIndex, point] of points.entries()) {
    decorations.push(decorationFor(
      `ai-${seed.toString(16)}-${nailKey.replace('.', '-')}-${entryIndex}-${pointIndex}`,
      recipeDecoration.catalogId,
      point,
      DEFAULT_DECORATION_SCALE,
    ))
  }
  if (points.length < maxPoints) {
    warningForColor(warnings, `วาง ${recipeDecoration.catalogId} บน ${nailKey} ได้ ${points.length}/${maxPoints} ชิ้นตามพื้นที่ hull`)
  }
}

export function composeFromRecipe(
  recipe: AiRecipe,
  hulls: ReadonlyMap<NailKey, Pt2[]>,
  seed: number,
): ComposeResult {
  const changes = new Map<NailKey, ComposedNailChange>() as ComposeResult
  const warnings: string[] = []
  Object.defineProperty(changes, 'warnings', { value: warnings, enumerable: false })
  const baseColor = HEX_COLOR.test(recipe.baseColor) ? recipe.baseColor : '#ffffff'
  const finish = typedOption(recipe.finish, FINISHES, 'glossy')
  const shape = typedOption(modelShapeFromRecipe(recipe.shape), NAIL_SHAPES, 'round')
  const length = typedOption(recipe.length, NAIL_LENGTHS, 'medium')
  const palette = PALETTES[recipe.paletteId] ?? []
  const accentNails = new Set((Array.isArray(recipe.accentNails) ? recipe.accentNails : [])
    .filter((index) => Number.isInteger(index) && index >= 0 && index < FINGERS.length))
  const recipeDecorations = Array.isArray(recipe.decorations) ? recipe.decorations : []

  for (const [fingerIndex, finger] of FINGERS.entries()) {
    const key = `right.${finger}` as NailKey
    const nailBaseColor = accentNails.has(fingerIndex)
      ? (() => {
        for (const candidate of palette) {
          if (evaluateColorHarmony({ base: baseColor, pattern: candidate }).patternOk) return candidate
        }
        warningForColor(warnings, `ไม่มีสี accent ใน palette ${recipe.paletteId} ที่ผ่าน ΔE/hue; ใช้สี complementary ที่คำนวณจากสีพื้น`)
        return complementaryColor(baseColor)
      })()
      : baseColor
    const decorations: Decoration[] = []
    const hull = hulls.get(key)

    for (const [entryIndex, recipeDecoration] of recipeDecorations.entries()) {
      if (decorations.length >= MAX_DECORATIONS_PER_NAIL) break
      if (!RECIPE_ZONES.has(recipeDecoration.zone)) {
        warningForColor(warnings, `ข้ามของตกแต่ง ${recipeDecoration.catalogId} เพราะ zone ไม่รองรับ`)
        continue
      }
      const entry = catalogEntry(recipeDecoration.catalogId)
      if (!entry) {
        warningForColor(warnings, `ไม่พบของตกแต่ง ${recipeDecoration.catalogId} ใน catalog`)
        continue
      }
      if (!evaluateColorHarmony({ base: nailBaseColor, decoration: entry.defaultColor }).decorationOk) {
        warningForColor(warnings, `ข้ามของตกแต่ง ${recipeDecoration.catalogId} บน ${key} เพราะสีจมกับพื้น (ΔE < 10)`)
        continue
      }

      const density = clampDensity(recipeDecoration.density)
      const requested = Math.max(1, Math.round(density * MAX_DECORATIONS_PER_NAIL))
      const remaining = MAX_DECORATIONS_PER_NAIL - decorations.length
      if (recipeDecoration.zone === 'accent-nail') {
        if (hull && hull.length >= 3) {
          decorations.push(decorationFor(
            `ai-${seed.toString(16)}-${key.replace('.', '-')}-${entryIndex}-accent`,
            recipeDecoration.catalogId,
            centroid(hull),
            Math.min(1, 0.45 + density * 0.45),
          ))
        }
        continue
      }

      const requestedForZone = recipeDecoration.zone === 'negative-space'
        ? Math.max(1, Math.round(requested * NEGATIVE_SPACE_POINT_RATIO))
        : requested
      addScatterDecorations(
        decorations,
        hull,
        recipeDecoration,
        entryIndex,
        key,
        seed,
        Math.min(remaining, requestedForZone),
        warnings,
      )
    }

    changes.set(key, { baseColor: nailBaseColor, finish, shape, length, decorations })
  }

  return changes
}
