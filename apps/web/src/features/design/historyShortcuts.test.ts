import { describe, expect, it } from 'vitest'
import { shouldHandleHistoryShortcut } from './historyShortcuts.ts'

function shortcut(
  key: string,
  options: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>> = {},
) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    ...options,
  }
}

describe('shouldHandleHistoryShortcut', () => {
  it.each([
    [shortcut('z', { ctrlKey: true }), 'undo'],
    [shortcut('Z', { metaKey: true }), 'undo'],
    [shortcut('y', { ctrlKey: true }), 'redo'],
    [shortcut('Y', { metaKey: true }), 'redo'],
    [shortcut('z', { ctrlKey: true, shiftKey: true }), 'redo'],
    [shortcut('Z', { metaKey: true, shiftKey: true }), 'redo'],
  ] as const)('recognizes history shortcut %#', (event, expected) => {
    expect(shouldHandleHistoryShortcut(event)).toBe(expected)
  })

  it.each([
    shortcut('a', { ctrlKey: true }),
    shortcut('z'),
    shortcut('z', { shiftKey: true }),
    shortcut('z', { ctrlKey: true, target: { tagName: 'INPUT' } as unknown as EventTarget }),
    shortcut('z', { metaKey: true, target: { tagName: 'TEXTAREA' } as unknown as EventTarget }),
    shortcut('y', { ctrlKey: true, target: { tagName: 'SELECT' } as unknown as EventTarget }),
    shortcut('z', { ctrlKey: true, target: { isContentEditable: true } as unknown as EventTarget }),
  ])('ignores non-history or editable-target shortcut %#', (event) => {
    expect(shouldHandleHistoryShortcut(event)).toBeNull()
  })
})
