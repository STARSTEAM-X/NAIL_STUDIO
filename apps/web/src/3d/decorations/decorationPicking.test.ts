import { describe, expect, it } from 'vitest'
import type { Decoration } from '@nail-studio/contracts'
import { nearestDecoration, SELECTION_RADIUS_UV } from './decorationPicking.ts'

function deco(id: string, u: number, v: number): Decoration {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('nearestDecoration', () => {
  it('returns null for an empty list', () => {
    expect(nearestDecoration([], 0.5, 0.5)).toBeNull()
  })

  it('returns the only decoration when the click is within range', () => {
    const target = deco('a', 0.5, 0.5)
    expect(nearestDecoration([target], 0.51, 0.5)).toBe(target)
  })

  it('returns null when the nearest decoration is outside the selection radius', () => {
    const target = deco('a', 0.5, 0.5)
    const far = 0.5 + SELECTION_RADIUS_UV * 3
    expect(nearestDecoration([target], far, 0.5)).toBeNull()
  })

  it('picks the closer of two overlapping decorations', () => {
    const near = deco('near', 0.5, 0.5)
    const far = deco('far', 0.55, 0.55)
    expect(nearestDecoration([far, near], 0.5, 0.5)).toBe(near)
  })

  it('treats a point exactly at the selection radius boundary as inside', () => {
    const target = deco('a', 0.5, 0.5)
    expect(nearestDecoration([target], 0.5 + SELECTION_RADIUS_UV, 0.5)).toBe(target)
  })
})
