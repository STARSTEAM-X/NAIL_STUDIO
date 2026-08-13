import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyDocument,
  type DesignDocument,
  type Layer,
} from '@nail-studio/contracts'
import { EDITABLE_NAILS, createDesignStore } from './designStore.ts'

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
