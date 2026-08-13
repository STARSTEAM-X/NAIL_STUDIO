import { describe, expect, it } from 'vitest'
import { strokeSchema, type Point } from '@nail-studio/contracts'
import {
  BRUSH_PRESETS,
  pathToDabs,
  presetOf,
  pressureToRadius,
  settingsToDabs,
  settingsToStroke,
  strokeToDabs,
} from './brush.ts'
import { DEFAULT_PAINT_SETTINGS, type PaintSettings } from './paintSettings.ts'

const SETTINGS: PaintSettings = { ...DEFAULT_PAINT_SETTINGS, size: 100, softness: 0.3 }

function horizontal(count: number): Point[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index / (count - 1),
    y: 0.5,
    p: 0.5,
  }))
}

describe('pressureToRadius', () => {
  it('แตะเบาสุดยังได้รัศมีขั้นต่ำ ไม่ใช่ศูนย์', () => {
    expect(pressureToRadius(100, 0, 0.35)).toBeCloseTo(17.5)
  })

  it('กดเต็มแรงได้รัศมีเต็มครึ่งหนึ่งของขนาดแปรง', () => {
    expect(pressureToRadius(100, 1, 0.35)).toBeCloseTo(50)
  })

  it('แรงกดนอกช่วงถูกบีบ ไม่ทำให้รัศมีติดลบหรือระเบิด', () => {
    expect(pressureToRadius(100, -5)).toBeCloseTo(17.5)
    expect(pressureToRadius(100, 9)).toBeCloseTo(50)
  })
})

describe('pathToDabs', () => {
  it('เส้นว่างไม่ได้แต้มเลย', () => {
    expect(pathToDabs([], 100, 1, 0.25)).toEqual([])
  })

  it('จุดเดียวได้หนึ่งแต้ม', () => {
    expect(pathToDabs([{ x: 0.5, y: 0.5, p: 1 }], 100, 1, 0.25)).toHaveLength(1)
  })

  it('แต้มเรียงห่างเท่ากันตลอดเส้น แม้จุดที่บันทึกมาจะถี่ไม่เท่ากัน', () => {
    // carry คือสิ่งที่ทำให้ข้อนี้ผ่าน ถ้าเริ่มนับระยะใหม่ทุกช่วง จะเห็นเป็นปุ่มสีเข้ม
    // ตรงทุกจุดที่อุปกรณ์บันทึกไว้ ซึ่งเป็นข้อบกพร่องที่มองเห็นได้ด้วยตา
    const dabs = pathToDabs(horizontal(9), 100, 1, 0.25, 1024)
    const gaps: number[] = []
    for (let index = 1; index < dabs.length; index += 1) {
      gaps.push(dabs[index]!.x - dabs[index - 1]!.x)
    }
    for (const gap of gaps) expect(gap).toBeCloseTo(25, 6)
  })

  it('จุดที่ทับกันสนิทไม่ทำให้วนไม่รู้จบ', () => {
    const same: Point[] = Array.from({ length: 50 }, () => ({ x: 0.5, y: 0.5, p: 1 }))
    expect(pathToDabs(same, 100, 1, 0.25)).toHaveLength(1)
  })

  it('ขนาดแปรงเล็กมากยังจบการทำงาน (ระยะก้าวมีเพดานล่าง)', () => {
    // ถ้าไม่มี MIN_STEP_PX ลูปจะเดินครั้งละ 0 พิกเซลแล้วค้างทั้งแท็บ
    const dabs = pathToDabs(horizontal(2), 0, 1, 0, 1024)
    expect(dabs.length).toBeGreaterThan(0)
    expect(Number.isFinite(dabs.length)).toBe(true)
  })

  it('รัศมีไล่ตามแรงกดระหว่างจุด', () => {
    const dabs = pathToDabs(
      [{ x: 0, y: 0.5, p: 0 }, { x: 1, y: 0.5, p: 1 }],
      100, 1, 0.25, 1024, 0.35,
    )
    expect(dabs.at(-1)!.r).toBeGreaterThan(dabs[0]!.r)
  })
})

describe('settingsToDabs / strokeToDabs', () => {
  it('ยางลบใช้ความทึบเต็มเสมอ ไม่ว่าผู้ใช้ตั้ง opacity ไว้เท่าไร', () => {
    const erase = settingsToDabs(horizontal(3), { ...SETTINGS, tool: 'erase', opacity: 0.2 })
    for (const dab of erase) expect(dab.alpha).toBe(1)
  })

  it('พรีวิวตอนลากกับ replay ตอนบันทึกได้แต้มชุดเดียวกันทุกประการ', () => {
    // ถ้าสองทางนี้หลุดจากกัน เส้นจะเปลี่ยนรูปตอนปล่อยนิ้ว — บั๊กที่ผู้ใช้เห็นชัดที่สุด
    const points = horizontal(12)
    for (const tool of ['brush', 'erase'] as const) {
      const settings = { ...SETTINGS, tool }
      const preview = settingsToDabs(points, settings)
      const replay = strokeToDabs(settingsToStroke(settings, points))
      expect(replay).toEqual(preview)
    }
  })

  it('เส้นเทสีทั้งเล็บไม่มีแต้ม', () => {
    expect(strokeToDabs({ kind: 'fill', color: '#ffffff' })).toEqual([])
  })
})

describe('settingsToStroke', () => {
  it('เส้นที่สร้างออกมาผ่าน schema ของเอกสารงานเสมอ', () => {
    for (const tool of ['brush', 'erase'] as const) {
      const stroke = settingsToStroke({ ...SETTINGS, tool }, horizontal(4))
      expect(() => strokeSchema.parse(stroke)).not.toThrow()
    }
  })

  it('ยางลบเก็บชนิดหัวแปรงไว้ด้วย', () => {
    // ไม่เก็บ = ตอน replay จะถอยไปใช้หัว round แล้วรอยลบเปลี่ยนรูปหลังเปิดงานใหม่
    const stroke = settingsToStroke({ ...SETTINGS, tool: 'erase', brush: 'liner' }, horizontal(3))
    expect(stroke.kind === 'erase' && stroke.brush).toBe('liner')
  })

  it('คัดลอกค่าเครื่องมือลงในตัวเส้น ไม่ได้อ้างถึงค่าปัจจุบันภายหลัง', () => {
    const settings = { ...SETTINGS, color: '#123456' }
    const stroke = settingsToStroke(settings, horizontal(3))
    settings.color = '#ffffff'
    expect(stroke.kind === 'brush' && stroke.color).toBe('#123456')
  })
})

describe('presetOf', () => {
  it('ทุกหัวแปรงที่ contracts ประกาศไว้มีค่าตั้งต้นครบ', () => {
    for (const brush of Object.keys(BRUSH_PRESETS)) {
      expect(BRUSH_PRESETS[brush as keyof typeof BRUSH_PRESETS].spacing).toBeGreaterThan(0)
    }
  })

  it('หัวแปรงที่ไม่รู้จักถอยไปใช้ round แทนที่จะพัง', () => {
    expect(presetOf(undefined)).toBe(BRUSH_PRESETS.round)
  })
})
