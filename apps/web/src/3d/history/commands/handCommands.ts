import type { DesignDocument, HandSettings } from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { replaceHand } from './documentEdits.ts'

export class SetSkinToneCommand implements Command {
  readonly label = 'เปลี่ยนสีผิว'
  readonly before: string
  readonly after: string

  constructor(before: string, after: string) {
    this.before = before
    this.after = after
  }

  do(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.skinTone === this.after ? hand : { ...hand, skinTone: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.skinTone === this.before ? hand : { ...hand, skinTone: this.before })
  }
}

export class SetProportionsCommand implements Command {
  readonly label = 'ปรับสัดส่วนมือ'
  readonly before: HandSettings['proportions']
  readonly after: HandSettings['proportions']
  readonly mergeKey?: string

  constructor(
    before: HandSettings['proportions'],
    after: HandSettings['proportions'],
    mergeKey?: string,
  ) {
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.proportions === this.after ? hand : { ...hand, proportions: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.proportions === this.before ? hand : { ...hand, proportions: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetProportionsCommand)) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetProportionsCommand(this.before, next.after, this.mergeKey)
  }
}
