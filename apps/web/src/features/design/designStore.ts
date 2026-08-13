import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  MAX_STROKES_PER_LAYER,
  MAX_LAYERS_PER_NAIL,
  createEmptyDocument,
  nailKeysOfHand,
  type DesignDocument,
  type Hand,
  type Layer,
  type Nail,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { HistoryStack } from '@/3d/history/HistoryStack.ts'
import type { Command } from '@/3d/history/Command.ts'
import { CompositeCommand } from '@/3d/history/commands/CompositeCommand.ts'
import {
  AddStrokeCommand,
  ClearNailCommand,
  CopyNailCommand,
  SetBaseColorCommand,
  SetFinishCommand,
} from '@/3d/history/commands/nailCommands.ts'
import {
  AddLayerCommand,
  MoveLayerCommand,
  RemoveLayerCommand,
  RenameLayerCommand,
  SetLayerBlendCommand,
  SetLayerOpacityCommand,
  SetLayerVisibilityCommand,
} from '@/3d/history/commands/layerCommands.ts'
import { DEFAULT_PAINT_SETTINGS, type PaintSettings } from '@/3d/painting/paintSettings.ts'

export const EDITABLE_HAND: Hand = 'right'
export const EDITABLE_NAILS: NailKey[] = nailKeysOfHand(EDITABLE_HAND)

export type FocusTarget = { kind: 'nail'; key: NailKey } | { kind: 'home' } | null

export interface DesignState {
  document: DesignDocument
  focus: FocusTarget
  selection: Set<NailKey>
  activeLayerIds: Partial<Record<NailKey, string>>
  settings: PaintSettings
  revision: number
  notice: string | null
  history: HistoryStack
}

export interface DesignActions {
  loadDocument: (document: DesignDocument) => void
  selectNail: (key: NailKey, mode?: 'replace' | 'toggle') => void
  selectAll: () => void
  focusNail: (key: NailKey) => void
  focusHome: () => void
  clearFocus: () => void
  setSettings: (patch: Partial<PaintSettings>) => void
  activeLayerId: (key: NailKey) => string
  selectLayer: (key: NailKey, id: string) => void
  addStroke: (stroke: Stroke) => void
  clearSelectedNails: () => void
  setFinish: (finish: Nail['finish'], mergeKey?: string) => void
  setBaseColor: (color: string, mergeKey?: string) => void
  copyActiveNailToAll: () => void
  addLayer: (key: NailKey, layer: Layer, index?: number) => void
  removeLayer: (key: NailKey, layerId: string) => void
  renameLayer: (key: NailKey, layerId: string, name: string, mergeKey?: string) => void
  setLayerVisibility: (key: NailKey, layerId: string, visible: boolean) => void
  setLayerOpacity: (key: NailKey, layerId: string, opacity: number, mergeKey?: string) => void
  setLayerBlend: (key: NailKey, layerId: string, blend: Layer['blend']) => void
  moveLayer: (key: NailKey, layerId: string, toIndex: number) => void
  undo: () => void
  redo: () => void
  dismissNotice: () => void
}

export type DesignStore = StoreApi<DesignState & DesignActions>

export function primaryOf(selection: Set<NailKey>): NailKey {
  return EDITABLE_NAILS.find((key) => selection.has(key)) ?? EDITABLE_NAILS[0] ?? 'right.thumb'
}

function editableSelection(selection: Iterable<NailKey>): NailKey[] {
  const selected = new Set(selection)
  return EDITABLE_NAILS.filter((key) => selected.has(key))
}

function activeLayerIdOf(
  document: DesignDocument,
  activeLayerIds: Partial<Record<NailKey, string>>,
  key: NailKey,
): string {
  const layers = document.nails[key].layers
  const activeId = activeLayerIds[key]
  if (activeId !== undefined && layers.some((layer) => layer.id === activeId)) return activeId
  return layers[0]!.id
}

function initialActiveLayerIds(document: DesignDocument): Partial<Record<NailKey, string>> {
  return Object.fromEntries(
    Object.entries(document.nails).map(([key, nail]) => [key, nail.layers[0]!.id]),
  ) as Partial<Record<NailKey, string>>
}

