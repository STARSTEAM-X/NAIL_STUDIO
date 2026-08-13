import { describe, expect, it } from 'vitest'
import { createEmptyDocument, type DesignDocument, type NailKey } from '@nail-studio/contracts'
import type { Command, CommandResult } from './Command.ts'
import { HistoryStack } from './HistoryStack.ts'

const RIGHT_INDEX = 'right.index' as NailKey

interface ColorCommand extends Command {
  readonly targetColor: string
}

function result(document: DesignDocument, affects: readonly NailKey[] = [RIGHT_INDEX]): CommandResult {
  return { document, affects: new Set(affects) }
}

function setRightIndexColor(before: string, after: string, label: string, mergeKey?: string): ColorCommand {
  return {
    label,
    ...(mergeKey === undefined ? {} : { mergeKey }),
    do(document) {
      if (document.nails[RIGHT_INDEX].baseColor === after) return result(document, [])
      return result({
        ...document,
        nails: {
          ...document.nails,
          [RIGHT_INDEX]: { ...document.nails[RIGHT_INDEX], baseColor: after },
        },
      })
    },
    undo(document) {
      if (document.nails[RIGHT_INDEX].baseColor === before) return result(document, [])
      return result({
        ...document,
        nails: {
          ...document.nails,
          [RIGHT_INDEX]: { ...document.nails[RIGHT_INDEX], baseColor: before },
        },
      })
    },
    merge(next) {
      if (next.mergeKey === undefined || next.mergeKey !== mergeKey || !('targetColor' in next)) return null
      return setRightIndexColor(before, next.targetColor as string, next.label, mergeKey)
    },
    targetColor: after,
  }
}

function setSkinTone(before: string, after: string, label: string): Command {
  return {
    label,
    do(document) {
      if (document.hand.skinTone === after) return result(document, [])
      return result({ ...document, hand: { ...document.hand, skinTone: after } }, [])
    },
    undo(document) {
      if (document.hand.skinTone === before) return result(document, [])
      return result({ ...document, hand: { ...document.hand, skinTone: before } }, [])
    },
  }
}

describe('HistoryStack', () => {
  it('returns the affected document through one execute, undo, and redo cycle', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const command = setRightIndexColor('#ffffff', '#112233', 'Set blue')

    const executed = history.execute(original, command)
    expect(executed.document.nails[RIGHT_INDEX].baseColor).toBe('#112233')
    expect(executed.recorded).toBe(true)
    expect(executed.affects).toEqual(new Set([RIGHT_INDEX]))
    expect(history.state()).toEqual({ canUndo: true, canRedo: false, undoLabel: 'Set blue', redoLabel: null })

    const undone = history.undo(executed.document)
    expect(undone.document.nails[RIGHT_INDEX].baseColor).toBe('#ffffff')
    expect(history.state()).toEqual({ canUndo: false, canRedo: true, undoLabel: null, redoLabel: 'Set blue' })

    const redone = history.redo(undone.document)
    expect(redone.document.nails[RIGHT_INDEX].baseColor).toBe('#112233')
    expect(history.state()).toEqual({ canUndo: true, canRedo: false, undoLabel: 'Set blue', redoLabel: null })
  })

  it('rejects a no-op by document identity without recording it', () => {
    const history = new HistoryStack()
    const document = createEmptyDocument()
    const command: Command = {
      label: 'No change',
      do: (current) => result(current, []),
      undo: (current) => result(current, []),
    }

    const executed = history.execute(document, command)
    expect(executed.document).toBe(document)
    expect(executed.recorded).toBe(false)
    expect(history.state()).toEqual({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null })
  })

  it('clears redo history after a new recorded execute', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const first = history.execute(original, setRightIndexColor('#ffffff', '#112233', 'Set blue'))
    const undone = history.undo(first.document)
    const second = history.execute(undone.document, setRightIndexColor('#ffffff', '#445566', 'Set teal'))

    expect(second.document.nails[RIGHT_INDEX].baseColor).toBe('#445566')
    expect(history.state()).toEqual({ canUndo: true, canRedo: false, undoLabel: 'Set teal', redoLabel: null })
  })

  it('retains only the newest 100 recorded commands', () => {
    const history = new HistoryStack()
    let document = createEmptyDocument()
    let previous = document.hand.skinTone

    for (let index = 1; index <= 101; index += 1) {
      const next = `#${index.toString(16).padStart(6, '0')}`
      document = history.execute(document, setSkinTone(previous, next, `Tone ${index}`)).document
      previous = next
    }

    for (let index = 0; index < 100; index += 1) document = history.undo(document).document
    expect(document.hand.skinTone).toBe('#000001')
    expect(history.state().canUndo).toBe(false)
    expect(history.undo(document).document).toBe(document)
  })

  it('coalesces matching merge keys inside 500 milliseconds', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const first = history.execute(original, setRightIndexColor('#ffffff', '#112233', 'Set blue', 'color'), 1_000)
    const second = history.execute(first.document, setRightIndexColor('#112233', '#445566', 'Set teal', 'color'), 1_499)

    expect(second.recorded).toBe(true)
    expect(history.undo(second.document).document.nails[RIGHT_INDEX].baseColor).toBe('#ffffff')
    expect(history.state().canUndo).toBe(false)
  })

  it('removes a merged gesture that returns to its original value', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const first = history.execute(original, setRightIndexColor('#ffffff', '#808080', 'Half', 'opacity'), 1_000)
    const second = history.execute(first.document, setRightIndexColor('#808080', '#ffffff', 'Full', 'opacity'), 1_400)

    expect(second.document.nails[RIGHT_INDEX].baseColor).toBe('#ffffff')
    expect(second.recorded).toBe(true)
    expect(history.state()).toEqual({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null })
  })

  it('coalesces an empty merge key inside 500 milliseconds', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const first = history.execute(original, setRightIndexColor('#ffffff', '#112233', 'Set blue', ''), 1_000)
    const second = history.execute(first.document, setRightIndexColor('#112233', '#445566', 'Set teal', ''), 1_499)

    expect(history.undo(second.document).document.nails[RIGHT_INDEX].baseColor).toBe('#ffffff')
    expect(history.state().canUndo).toBe(false)
  })

  it('does not coalesce matching merge keys after 500 milliseconds', () => {
    const history = new HistoryStack()
    const original = createEmptyDocument()
    const first = history.execute(original, setRightIndexColor('#ffffff', '#112233', 'Set blue', 'color'), 1_000)
    const second = history.execute(first.document, setRightIndexColor('#112233', '#445566', 'Set teal', 'color'), 1_501)

    const onceUndone = history.undo(second.document)
    expect(onceUndone.document.nails[RIGHT_INDEX].baseColor).toBe('#112233')
    expect(history.state().canUndo).toBe(true)
    expect(history.undo(onceUndone.document).document.nails[RIGHT_INDEX].baseColor).toBe('#ffffff')
  })
})
