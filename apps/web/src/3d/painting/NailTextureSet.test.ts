import { describe, expect, it } from 'vitest'
import {
  createEmptyDocument,
  nailKeysOfHand,
  type DesignDocument,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { createFakeCanvas, type DrawCall } from './fakeCanvas.ts'
import { NailTextureSet, type CanvasFactory, type Surface } from './NailTextureSet.ts'

function stroke(color: string): Stroke {
  return {
    kind: 'brush', brush: 'round', color, size: 80, opacity: 1, softness: 0,
    points: [{ x: 0.4, y: 0.4, p: 1 }, { x: 0.6, y: 0.6, p: 1 }],
  }
}

interface Harness {
  textures: NailTextureSet
  document: DesignDocument
  /** จำนวนแคนวาสที่ถูกสร้าง — ตัวชี้วัดหน่วยความจำที่จองไว้ */
  created: () => number
  callsOf: (surface: Surface) => DrawCall[]
  surfaces: Array<{ surface: Surface; calls: DrawCall[] }>
  addStroke: (key: NailKey, value: Stroke) => void
}

function harness(): Harness {
  const surfaces: Array<{ surface: Surface; calls: DrawCall[] }> = []
  const factory: CanvasFactory = () => {
    const fake = createFakeCanvas()
    const surface: Surface = { canvas: {} as CanvasImageSource, ctx: fake.ctx }
    surfaces.push({ surface, calls: fake.calls })
    return surface
  }
  const document = createEmptyDocument()
  const textures = new NailTextureSet({
    factory,
    read: () => document,
    size: 64,
    // ทำงานทันทีแทน requestAnimationFrame เพื่อให้เทสเป็นซิงโครนัส
    schedule: (task) => task(),
  })
  return {
    textures,
    document,
    created: () => surfaces.length,
    surfaces,
    callsOf: (surface) => surfaces.find((entry) => entry.surface === surface)?.calls ?? [],
    addStroke: (key, value) => {
      const layer = document.nails[key].layers[0]!
      layer.strokes = [...layer.strokes, value]
    },
  }
}

/** นับจำนวนแต้มที่ถูกวาดจริง — ใช้พิสูจน์ว่าเส้นเก่าไม่ถูก replay ซ้ำ */
function fills(calls: DrawCall[]): number {
  return calls.filter((call) => call.op === 'fill').length
}

describe('การจองแคนวาส', () => {
  it('ไม่จองแคนวาสของเล็บจนกว่าจะบอกว่านิ้วไหนแสดงอยู่', () => {
    const { created } = harness()
    // wet + scratch เท่านั้น — เท็กซ์เจอร์ของมือที่ไม่ได้แสดงไม่มีใครอ่าน
    expect(created()).toBe(2)
  })

  it('จองเฉพาะนิ้วของมือที่แสดงอยู่ ไม่ใช่ทั้งสิบนิ้ว', () => {
    const { textures, created } = harness()
    textures.setVisibleNails(nailKeysOfHand('right'))
    expect(created()).toBe(2 + 5)
  })

  it('สลับมือแล้วคืนแคนวาสของมือเดิม ไม่สะสมเพิ่มไปเรื่อย ๆ', () => {
    const { textures, created } = harness()
    textures.setVisibleNails(nailKeysOfHand('right'))
    textures.setVisibleNails(nailKeysOfHand('left'))
    textures.setVisibleNails(nailKeysOfHand('right'))
    // แต่ละรอบสร้างเพิ่ม 5 ใบ แต่ของเดิมถูกปล่อยไปแล้ว จึงไม่ค้างพร้อมกัน
    expect(created()).toBe(2 + 5 + 5 + 5)
    expect(textures.composite('right.index')).toBeDefined()
  })
})

describe('การวาดเพิ่มทีละเส้น', () => {
  it('เส้นที่วาดไปแล้วไม่ถูกวาดซ้ำเมื่อมีเส้นใหม่ต่อท้าย', () => {
    // นี่คือทั้งหมดที่ทำให้การวาดเส้นที่ 50 เร็วเท่าเส้นแรก
    const { textures, addStroke, surfaces } = harness()
    textures.setVisibleNails(['right.index'])
    addStroke('right.index', stroke('#ff0000'))
    textures.rebuild('right.index')
    const layerSurface = surfaces.at(-1)!
    const afterFirst = fills(layerSurface.calls)
    expect(afterFirst).toBeGreaterThan(0)
    const boundary = layerSurface.calls.length

    addStroke('right.index', stroke('#00ff00'))
    textures.rebuild('right.index')

    const added = layerSurface.calls.slice(boundary)
    // วาดเพิ่มเท่ากับ "หนึ่งเส้น" พอดี ไม่ใช่วาดใหม่ทั้งสองเส้น
    expect(fills(added)).toBe(afterFirst)
    // และต้องไม่ล้างแคนวาสก่อน — การล้างคือสัญญาณว่ากำลัง replay ทั้งเลเยอร์
    expect(added.some((call) => call.op === 'clearRect')).toBe(false)
  })

  it('วาดใหม่ทั้งเลเยอร์เมื่อเส้นถูกแก้ไม่ใช่แค่ต่อท้าย', () => {
    const { textures, document, surfaces } = harness()
    textures.setVisibleNails(['right.index'])
    const layer = document.nails['right.index'].layers[0]!
    layer.strokes = [stroke('#ff0000'), stroke('#00ff00')]
    textures.rebuild('right.index')
    const layerSurface = surfaces.at(-1)!
    const before = layerSurface.calls.length

    // ลบเส้นแรกทิ้ง — ถ้าชั้นแคชคิดว่าเป็นการต่อท้ายจะเหลือภาพเก่าค้าง
    layer.strokes = [layer.strokes[1]!]
    textures.rebuild('right.index')
    const added = layerSurface.calls.slice(before)
    expect(added[0]?.op).toBe('clearRect')
  })

  it('เลเยอร์ที่ไม่มีเส้นเลยไม่จองแคนวาส', () => {
    const { textures, created } = harness()
    textures.setVisibleNails(['right.index'])
    const base = created()
    textures.rebuild('right.index')
    expect(created()).toBe(base)
  })
})

describe('เส้นสดระหว่างลากนิ้ว', () => {
  it('เริ่มเส้นซ้อนกันไม่ได้', () => {
    const { textures } = harness()
    textures.setVisibleNails(['right.index'])
    expect(textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)).toBe(true)
    expect(textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)).toBe(false)
  })

  it('เส้นสดปรากฏบนทุกนิ้วที่เลือกไว้พร้อมกัน', () => {
    const { textures, surfaces } = harness()
    const visible = nailKeysOfHand('right')
    textures.setVisibleNails(visible)
    const composites = new Map(visible.map((key, index) => [key, surfaces[2 + index]!]))
    const before = new Map([...composites].map(([key, entry]) => [key, entry.calls.length]))

    textures.beginStroke(['right.index', 'right.ring'], new Map([
      ['right.index', 0], ['right.ring', 0],
    ]), false)
    textures.paintDabs([{ x: 10, y: 10, r: 5, alpha: 1 }], '#ff0000', 0)

    expect(composites.get('right.index')!.calls.length).toBeGreaterThan(before.get('right.index')!)
    expect(composites.get('right.ring')!.calls.length).toBeGreaterThan(before.get('right.ring')!)
    expect(composites.get('right.middle')!.calls.length).toBe(before.get('right.middle')!)
  })

  it('composites the live preview at each target nail\'s mapped layer index', () => {
    const { textures, document, surfaces } = harness()
    const index = document.nails['right.index']
    const ring = document.nails['right.ring']
    document.nails['right.index'] = {
      ...index,
      layers: [
        { ...index.layers[0]!, opacity: 0.2 },
        { ...index.layers[0]!, id: 'index-top', name: 'Index top', opacity: 0.4 },
      ],
    }
    document.nails['right.ring'] = {
      ...ring,
      layers: [
        { ...ring.layers[0]!, opacity: 0.6 },
        { ...ring.layers[0]!, id: 'ring-top', name: 'Ring top', opacity: 0.8 },
      ],
    }
    textures.setVisibleNails(['right.index', 'right.ring'])
    const indexComposite = surfaces[2]!
    const ringComposite = surfaces[3]!
    const indexBefore = indexComposite.calls.length
    const ringBefore = ringComposite.calls.length

    textures.beginStroke(
      ['right.index', 'right.ring'],
      new Map([['right.index', 0], ['right.ring', 1]]),
      false,
    )
    textures.paintDabs([{ x: 10, y: 10, r: 5, alpha: 1 }], '#ff0000', 0)

    const previewAlpha = (calls: DrawCall[]) => calls
      .filter((call) => call.op === 'drawImage')
      .map((call) => call.alpha)
    expect(previewAlpha(indexComposite.calls.slice(indexBefore))).toEqual([0.2])
    expect(previewAlpha(ringComposite.calls.slice(ringBefore))).toEqual([0.8])
  })

  it('จบเส้นแล้วแคนวาสเส้นสดถูกล้าง ไม่ค้างไปปนกับเส้นถัดไป (TD-5)', () => {
    const { textures, surfaces } = harness()
    textures.setVisibleNails(['right.index'])
    const wet = surfaces[0]!
    textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)
    textures.paintDabs([{ x: 10, y: 10, r: 5, alpha: 1 }], '#ff0000', 0)
    const before = wet.calls.filter((call) => call.op === 'clearRect').length
    textures.endStroke()
    expect(wet.calls.filter((call) => call.op === 'clearRect').length).toBeGreaterThan(before)
    expect(textures.isPainting()).toBe(false)
  })

  it('จบเส้นซ้ำไม่ทำให้พัง — การยกเลิกกับการปล่อยนิ้วอาจมาพร้อมกัน', () => {
    const { textures } = harness()
    textures.setVisibleNails(['right.index'])
    textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)
    textures.endStroke()
    expect(() => textures.endStroke()).not.toThrow()
  })

  it('โหมดหนึ่งปิดเส้นของอีกโหมดไม่ได้', () => {
    // แผงวาดแบน (2d) กับการวาดบนโมเดล (3d) ใช้แคนวาสเส้นสดใบเดียวกัน
    // ถ้าปิดข้ามเจ้าของได้ การปล่อยนิ้วในโหมดหนึ่งจะไปตัดเส้นที่อีกโหมดกำลังลากอยู่ทิ้ง
    const { textures } = harness()
    textures.setVisibleNails(['right.index'])
    textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false, '2d')
    expect(textures.strokeOwner()).toBe('2d')

    textures.endStroke('3d')
    expect(textures.isPainting()).toBe(true)

    textures.endStroke('2d')
    expect(textures.isPainting()).toBe(false)
    expect(textures.strokeOwner()).toBeNull()
  })

  it('เส้นที่ค้างสถานะไว้ถูกกู้คืนได้ ไม่ล็อกจนวาดต่อไม่ได้ถาวร', () => {
    // จำลองกรณีที่ pointerdown ไม่มี pointerup ตามมา (แท็บถูกปิด, element ถูกถอด)
    // ถ้าไม่มีทางกู้ ผู้ใช้จะวาดไม่ได้อีกเลยจนกว่าจะรีโหลด โดยไม่มีข้อความบอกสาเหตุ
    const { textures } = harness()
    textures.setVisibleNails(['right.index'])
    textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)
    expect(textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)).toBe(false)

    textures.endStroke()
    expect(textures.isPainting()).toBe(false)
    expect(textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)).toBe(true)
  })

  it('รวบการวาดหลายครั้งในเฟรมเดียวให้เหลือการประกอบภาพรอบเดียว', () => {
    const pending: Array<() => void> = []
    const surfaces: Array<{ surface: Surface; calls: DrawCall[] }> = []
    const document = createEmptyDocument()
    const textures = new NailTextureSet({
      factory: () => {
        const fake = createFakeCanvas()
        const surface: Surface = { canvas: {} as CanvasImageSource, ctx: fake.ctx }
        surfaces.push({ surface, calls: fake.calls })
        return surface
      },
      read: () => document,
      size: 64,
      schedule: (task) => pending.push(task),
    })
    textures.setVisibleNails(['right.index'])
    const wet = surfaces[0]!
    const composite = surfaces[2]!
    const before = composite.calls.length

    textures.beginStroke(['right.index'], new Map([['right.index', 0]]), false)
    for (let index = 0; index < 20; index += 1) {
      textures.paintDabs([{ x: index, y: index, r: 4, alpha: 1 }], '#ff0000', 0)
    }
    expect(wet.calls.some((call) => call.op === 'fill')).toBe(true)
    // pointermove ยิงถี่กว่าเฟรม — ต้องเหลืองานประกอบภาพรอบเดียวเท่านั้น
    expect(pending).toHaveLength(1)
    expect(composite.calls.length).toBe(before)
    pending[0]!()
    expect(composite.calls.length).toBeGreaterThan(before)
  })
})

describe('การคืนทรัพยากร', () => {
  it('dispose แล้วไม่วาดอะไรอีก', async () => {
    const { textures, surfaces } = harness()
    textures.setVisibleNails(['right.index'])
    const composite = surfaces[2]!
    textures.dispose()
    await Promise.resolve()
    const before = composite.calls.length
    textures.rebuild('right.index')
    expect(composite.calls.length).toBe(before)
  })
})
