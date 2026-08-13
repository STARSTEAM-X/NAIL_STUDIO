import {
  MAX_LAYERS_PER_NAIL,
  type DesignDocument,
  type Layer,
  type Nail,
  type NailKey,
} from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { replaceLayer, replaceNail } from './documentEdits.ts'

function moveLayer(nail: Nail, layerId: string, from: number, to: number): Nail {
  if (from === to || from < 0 || to < 0 || from >= nail.layers.length || to >= nail.layers.length) return nail
  const layer = nail.layers[from]
  if (!layer || layer.id !== layerId) return nail
  const layers = [...nail.layers]
  layers.splice(from, 1)
  layers.splice(to, 0, layer)
  return { ...nail, layers }
}

export class AddLayerCommand implements Command {
  readonly label = 'เพิ่มเลเยอร์'
  readonly key: NailKey
  readonly layer: Layer
  readonly index: number

  constructor(
    key: NailKey,
    layer: Layer,
    index: number,
  ) {
    this.key = key
    this.layer = layer
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.layers.length >= MAX_LAYERS_PER_NAIL || this.index < 0 || this.index > nail.layers.length) return nail
      if (nail.layers.some((layer) => layer.id === this.layer.id)) return nail
      const layers = [...nail.layers]
      layers.splice(this.index, 0, this.layer)
      return { ...nail, layers }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.layers.findIndex((layer) => layer.id === this.layer.id)
      if (index < 0) return nail
      const layers = [...nail.layers]
      layers.splice(index, 1)
      return { ...nail, layers }
    })
  }
}

export class RemoveLayerCommand implements Command {
  readonly label = 'ลบเลเยอร์'
  readonly key: NailKey
  readonly layer: Layer
  readonly index: number

  constructor(
    key: NailKey,
    layer: Layer,
    index: number,
  ) {
    this.key = key
    this.layer = layer
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.layers.findIndex((layer) => layer.id === this.layer.id)
      if (nail.layers.length <= 1 || index < 0) return nail
      const layers = [...nail.layers]
      layers.splice(index, 1)
      return { ...nail, layers }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (this.index < 0 || this.index > nail.layers.length) return nail
      if (nail.layers.some((layer) => layer.id === this.layer.id)) return nail
      const layers = [...nail.layers]
      layers.splice(this.index, 0, this.layer)
      return { ...nail, layers }
    })
  }
}

export class RenameLayerCommand implements Command {
  readonly label = 'เปลี่ยนชื่อเลเยอร์'
  readonly key: NailKey
  readonly layerId: string
  readonly before: string
  readonly after: string
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    layerId: string,
    before: string,
    after: string,
    mergeKey?: string,
  ) {
    this.key = key
    this.layerId = layerId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.name === this.after ? layer : { ...layer, name: this.after }))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.name === this.before ? layer : { ...layer, name: this.before }))
  }

  merge(next: Command): Command | null {
    if (!(next instanceof RenameLayerCommand) || next.key !== this.key || next.layerId !== this.layerId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new RenameLayerCommand(this.key, this.layerId, this.before, next.after, this.mergeKey)
  }
}

export class SetLayerVisibilityCommand implements Command {
  readonly label = 'เปลี่ยนการแสดงเลเยอร์'
  readonly key: NailKey
  readonly layerId: string
  readonly before: boolean
  readonly after: boolean

  constructor(
    key: NailKey,
    layerId: string,
    before: boolean,
    after: boolean,
  ) {
    this.key = key
    this.layerId = layerId
    this.before = before
    this.after = after
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.visible === this.after ? layer : { ...layer, visible: this.after }))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.visible === this.before ? layer : { ...layer, visible: this.before }))
  }
}

export class SetLayerOpacityCommand implements Command {
  readonly label = 'เปลี่ยนความทึบเลเยอร์'
  readonly key: NailKey
  readonly layerId: string
  readonly before: number
  readonly after: number
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    layerId: string,
    before: number,
    after: number,
    mergeKey?: string,
  ) {
    this.key = key
    this.layerId = layerId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.opacity === this.after ? layer : { ...layer, opacity: this.after }))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.opacity === this.before ? layer : { ...layer, opacity: this.before }))
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetLayerOpacityCommand) || next.key !== this.key || next.layerId !== this.layerId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetLayerOpacityCommand(this.key, this.layerId, this.before, next.after, this.mergeKey)
  }
}

export class SetLayerBlendCommand implements Command {
  readonly label = 'เปลี่ยนโหมดผสมเลเยอร์'
  readonly key: NailKey
  readonly layerId: string
  readonly before: Layer['blend']
  readonly after: Layer['blend']

  constructor(
    key: NailKey,
    layerId: string,
    before: Layer['blend'],
    after: Layer['blend'],
  ) {
    this.key = key
    this.layerId = layerId
    this.before = before
    this.after = after
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.blend === this.after ? layer : { ...layer, blend: this.after }))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) =>
      replaceLayer(nail, this.layerId, (layer) => layer.blend === this.before ? layer : { ...layer, blend: this.before }))
  }
}

export class MoveLayerCommand implements Command {
  readonly label = 'ย้ายเลเยอร์'
  readonly key: NailKey
  readonly layerId: string
  readonly from: number
  readonly to: number

  constructor(
    key: NailKey,
    layerId: string,
    from: number,
    to: number,
  ) {
    this.key = key
    this.layerId = layerId
    this.from = from
    this.to = to
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => moveLayer(nail, this.layerId, this.from, this.to))
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => moveLayer(nail, this.layerId, this.to, this.from))
  }
}
