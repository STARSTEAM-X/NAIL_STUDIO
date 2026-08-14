import {
  MAX_STROKES_PER_LAYER,
  type DesignDocument,
  type Nail,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { cloneNail, nailsMatch, replaceLayer, replaceNail } from './documentEdits.ts'

export class AddStrokeCommand implements Command {
  readonly label = 'วาดเส้น'
  readonly key: NailKey
  readonly layerId: string
  readonly stroke: Stroke

  constructor(
    key: NailKey,
    layerId: string,
    stroke: Stroke,
  ) {
    this.key = key
    this.layerId = layerId
    this.stroke = stroke
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => replaceLayer(nail, this.layerId, (layer) => {
      if (layer.strokes.length >= MAX_STROKES_PER_LAYER) return layer
      return { ...layer, strokes: [...layer.strokes, this.stroke] }
    }))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => replaceLayer(nail, this.layerId, (layer) => {
      if (layer.strokes.at(-1) !== this.stroke) return layer
      return { ...layer, strokes: layer.strokes.slice(0, -1) }
    }))
  }
}

export class SetBaseColorCommand implements Command {
  readonly label = 'เปลี่ยนสีเล็บ'
  readonly key: NailKey
  readonly before: string
  readonly after: string
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    before: string,
    after: string,
    mergeKey?: string,
  ) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.baseColor === this.after ? nail : { ...nail, baseColor: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.baseColor === this.before ? nail : { ...nail, baseColor: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetBaseColorCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetBaseColorCommand(this.key, this.before, next.after, this.mergeKey)
  }
}

export class SetFinishCommand implements Command {
  readonly label = 'เปลี่ยนผิวเล็บ'
  readonly key: NailKey
  readonly before: Nail['finish']
  readonly after: Nail['finish']
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    before: Nail['finish'],
    after: Nail['finish'],
    mergeKey?: string,
  ) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.finish === this.after ? nail : { ...nail, finish: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.finish === this.before ? nail : { ...nail, finish: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetFinishCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetFinishCommand(this.key, this.before, next.after, this.mergeKey)
  }
}

export class SetShapeCommand implements Command {
  readonly label = 'เปลี่ยนทรงเล็บ'
  readonly key: NailKey
  readonly before: Nail['shape']
  readonly after: Nail['shape']
  readonly mergeKey?: string

  constructor(key: NailKey, before: Nail['shape'], after: Nail['shape'], mergeKey?: string) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.shape === this.after ? nail : { ...nail, shape: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.shape === this.before ? nail : { ...nail, shape: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetShapeCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetShapeCommand(this.key, this.before, next.after, this.mergeKey)
  }
}

export class SetLengthCommand implements Command {
  readonly label = 'เปลี่ยนความยาวเล็บ'
  readonly key: NailKey
  readonly before: Nail['length']
  readonly after: Nail['length']
  readonly mergeKey?: string

  constructor(key: NailKey, before: Nail['length'], after: Nail['length'], mergeKey?: string) {
    this.key = key
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.length === this.after ? nail : { ...nail, length: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nail.length === this.before ? nail : { ...nail, length: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetLengthCommand) || next.key !== this.key) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetLengthCommand(this.key, this.before, next.after, this.mergeKey)
  }
}

export class ClearNailCommand implements Command {
  readonly label = 'ล้างลายเล็บ'
  readonly key: NailKey
  readonly beforeStrokes: ReadonlyArray<ReadonlyArray<Stroke>>

  constructor(
    key: NailKey,
    beforeStrokes: ReadonlyArray<ReadonlyArray<Stroke>>,
  ) {
    this.key = key
    this.beforeStrokes = beforeStrokes
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.layers.every((layer) => layer.strokes.length === 0)) return nail
      return { ...nail, layers: nail.layers.map((layer) => ({ ...layer, strokes: [] })) }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const layers = nail.layers.map((layer, index) => {
        const strokes = this.beforeStrokes[index]
        if (strokes === undefined || layer.strokes === strokes) return layer
        return { ...layer, strokes: [...strokes] }
      })
      return layers.some((layer, index) => layer !== nail.layers[index]) ? { ...nail, layers } : nail
    })
  }
}

export class CopyNailCommand implements Command {
  readonly label = 'คัดลอกเล็บ'
  readonly key: NailKey
  readonly before: Nail
  readonly source: Nail

  constructor(
    key: NailKey,
    before: Nail,
    source: Nail,
  ) {
    this.key = key
    this.before = before
    this.source = source
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nailsMatch(nail, this.source) ? nail : cloneNail(this.source))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      nailsMatch(nail, this.before) ? nail : cloneNail(this.before))
  }
}
