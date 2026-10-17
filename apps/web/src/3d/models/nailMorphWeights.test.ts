import { describe, expect, it } from 'vitest'
import { NAIL_LENGTHS, NAIL_SHAPES } from '@nail-studio/contracts'
import { nailMorphWeights } from './nailMorphWeights.ts'

const NAMES = ['almond', 'square', 'squoval', 'stiletto', 'short', 'long', 'extra']

describe('nailMorphWeights', () => {
  it('เปิด target ของทรงและความยาวที่เลือก (round/medium ไม่มี target) ครบ 5 × 4 ชุด', () => {
    for (const shape of NAIL_SHAPES) {
      for (const length of NAIL_LENGTHS) {
        const expected = NAMES.map((name) => (name === shape || name === length ? 1 : 0))
        expect(nailMorphWeights(NAMES, shape, length), `${shape}/${length}`).toEqual(expected)
      }
    }
  })

  it('ชื่อที่ไม่รู้จักได้ 0 และเรียงตาม targetNames', () => {
    expect(nailMorphWeights(['extra', 'unknown', 'almond'], 'almond', 'extra')).toEqual([1, 0, 1])
  })
})
