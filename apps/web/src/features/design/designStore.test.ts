import { describe, expect, it } from 'vitest'
import {
  MAX_STROKES_PER_LAYER,
  NAIL_KEYS,
  createEmptyDocument,
  designDocumentSchema,
  type Stroke,
} from '@nail-studio/contracts'
import { EDITABLE_NAILS, createDesignStore, primaryOf } from './designStore.ts'

const STROKE: Stroke = {
  kind: 'brush', brush: 'round', color: '#b5314c',
  size: 100, opacity: 1, softness: 0.25,
  points: [{ x: 0.5, y: 0.5, p: 0.7 }],
}

function strokesOf(store: ReturnType<typeof createDesignStore>, key: (typeof NAIL_KEYS)[number]) {
  return store.getState().document.nails[key].layers[0]?.strokes ?? []
}

describe('การเลือกเล็บ', () => {
  it('เริ่มต้นมีเล็บที่เลือกไว้เสมอ', () => {
    expect(createDesignStore().getState().selection.size).toBe(1)
  })

  it('เลือกแบบแทนที่ได้ทีละนิ้ว', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.ring')
    expect([...store.getState().selection]).toEqual(['right.ring'])
  })

  it('เลือกทุกนิ้วได้เฉพาะนิ้วที่แก้ไขได้จริง ไม่ลามไปมือที่ยังไม่ได้เปิดใช้', () => {
    const store = createDesignStore()
    store.getState().selectAll()
    expect([...store.getState().selection].sort()).toEqual([...EDITABLE_NAILS].sort())
  })

  it('เลือกเพิ่มทีละนิ้วและถอดออกได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().selectNail('right.middle', 'toggle')
    expect(store.getState().selection.size).toBe(2)
    store.getState().selectNail('right.middle', 'toggle')
    expect([...store.getState().selection]).toEqual(['right.index'])
  })

  it('ถอดนิ้วสุดท้ายออกไม่ได้ — ต้องเหลืออย่างน้อยหนึ่งนิ้วเสมอ', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().selectNail('right.index', 'toggle')
    expect(store.getState().selection.size).toBe(1)
  })

})

describe('การวาดเส้น', () => {
  it('เส้นเดียวลงทุกนิ้วที่เลือกไว้ และไม่ลงนิ้วที่ไม่ได้เลือก', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().selectNail('right.ring', 'toggle')
    store.getState().addStroke(STROKE)
    expect(strokesOf(store, 'right.index')).toHaveLength(1)
    expect(strokesOf(store, 'right.ring')).toHaveLength(1)
    expect(strokesOf(store, 'right.middle')).toHaveLength(0)
  })

  it('เล็บที่ไม่ถูกแตะคง identity เดิม — ชั้นแคชเท็กซ์เจอร์พึ่งข้อนี้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    const before = store.getState().document.nails
    store.getState().addStroke(STROKE)
    const after = store.getState().document.nails
    expect(after['right.index']).not.toBe(before['right.index'])
    for (const key of NAIL_KEYS) {
      if (key !== 'right.index') expect(after[key]).toBe(before[key])
    }
  })

  it('revision เพิ่มขึ้นทุกครั้งที่เอกสารเปลี่ยน — autosave พึ่งข้อนี้', () => {
    const store = createDesignStore()
    const before = store.getState().revision
    store.getState().addStroke(STROKE)
    expect(store.getState().revision).toBe(before + 1)
  })

  it('การกระทำที่ไม่เปลี่ยนอะไรเลยไม่ทำให้ revision ขยับ', () => {
    // ไม่งั้น autosave จะยิงคำขอทุกครั้งที่ผู้ใช้กดปุ่มค่าเดิมซ้ำ
    const store = createDesignStore()
    store.getState().setFinish('glossy')
    expect(store.getState().revision).toBe(0)
    store.getState().clearSelectedNails()
    expect(store.getState().revision).toBe(0)
  })

  it('ปฏิเสธเมื่อชนเพดานจำนวนเส้น พร้อมบอกผู้ใช้ว่าทำไม', () => {
    const document = createEmptyDocument()
    const layer = document.nails['right.index'].layers[0]!
    layer.strokes = Array.from({ length: MAX_STROKES_PER_LAYER }, () => STROKE)
    const store = createDesignStore({ document })
    store.getState().selectNail('right.index')
    store.getState().addStroke(STROKE)
    expect(strokesOf(store, 'right.index')).toHaveLength(MAX_STROKES_PER_LAYER)
    expect(store.getState().notice).toContain(String(MAX_STROKES_PER_LAYER))
  })

  it('เอกสารยังผ่าน schema หลังวาด — สิ่งที่บันทึกไปต้องถูกต้องเสมอ', () => {
    const store = createDesignStore()
    store.getState().selectAll()
    store.getState().addStroke(STROKE)
    expect(() => designDocumentSchema.parse(store.getState().document)).not.toThrow()
  })
})

