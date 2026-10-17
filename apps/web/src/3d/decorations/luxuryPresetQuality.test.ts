import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { FINGERS } from '@nail-studio/contracts'
import { buildFromRecipe, PRESETS } from '../../../../../packages/patterns/src/index.ts'
import { catalogEntry } from './decorationCatalog.ts'

describe('luxury preset 3D quality regressions', () => {
  for (const id of ['gem-chaton', 'gem-marquise']) {
    it(id + ' lies flat with thickness along the local Y nail normal', () => {
      const geometry = catalogEntry(id)!.geometry()
      try {
        geometry.computeBoundingBox()
        const size = geometry.boundingBox!.getSize(new Vector3())
        expect(size.y).toBeLessThan(size.x)
        expect(size.y).toBeLessThan(size.z)
      } finally { geometry.dispose() }
    })
  }

  it('the chaton table faces outward along local +Y rather than edge-on', () => {
    const geometry = catalogEntry('gem-chaton')!.geometry()
    try {
      geometry.computeBoundingBox()
      const top = geometry.boundingBox!.max.y
      const positions = geometry.getAttribute('position')
      const index = geometry.getIndex()!
      let area = 0
      const a = new Vector3(), b = new Vector3(), c = new Vector3()
      for (let i = 0; i < index.count; i += 3) {
        a.fromBufferAttribute(positions, index.getX(i))
        b.fromBufferAttribute(positions, index.getX(i + 1))
        c.fromBufferAttribute(positions, index.getX(i + 2))
        if ([a, b, c].some((p) => Math.abs(p.y - top) > 1e-6)) continue
        area += b.sub(a).cross(c.sub(a)).y / 2
      }
      expect(area).toBeGreaterThan(0.35)
    } finally { geometry.dispose() }
  })

  it('keeps warm pink/beige pigment in the pale bases under bright lighting', () => {
    for (const id of ['peach-blush', 'bridal-crystal-lace', 'emerald-marble-foil']) {
      const document = buildFromRecipe(PRESETS[id]!.recipe).document
      const fingers = id === 'emerald-marble-foil' ? ['middle', 'little'] as const : FINGERS
      for (const finger of fingers) {
        const base = document.nails[`right.${finger}`].baseColor
        const red = Number.parseInt(base.slice(1, 3), 16)
        const green = Number.parseInt(base.slice(3, 5), 16)
        const blue = Number.parseInt(base.slice(5, 7), 16)
        expect(red - green, id + '/' + finger).toBeGreaterThanOrEqual(40)
        expect(green).toBeGreaterThan(blue)
      }
    }
  })

  it('leaves the cuticle half of every bridal nail free of milky white paint', () => {
    const document = buildFromRecipe(PRESETS['bridal-crystal-lace']!.recipe).document
    for (const finger of FINGERS) {
      const white = document.nails[`right.${finger}`].layers.flatMap((layer) => layer.strokes)
        .filter((stroke) => stroke.kind === 'brush' && stroke.color === '#fbf6f1')
      expect(white.length).toBeGreaterThan(0)
      for (const stroke of white) {
        if (stroke.kind !== 'brush') throw new Error('expected brush')
        for (const point of stroke.points) expect(point.y + stroke.size / 2048).toBeLessThan(0.5)
      }
    }
  })
})
