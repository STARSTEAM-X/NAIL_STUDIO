export type PaletteHarmony = 'analogous' | 'complementary' | 'triadic' | 'monochrome'
export type PaletteSource = 'curated' | 'extracted'
export type PaletteColorRole = 'base' | 'accent' | 'detail' | 'glitter'

export interface BrandColorSeed {
  brand: string
  name: string
  hex: string
  isAvailable: boolean
}

export interface PaletteColorSeed {
  role: PaletteColorRole
  hex: string
}

export interface ColorPaletteSeed {
  code: string
  nameTh: string
  colors: PaletteColorSeed[]
  harmony: PaletteHarmony
  source: PaletteSource
  popularity: number
  isActive: boolean
}

export interface DesignArchetypeSeed {
  code: string
  nameTh: string
  composerKey: string
  defaultParams: Record<string, unknown>
  supportedZones: string[]
  popularity: number
  isActive: boolean
}

export const BRAND_COLORS: BrandColorSeed[] = [
  { brand: 'GELISH', name: 'Pearl White', hex: '#F8F6F2', isAvailable: true },
  { brand: 'GELISH', name: 'Blush Nude', hex: '#E8B7A8', isAvailable: true },
  { brand: 'GELISH', name: 'Rose Petal', hex: '#D98C9A', isAvailable: true },
  { brand: 'GELISH', name: 'Cherry Red', hex: '#B3122E', isAvailable: true },
  { brand: 'GELISH', name: 'Cocoa', hex: '#7A4B3A', isAvailable: true },
  { brand: 'GELISH', name: 'Champagne', hex: '#D4AF37', isAvailable: true },
  { brand: 'GELISH', name: 'Midnight', hex: '#1D1D2C', isAvailable: true },
  { brand: 'GELISH', name: 'Soft Pink', hex: '#F3C7CF', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Milk Tea', hex: '#E0A884', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Dusty Rose', hex: '#C98B8B', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Coral', hex: '#E26D5A', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Tangerine', hex: '#E98B4A', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Lemon', hex: '#F3D56B', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Sage', hex: '#A7B59A', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Ocean', hex: '#3D7EA6', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Lavender', hex: '#A58CBD', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Mocha', hex: '#9A6A53', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Slate', hex: '#5A6472', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Ink', hex: '#2E3540', isAvailable: true },
  { brand: 'VERY GOOD NAIL', name: 'Glitter Gold', hex: '#E5C07B', isAvailable: true },
  { brand: 'SANSU', name: 'Clear', hex: '#FFFDF8', isAvailable: true },
  { brand: 'SANSU', name: 'Nude', hex: '#D9A78E', isAvailable: true },
  { brand: 'SANSU', name: 'Mauve', hex: '#A96478', isAvailable: true },
  { brand: 'SANSU', name: 'Gold', hex: '#C8A24A', isAvailable: true },
  { brand: 'SANSU', name: 'Black', hex: '#1A1A1A', isAvailable: true },
]

export const COLOR_PALETTES: ColorPaletteSeed[] = [
  {
    code: 'pal-nude-rose',
    nameTh: 'นู้ดโรสคลาสสิก',
    colors: [
      { role: 'base', hex: '#E0A884' },
      { role: 'accent', hex: '#E8B7A8' },
      { role: 'detail', hex: '#D98C9A' },
      { role: 'glitter', hex: '#D4AF37' },
    ],
    harmony: 'analogous',
    source: 'curated',
    popularity: 100,
    isActive: true,
  },
  {
    code: 'pal-berry-night',
    nameTh: 'เบอร์รี่ยามค่ำ',
    colors: [
      { role: 'base', hex: '#B3122E' },
      { role: 'accent', hex: '#A96478' },
      { role: 'detail', hex: '#1D1D2C' },
      { role: 'glitter', hex: '#F8F6F2' },
    ],
    harmony: 'complementary',
    source: 'curated',
    popularity: 96,
    isActive: true,
  },
  {
    code: 'pal-sage-sky',
    nameTh: 'เซจตัดฟ้า',
    colors: [
      { role: 'base', hex: '#A7B59A' },
      { role: 'accent', hex: '#3D7EA6' },
      { role: 'detail', hex: '#F8F6F2' },
    ],
    harmony: 'complementary',
    source: 'curated',
    popularity: 84,
    isActive: true,
  },
  {
    code: 'pal-sunset-coral',
    nameTh: 'พระอาทิตย์ตกคอรัล',
    colors: [
      { role: 'base', hex: '#E26D5A' },
      { role: 'accent', hex: '#E98B4A' },
      { role: 'detail', hex: '#F3D56B' },
    ],
    harmony: 'analogous',
    source: 'curated',
    popularity: 91,
    isActive: true,
  },
  {
    code: 'pal-lavender-milk',
    nameTh: 'ลาเวนเดอร์มิลค์',
    colors: [
      { role: 'base', hex: '#A58CBD' },
      { role: 'accent', hex: '#F3C7CF' },
      { role: 'detail', hex: '#F8F6F2' },
    ],
    harmony: 'triadic',
    source: 'curated',
    popularity: 79,
    isActive: true,
  },
  {
    code: 'pal-mocha-gold',
    nameTh: 'มอคค่าทอง',
    colors: [
      { role: 'base', hex: '#9A6A53' },
      { role: 'accent', hex: '#7A4B3A' },
      { role: 'glitter', hex: '#E5C07B' },
    ],
    harmony: 'analogous',
    source: 'curated',
    popularity: 87,
    isActive: true,
  },
  {
    code: 'pal-monochrome-ink',
    nameTh: 'หมึกโมโนโครม',
    colors: [
      { role: 'base', hex: '#1A1A1A' },
      { role: 'accent', hex: '#2E3540' },
      { role: 'detail', hex: '#5A6472' },
      { role: 'glitter', hex: '#F8F6F2' },
    ],
    harmony: 'monochrome',
    source: 'curated',
    popularity: 72,
    isActive: true,
  },
  {
    code: 'pal-clear-gold',
    nameTh: 'เคลียร์โกลด์',
    colors: [
      { role: 'base', hex: '#FFFDF8' },
      { role: 'accent', hex: '#C8A24A' },
      { role: 'glitter', hex: '#E5C07B' },
      { role: 'detail', hex: '#1A1A1A' },
    ],
    harmony: 'triadic',
    source: 'curated',
    popularity: 89,
    isActive: true,
  },
]

export const DESIGN_ARCHETYPES: DesignArchetypeSeed[] = [
  {
    code: 'french-tip',
    nameTh: 'เฟรนช์ปลายเล็บ',
    composerKey: 'french-tip',
    defaultParams: { tipDepth: 0.22, baseRole: 'base', tipRole: 'accent' },
    supportedZones: ['nail-plate', 'free-edge'],
    popularity: 100,
    isActive: true,
  },
  {
    code: 'ombre',
    nameTh: 'ไล่สีออมเบร',
    composerKey: 'ombre',
    defaultParams: { direction: 'cuticle-to-tip', stops: 3 },
    supportedZones: ['nail-plate'],
    popularity: 94,
    isActive: true,
  },
  {
    code: 'accent-nail',
    nameTh: 'เล็บเด่นหนึ่งนิ้ว',
    composerKey: 'accent-nail',
    defaultParams: { accentIndex: 3, accentRole: 'accent' },
    supportedZones: ['nail-plate', 'accent-nail'],
    popularity: 88,
    isActive: true,
  },
  {
    code: 'negative-space',
    nameTh: 'เนกาทีฟสเปซ',
    composerKey: 'negative-space',
    defaultParams: { coverage: 0.55, detailRole: 'detail' },
    supportedZones: ['nail-plate', 'negative-space'],
    popularity: 76,
    isActive: true,
  },
  {
    code: 'marble',
    nameTh: 'ลายหินอ่อน',
    composerKey: 'marble',
    defaultParams: { veinCount: 4, contrast: 0.42 },
    supportedZones: ['nail-plate'],
    popularity: 81,
    isActive: true,
  },
  {
    code: 'geometric',
    nameTh: 'เรขาคณิต',
    composerKey: 'geometric',
    defaultParams: { sides: 3, rotation: 0.25, lineWidth: 0.04 },
    supportedZones: ['nail-plate', 'accent-nail'],
    popularity: 69,
    isActive: true,
  },
  {
    code: 'glitter-gradient',
    nameTh: 'กลิตเตอร์ไล่ประกาย',
    composerKey: 'glitter-gradient',
    defaultParams: { density: 0.72, direction: 'tip-to-cuticle', glitterRole: 'glitter' },
    supportedZones: ['nail-plate', 'free-edge'],
    popularity: 85,
    isActive: true,
  },
]

const HEX_PATTERN = /^#[0-9A-F]{6}$/i
const PALETTE_ROLES = new Set<PaletteColorRole>(['base', 'accent', 'detail', 'glitter'])
const HARMONIES = new Set<PaletteHarmony>(['analogous', 'complementary', 'triadic', 'monochrome'])
const SOURCES = new Set<PaletteSource>(['curated', 'extracted'])

export function validateDesignCatalogSeed(): void {
  const brandColorKeys = new Set<string>()
  const knownHexes = new Set<string>()

  for (const color of BRAND_COLORS) {
    if (!color.brand || !color.name || !HEX_PATTERN.test(color.hex)) {
      throw new Error(`Invalid brand color seed: ${JSON.stringify(color)}`)
    }

    const key = `${color.brand}:${color.hex.toUpperCase()}`
    if (brandColorKeys.has(key)) {
      throw new Error(`Duplicate brand color seed: ${key}`)
    }
    brandColorKeys.add(key)
    knownHexes.add(color.hex.toUpperCase())
  }

  const paletteCodes = new Set<string>()
  for (const palette of COLOR_PALETTES) {
    if (paletteCodes.has(palette.code)) {
      throw new Error(`Duplicate palette seed: ${palette.code}`)
    }
    if (!palette.code || !palette.nameTh || !HARMONIES.has(palette.harmony) || !SOURCES.has(palette.source)) {
      throw new Error(`Invalid color palette seed: ${palette.code}`)
    }
    paletteCodes.add(palette.code)

    const roles = new Set<PaletteColorRole>()
    for (const color of palette.colors) {
      if (!PALETTE_ROLES.has(color.role) || roles.has(color.role) || !knownHexes.has(color.hex.toUpperCase())) {
        throw new Error(`Palette ${palette.code} references an invalid or unknown color`)
      }
      roles.add(color.role)
    }
  }

  const archetypeCodes = new Set<string>()
  for (const archetype of DESIGN_ARCHETYPES) {
    if (
      archetypeCodes.has(archetype.code) ||
      !archetype.code ||
      archetype.composerKey !== archetype.code ||
      archetype.supportedZones.length === 0
    ) {
      throw new Error(`Invalid design archetype seed: ${archetype.code}`)
    }
    archetypeCodes.add(archetype.code)
  }
}
