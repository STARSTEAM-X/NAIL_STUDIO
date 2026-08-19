import { describe, expect, it } from 'vitest'
import { toolShortcutFrom } from './toolShortcuts.ts'

function event(overrides: Partial<KeyboardEvent> = {}): Parameters<typeof toolShortcutFrom>[0] {
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

const inputTarget = { tagName: 'INPUT' } as unknown as EventTarget

describe('toolShortcutFrom', () => {
  it('maps B and E to the brush and eraser', () => {
    expect(toolShortcutFrom(event({ key: 'b' }))).toEqual({ kind: 'tool', tool: 'brush' })
    expect(toolShortcutFrom(event({ key: 'B' }))).toEqual({ kind: 'tool', tool: 'brush' })
    expect(toolShortcutFrom(event({ key: 'e' }))).toEqual({ kind: 'tool', tool: 'erase' })
  })

  it('maps the Thai keyboard layout through event.code', () => {
    // ผังไทย: ปุ่ม B ให้ key = 'ิ' และปุ่ม E ให้ key = 'ำ'
    expect(toolShortcutFrom(event({ key: 'ิ', code: 'KeyB' }))).toEqual({ kind: 'tool', tool: 'brush' })
    expect(toolShortcutFrom(event({ key: 'ำ', code: 'KeyE' }))).toEqual({ kind: 'tool', tool: 'erase' })
  })

  it('maps bracket keys to brush size steps', () => {
    expect(toolShortcutFrom(event({ key: '[' }))).toEqual({ kind: 'size', direction: -1 })
    expect(toolShortcutFrom(event({ key: ']' }))).toEqual({ kind: 'size', direction: 1 })
    expect(toolShortcutFrom(event({ key: 'บ', code: 'BracketLeft' }))).toEqual({ kind: 'size', direction: -1 })
  })

  it('lets brush size repeat while the key is held', () => {
    expect(toolShortcutFrom(event({ key: ']', repeat: true }))).toEqual({ kind: 'size', direction: 1 })
    expect(toolShortcutFrom(event({ key: 'b', repeat: true }))).toBeNull()
  })

  it('opens help on ? from either keyboard layout', () => {
    expect(toolShortcutFrom(event({ key: '?', shiftKey: true }))).toEqual({ kind: 'help' })
    // ผังไทยไม่ส่ง key = '?' จึงต้องอ่านจาก code + Shift
    expect(toolShortcutFrom(event({ key: 'ฃ', code: 'Slash', shiftKey: true }))).toEqual({ kind: 'help' })
  })

  it('ignores modifier chords so it never steals Ctrl+B or Cmd+E', () => {
    expect(toolShortcutFrom(event({ key: 'b', ctrlKey: true }))).toBeNull()
    expect(toolShortcutFrom(event({ key: 'e', metaKey: true }))).toBeNull()
    expect(toolShortcutFrom(event({ key: '[', altKey: true }))).toBeNull()
    expect(toolShortcutFrom(event({ key: 'B', shiftKey: true }))).toBeNull()
  })

  it('stays silent while the user is typing', () => {
    expect(toolShortcutFrom(event({ key: 'b', target: inputTarget }))).toBeNull()
    expect(toolShortcutFrom(event({ key: ']', target: inputTarget }))).toBeNull()
    expect(toolShortcutFrom(event({ key: '?', shiftKey: true, target: inputTarget }))).toBeNull()
  })

  it('returns null for unrelated keys', () => {
    expect(toolShortcutFrom(event({ key: 'q' }))).toBeNull()
    expect(toolShortcutFrom(event({ key: '1' }))).toBeNull()
  })
})
