import type { DesignDocument, NailKey } from '@nail-studio/contracts'

export interface CommandResult {
  document: DesignDocument
  affects: ReadonlySet<NailKey>
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
