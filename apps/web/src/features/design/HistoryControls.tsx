import { useEffect } from 'react'
import { Icon } from '@/components/Icon.tsx'
import { useDesign } from './DesignStoreProvider.tsx'
import { shouldHandleHistoryShortcut } from './historyShortcuts.ts'

export function HistoryControls() {
  const revision = useDesign((state) => state.revision)
  const history = useDesign((state) => state.history)
  const undo = useDesign((state) => state.undo)
  const redo = useDesign((state) => state.redo)
  const state = history.state()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shouldHandleHistoryShortcut(event)
      if (!action) return
      event.preventDefault()
      if (action === 'undo') undo()
      else redo()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <div className="history-controls" aria-label="ประวัติการแก้ไข" data-revision={revision}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={!state.canUndo}
        onClick={undo}
        aria-label={state.undoLabel ? `เลิกทำ: ${state.undoLabel}` : 'เลิกทำ'}
        data-tooltip={state.undoLabel ? `เลิกทำ: ${state.undoLabel} · Ctrl+Z` : 'เลิกทำ · Ctrl+Z'}
      >
        <Icon name="undo" size={17} />
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={!state.canRedo}
        onClick={redo}
        aria-label={state.redoLabel ? `ทำซ้ำ: ${state.redoLabel}` : 'ทำซ้ำ'}
        data-tooltip={state.redoLabel ? `ทำซ้ำ: ${state.redoLabel} · Ctrl+Y` : 'ทำซ้ำ · Ctrl+Y'}
      >
        <Icon name="redo" size={17} />
      </button>
    </div>
  )
}
