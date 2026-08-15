import { describe, expect, it } from 'vitest'
import { fingerIndexFromShortcut } from './fingerShortcuts.ts'

function event(overrides: Partial<KeyboardEvent> = {}): Parameters<typeof fingerIndexFromShortcut>[0] {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    target: null,
    ...overrides,
  }
}

describe('fingerIndexFromShortcut', () => {
  it('maps number keys 1–5 to fingers in order', () => {
    expect(fingerIndexFromShortcut(event({ key: '1' }))).toBe(0)
    expect(fingerIndexFromShortcut(event({ key: '3' }))).toBe(2)
    expect(fingerIndexFromShortcut(event({ code: 'Numpad5' }))).toBe(4)
  })

  it('ignores modifiers, repeats, and editable controls', () => {
    expect(fingerIndexFromShortcut(event({ key: '1', shiftKey: true }))).toBeNull()
    expect(fingerIndexFromShortcut(event({ key: '2', repeat: true }))).toBeNull()
    expect(fingerIndexFromShortcut(event({ key: '3', target: { tagName: 'INPUT' } as unknown as EventTarget }))).toBeNull()
  })
})
