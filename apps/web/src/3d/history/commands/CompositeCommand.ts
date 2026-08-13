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

  merge(next: Command): Command | null {
    if (!(next instanceof CompositeCommand) || this.mergeKey === undefined) return null
    if (next.mergeKey !== this.mergeKey || next.children.length !== this.children.length) return null
    const children: Command[] = []
    for (let index = 0; index < this.children.length; index += 1) {
      const previous = this.children[index]
      const following = next.children[index]
      if (!previous || !following) return null
      const merged = previous.merge?.(following) ?? null
      if (!merged) return null
      children.push(merged)
    }
    return new CompositeCommand(this.label, children, this.mergeKey)
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
