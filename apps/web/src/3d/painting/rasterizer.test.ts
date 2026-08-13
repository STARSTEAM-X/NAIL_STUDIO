import { describe, expect, it } from 'vitest'
import type { Point } from '@nail-studio/contracts'
import { createFakeCanvas } from './fakeCanvas.ts'
import { drawDabs, hexToRgba, renderLayer, renderStroke } from './rasterizer.ts'
import type { Dab } from './brush.ts'

function dabs(count: number): Dab[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index * 10, y: 20, r: 8, alpha: 1,
  }))
}

const POINTS: Point[] = [
  { x: 0.2, y: 0.5, p: 0.6 },
  { x: 0.8, y: 0.5, p: 0.6 },
]

describe('hexToRgba', () => {
  it('อ่านรูปแบบ 6 หลักและ 3 หลัก', () => {
    expect(hexToRgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)')
    expect(hexToRgba('#f80', 1)).toBe('rgba(255, 136, 0, 1)')
  })

  it('ค่าที่อ่านไม่ออกถูกส่งต่อให้แคนวาสตัดสินเอง ไม่ใช่โยนข้อผิดพลาด', () => {
    // สีมาจากเอกสารงานที่ผ่าน schema แล้ว แต่การทำให้ทั้งเล็บหายไปเพราะสีเดียว
    // เพี้ยนคือความเสียหายที่หนักกว่าการวาดสีผิด
    expect(hexToRgba('rebeccapurple', 1)).toBe('rebeccapurple')
  })
})

describe('drawDabs', () => {
  it('ไม่ทำอะไรเลยเมื่อไม่มีแต้ม', () => {
    const fake = createFakeCanvas()
    drawDabs(fake.ctx, [], '#ffffff', 0.5)
    expect(fake.calls).toHaveLength(0)
  })

  it('ขอบคมวาดเป็นวงกลมทึบ ไม่สร้าง gradient เลย', () => {
    const fake = createFakeCanvas()
    drawDabs(fake.ctx, dabs(5), '#ffffff', 0)
    expect(fake.gradients).toBe(0)
    expect(fake.calls.filter((call) => call.op === 'fill')).toHaveLength(5)
  })

  it('ขอบฟุ้งสร้าง gradient ครั้งเดียวต่อเส้น ไม่ใช่ครั้งเดียวต่อแต้ม', () => {
    // นี่คือเหตุผลทั้งหมดที่ drawDabs รับทั้งเส้น แทนที่จะเรียก drawDab ทีละแต้ม
    // เล็บที่ลงสีหนักมีหลายหมื่นแต้มต่อการ replay หนึ่งรอบ
    const fake = createFakeCanvas()
    drawDabs(fake.ctx, dabs(500), '#ffffff', 0.6)
    expect(fake.gradients).toBe(1)
    expect(fake.calls.filter((call) => call.op === 'fill')).toHaveLength(500)
  })

  it('คืนสถานะแคนวาสหลังวาดเสร็จ', () => {
    const fake = createFakeCanvas()
    fake.ctx.globalAlpha = 0.3
    drawDabs(fake.ctx, dabs(3), '#ffffff', 0.6)
    expect(fake.ctx.globalAlpha).toBe(0.3)
  })
})

describe('renderStroke', () => {
  it('เทสีทั้งเล็บเต็มพื้นที่เท็กซ์เจอร์ด้วยความทึบเต็ม', () => {
    const fake = createFakeCanvas()
    renderStroke(fake.ctx, { kind: 'fill', color: '#112233' }, 512)
    const call = fake.calls.find((entry) => entry.op === 'fillRect')
    expect(call?.args).toEqual([0, 0, 512, 512])
    expect(call?.alpha).toBe(1)
    expect(call?.fillStyle).toBe('#112233')
  })

  it('ยางลบวาดด้วย destination-out', () => {
    const fake = createFakeCanvas()
    renderStroke(fake.ctx, { kind: 'erase', brush: 'round', size: 60, softness: 0, points: POINTS })
    const fills = fake.calls.filter((call) => call.op === 'fill')
    expect(fills.length).toBeGreaterThan(0)
    for (const call of fills) expect(call.composite).toBe('destination-out')
  })

  it('แปรงวาดด้วย source-over และคืนสถานะเดิมหลังวาด', () => {
    const fake = createFakeCanvas()
    renderStroke(fake.ctx, {
      kind: 'brush', brush: 'round', color: '#ff0000',
      size: 60, opacity: 1, softness: 0, points: POINTS,
    })
    const fills = fake.calls.filter((call) => call.op === 'fill')
    for (const call of fills) expect(call.composite).toBe('source-over')
    expect(fake.ctx.globalCompositeOperation).toBe('source-over')
  })
})

describe('renderLayer', () => {
  it('ล้างแคนวาสก่อนเสมอ แล้ววาดเส้นตามลำดับที่บันทึกไว้', () => {
    const fake = createFakeCanvas()
    renderLayer(fake.ctx, {
      id: 'layer-1', name: 'เลเยอร์ 1', visible: true, opacity: 1, blend: 'normal',
      strokes: [
        { kind: 'fill', color: '#000000' },
        { kind: 'fill', color: '#ffffff' },
      ],
    }, 256)
    expect(fake.calls[0]?.op).toBe('clearRect')
    const fills = fake.calls.filter((call) => call.op === 'fillRect')
    expect(fills.map((call) => call.fillStyle)).toEqual(['#000000', '#ffffff'])
  })

  it('เลเยอร์ว่างยังต้องล้างแคนวาส ไม่ใช่ปล่อยของเก่าค้าง', () => {
    const fake = createFakeCanvas()
    renderLayer(fake.ctx, {
      id: 'layer-1', name: 'เลเยอร์ 1', visible: true, opacity: 1, blend: 'normal', strokes: [],
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]?.op).toBe('clearRect')
  })
})
