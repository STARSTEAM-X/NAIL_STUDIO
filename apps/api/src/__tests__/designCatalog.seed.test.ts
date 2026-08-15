import { describe, expect, it } from 'vitest'
import {
  BRAND_COLORS,
  COLOR_PALETTES,
  DESIGN_ARCHETYPES,
  validateDesignCatalogSeed,
} from '../designCatalog/seedData.ts'

describe('design catalog seed', () => {
  it('passes all cross-reference validation', () => {
    expect(() => validateDesignCatalogSeed()).not.toThrow()
  })

  it('contains the initial brand inventory and curated palettes', () => {
    expect(BRAND_COLORS).toHaveLength(25)
    expect(new Set(BRAND_COLORS.map((color) => color.brand))).toEqual(
      new Set(['GELISH', 'VERY GOOD NAIL', 'SANSU']),
    )
    expect(COLOR_PALETTES).toHaveLength(8)
    expect(COLOR_PALETTES.every((palette) => palette.source === 'curated')).toBe(true)
  })

  it('keeps archetype keys aligned with their catalog codes', () => {
    expect(DESIGN_ARCHETYPES).toHaveLength(7)
    expect(DESIGN_ARCHETYPES.every((archetype) => archetype.composerKey === archetype.code)).toBe(true)
    expect(new Set(DESIGN_ARCHETYPES.map((archetype) => archetype.code))).toEqual(
      new Set(['french-tip', 'ombre', 'accent-nail', 'negative-space', 'marble', 'geometric', 'glitter-gradient']),
    )
  })
})
