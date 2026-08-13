import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import type { NailKey } from '@nail-studio/contracts'
import { pickNail, pointerToNdc, type Hit } from './picking.ts'

const RECT = { left: 100, top: 50, width: 400, height: 200 }

describe('pointerToNdc', () => {
  it('กลางพื้นที่คือจุดกำเนิด', () => {
    expect(pointerToNdc(300, 150, RECT)).toEqual({ x: 0, y: 0 })
  })

  it('มุมซ้ายบนคือ (-1, 1) — แกน y ของกล้องชี้ขึ้น ส่วนของหน้าจอชี้ลง', () => {
    expect(pointerToNdc(100, 50, RECT)).toEqual({ x: -1, y: 1 })
  })

  it('มุมขวาล่างคือ (1, -1)', () => {
    expect(pointerToNdc(500, 250, RECT)).toEqual({ x: 1, y: -1 })
  })

  it('พื้นที่กว้างศูนย์ไม่ทำให้ได้ค่าที่หารด้วยศูนย์', () => {
    const ndc = pointerToNdc(10, 10, { left: 0, top: 0, width: 0, height: 0 })
    expect(Number.isFinite(ndc.x)).toBe(true)
    expect(Number.isFinite(ndc.y)).toBe(true)
  })
})

describe('pickNail', () => {
  const nail = new Object3D()
  const otherNail = new Object3D()
  const finger = new Object3D()
  const nailOf = new Map<Object3D, NailKey>([
    [nail, 'right.index'],
    [otherNail, 'right.middle'],
  ])

  const hit = (object: Object3D, u = 0.5, v = 0.5): Hit => ({ object, uv: { x: u, y: v } })

  it('ชนเล็บโดยตรงได้คีย์และตำแหน่งบนผิวเล็บ', () => {
    expect(pickNail([hit(nail, 0.25, 0.75)], nailOf, 0.8)).toEqual({
      key: 'right.index',
      point: { x: 0.25, y: 0.75, p: 0.8 },
    })
  })

  it('ไม่ชนอะไรเลยคืนค่าว่าง', () => {
    expect(pickNail([], nailOf, 0.5)).toBeNull()
  })

  it('นิ้วที่บังอยู่บังจริง — ไม่ไล่หาเล็บที่อยู่ถัดไปในรายการ', () => {
    // ถ้าข้อนี้พัง สีจะไปลงเล็บที่อยู่หลังฝ่ามือซึ่งผู้ใช้มองไม่เห็น
    expect(pickNail([hit(finger), hit(nail)], nailOf, 0.5)).toBeNull()
  })

  it('เลือกเล็บที่อยู่หน้าสุดเมื่อเล็บซ้อนกัน', () => {
    expect(pickNail([hit(otherNail), hit(nail)], nailOf, 0.5)?.key).toBe('right.middle')
  })

  it('ชนเล็บแต่ไม่มีพิกัดผิวถือว่าเล็งไม่ได้', () => {
    // mesh ที่ไม่มี uv วาดไม่ได้ ต้องเงียบ ไม่ใช่เดาตำแหน่งให้
    expect(pickNail([{ object: nail }], nailOf, 0.5)).toBeNull()
  })

  it('พิกัดที่หลุดขอบไปไกลถือว่าเล็งไม่ได้', () => {
    expect(pickNail([hit(nail, 5, 0.5)], nailOf, 0.5)).toBeNull()
  })
})
