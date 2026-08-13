import type { DesignDocument, NailKey } from '@nail-studio/contracts'
import type { Command, CommandResult, HistoryState, ReplayResult } from './Command.ts'

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
      if (merged.undo(result.document).document === result.document) {
        this.entries[this.indexOf(this.cursor - 1)] = undefined
        this.length -= 1
        this.cursor -= 1
      } else {
        this.entries[this.indexOf(this.cursor - 1)] = { command: merged, timestamp: now }
      }
    } else {
      this.append({ command, timestamp: now })
    }

    return { ...result, recorded: true }
  }

  /**
   * ย้อนหนึ่งขั้น — cursor ขยับต่อเมื่อคำสั่งเปลี่ยนเอกสารได้จริง
   *
   * คำสั่งทุกตัวมีทางลัดคืนเอกสารเดิมเมื่อสถานะไม่ตรงกับที่มันคาดไว้ ถ้าขยับ cursor
   * ไปก่อนโดยไม่ดูผล ประวัติจะเลื่อนไปหนึ่งช่องทั้งที่เอกสารอยู่ที่เดิม การกดย้อน
   * ครั้งถัดไปจะข้ามการกระทำหนึ่งรายการโดยผู้ใช้ไม่มีทางสังเกตเห็น (execute
   * ระวังกรณีเดียวกันนี้อยู่แล้วผ่าน `recorded`)
   */
  undo(document: DesignDocument): ReplayResult {
    return this.replay(document, this.entryAt(this.cursor - 1), -1, true)
  }

  redo(document: DesignDocument): ReplayResult {
    return this.replay(document, this.entryAt(this.cursor), 1, false)
  }

  private replay(
    document: DesignDocument,
    entry: HistoryEntry | undefined,
    step: number,
    undo: boolean,
  ): ReplayResult {
    if (!entry) return { document, affects: NO_AFFECTS, applied: false }
    const result = undo ? entry.command.undo(document) : entry.command.do(document)
    if (result.document === document) return { document, affects: NO_AFFECTS, applied: false }
    this.cursor += step
    return { ...result, applied: true }
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
    if (!previous || previous.command.mergeKey !== next.mergeKey || next.mergeKey === undefined) return null
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
