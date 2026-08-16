import { MAX_DECORATIONS_PER_NAIL, type NailKey } from '@nail-studio/contracts'
import { describe, expect, it } from 'vitest'
import { isPointInHull } from '@/3d/geometry/pointInHull.ts'
import { computeHull, type Pt2 } from '@/3d/geometry/hull.ts'
import { deltaE76, hexToLab } from './colorRules.ts'
import { composeFromRecipe, seedFromRecipe } from './composer.ts'
import type { AiRecipe } from '@/features/ai/aiClient.ts'

const HULL: Pt2[] = computeHull([
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
])

const RECIPE: AiRecipe = {
  archetype: 'geometric',
  paletteId: 'pal-berry-night',
  baseColor: '#ffffff',
  accentNails: [0, 2],
  finish: 'chrome',
  shape: 'coffin',
  length: 'long',
  decorations: [
    { catalogId: 'metal-hoop', zone: 'nail-plate', density: 0.5 },
    { catalogId: 'gem-princess', zone: 'accent-nail', density: 1 },
  ],
}

const LOW_CONTRAST_RECIPE: AiRecipe = {
  ...RECIPE,
  accentNails: [],
  decorations: [{ catalogId: 'gem-princess', zone: 'nail-plate', density: 1 }],
}

describe('composeFromRecipe', () => {
  it('is deterministic and applies all right-hand nails', () => {
    const nailHulls = new Map<NailKey, Pt2[]>([
      ['right.thumb', HULL], ['right.index', HULL], ['right.middle', HULL],
      ['right.ring', HULL], ['right.little', HULL],
    ])
    const first = composeFromRecipe(RECIPE, nailHulls, seedFromRecipe(RECIPE))
    const second = composeFromRecipe(RECIPE, nailHulls, seedFromRecipe(RECIPE))
    expect([...second.entries()]).toEqual([...first.entries()])
    expect(first).toHaveLength(5)
    expect(first.get('right.thumb')?.baseColor).not.toBe(RECIPE.baseColor)
    expect(deltaE76(hexToLab(first.get('right.thumb')!.baseColor), hexToLab(RECIPE.baseColor))).toBeGreaterThanOrEqual(15)
  })

  it('keeps generated decorations inside the hull and skips low-contrast assets', () => {
    const nailHulls = new Map<NailKey, Pt2[]>([
      ['right.thumb', HULL], ['right.index', HULL], ['right.middle', HULL],
      ['right.ring', HULL], ['right.little', HULL],
    ])
    const result = composeFromRecipe(LOW_CONTRAST_RECIPE, nailHulls, 123)
    for (const change of result.values()) {
      expect(change.decorations.length).toBeLessThanOrEqual(MAX_DECORATIONS_PER_NAIL)
      for (const decoration of change.decorations) {
        expect(isPointInHull(HULL, { x: decoration.u, y: decoration.v })).toBe(true)
        expect(decoration.catalogId).not.toBe('gem-princess')
      }
    }
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
