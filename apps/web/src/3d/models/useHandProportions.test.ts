import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@nail-studio/contracts'
import { shouldApplyHand } from './useHandProportions.ts'

describe('shouldApplyHand', () => {
  it('คืน true ครั้งแรก (last เป็น undefined)', () => {
    const hand = createEmptyDocument().hand
    expect(shouldApplyHand(hand, undefined)).toBe(true)
  })

  it('คืน false เมื่อ hand เป็น object เดิม (reference เท่ากัน)', () => {
    const hand = createEmptyDocument().hand
    expect(shouldApplyHand(hand, hand)).toBe(false)
  })

  it('คืน true เมื่อ hand เป็นคนละ object แม้ค่าข้างในเท่ากัน', () => {
    const a = createEmptyDocument().hand
    const b = createEmptyDocument().hand
    expect(shouldApplyHand(b, a)).toBe(true)
  })
})
