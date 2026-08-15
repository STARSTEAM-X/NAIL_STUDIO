import { describe, expect, it } from 'vitest'
import { registerSchema } from './auth.ts'

describe('registerSchema', () => {
  it('accepts registration details from the sign-up form', () => {
    const result = registerSchema.parse({
      email: 'artist@example.com',
      password: 'long-enough-password',
      displayName: 'Artist',
      dateOfBirth: '1995-04-12',
      termsAccepted: true,
    })

    expect(result.dateOfBirth).toBe('1995-04-12')
    expect(result.termsAccepted).toBe(true)
  })

  it('rejects an invalid date or an unchecked terms flag', () => {
    expect(() => registerSchema.parse({
      email: 'artist@example.com',
      password: 'long-enough-password',
      displayName: 'Artist',
      dateOfBirth: '12/04/1995',
    })).toThrow()

    expect(() => registerSchema.parse({
      email: 'artist@example.com',
      password: 'long-enough-password',
      displayName: 'Artist',
      termsAccepted: false,
    })).toThrow()
  })
})
