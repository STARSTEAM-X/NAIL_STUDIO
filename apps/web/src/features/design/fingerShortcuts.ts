type FingerShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'target'
>

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { tagName?: string; isContentEditable?: boolean }
  return element.isContentEditable === true
    || element.tagName === 'INPUT'
    || element.tagName === 'TEXTAREA'
    || element.tagName === 'SELECT'
}

/** Returns the zero-based finger index for the 1–5 navigation shortcuts. */
export function fingerIndexFromShortcut(event: FingerShortcutEvent): number | null {
  if (
    event.repeat
    || event.ctrlKey
    || event.metaKey
    || event.altKey
    || event.shiftKey
    || isEditableTarget(event.target)
  ) return null

  if (/^[1-5]$/.test(event.key)) return Number(event.key) - 1
  if (/^(Digit|Numpad)[1-5]$/.test(event.code)) return Number(event.code.slice(-1)) - 1
  return null
}
