import { describe, expect, it } from 'vitest'
import type { Layer } from '@nail-studio/contracts'
import { blendToOp, compositeLayers, type LayerSource } from './layers.ts'
import { createFakeCanvas } from './fakeCanvas.ts'

function layer(overrides: Partial<Layer> & { id: string }): Layer {
  return {
    name: overrides.id, visible: true, opacity: 1, blend: 'normal', strokes: [],
    ...overrides,
  }
}

function source(overrides: Partial<Layer> & { id: string }): LayerSource {
  return { layer: layer(overrides), canvas: { id: overrides.id } as unknown as CanvasImageSource }
}

describe('blendToOp', () => {
  it('แปลงโหมดผสมทุกแบบที่ contracts อนุญาต', () => {
    expect(blendToOp('normal')).toBe('source-over')
    expect(blendToOp('multiply')).toBe('multiply')
    expect(blendToOp('screen')).toBe('screen')
  })
})

describe('compositeLayers', () => {
  it('ล้างแล้วรองพื้นก่อนวาดเลเยอร์ ผลลัพธ์จึงทึบพอส่งเข้าเท็กซ์เจอร์ตรง ๆ', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [source({ id: 'a' })], 256, '#ffffff')
    expect(fake.calls[0]?.op).toBe('clearRect')
    expect(fake.calls[1]?.op).toBe('fillRect')
    expect(fake.calls[1]?.fillStyle).toBe('#ffffff')
    expect(fake.calls[2]?.op).toBe('drawImage')
  })

  it('ไม่รองพื้นเมื่อไม่ได้ระบุสีพื้น', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [source({ id: 'a' })], 256)
    expect(fake.calls.some((call) => call.op === 'fillRect')).toBe(false)
  })

  it('วาดเลเยอร์ตามลำดับในอาร์เรย์ — ตัวหลังอยู่บนตัวหน้า', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [source({ id: 'a' }), source({ id: 'b' })], 256)
    const drawn = fake.calls.filter((call) => call.op === 'drawImage')
    expect(drawn.map((call) => (call.args[0] as { id: string }).id)).toEqual(['a', 'b'])
  })

  it('ข้ามเลเยอร์ที่ซ่อนหรือความทึบศูนย์ ไม่ใช่วาดแล้วมองไม่เห็น', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [
      source({ id: 'hidden', visible: false }),
      source({ id: 'clear', opacity: 0 }),
      source({ id: 'shown' }),
    ], 256)
    const drawn = fake.calls.filter((call) => call.op === 'drawImage')
    expect(drawn.map((call) => (call.args[0] as { id: string }).id)).toEqual(['shown'])
  })

  it('ใช้ความทึบและโหมดผสมของแต่ละเลเยอร์', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [source({ id: 'a', opacity: 0.4, blend: 'multiply' })], 256)
    const call = fake.calls.find((entry) => entry.op === 'drawImage')
    expect(call?.alpha).toBeCloseTo(0.4)
    expect(call?.composite).toBe('multiply')
  })

  it('คืนสถานะแคนวาสเป็นค่าปกติเมื่อจบ ไม่ให้รั่วไปงานถัดไป', () => {
    const fake = createFakeCanvas()
    compositeLayers(fake.ctx, [source({ id: 'a', opacity: 0.2, blend: 'screen' })], 256)
    expect(fake.ctx.globalAlpha).toBe(1)
    expect(fake.ctx.globalCompositeOperation).toBe('source-over')
  })
})
