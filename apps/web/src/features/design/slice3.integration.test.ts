import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyDocument,
  type DesignDocument,
  type Layer,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import type { Command } from '@/3d/history/Command.ts'
import { EDITABLE_NAILS, HISTORY_STUCK_NOTICE, createDesignStore } from './designStore.ts'

function stroke(): Stroke {
  return {
    kind: 'brush',
    brush: 'round',
    color: '#ff0000',
    size: 20,
    opacity: 1,
    softness: 0.5,
    points: [{ x: 0.5, y: 0.5, p: 1 }, { x: 0.6, y: 0.6, p: 1 }],
  }
}

function withNailColor(
  document: DesignDocument,
  key: keyof DesignDocument['nails'],
  color: string,
): DesignDocument {
  return {
    ...document,
    nails: {
      ...document.nails,
      [key]: { ...document.nails[key], baseColor: color },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Slice 3 store and history scenarios', () => {
  it('restores exact state through 100 executes, 100 undos, and 100 redos', () => {
    const original = createEmptyDocument()
    const store = createDesignStore({ document: original })

    for (let index = 1; index <= 100; index += 1) {
      store.getState().setBaseColor(`#${index.toString(16).padStart(6, '0')}`)
    }
    const edited = structuredClone(store.getState().document)
    expect(edited.nails['right.index'].baseColor).toBe('#000064')

    for (let index = 0; index < 100; index += 1) store.getState().undo()
    expect(store.getState().document).toEqual(original)
    expect(store.getState().history.state()).toMatchObject({ canUndo: false, canRedo: true })

    for (let index = 0; index < 100; index += 1) store.getState().redo()
    expect(store.getState().document).toEqual(edited)
    expect(store.getState().revision).toBe(300)
    expect(store.getState().history.state()).toMatchObject({ canUndo: true, canRedo: false })
  })

  it('coalesces one layer-opacity slider gesture into one undo item', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const store = createDesignStore()
    const layerId = store.getState().activeLayerId('right.index')
    const mergeKey = `layer-opacity:right.index:${layerId}`

    store.getState().setLayerOpacity('right.index', layerId, 0.8, mergeKey)
    store.getState().setLayerOpacity('right.index', layerId, 0.5, mergeKey)
    store.getState().setLayerOpacity('right.index', layerId, 0.2, mergeKey)

    expect(store.getState().document.nails['right.index'].layers[0]?.opacity).toBe(0.2)
    store.getState().undo()
    expect(store.getState().document.nails['right.index'].layers[0]?.opacity).toBe(1)
    expect(store.getState().history.state()).toMatchObject({ canUndo: false, canRedo: true })

    store.getState().redo()
    expect(store.getState().document.nails['right.index'].layers[0]?.opacity).toBe(0.2)
  })

  it('undoes a mixed layer workflow to exact document equality', () => {
    const original = createEmptyDocument()
    const store = createDesignStore({ document: original })
    const second: Layer = {
      id: 'layer-2', name: 'Accent', visible: true, opacity: 1, blend: 'normal', strokes: [],
    }
    const third: Layer = {
      id: 'layer-3', name: 'Detail', visible: true, opacity: 1, blend: 'normal', strokes: [],
    }

    store.getState().addLayer('right.index', second, 1)
    store.getState().addLayer('right.index', third, 2)
    store.getState().renameLayer('right.index', 'layer-2', 'Chrome accent')
    store.getState().setLayerVisibility('right.index', 'layer-2', false)
    store.getState().setLayerOpacity('right.index', 'layer-2', 0.35)
    store.getState().setLayerBlend('right.index', 'layer-2', 'multiply')
    store.getState().moveLayer('right.index', 'layer-3', 0)
    store.getState().removeLayer('right.index', 'layer-2')

    expect(store.getState().document).not.toEqual(original)
    for (let index = 0; index < 8; index += 1) store.getState().undo()
    expect(store.getState().document).toEqual(original)
    expect(store.getState().history.state()).toMatchObject({ canUndo: false, canRedo: true })
  })

  it('applies one composite command to exactly five editable nails', () => {
    const original = withNailColor(createEmptyDocument(), 'left.middle', '#123456')
    const store = createDesignStore({ document: original })
    const leftBefore = structuredClone(
      Object.fromEntries(Object.entries(original.nails).filter(([key]) => key.startsWith('left.'))),
    )

    store.getState().selectAll()
    store.getState().setBaseColor('#654321')

    expect(EDITABLE_NAILS).toHaveLength(5)
    expect(EDITABLE_NAILS.every((key) => store.getState().document.nails[key].baseColor === '#654321')).toBe(true)
    expect(Object.fromEntries(
      Object.entries(store.getState().document.nails).filter(([key]) => key.startsWith('left.')),
    )).toEqual(leftBefore)

    store.getState().undo()
    expect(store.getState().document).toEqual(original)
    expect(store.getState().history.state()).toMatchObject({ canUndo: false, canRedo: true })
  })

  it('makes a freshly added layer the active one, and undo puts it back', () => {
    const store = createDesignStore()
    const key = 'right.index' as const
    const first = store.getState().activeLayerId(key)
    const added: Layer = {
      id: 'layer-new', name: 'ใหม่', visible: true, opacity: 1, blend: 'normal', strokes: [],
    }

    store.getState().addLayer(key, added)
    // ถ้าไม่สลับให้ ผู้ใช้กด "เพิ่ม" แล้ววาดต่อ สีจะไปลงเลเยอร์เดิมโดยไม่มีอะไรบอก
    expect(store.getState().activeLayerId(key)).toBe('layer-new')

    store.getState().undo()
    expect(store.getState().activeLayerId(key)).toBe(first)
  })

  it('refuses to paint into a hidden layer and says why', () => {
    const store = createDesignStore()
    const key = 'right.index' as const
    store.getState().selectNail(key)
    const layerId = store.getState().activeLayerId(key)
    store.getState().setLayerVisibility(key, layerId, false)
    const before = store.getState().document

    expect(store.getState().beginPaint()).toBeNull()
    expect(store.getState().notice).toContain('ถูกซ่อนอยู่')

    // ถึงจะเรียก addStroke ตรง ๆ ก็ต้องไม่เขียนลงเอกสาร — จอไม่เปลี่ยนแต่ไฟล์เปลี่ยนไม่ได้
    store.getState().addStroke(stroke())
    expect(store.getState().document).toBe(before)

    store.getState().setLayerVisibility(key, layerId, true)
    expect(store.getState().beginPaint()).toEqual(new Map([[key, 0]]))
    store.getState().addStroke(stroke())
    expect(store.getState().document.nails[key].layers[0]?.strokes).toHaveLength(1)
  })

  it('refuses to paint into a layer at zero opacity and says why', () => {
    const store = createDesignStore()
    const key = 'right.index' as const
    store.getState().selectNail(key)
    store.getState().setLayerOpacity(key, store.getState().activeLayerId(key), 0)
    const before = store.getState().document

    expect(store.getState().beginPaint()).toBeNull()
    expect(store.getState().notice).toContain('ความทึบ 0%')
    store.getState().addStroke(stroke())
    expect(store.getState().document).toBe(before)
  })

  it('warns instead of going silent when history no longer matches the document', () => {
    const store = createDesignStore()
    // คำสั่งที่ย้อนตัวเองไม่ได้ ถูกบันทึกลงประวัติโดยที่ store ไม่ได้รับเอกสารใหม่ไป
    // — สภาพเดียวกับตอนที่ประวัติกับเอกสารหลุดจากกัน
    const stubborn: Command = {
      label: 'ดื้อ',
      do: (current) => ({
        document: { ...current, hand: { ...current.hand, skinTone: '#abcdef' } },
        affects: new Set<NailKey>(),
      }),
      undo: (current) => ({ document: current, affects: new Set<NailKey>() }),
    }
    store.getState().history.execute(store.getState().document, stubborn)
    expect(store.getState().history.state().canUndo).toBe(true)

    store.getState().undo()
    expect(store.getState().notice).toBe(HISTORY_STUCK_NOTICE)
    expect(store.getState().history.state().canUndo).toBe(true)
  })

  it('cannot replay commands from the previous document after loading a server document', () => {
    const serverDocument = withNailColor(createEmptyDocument(), 'right.index', '#445566')
    const store = createDesignStore()
    store.getState().setBaseColor('#112233')
    store.getState().setFinish('matte')
    store.getState().undo()
    expect(store.getState().history.state()).toMatchObject({ canUndo: true, canRedo: true })

    store.getState().loadDocument(serverDocument)
    const revisionAfterLoad = store.getState().revision
    store.getState().undo()
    store.getState().redo()

    expect(store.getState().document).toEqual(serverDocument)
    expect(store.getState().revision).toBe(revisionAfterLoad)
    expect(store.getState().history.state()).toEqual({
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    })
  })
})
