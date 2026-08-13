import type { DesignDocument, NailKey } from '@nail-studio/contracts'

export interface CommandResult {
  document: DesignDocument
  affects: ReadonlySet<NailKey>
}

/**
 * ผลของการย้อน/ทำซ้ำ พร้อมคำตอบว่า "คำสั่งนั้นทำงานได้จริงหรือไม่"
 *
 * ต้องแยกจาก CommandResult เพราะ HistoryStack ใช้ค่านี้ตัดสินว่าจะขยับ cursor ไหม
 * ถ้าขยับทั้งที่เอกสารไม่เปลี่ยน ประวัติกับเอกสารจะหลุดจากกันโดยไม่มีอาการให้เห็น
 */
export interface ReplayResult extends CommandResult {
  applied: boolean
}

export interface Command {
  readonly label: string
  readonly mergeKey?: string
  do(document: DesignDocument): CommandResult
  undo(document: DesignDocument): CommandResult
  merge?(next: Command): Command | null
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}
