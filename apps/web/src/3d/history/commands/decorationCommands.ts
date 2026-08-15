import {
  MAX_DECORATIONS_PER_NAIL,
  type DesignDocument,
  type Decoration,
  type NailKey,
} from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { replaceNail } from './documentEdits.ts'

export class AddDecorationCommand implements Command {
  readonly label = 'เพิ่มของตกแต่ง'
  readonly key: NailKey
  readonly decoration: Decoration
  readonly index: number

  constructor(key: NailKey, decoration: Decoration, index: number) {
    this.key = key
    this.decoration = decoration
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.decorations.length >= MAX_DECORATIONS_PER_NAIL) return nail
      if (this.index < 0 || this.index > nail.decorations.length) return nail
      if (nail.decorations.some((decoration) => decoration.id === this.decoration.id)) return nail
      const decorations = [...nail.decorations]
      decorations.splice(this.index, 0, this.decoration)
      return { ...nail, decorations }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decoration.id)
      if (index < 0) return nail
      const decorations = [...nail.decorations]
      decorations.splice(index, 1)
      return { ...nail, decorations }
    })
  }
}

export class RemoveDecorationCommand implements Command {
  readonly label = 'ลบของตกแต่ง'
  readonly key: NailKey
  readonly decoration: Decoration
  readonly index: number

  constructor(key: NailKey, decoration: Decoration, index: number) {
    this.key = key
    this.decoration = decoration
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decoration.id)
      if (index < 0) return nail
      const decorations = [...nail.decorations]
      decorations.splice(index, 1)
      return { ...nail, decorations }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.decorations.some((decoration) => decoration.id === this.decoration.id)) return nail
      const index = Math.min(Math.max(this.index, 0), nail.decorations.length)
      const decorations = [...nail.decorations]
      decorations.splice(index, 0, this.decoration)
      return { ...nail, decorations }
    })
  }
}

interface DecorationTransform {
  u: number
  v: number
  rotation: number
}

export class MoveDecorationCommand implements Command {
  readonly label = 'ย้ายของตกแต่ง'
  readonly key: NailKey
  readonly decorationId: string
  readonly before: DecorationTransform
  readonly after: DecorationTransform
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    decorationId: string,
    before: DecorationTransform,
    after: DecorationTransform,
    mergeKey?: string,
  ) {
    this.key = key
    this.decorationId = decorationId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  private apply(document: DesignDocument, transform: DecorationTransform): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decorationId)
      if (index < 0) return nail
      const current = nail.decorations[index]!
      if (current.u === transform.u && current.v === transform.v && current.rotation === transform.rotation) {
        return nail
      }
      const decorations = [...nail.decorations]
      decorations[index] = { ...current, u: transform.u, v: transform.v, rotation: transform.rotation }
      return { ...nail, decorations }
    })
  }

  do(document: DesignDocument): CommandResult {
    return this.apply(document, this.after)
  }

  undo(document: DesignDocument): CommandResult {
    return this.apply(document, this.before)
  }

  merge(next: Command): Command | null {
    if (!(next instanceof MoveDecorationCommand)) return null
    if (next.key !== this.key || next.decorationId !== this.decorationId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new MoveDecorationCommand(this.key, this.decorationId, this.before, next.after, this.mergeKey)
  }
}

export class ScaleDecorationCommand implements Command {
  readonly label = 'ปรับขนาดของตกแต่ง'
  readonly key: NailKey
  readonly decorationId: string
  readonly before: number
  readonly after: number
  readonly mergeKey?: string

  constructor(key: NailKey, decorationId: string, before: number, after: number, mergeKey?: string) {
    this.key = key
    this.decorationId = decorationId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  private apply(document: DesignDocument, scale: number): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decorationId)
      if (index < 0) return nail
      const current = nail.decorations[index]!
      if (current.scale === scale) return nail
      const decorations = [...nail.decorations]
      decorations[index] = { ...current, scale }
      return { ...nail, decorations }
    })
  }

  do(document: DesignDocument): CommandResult {
    return this.apply(document, this.after)
  }

  undo(document: DesignDocument): CommandResult {
    return this.apply(document, this.before)
  }

  merge(next: Command): Command | null {
    if (!(next instanceof ScaleDecorationCommand)) return null
    if (next.key !== this.key || next.decorationId !== this.decorationId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new ScaleDecorationCommand(this.key, this.decorationId, this.before, next.after, this.mergeKey)
  }
}
