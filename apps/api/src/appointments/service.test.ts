import { describe, expect, it } from 'vitest'
import { allowedTransition } from './service.ts'

describe('appointment state machine', () => {
  it('allows only documented forward transitions', () => {
    expect(allowedTransition('pending', 'confirmed')).toBe(true)
    expect(allowedTransition('pending', 'counter_offered')).toBe(true)
    expect(allowedTransition('counter_offered', 'counter_offered')).toBe(true)
    expect(allowedTransition('completed', 'cancelled')).toBe(false)
    expect(allowedTransition('declined', 'confirmed')).toBe(false)
  })
})
