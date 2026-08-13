import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  MAX_STROKES_PER_LAYER,
  createEmptyDocument,
  nailKeysOfHand,
  type DesignDocument,
  type Hand,
  type Layer,
  type Nail,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { DEFAULT_PAINT_SETTINGS, type PaintSettings } from '@/3d/painting/paintSettings.ts'

/**
 * สถานะของหน้าแก้ไขงานหนึ่งชิ้น
 *
 * เป็น "โรงงาน" ไม่ใช่ store ก้อนเดียวทั้งแอป เพราะสถานะนี้ผูกกับงานที่เปิดอยู่
 * ถ้าเป็นก้อนเดียวทั้งแอป การเปิดงานชิ้นถัดไปจะเห็นเส้นของงานก่อนหน้าค้างอยู่ชั่วขณะ
 * และเทสแต่ละข้อจะแชร์สถานะกัน ต้องคอยรีเซ็ตเองซึ่งพลาดง่าย
 *
 * ค่าคงตัวที่ต้องเป็นจริงเสมอ:
 *   1. selection ไม่เคยว่าง — ต้องมีเล็บที่ถูกเลือกอย่างน้อยหนึ่งนิ้วเสมอ
 *   2. เล็บที่ไม่ได้ถูกแก้ต้องคง identity เดิม (===) เพื่อให้ชั้นแคชเท็กซ์เจอร์
 *      รู้ได้ในเวลาคงที่ว่าต้องวาดใหม่นิ้วไหน โดยไม่ต้องเทียบเนื้อในทั้งเอกสาร
 *   3. revision เพิ่มขึ้นทุกครั้งที่ document เปลี่ยน — เป็นฐานของ autosave
 */

/**
 * มือเดียวที่แก้ไขได้ในตอนนี้ (Slice 2)
 *
 * เอกสารงานยังเก็บครบ 10 นิ้วตามเดิม — จงใจไม่ตัด schema ลงเหลือ 5 เพราะการเปลี่ยน
 * รูปแบบเอกสารต้องมี migration ของงานที่ผู้ใช้บันทึกไว้แล้ว ซึ่งเป็นราคาที่ไม่ควรจ่าย
 * เพื่อการตัดฟีเจอร์ชั่วคราว เล็บมือซ้ายจึงถูกเก็บไว้เป็นค่าเริ่มต้นและไม่ถูกแตะ
 *
 * การเปิดมือซ้ายกลับมาคือการแก้ค่านี้ให้เป็นรายการของมือ แล้วเพิ่ม UI สลับมือกลับเข้าไป
 * ส่วนการกลับด้านโมเดลมีบันทึกไว้ใน architecture.md D-23
 */
export const EDITABLE_HAND: Hand = 'right'

/** คีย์เล็บทั้งหมดที่แก้ไขได้ในตอนนี้ */
export const EDITABLE_NAILS: NailKey[] = nailKeysOfHand(EDITABLE_HAND)

/**
 * เป้าหมายที่อยากให้กล้องไปจ่อ — เป็นสถานะของมุมมอง ไม่ใช่ส่วนหนึ่งของงานออกแบบ
 * จึงไม่ถูกบันทึกลงเอกสารและไม่นับเป็นการแก้ไข (revision ไม่ขยับ)
 */
export type FocusTarget = { kind: 'nail'; key: NailKey } | { kind: 'home' } | null

export interface DesignState {
  document: DesignDocument
  focus: FocusTarget
  /** เล็บที่ถูกเลือก — วาดหนึ่งครั้งลงทุกนิ้วที่เลือกไว้ */
  selection: Set<NailKey>
  /** ใช้ดัชนีไม่ใช่ id เพราะเลเยอร์เป็นคนละชุดในแต่ละเล็บ id เดียวจึงชี้ข้ามเล็บไม่ได้ */
  activeLayerIndex: number
  settings: PaintSettings
  /** นับทุกการเปลี่ยนแปลงของ document — autosave เทียบตัวเลขนี้กับที่บันทึกไปแล้ว */
  revision: number
  /** ข้อความบอกผู้ใช้เมื่อการกระทำถูกปฏิเสธ เช่น ชนเพดานจำนวนเส้น */
  notice: string | null
}

