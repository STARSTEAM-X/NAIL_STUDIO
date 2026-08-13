import type { DesignDocument, NailKey } from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'

export class CompositeCommand implements Command {
  readonly label: string
  readonly children: ReadonlyArray<Command>
  readonly mergeKey?: string

  constructor(
    label: string,
    children: ReadonlyArray<Command>,
    mergeKey?: string,
  ) {
    this.label = label
    this.children = children
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return this.apply(document, this.children)
  }

  undo(document: DesignDocument): CommandResult {
    return this.apply(document, [...this.children].reverse(), true)
  }

  private apply(document: DesignDocument, commands: ReadonlyArray<Command>, undo = false): CommandResult {
    let current = document
    const affects = new Set<NailKey>()
    for (const command of commands) {
      const result = undo ? command.undo(current) : command.do(current)
      current = result.document
      for (const key of result.affects) affects.add(key)
    }
    return { document: current, affects }
  }
}
