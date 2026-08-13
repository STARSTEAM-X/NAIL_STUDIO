import type { DesignDocument, NailKey } from '@nail-studio/contracts'
import type { Command, CommandResult, HistoryState } from './Command.ts'

const HISTORY_CAPACITY = 100
const MERGE_WINDOW_MS = 500
const NO_AFFECTS: ReadonlySet<NailKey> = new Set<NailKey>()

interface HistoryEntry {
  command: Command
  timestamp: number
}

export interface ExecuteResult extends CommandResult {
  recorded: boolean
}

export class HistoryStack {
  private readonly entries: Array<HistoryEntry | undefined> = Array(HISTORY_CAPACITY)
  private start = 0
  private length = 0
  private cursor = 0

  execute(document: DesignDocument, command: Command, now = Date.now()): ExecuteResult {
    const result = command.do(document)
    if (result.document === document) return { ...result, recorded: false }

    this.discardRedo()
    const previous = this.entryAt(this.cursor - 1)
    const merged = this.merge(previous, command, now)
    if (merged) {
      this.entries[this.indexOf(this.cursor - 1)] = { command: merged, timestamp: now }
    } else {
      this.append({ command, timestamp: now })
    }

    return { ...result, recorded: true }
  }

  undo(document: DesignDocument): CommandResult {
    const entry = this.entryAt(this.cursor - 1)
    if (!entry) return { document, affects: NO_AFFECTS }
    this.cursor -= 1
    return entry.command.undo(document)
  }

  redo(document: DesignDocument): CommandResult {
    const entry = this.entryAt(this.cursor)
    if (!entry) return { document, affects: NO_AFFECTS }
    this.cursor += 1
    return entry.command.do(document)
  }

  clear(): void {
    this.entries.fill(undefined)
    this.start = 0
    this.length = 0
    this.cursor = 0
  }

  state(): HistoryState {
    const undo = this.entryAt(this.cursor - 1)
    const redo = this.entryAt(this.cursor)
    return {
      canUndo: undo !== undefined,
      canRedo: redo !== undefined,
      undoLabel: undo?.command.label ?? null,
      redoLabel: redo?.command.label ?? null,
    }
  }

  private merge(previous: HistoryEntry | undefined, next: Command, now: number): Command | null {
    if (!previous || previous.command.mergeKey !== next.mergeKey || !next.mergeKey) return null
    if (now - previous.timestamp > MERGE_WINDOW_MS) return null
    return previous.command.merge?.(next) ?? null
  }

  private discardRedo(): void {
    for (let offset = this.cursor; offset < this.length; offset += 1) {
      this.entries[this.indexOf(offset)] = undefined
    }
    this.length = this.cursor
  }

  private append(entry: HistoryEntry): void {
    if (this.length === HISTORY_CAPACITY) {
      this.entries[this.start] = entry
      this.start = (this.start + 1) % HISTORY_CAPACITY
    } else {
      this.entries[this.indexOf(this.length)] = entry
      this.length += 1
    }
    this.cursor = this.length
  }

  private entryAt(offset: number): HistoryEntry | undefined {
    if (offset < 0 || offset >= this.length) return undefined
    return this.entries[this.indexOf(offset)]
  }

  private indexOf(offset: number): number {
    return (this.start + offset) % HISTORY_CAPACITY
  }
}