function repairActiveLayerIds(
  before: DesignDocument,
  after: DesignDocument,
  activeLayerIds: Partial<Record<NailKey, string>>,
): Partial<Record<NailKey, string>> {
  const repaired = { ...activeLayerIds }
  for (const key of Object.keys(after.nails) as NailKey[]) {
    const currentId = repaired[key]
    const afterLayers = after.nails[key].layers
    if (currentId !== undefined && afterLayers.some((layer) => layer.id === currentId)) continue
    const beforeIndex = currentId === undefined
      ? 0
      : before.nails[key].layers.findIndex((layer) => layer.id === currentId)
    repaired[key] = afterLayers[Math.min(Math.max(beforeIndex, 0), afterLayers.length - 1)]!.id
  }
  return repaired
}

function commandFor(label: string, commands: Command[], mergeKey?: string): Command {
  return commands.length === 1 ? commands[0]! : new CompositeCommand(label, commands, mergeKey)
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

function isEditable(key: NailKey): boolean {
  return EDITABLE_NAILS.includes(key)
}

export interface CreateDesignStoreOptions {
  document?: DesignDocument
  settings?: PaintSettings
}

export function createDesignStore(options: CreateDesignStoreOptions = {}): DesignStore {
  const document = options.document ?? createEmptyDocument()
  const history = new HistoryStack()

  return createStore<DesignState & DesignActions>((set, get) => {
    const execute = (command: Command): boolean => {
      const state = get()
      const result = state.history.execute(state.document, command)
      if (!result.recorded) return false
      set({
        document: result.document,
        revision: state.revision + 1,
        notice: null,
        activeLayerIds: repairActiveLayerIds(state.document, result.document, state.activeLayerIds),
      })
      return true
    }

    return {
      document,
      focus: null,
      selection: new Set<NailKey>([EDITABLE_NAILS[1] ?? 'right.index']),
      activeLayerIds: initialActiveLayerIds(document),
      settings: options.settings ?? DEFAULT_PAINT_SETTINGS,
      revision: 0,
      notice: null,
      history,

      loadDocument: (next) => {
        history.clear()
        set((state) => ({
          document: next,
          revision: state.revision + 1,
          notice: null,
          activeLayerIds: initialActiveLayerIds(next),
        }))
      },

      selectNail: (key, mode = 'replace') => {
        set((state) => {
          if (mode === 'replace') return { selection: new Set([key]) }
          const selection = new Set(state.selection)
          if (selection.has(key)) {
            if (selection.size === 1) return state
            selection.delete(key)
          } else {
            selection.add(key)
          }
          return { selection }
        })
      },

      selectAll: () => {
        set({ selection: new Set(EDITABLE_NAILS), focus: { kind: 'home' } })
      },

      focusNail: (key) => set({ focus: { kind: 'nail', key } }),
      focusHome: () => set({ focus: { kind: 'home' } }),
      clearFocus: () => {
        if (get().focus !== null) set({ focus: null })
      },
      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      activeLayerId: (key) => activeLayerIdOf(get().document, get().activeLayerIds, key),

      selectLayer: (key, id) => {
        if (!get().document.nails[key].layers.some((layer) => layer.id === id)) return
        set((state) => ({ activeLayerIds: { ...state.activeLayerIds, [key]: id } }))
      },

      addStroke: (stroke) => {
        const state = get()
        const targets = editableSelection(state.selection).map((key) => ({
          key,
          layerId: activeLayerIdOf(state.document, state.activeLayerIds, key),
        }))
        const overflowing = targets.some(({ key, layerId }) => {
          const layer = state.document.nails[key].layers.find((item) => item.id === layerId)
          return layer === undefined || layer.strokes.length >= MAX_STROKES_PER_LAYER
        })
        if (overflowing) {
          set({ notice: `เลเยอร์นี้เก็บได้สูงสุด ${MAX_STROKES_PER_LAYER} เส้น — รวมเลเยอร์หรือเริ่มเลเยอร์ใหม่ก่อน` })
          return
        }
        if (targets.length > 0) execute(commandFor('วาดเส้น', targets.map(({ key, layerId }) =>
          new AddStrokeCommand(key, layerId, stroke))))
      },

      clearSelectedNails: () => {
        const state = get()
        const commands = editableSelection(state.selection)
          .filter((key) => state.document.nails[key].layers.some((layer) => layer.strokes.length > 0))
          .map((key) => new ClearNailCommand(
            key,
            state.document.nails[key].layers.map((layer) => layer.strokes),
          ))
        if (commands.length > 0) execute(commandFor('ล้างลายเล็บ', commands))
      },

      setFinish: (finish, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .filter((key) => state.document.nails[key].finish !== finish)
          .map((key) => new SetFinishCommand(key, state.document.nails[key].finish, finish, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนผิวเล็บ', commands, mergeKey))
      },

      setBaseColor: (color, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .filter((key) => state.document.nails[key].baseColor !== color)
          .map((key) => new SetBaseColorCommand(key, state.document.nails[key].baseColor, color, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนสีเล็บ', commands, mergeKey))
      },

      copyActiveNailToAll: () => {
        const state = get()
        const sourceKey = primaryOf(state.selection)
        const source = state.document.nails[sourceKey]
        const commands = EDITABLE_NAILS
          .filter((key) => key !== sourceKey && !nailsMatch(state.document.nails[key], source))
          .map((key) => new CopyNailCommand(key, state.document.nails[key], source))
        if (commands.length > 0) execute(new CompositeCommand('คัดลอกเล็บไปทุกนิ้ว', commands))
        set({ selection: new Set(EDITABLE_NAILS) })
      },

      addLayer: (key, layer, index) => {
        if (!isEditable(key)) return
        const current = get().document.nails[key]
        if (current.layers.length >= MAX_LAYERS_PER_NAIL) {
          set({ notice: `เล็บหนึ่งนิ้วมีได้สูงสุด ${MAX_LAYERS_PER_NAIL} เลเยอร์` })
          return
        }
        execute(new AddLayerCommand(key, layer, index ?? current.layers.length))
      },

      removeLayer: (key, layerId) => {
        if (!isEditable(key)) return
        const layers = get().document.nails[key].layers
        if (layers.length <= 1) {
          set({ notice: 'เล็บแต่ละนิ้วต้องมีอย่างน้อย 1 เลเยอร์' })
          return
        }
        const index = layers.findIndex((layer) => layer.id === layerId)
        const layer = layers[index]
        if (!layer) return
        execute(new RemoveLayerCommand(key, layer, index))
      },

      renameLayer: (key, layerId, name, mergeKey) => {
        if (!isEditable(key) || name.length === 0 || name.length > 60) return
        const layer = get().document.nails[key].layers.find((item) => item.id === layerId)
        if (!layer) return
        execute(new RenameLayerCommand(key, layerId, layer.name, name, mergeKey))
      },

      setLayerVisibility: (key, layerId, visible) => {
        if (!isEditable(key)) return
        const layer = get().document.nails[key].layers.find((item) => item.id === layerId)
        if (!layer) return
        execute(new SetLayerVisibilityCommand(key, layerId, layer.visible, visible))
      },

      setLayerOpacity: (key, layerId, opacity, mergeKey) => {
        if (!isEditable(key) || opacity < 0 || opacity > 1) return
        const layer = get().document.nails[key].layers.find((item) => item.id === layerId)
        if (!layer) return
        execute(new SetLayerOpacityCommand(key, layerId, layer.opacity, opacity, mergeKey))
      },

      setLayerBlend: (key, layerId, blend) => {
        if (!isEditable(key)) return
        const layer = get().document.nails[key].layers.find((item) => item.id === layerId)
        if (!layer) return
        execute(new SetLayerBlendCommand(key, layerId, layer.blend, blend))
      },

      moveLayer: (key, layerId, toIndex) => {
        if (!isEditable(key)) return
        const layers = get().document.nails[key].layers
        const from = layers.findIndex((layer) => layer.id === layerId)
        if (from < 0) return
        execute(new MoveLayerCommand(key, layerId, from, toIndex))
      },

      undo: () => {
        const state = get()
        const result = state.history.undo(state.document)
        if (result.document === state.document) return
        set({
          document: result.document,
          revision: state.revision + 1,
          notice: null,
          activeLayerIds: repairActiveLayerIds(state.document, result.document, state.activeLayerIds),
        })
      },

      redo: () => {
        const state = get()
        const result = state.history.redo(state.document)
        if (result.document === state.document) return
        set({
          document: result.document,
          revision: state.revision + 1,
          notice: null,
          activeLayerIds: repairActiveLayerIds(state.document, result.document, state.activeLayerIds),
        })
      },

      dismissNotice: () => set({ notice: null }),
    }
  })
}
