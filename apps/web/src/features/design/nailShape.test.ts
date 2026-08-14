// apps/web/src/features/design/nailShape.test.ts
import { describe, expect, it } from 'vitest'
import { EDITABLE_NAILS, createDesignStore } from './designStore.ts'

describe('setShape / setLength', () => {
  it('เปลี่ยนทรงของนิ้วที่เลือกแล้วเข้าประวัติ ย้อนได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().setShape('stiletto')

    expect(store.getState().document.nails['right.index'].shape).toBe('stiletto')
    expect(store.getState().history.state()).toMatchObject({ canUndo: true })

    store.getState().undo()
    expect(store.getState().document.nails['right.index'].shape).toBe('round')
  })

  it('เปลี่ยนความยาวของนิ้วที่เลือกแล้วเข้าประวัติ ย้อนได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().setLength('extra')

    expect(store.getState().document.nails['right.index'].length).toBe('extra')
    store.getState().undo()
    expect(store.getState().document.nails['right.index'].length).toBe('medium')
  })

  it('ใช้กับทุกนิ้วที่เลือกได้พร้อมกันผ่าน selectAll', () => {
    const store = createDesignStore()
    store.getState().selectAll()
    store.getState().setShape('almond')

    expect(EDITABLE_NAILS.every((key) => store.getState().document.nails[key].shape === 'almond')).toBe(true)
    store.getState().undo()
    expect(EDITABLE_NAILS.every((key) => store.getState().document.nails[key].shape === 'round')).toBe(true)
  })

  it('ไม่ทำอะไรถ้าเลือกทรง/ความยาวเดิม (ไม่บันทึกประวัติเปล่า)', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    const revisionBefore = store.getState().revision
    store.getState().setShape('round')
    expect(store.getState().revision).toBe(revisionBefore)
  })
})
