import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  MAX_STROKES_PER_LAYER,
  MAX_LAYERS_PER_NAIL,
  createEmptyDocument,
  nailKeysOfHand,
  type Decoration,
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
import { nailsMatch } from '@/3d/history/commands/documentEdits.ts'
import {
  AddStrokeCommand,
  ClearNailCommand,
  CopyNailCommand,
  SetBaseColorCommand,
  SetFinishCommand,
  SetLengthCommand,
  SetShapeCommand,
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
import {
  AddDecorationCommand,
  MoveDecorationCommand,
  RemoveDecorationCommand,
  ScaleDecorationCommand,
} from '@/3d/history/commands/decorationCommands.ts'
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
  mode: 'paint' | 'decorate'
  selectedDecoration: { key: NailKey; decorationId: string } | null
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
  /**
   * ขออนุญาตเริ่มลากเส้น — คืนดัชนีเลเยอร์ของแต่ละนิ้ว หรือ null พร้อมตั้ง notice
   * ให้ผู้ใช้รู้เหตุผล ตัวควบคุมทั้งสองโหมดเรียกตัวนี้ตัวเดียวกัน
   */
  beginPaint: () => ReadonlyMap<NailKey, number> | null
  addStroke: (stroke: Stroke) => void
  clearSelectedNails: () => void
  setFinish: (finish: Nail['finish'], mergeKey?: string) => void
  setShape: (shape: Nail['shape'], mergeKey?: string) => void
  setLength: (length: Nail['length'], mergeKey?: string) => void
  setBaseColor: (color: string, mergeKey?: string) => void
  setMode: (mode: 'paint' | 'decorate') => void
  selectDecoration: (target: { key: NailKey; decorationId: string } | null) => void
  addDecoration: (key: NailKey, decoration: Decoration) => void
  removeDecoration: (key: NailKey, decorationId: string) => void
  moveDecoration: (key: NailKey, decorationId: string, u: number, v: number, rotation: number, mergeKey?: string) => void
  scaleDecoration: (key: NailKey, decorationId: string, scale: number, mergeKey?: string) => void
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

function isEditable(key: NailKey): boolean {
  return EDITABLE_NAILS.includes(key)
}

export const HISTORY_STUCK_NOTICE = 'ย้อนกลับไม่ได้ — ประวัติไม่ตรงกับงานบนหน้าจอแล้ว'

interface PaintTargets {
  /** เล็บที่พร้อมรับเส้น พร้อมดัชนีเลเยอร์ที่จะเขียนลง — ว่างเมื่อวาดไม่ได้ */
  layerIndexes: Map<NailKey, number>
  /** เหตุผลที่วาดไม่ได้ — null เมื่อวาดได้ หรือเมื่อไม่ได้เลือกนิ้วไว้เลย */
  notice: string | null
}

/**
 * ตรวจว่าตอนนี้ลงสีได้จริงไหม ก่อนจะเริ่มลากเส้น
 *
 * ทำไมต้องกัน: `compositeLayers` ข้ามเลเยอร์ที่ซ่อนหรือความทึบ 0 ไปเลย ถ้าเลเยอร์
 * ที่กำลังใช้งานเป็นแบบนั้น ผู้ใช้จะลากเส้นแล้วจอไม่เปลี่ยนอะไรสักนิด ทั้งที่เส้นถูก
 * บันทึกลงเอกสารเรียบร้อย — ความล้มเหลวที่ไม่มีอาการให้เห็นและเดาสาเหตุเองไม่ได้
 * เหมือนกรณี `beginStroke` ค้างใน Slice 2 จึงต้องบอกเหตุผลออกไปเสมอ ไม่ใช่เงียบ
 */
function paintTargetsOf(state: DesignState): PaintTargets {
  const empty = new Map<NailKey, number>()
  const layerIndexes = new Map<NailKey, number>()
  for (const key of editableSelection(state.selection)) {
    const layers = state.document.nails[key].layers
    const activeId = activeLayerIdOf(state.document, state.activeLayerIds, key)
    const index = layers.findIndex((layer) => layer.id === activeId)
    const layer = layers[index]
    if (!layer) return { layerIndexes: empty, notice: null }
    if (!layer.visible) {
      return { layerIndexes: empty, notice: `เลเยอร์ "${layer.name}" ถูกซ่อนอยู่ — เปิด "แสดง" ก่อนจึงจะวาดเห็น` }
    }
    if (layer.opacity <= 0) {
      return { layerIndexes: empty, notice: `เลเยอร์ "${layer.name}" ความทึบ 0% — เพิ่มความทึบก่อนจึงจะวาดเห็น` }
    }
    if (layer.strokes.length >= MAX_STROKES_PER_LAYER) {
      return {
        layerIndexes: empty,
        notice: `เลเยอร์นี้เก็บได้สูงสุด ${MAX_STROKES_PER_LAYER} เส้น — รวมเลเยอร์หรือเริ่มเลเยอร์ใหม่ก่อน`,
      }
    }
    layerIndexes.set(key, index)
  }
  return { layerIndexes, notice: null }
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
      mode: 'paint',
      selectedDecoration: null,

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

      beginPaint: () => {
        const { layerIndexes, notice } = paintTargetsOf(get())
        if (notice) set({ notice })
        return layerIndexes.size > 0 ? layerIndexes : null
      },

      addStroke: (stroke) => {
        const state = get()
        // ตรวจซ้ำตอนปิดเส้น ไม่ใช่เชื่อผลตอน beginPaint — เลเยอร์ถูกซ่อนกลางคันได้
        const { layerIndexes, notice } = paintTargetsOf(state)
        if (notice) {
          set({ notice })
          return
        }
        if (layerIndexes.size === 0) return
        execute(commandFor('วาดเส้น', [...layerIndexes].map(([key, index]) =>
          new AddStrokeCommand(key, state.document.nails[key].layers[index]!.id, stroke))))
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
          .map((key) => new SetFinishCommand(key, state.document.nails[key].finish, finish, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนผิวเล็บ', commands, mergeKey))
      },

      setShape: (shape, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .map((key) => new SetShapeCommand(key, state.document.nails[key].shape, shape, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนทรงเล็บ', commands, mergeKey))
      },

      setLength: (length, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .map((key) => new SetLengthCommand(key, state.document.nails[key].length, length, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนความยาวเล็บ', commands, mergeKey))
      },

      setBaseColor: (color, mergeKey) => {
        const state = get()
        const commands = editableSelection(state.selection)
          .map((key) => new SetBaseColorCommand(key, state.document.nails[key].baseColor, color, mergeKey))
        if (commands.length > 0) execute(commandFor('เปลี่ยนสีเล็บ', commands, mergeKey))
      },

      setMode: (mode) => set({ mode, selectedDecoration: mode === 'paint' ? null : get().selectedDecoration }),

      selectDecoration: (target) => set({ selectedDecoration: target }),

      addDecoration: (key, decoration) => {
        if (!isEditable(key)) return
        const nail = get().document.nails[key]
        execute(new AddDecorationCommand(key, decoration, nail.decorations.length))
      },

      removeDecoration: (key, decorationId) => {
        if (!isEditable(key)) return
        const decorations = get().document.nails[key].decorations
        const index = decorations.findIndex((decoration) => decoration.id === decorationId)
        const decoration = decorations[index]
        if (!decoration) return
        if (execute(new RemoveDecorationCommand(key, decoration, index))) {
          const selected = get().selectedDecoration
          if (selected && selected.key === key && selected.decorationId === decorationId) {
            set({ selectedDecoration: null })
          }
        }
      },

      moveDecoration: (key, decorationId, u, v, rotation, mergeKey) => {
        if (!isEditable(key)) return
        const decoration = get().document.nails[key].decorations.find((item) => item.id === decorationId)
        if (!decoration) return
        execute(new MoveDecorationCommand(
          key, decorationId,
          { u: decoration.u, v: decoration.v, rotation: decoration.rotation },
          { u, v, rotation },
          mergeKey,
        ))
      },

      scaleDecoration: (key, decorationId, scale, mergeKey) => {
        if (!isEditable(key)) return
        const decoration = get().document.nails[key].decorations.find((item) => item.id === decorationId)
        if (!decoration) return
        execute(new ScaleDecorationCommand(key, decorationId, decoration.scale, scale, mergeKey))
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
        // เลเยอร์ที่เพิ่งเพิ่มต้องกลายเป็นเลเยอร์ที่ใช้งานทันที ไม่งั้นผู้ใช้กดเพิ่ม
        // แล้ววาดต่อ สีจะไปลงเลเยอร์เดิมโดยไม่มีอะไรบอก — การ undo จะพาชั้นที่เลือก
        // กลับเองผ่าน repairActiveLayerIds เพราะเลเยอร์นั้นหายไปจากเอกสาร
        if (execute(new AddLayerCommand(key, layer, index ?? current.layers.length))) {
          set((state) => ({ activeLayerIds: { ...state.activeLayerIds, [key]: layer.id } }))
        }
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
        if (!isEditable(key)) return
        const normalized = name.trim()
        if (normalized.length === 0) {
          set({ notice: 'กรุณาตั้งชื่อเลเยอร์' })
          return
        }
        if (normalized.length > 60) {
          set({ notice: 'ชื่อเลเยอร์ยาวเกิน 60 ตัวอักษร' })
          return
        }
        const layer = get().document.nails[key].layers.find((item) => item.id === layerId)
        if (!layer) return
        execute(new RenameLayerCommand(key, layerId, layer.name, normalized, mergeKey))
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
        if (!state.history.state().canUndo) return
        const result = state.history.undo(state.document)
        // มีรายการอยู่แต่เล่นย้อนไม่ได้ = ประวัติไม่ตรงกับเอกสารแล้ว ต้องบอก
        // ไม่ใช่เงียบ ไม่งั้นผู้ใช้จะเห็นแค่ "กดแล้วไม่มีอะไรเกิดขึ้น"
        if (!result.applied) {
          set({ notice: HISTORY_STUCK_NOTICE })
          return
        }
        set({
          document: result.document,
          revision: state.revision + 1,
          notice: null,
          activeLayerIds: repairActiveLayerIds(state.document, result.document, state.activeLayerIds),
        })
      },

      redo: () => {
        const state = get()
        if (!state.history.state().canRedo) return
        const result = state.history.redo(state.document)
        if (!result.applied) {
          set({ notice: HISTORY_STUCK_NOTICE })
          return
        }
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
