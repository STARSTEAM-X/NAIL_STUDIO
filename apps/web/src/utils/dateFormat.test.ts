import { describe, expect, it } from 'vitest'
import { formatDdMmYyyy, maskDdMmYyyyInput, parseDdMmYyyy } from './dateFormat.ts'

describe('parseDdMmYyyy', () => {
  it('parses valid dates to ISO and round-trips through formatting', () => {
    for (const value of ['31/01/2000', '29/02/2000', '30/04/2001']) {
      const iso = parseDdMmYyyy(value)
      expect(iso).not.toBeNull()
      expect(formatDdMmYyyy(iso!)).toBe(value)
    }
  })

  it('returns null for partial input without throwing', () => {
    expect(parseDdMmYyyy('31/')).toBeNull()
    expect(parseDdMmYyyy('31/01')).toBeNull()
  })

  it('rejects invalid days and months', () => {
    expect(parseDdMmYyyy('00/01/2000')).toBeNull()
    expect(parseDdMmYyyy('32/01/2000')).toBeNull()
    expect(parseDdMmYyyy('31/02/2000')).toBeNull()
    expect(parseDdMmYyyy('30/02/2000')).toBeNull()
    expect(parseDdMmYyyy('00/13/2000')).toBeNull()
    expect(parseDdMmYyyy('01/13/2000')).toBeNull()
    expect(parseDdMmYyyy('01/00/2000')).toBeNull()
  })

  it('handles leap years correctly', () => {
    expect(parseDdMmYyyy('29/02/2000')).toBe('2000-02-29')
    expect(parseDdMmYyyy('29/02/2001')).toBeNull()
    expect(parseDdMmYyyy('29/02/1900')).toBeNull()
    expect(parseDdMmYyyy('29/02/2004')).toBe('2004-02-29')
  })

  it('requires a four-digit year and rejects future years', () => {
    expect(parseDdMmYyyy('01/01/00')).toBeNull()
    expect(parseDdMmYyyy('01/01/200')).toBeNull()
    expect(parseDdMmYyyy(`01/01/${new Date().getFullYear() + 1}`)).toBeNull()
  })
})

describe('formatDdMmYyyy', () => {
  it('formats valid ISO dates and returns empty for invalid input', () => {
    expect(formatDdMmYyyy('2000-01-31')).toBe('31/01/2000')
    expect(formatDdMmYyyy('')).toBe('')
    expect(formatDdMmYyyy('2000-02-30')).toBe('')
    expect(formatDdMmYyyy('not-a-date')).toBe('')
  })
})

describe('maskDdMmYyyyInput', () => {
  it('inserts slashes while typing', () => {
    expect(maskDdMmYyyyInput('3')).toBe('3')
    expect(maskDdMmYyyyInput('31')).toBe('31')
    expect(maskDdMmYyyyInput('3101')).toBe('31/01')
    expect(maskDdMmYyyyInput('31012000')).toBe('31/01/2000')
  })

  it('strips non-digits and limits the value to dd/mm/yyyy', () => {
    expect(maskDdMmYyyyInput('31/01/2000abc')).toBe('31/01/2000')
    expect(maskDdMmYyyyInput('310120009999')).toBe('31/01/2000')
  })
})
