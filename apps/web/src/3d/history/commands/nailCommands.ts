import {
  MAX_STROKES_PER_LAYER,
  type DesignDocument,
  type Nail,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'

const NO_AFFECTS: ReadonlySet<NailKey> = new Set<NailKey>()

function result(document: DesignDocument, key: NailKey, changed: boolean): CommandResult {
  return { document, affects: changed ? new Set([key]) : NO_AFFECTS }
}

function replaceNail(
  document: DesignDocument,
  key: NailKey,
  update: (nail: Nail) => Nail,
): CommandResult {
  const current = document.nails[key]
  const next = update(current)
  if (next === current) return result(document, key, false)
  return result({ ...document, nails: { ...document.nails, [key]: next } }, key, true)
}

function replaceLayer(
  nail: Nail,
  layerId: string,
  update: (layer: Nail['layers'][number]) => Nail['layers'][number],
): Nail {
  const index = nail.layers.findIndex((layer) => layer.id === layerId)
  const current = nail.layers[index]
  if (!current) return nail
  const next = update(current)
  if (next === current) return nail
  const layers = [...nail.layers]
  layers[index] = next
  return { ...nail, layers }
}

function cloneNail(nail: Nail): Nail {
  return {
    ...nail,
    layers: nail.layers.map((layer) => ({ ...layer, strokes: [...layer.strokes] })),
    decorations: nail.decorations.map((decoration) => ({ ...decoration })),
  }
}

function nailsMatch(first: Nail, second: Nail): boolean {
  if (
    first.shape !== second.shape
    || first.length !== second.length
    || first.finish !== second.finish
    || first.baseColor !== second.baseColor
    || first.layers.length !== second.layers.length
    || first.decorations.length !== second.decorations.length
  ) return false
  return JSON.stringify(first.layers) === JSON.stringify(second.layers)
    && JSON.stringify(first.decorations) === JSON.stringify(second.decorations)
}

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