export interface DesignActions {
  loadDocument: (document: DesignDocument) => void
  selectNail: (key: NailKey, mode?: 'replace' | 'toggle') => void
  selectAll: () => void
  focusNail: (key: NailKey) => void
  focusHome: () => void
  clearFocus: () => void
  setSettings: (patch: Partial<PaintSettings>) => void
  addStroke: (stroke: Stroke) => void
  clearSelectedNails: () => void
  setFinish: (finish: Nail['finish']) => void
  setBaseColor: (color: string) => void
  copyActiveNailToAll: () => void
  dismissNotice: () => void
}

export type DesignStore = StoreApi<DesignState & DesignActions>

/** เล็บที่ถือว่า "ต้นฉบับ" เมื่อสั่งคัดลอกไปทุกนิ้ว — นิ้วแรกตามลำดับมาตรฐาน */
export function primaryOf(selection: Set<NailKey>): NailKey {
  const first = EDITABLE_NAILS.find((key) => selection.has(key))
  // selection ว่างไม่ควรเกิดขึ้นตามค่าคงตัวข้อ 1 แต่ถ้าเกิดก็ต้องไม่ทำให้ทั้งหน้าพัง
  return first ?? EDITABLE_NAILS[0] ?? 'right.thumb'
}

/** แก้เล็บที่เลือกไว้ทีละนิ้ว โดยเล็บที่ไม่ถูกแตะต้องคง identity เดิม (ค่าคงตัวข้อ 2) */
function mapNails(
  document: DesignDocument,
  keys: Iterable<NailKey>,
  update: (nail: Nail, key: NailKey) => Nail,
): DesignDocument {
  const nails = { ...document.nails }
  let changed = false
  for (const key of keys) {
    const current = nails[key]
    const next = update(current, key)
    if (next !== current) {
      nails[key] = next
      changed = true
    }
  }
  return changed ? { ...document, nails } : document
}

function replaceLayer(nail: Nail, index: number, update: (layer: Layer) => Layer): Nail {
  const target = nail.layers[index]
  if (!target) return nail
  const next = update(target)
  if (next === target) return nail
  const layers = [...nail.layers]
  layers[index] = next
  return { ...nail, layers }
}

export interface CreateDesignStoreOptions {
  document?: DesignDocument
  settings?: PaintSettings
}

