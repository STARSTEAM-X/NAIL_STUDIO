type HistoryShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { tagName?: string; isContentEditable?: boolean }
  return element.isContentEditable === true
    || element.tagName === 'INPUT'
    || element.tagName === 'TEXTAREA'
    || element.tagName === 'SELECT'
}

export function shouldHandleHistoryShortcut(event: HistoryShortcutEvent): 'undo' | 'redo' | null {
  if (isEditableTarget(event.target) || (!event.ctrlKey && !event.metaKey)) return null

  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return null
}
