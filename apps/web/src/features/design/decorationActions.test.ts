import { describe, expect, it } from 'vitest'
import type { NailKey } from '@nail-studio/contracts'
import { createDesignStore } from './designStore.ts'

const RIGHT_INDEX: NailKey = 'right.index'

function deco(id: string, u = 0.5, v = 0.5) {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('decoration store actions', () => {
  it('defaults to paint mode with no selection', () => {
    const store = createDesignStore()
    expect(store.getState().mode).toBe('paint')
    expect(store.getState().selectedDecoration).toBeNull()
  })

  it('switches mode', () => {
    const store = createDesignStore()
    store.getState().setMode('decorate')
    expect(store.getState().mode).toBe('decorate')
  })

  it('adds a decoration to the given nail', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    expect(store.getState().document.nails[RIGHT_INDEX].decorations).toHaveLength(1)
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.id).toBe('a')
  })

  it('removes a decoration and clears selection if it was selected', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    store.getState().selectDecoration({ key: RIGHT_INDEX, decorationId: 'a' })
    store.getState().removeDecoration(RIGHT_INDEX, 'a')
    expect(store.getState().document.nails[RIGHT_INDEX].decorations).toHaveLength(0)
    expect(store.getState().selectedDecoration).toBeNull()
  })

  it('moves a decoration and supports undo', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a', 0.3, 0.3))
    store.getState().moveDecoration(RIGHT_INDEX, 'a', 0.6, 0.7, 1.0)
    const moved = store.getState().document.nails[RIGHT_INDEX].decorations[0]!
    expect(moved.u).toBeCloseTo(0.6)
    expect(moved.v).toBeCloseTo(0.7)
    expect(moved.rotation).toBeCloseTo(1.0)
    store.getState().undo()
    const restored = store.getState().document.nails[RIGHT_INDEX].decorations[0]!
    expect(restored.u).toBeCloseTo(0.3)
    expect(restored.v).toBeCloseTo(0.3)
  })

  it('scales a decoration and supports undo', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    store.getState().scaleDecoration(RIGHT_INDEX, 'a', 0.5)
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.scale).toBeCloseTo(0.5)
    store.getState().undo()
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.scale).toBeCloseTo(0.1)
  })

  it('adding to a non-editable nail is a no-op', () => {
    const store = createDesignStore()
    const before = store.getState().document
    store.getState().addDecoration('left.thumb' as NailKey, deco('a'))
    expect(store.getState().document).toBe(before)
  })
})
