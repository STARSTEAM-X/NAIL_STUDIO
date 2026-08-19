import { describe, expect, it } from 'vitest'
import { tooltipPlacement, type AnchorRect } from './tooltipPlacement.ts'

const viewport = { width: 1000, height: 800 }

function rect(overrides: Partial<AnchorRect> = {}): AnchorRect {
  return { top: 100, bottom: 130, left: 400, right: 440, width: 40, height: 30, ...overrides }
}

describe('tooltipPlacement', () => {
  it('centres under the anchor by default', () => {
    expect(tooltipPlacement(rect(), 'bottom', viewport)).toEqual({ side: 'bottom', x: 420, y: 136 })
  })

  it('flips above when the anchor sits too close to the bottom of the screen', () => {
    const placement = tooltipPlacement(rect({ top: 770, bottom: 795 }), 'bottom', viewport)
    expect(placement.side).toBe('top')
    expect(placement.y).toBe(764)
  })

  it('keeps an explicit side even near the bottom, since that side was chosen for space reasons', () => {
    // แถบเครื่องมือแนวตั้งเลือก right ไว้เพราะแคบเกินกว่าจะวางข้างใต้ได้
    expect(tooltipPlacement(rect({ top: 770, bottom: 795 }), 'right', viewport).side).toBe('right')
  })

  it('leaves a bubble alone when its centre still clears the right edge', () => {
    // จุดกึ่งกลาง 990 ยังไม่เกินขอบกันชนที่ 992 จึงไม่ต้องดึงกลับ
    expect(tooltipPlacement(rect({ left: 980, right: 1000, width: 20 }), 'bottom', viewport).x).toBe(990)
  })

  it('pulls the bubble back when its centre would fall past the right edge', () => {
    const placement = tooltipPlacement(rect({ left: 990, right: 1010, width: 20 }), 'bottom', viewport)
    expect(placement.x).toBe(viewport.width - 8)
  })

  it('pulls the bubble back from the left edge', () => {
    const placement = tooltipPlacement(rect({ left: -10, right: 5, width: 15 }), 'bottom', viewport)
    expect(placement.x).toBe(8)
  })

  it('places a right-side bubble past the anchor and vertically centred', () => {
    expect(tooltipPlacement(rect(), 'right', viewport)).toEqual({ side: 'right', x: 446, y: 115 })
  })

  it('places a left-side bubble before the anchor', () => {
    expect(tooltipPlacement(rect(), 'left', viewport)).toEqual({ side: 'left', x: 394, y: 115 })
  })

  it('never returns a position above the top edge', () => {
    expect(tooltipPlacement(rect({ top: 2, bottom: 20 }), 'top', viewport).y).toBe(8)
  })
})