describe('การใช้กับทุกนิ้ว', () => {
  it('คัดลอกเล็บต้นฉบับไปครบทุกนิ้วที่แก้ไขได้', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.index')
    store.getState().addStroke(STROKE)
    store.getState().copyActiveNailToAll()
    for (const key of EDITABLE_NAILS) expect(strokesOf(store, key)).toHaveLength(1)
  })

  it('ไม่แตะเล็บของมือที่ยังไม่ได้เปิดใช้งาน', () => {
    // เขียนข้อมูลที่ผู้ใช้ไม่มีทางเห็นว่าเปลี่ยน คือสิ่งที่จะกลายเป็นเซอร์ไพรส์
    // ตอนเปิดมือที่สองกลับมาในภายหลัง
    const store = createDesignStore()
    const untouched = NAIL_KEYS.filter((key) => !EDITABLE_NAILS.includes(key))
    const before = store.getState().document.nails
    store.getState().addStroke(STROKE)
    store.getState().copyActiveNailToAll()
    const after = store.getState().document.nails
    for (const key of untouched) expect(after[key]).toBe(before[key])
  })

  it('หลังคัดลอกแล้ว การวาดนิ้วเดียวไม่ไปเปลี่ยนนิ้วอื่น', () => {
    // ข้อนี้คือบั๊กที่เกิดขึ้นแน่นอนถ้าคัดลอกแบบใช้อาร์เรย์ก้อนเดียวกันทุกนิ้ว
    const store = createDesignStore()
    store.getState().copyActiveNailToAll()
    store.getState().selectNail('right.thumb')
    store.getState().addStroke(STROKE)
    expect(strokesOf(store, 'right.thumb')).toHaveLength(1)
    expect(strokesOf(store, 'right.little')).toHaveLength(0)
  })

  it('เลือกนิ้วแรกตามลำดับมาตรฐานเป็นต้นฉบับ ไม่ขึ้นกับลำดับที่ผู้ใช้กด', () => {
    expect(primaryOf(new Set(['right.ring', 'right.index']))).toBe('right.index')
    expect(primaryOf(new Set())).toBe('right.thumb')
  })
})

describe('การล้างและวัสดุ', () => {
  it('ล้างเฉพาะนิ้วที่เลือก', () => {
    const store = createDesignStore()
    store.getState().selectAll()
    store.getState().addStroke(STROKE)
    store.getState().selectNail('right.index')
    store.getState().clearSelectedNails()
    expect(strokesOf(store, 'right.index')).toHaveLength(0)
    expect(strokesOf(store, 'right.middle')).toHaveLength(1)
  })

  it('เปลี่ยนวัสดุและสีพื้นเฉพาะนิ้วที่เลือก', () => {
    const store = createDesignStore()
    store.getState().selectNail('right.little')
    store.getState().setFinish('chrome')
    store.getState().setBaseColor('#123456')
    expect(store.getState().document.nails['right.little'].finish).toBe('chrome')
    expect(store.getState().document.nails['right.little'].baseColor).toBe('#123456')
    expect(store.getState().document.nails['right.ring'].finish).toBe('glossy')
  })
})
