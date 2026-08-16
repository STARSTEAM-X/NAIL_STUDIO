import { describe, expect, it } from 'vitest'
import { deltaE76, evaluateColorHarmony, hexToLab, hueHarmony } from './colorRules.ts'

describe('colorRules', () => {
  it('converts identical colors to zero ΔE and separates black from white', () => {
    expect(deltaE76(hexToLab('#336699'), hexToLab('#336699'))).toBe(0)
    expect(deltaE76(hexToLab('#000000'), hexToLab('#ffffff'))).toBeGreaterThan(90)
  })

  it('classifies the documented hue relationships', () => {
    expect(hueHarmony('#ff0000', '#ff8000')).toBe('analogous')
    expect(hueHarmony('#ff0000', '#00ffff')).toBe('complementary')
    expect(hueHarmony('#ff0000', '#0000ff')).toBe('triadic')
    expect(hueHarmony('#ff0000', '#800000')).toBe('monochrome')
    expect(hueHarmony('#ff0000', '#ffff00')).toBe('clashing')
  })

  it('enforces contrast thresholds for patterns and decorations', () => {
    expect(evaluateColorHarmony({ base: '#ffffff', pattern: '#ffffff' }).patternOk).toBe(false)
    expect(evaluateColorHarmony({ base: '#ffffff', pattern: '#000000' }).patternOk).toBe(true)
    expect(evaluateColorHarmony({ base: '#ffffff', decoration: '#f4fbff' }).decorationOk).toBe(false)
  })
})