export function createDesignStore(options: CreateDesignStoreOptions = {}): DesignStore {
  const document = options.document ?? createEmptyDocument()
  return createStore<DesignState & DesignActions>((set, get) => ({
    document,
    focus: null,
    selection: new Set<NailKey>([EDITABLE_NAILS[1] ?? 'right.index']),
    activeLayerIndex: 0,
    settings: options.settings ?? DEFAULT_PAINT_SETTINGS,
    revision: 0,
    notice: null,

    loadDocument: (next) => {
      set((state) => ({ document: next, revision: state.revision + 1, notice: null }))
    },

    selectNail: (key, mode = 'replace') => {
      set((state) => {
        if (mode === 'replace') return { selection: new Set([key]) }
        const selection = new Set(state.selection)
        if (selection.has(key)) {
          // ห้ามเหลือศูนย์ (ค่าคงตัวข้อ 1) — ไม่งั้นแถบเครื่องมือจะสั่งงานอะไรไม่ได้เลย
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

    focusNail: (key) => {
      set({ focus: { kind: 'nail', key } })
    },

    focusHome: () => {
      set({ focus: { kind: 'home' } })
    },

    clearFocus: () => {
      // เขียนเฉพาะตอนที่มีอะไรให้ล้างจริง — ตัวยกเลิกถูกเรียกทุกครั้งที่แตะแคนวาส
      // การ set ทุกครั้งจะทำให้ทั้งหน้า render ใหม่ทุกจังหวะที่เริ่มลากเส้น
      if (get().focus !== null) set({ focus: null })
    },

    setSettings: (patch) => {
      set((state) => ({ settings: { ...state.settings, ...patch } }))
    },

    addStroke: (stroke) => {
      const state = get()
      const index = state.activeLayerIndex
      const overflowing = [...state.selection].some(
        (key) => (state.document.nails[key].layers[index]?.strokes.length ?? 0) >= MAX_STROKES_PER_LAYER,
      )
      if (overflowing) {
        set({ notice: `เลเยอร์นี้เก็บได้สูงสุด ${MAX_STROKES_PER_LAYER} เส้น — รวมเลเยอร์หรือเริ่มเลเยอร์ใหม่ก่อน` })
        return
      }
      // เส้นก้อนเดียวกันถูกใช้ร่วมกันได้ทุกนิ้ว เพราะเป็นข้อมูลอ่านอย่างเดียว
      // ทั้งเส้นทาง (เอกสารงานถูกแก้ด้วยการสร้างใหม่เสมอ ไม่มีใครแก้เส้นในที่)
      const document = mapNails(state.document, state.selection, (nail) =>
        replaceLayer(nail, index, (layer) => ({ ...layer, strokes: [...layer.strokes, stroke] })),
      )
      set({ document, revision: state.revision + 1 })
    },

    clearSelectedNails: () => {
      const state = get()
      const document = mapNails(state.document, state.selection, (nail) =>
        nail.layers.every((layer) => layer.strokes.length === 0)
          ? nail
          : { ...nail, layers: nail.layers.map((layer) => ({ ...layer, strokes: [] })) },
      )
      if (document === state.document) return
      set({ document, revision: state.revision + 1 })
    },

    setFinish: (finish) => {
      const state = get()
      const document = mapNails(state.document, state.selection, (nail) =>
        nail.finish === finish ? nail : { ...nail, finish },
      )
      if (document === state.document) return
      set({ document, revision: state.revision + 1 })
    },

    setBaseColor: (color) => {
      const state = get()
      const document = mapNails(state.document, state.selection, (nail) =>
        nail.baseColor === color ? nail : { ...nail, baseColor: color },
      )
      if (document === state.document) return
      set({ document, revision: state.revision + 1 })
    },

    copyActiveNailToAll: () => {
      const state = get()
      const sourceKey = primaryOf(state.selection)
      const source = state.document.nails[sourceKey]
      // คัดลอกเฉพาะนิ้วที่ผู้ใช้มองเห็นและแก้ไขได้ — การไปเขียนเล็บมือที่ยังไม่ได้เปิด
      // ใช้งานคือการเปลี่ยนข้อมูลที่ผู้ใช้ไม่มีทางเห็นว่าเปลี่ยน
      const others = EDITABLE_NAILS.filter((key) => key !== sourceKey)
      const document = mapNails(state.document, others, () => ({
        ...source,
        // ต้องสร้างอาร์เรย์ใหม่ให้แต่ละนิ้ว ไม่ใช่ใช้ก้อนเดียวกัน ไม่งั้นการวาดนิ้วเดียว
        // หลังจากนี้จะไปเปลี่ยนทุกนิ้วพร้อมกัน (บั๊กเดียวกับที่ createEmptyDocument เคยมี)
        layers: source.layers.map((layer) => ({ ...layer, strokes: [...layer.strokes] })),
        decorations: source.decorations.map((decoration) => ({ ...decoration })),
      }))
      set({ document, revision: state.revision + 1, selection: new Set(EDITABLE_NAILS) })
    },

    dismissNotice: () => {
      set({ notice: null })
    },
  }))
}
