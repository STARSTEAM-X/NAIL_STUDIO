/**
 * แปลงสีให้ใกล้กับที่ผู้ใช้เห็นบนโมเดลในเว็บ — แสงของฉาก + ACES Filmic tone mapping
 *
 * NailScene ใช้ค่าเริ่มต้นของ react-three-fiber: ACESFilmicToneMapping, exposure 1,
 * output sRGB บวกแสง ambient/directional/environment ซึ่งรวมกันแล้วสว่างกว่าสีพื้นจริง
 * ที่นี่ย่อแสงทั้งหมดเหลือ "กำลังแสง" ค่าเดียว (SCENE_LIGHT_GAIN) ณ ผิวที่หันหาผู้ดู
 * เป็นค่าประมาณ ไม่ใช่ PBR — พอให้ AI รู้ว่าสีจะอ่อน/อิ่มลงแค่ไหน
 */

/**
 * กำลังแสงที่ผิวหันตรงหาผู้ดู (คูณสีแบบ linear ก่อน tone mapping)
 *
 * ปรับเทียบกับฉากจริง (2026-10-17): จ่อกล้องที่เล็บสีพื้นล้วนใน tools/pattern-review.html
 * แล้วอ่านพิกเซลกลางเล็บ 5 สี (#ddb3a9 #861d35 #d2cbea #123b57 #efcfc4) — ค่า 0.80 ให้
 * ΔE76 เฉลี่ย 2.9 (ค่าตั้งต้นเดิม 1.6 จากคู่สีในคู่มือคลาดราว 17)
 * ถ้าแก้แสง/tone mapping ใน NailScene ให้วัดซ้ำแล้วแก้ค่านี้ที่เดียว
 */
export const SCENE_LIGHT_GAIN = 0.8

/** ทิศแสงหลักในกรอบภาพ (x ขวา, y ขึ้น, z หาผู้ดู) — ด้านหน้าเฉียงขวาบนแบบเดียวกับ directionalLight */
export const LIGHT_DIR: readonly [number, number, number] = (() => {
  const v = [0.3, 0.5, 0.8]
  const length = Math.hypot(v[0]!, v[1]!, v[2]!)
  return [v[0]! / length, v[1]! / length, v[2]! / length] as const
})()

/** ส่วนของแสงที่ไม่ขึ้นกับทิศ — ผิวที่หันหนีแสงยังไม่มืดสนิท */
export const AMBIENT = 0.35 * SCENE_LIGHT_GAIN
/** ตั้งให้ AMBIENT + KEY × (N₀·L) = SCENE_LIGHT_GAIN เมื่อ N₀ = (0, 0, 1) */
export const KEY = (SCENE_LIGHT_GAIN - AMBIENT) / LIGHT_DIR[2]

const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})

export function srgbToLinear(byte: number): number {
  return SRGB_TO_LINEAR[byte]!
}

export function linearToSrgbByte(value: number): number {
  const c = value <= 0 ? 0 : value >= 1 ? 1 : value
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(s * 255)
}

const rrtAndOdtFit = (v: number): number => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)

/**
 * ACESFilmicToneMapping ของ three.js (ShaderChunk tonemapping_pars_fragment) — ทำงานกับสี linear
 * exposure ÷ 0.6, เมทริกซ์ input → RRTAndODTFit → เมทริกซ์ output → clamp 0–1
 */
export function acesFilmic(r: number, g: number, b: number, out: number[] = [0, 0, 0]): number[] {
  const scale = 1 / 0.6
  r *= scale
  g *= scale
  b *= scale
  // ACESInputMat (column-major ใน GLSL → เขียนเป็นแถวของผลลัพธ์)
  const ir = rrtAndOdtFit(0.59719 * r + 0.35458 * g + 0.04823 * b)
  const ig = rrtAndOdtFit(0.076 * r + 0.90834 * g + 0.01566 * b)
  const ib = rrtAndOdtFit(0.0284 * r + 0.13383 * g + 0.83777 * b)
  // ACESOutputMat
  out[0] = Math.min(1, Math.max(0, 1.60475 * ir - 0.53108 * ig - 0.07367 * ib))
  out[1] = Math.min(1, Math.max(0, -0.10208 * ir + 1.10813 * ig - 0.00605 * ib))
  out[2] = Math.min(1, Math.max(0, -0.00327 * ir - 0.07276 * ig + 1.07602 * ib))
  return out
}

/** สีพื้น (hex) เมื่ออยู่บนโมเดล ณ ผิวที่หันหาผู้ดู — ใช้ในข้อความ/lint และเทส */
export function toSceneColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  const mapped = acesFilmic(
    srgbToLinear(rgb[0]!) * SCENE_LIGHT_GAIN,
    srgbToLinear(rgb[1]!) * SCENE_LIGHT_GAIN,
    srgbToLinear(rgb[2]!) * SCENE_LIGHT_GAIN,
  )
  return `#${mapped.map((c) => linearToSrgbByte(c).toString(16).padStart(2, '0')).join('')}`
}

/** sRGB byte → CIE Lab (D65) สำหรับวัด ΔE76 */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
