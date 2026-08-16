export interface LabColor {
  l: number
  a: number
  b: number
}

export const PATTERN_CONTRAST_MIN_DE = 15
export const DECORATION_CONTRAST_MIN_DE = 10

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const DELTA_EPSILON = 216 / 24389
const DELTA_KAPPA = 24389 / 27

function rgbFromHex(hex: string): [number, number, number] {
  if (!HEX_COLOR.test(hex)) throw new RangeError(`Invalid hex color: ${hex}`)
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function labPivot(value: number): number {
  return value > DELTA_EPSILON
    ? Math.cbrt(value)
    : (DELTA_KAPPA * value + 16) / 116
}

/** Convert an sRGB hex color to CIELAB using the D65 reference white. */
export function hexToLab(hex: string): LabColor {
  const linearRgb = rgbFromHex(hex).map(linearize)
  const red = linearRgb[0]!
  const green = linearRgb[1]!
  const blue = linearRgb[2]!
  const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175
  const z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883
  const fx = labPivot(x)
  const fy = labPivot(y)
  const fz = labPivot(z)
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function deltaE76(labA: LabColor, labB: LabColor): number {
  return Math.hypot(labA.l - labB.l, labA.a - labB.a, labA.b - labB.b)
}

function hueFromHex(hex: string): number {
  const [red, green, blue] = rgbFromHex(hex)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0

  let hue: number
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  hue *= 60
  return hue < 0 ? hue + 360 : hue
}

function hueDistance(hueA: number, hueB: number): number {
  const distance = Math.abs(hueA - hueB)
  return Math.min(distance, 360 - distance)
}

export type HueHarmony = 'analogous' | 'complementary' | 'triadic' | 'monochrome' | 'clashing'

export function hueHarmony(hexA: string, hexB: string): HueHarmony {
  const distance = hueDistance(hueFromHex(hexA), hueFromHex(hexB))
  if (distance < 2) return 'monochrome'
  if (distance < 40) return 'analogous'
  if (distance >= 150 && distance <= 210) return 'complementary'
  if (distance >= 110 && distance <= 130) return 'triadic'
  return 'clashing'
}

export interface ColorHarmonyInput {
  base: string
  pattern?: string
  decoration?: string
}

export interface ColorHarmonyEvaluation {
  patternOk: boolean
  decorationOk: boolean
  hue: HueHarmony | null
}

export function evaluateColorHarmony(input: ColorHarmonyInput): ColorHarmonyEvaluation {
  const base = hexToLab(input.base)
  const patternLab = input.pattern === undefined ? null : hexToLab(input.pattern)
  const decorationLab = input.decoration === undefined ? null : hexToLab(input.decoration)
  const hue = input.pattern === undefined ? null : hueHarmony(input.base, input.pattern)

  return {
    patternOk: patternLab === null
      || (deltaE76(base, patternLab) >= PATTERN_CONTRAST_MIN_DE && hue !== 'clashing'),
    decorationOk: decorationLab === null
      || deltaE76(base, decorationLab) >= DECORATION_CONTRAST_MIN_DE,
    hue,
  }
}
