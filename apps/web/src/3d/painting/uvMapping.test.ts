import { describe, expect, it } from 'vitest'
import { pointSchema } from '@nail-studio/contracts'
import { clampUv, isInsideUv, pixelToUv, toPaintPoint, uvToPixel } from './uvMapping.ts'
import { TEX_SIZE, UV_MARGIN } from './constants.ts'

describe('uvToPixel / pixelToUv', () => {
  it('กลับด้านแกน v เพราะแคนวาสนับ y จากบนลงล่าง', () => {
    expect(uvToPixel(0, 1, 100)).toEqual({ x: 0, y: 0 })
    expect(uvToPixel(1, 0, 100)).toEqual({ x: 100, y: 100 })
  })

  it('แปลงไปกลับแล้วได้ค่าเดิม', () => {
    const pixel = uvToPixel(0.3, 0.7, TEX_SIZE)
    const round = pixelToUv(pixel.x, pixel.y, TEX_SIZE)
    expect(round.u).toBeCloseTo(0.3, 10)
    expect(round.v).toBeCloseTo(0.7, 10)
  })

  it('ไม่หารด้วยศูนย์เมื่อขนาดเป็นศูนย์', () => {
    expect(Number.isFinite(pixelToUv(5, 5, 0).u)).toBe(true)
  })
})

describe('toPaintPoint', () => {
  it('จุดในกรอบผ่านตรง ๆ', () => {
    expect(toPaintPoint(0.5, 0.25, 0.8)).toEqual({ x: 0.5, y: 0.25, p: 0.8 })
  })

  it('จุดที่เลยกรอบเล็กน้อยถูกบีบเข้าขอบ ไม่ใช่ทิ้ง', () => {
    // ลากไปสุดขอบเล็บต้องได้สีถึงขอบ ถ้าทิ้งจุดนี้เส้นจะขาดก่อนถึงขอบทุกครั้ง
    expect(toPaintPoint(1.05, -0.05, 0.5)).toEqual({ x: 1, y: 0, p: 0.5 })
  })

  it('จุดที่หลุดไกลเกิน margin ถูกทิ้ง', () => {
    expect(toPaintPoint(1 + UV_MARGIN + 0.01, 0.5, 0.5)).toBeNull()
    expect(toPaintPoint(0.5, -UV_MARGIN - 0.01, 0.5)).toBeNull()
  })

  it('ค่าที่ไม่ใช่ตัวเลขถูกทิ้ง', () => {
    expect(toPaintPoint(Number.NaN, 0.5, 0.5)).toBeNull()
    expect(toPaintPoint(0.5, Number.POSITIVE_INFINITY, 0.5)).toBeNull()
  })

  it('แรงกดที่ไม่ถูกต้องถูกแทนด้วยค่ากลาง และแรงกดเกินสเกลถูกบีบ', () => {
    // pointerdown ของเมาส์รายงาน pressure = 0 ซึ่งจะทำให้แปรงเล็กผิดปกติ
    expect(toPaintPoint(0.5, 0.5, Number.NaN)?.p).toBe(0.5)
    // schema ฝั่ง contracts บังคับ 0–1 ถ้าไม่บีบตรงนี้เอกสารจะถูกปฏิเสธตอนบันทึก
    expect(toPaintPoint(0.5, 0.5, 3)?.p).toBe(1)
  })

  it('จุดที่ผ่านประตูนี้ต้องผ่าน schema ของเอกสารงานเสมอ', () => {
    for (const [u, v, p] of [[1.2, -0.2, 5], [0, 1, 0], [0.5, 0.5, 0.3]] as const) {
      const point = toPaintPoint(u, v, p)
      if (point) expect(() => pointSchema.parse(point)).not.toThrow()
    }
  })
})

describe('clampUv / isInsideUv', () => {
  it('บีบค่าเข้ากรอบ 0–1', () => {
    expect(clampUv(-3, 4)).toEqual({ u: 0, v: 1 })
  })

  it('ค่าที่ไม่ใช่ตัวเลขไม่ถือว่าอยู่ในกรอบ', () => {
    expect(isInsideUv(Number.NaN, 0.5)).toBe(false)
    expect(isInsideUv(0.5, 0.5)).toBe(true)
  })
})
