import { describe, expect, it } from 'vitest'
import { fitToPanel, panelToTexture, textureToPanel, triangleStretch, type FlatTriangle } from './flatTriangles.ts'

/** แผ่นสี่เหลี่ยมกว้าง 1 สูง 2 (ปลายเล็บ y น้อย) UV เต็มผืน — แบบเดียวกับ nailFlatten.test.ts */
function plate() {
  const flatX = [-0.5, 0.5, 0.5, -0.5]
  const flatY = [-1, -1, 1, 1]
  // จุดที่ y = −1 คือปลายเล็บ → v = 0
  const uv = [0, 0, 1, 0, 1, 1, 0, 1]
  return fitToPanel(flatX, flatY, uv, [0, 1, 2, 0, 2, 3], 512, 1024)
}

const triangle = (screen: number[], tex: number[]): FlatTriangle => ({
  screen: screen as unknown as FlatTriangle['screen'],
  tex: tex as unknown as FlatTriangle['tex'],
})

describe('fitToPanel', () => {
  it('คงสัดส่วนและบอกสเกลพิกเซลต่อหน่วย', () => {
    const flat = plate()
    expect(flat.bounds.height / flat.bounds.width).toBeCloseTo(2, 6)
    expect(flat.scale * 2).toBeCloseTo(flat.bounds.height, 6)
    expect(flat.texSize).toBe(1024)
  })
})

describe('textureToPanel', () => {
  it('ไปกลับกับ panelToTexture ได้จุดเดิม', () => {
    const flat = plate()
    for (const [u, v] of [[0.5, 0.5], [0.1, 0.9], [0.8, 0.05], [0.33, 0.66]] as const) {
      const panel = textureToPanel(flat, u, v)!
      expect(panel).not.toBeNull()
      const back = panelToTexture(flat, panel.x, panel.y)!
      expect(Math.abs(back.u / 1024 - u)).toBeLessThan(1e-6)
      expect(Math.abs(1 - back.v / 1024 - v)).toBeLessThan(1e-6)
    }
  })

  it('ปลายเล็บ (v = 0) อยู่ด้านบนของแผง', () => {
    const flat = plate()
    expect(textureToPanel(flat, 0.5, 0.02)!.y).toBeLessThan(textureToPanel(flat, 0.5, 0.98)!.y)
  })

  it('นอกเล็บได้ null ทั้งสองทาง', () => {
    const flat = fitToPanel([0, 1, 0], [0, 0, 1], [0, 0, 1, 0, 0, 1], null, 100, 100)
    expect(textureToPanel(flat, 0.9, 0.9)).toBeNull()
    expect(panelToTexture(flat, 1, 1)).toBeNull()
  })
})

describe('triangleStretch', () => {
  it('ยืดตามแนว v สองเท่า → 2 ตามแนวยาว', () => {
    const result = triangleStretch(triangle([0, 0, 10, 0, 0, 20], [0, 0, 10, 0, 0, 10]))!
    expect(result.stretch).toBeCloseTo(2, 6)
    expect(result.direction).toBe('along')
  })

  it('ยืดตามแนว u → ตามแนวขวาง', () => {
    const result = triangleStretch(triangle([0, 0, 30, 0, 0, 10], [0, 0, 10, 0, 0, 10]))!
    expect(result.stretch).toBeCloseTo(3, 6)
    expect(result.direction).toBe('across')
  })

  it('หมุนอย่างเดียวไม่ยืด', () => {
    const c = Math.cos(0.7) * 10
    const s = Math.sin(0.7) * 10
    expect(triangleStretch(triangle([0, 0, c, s, -s, c], [0, 0, 10, 0, 0, 10]))!.stretch).toBeCloseTo(1, 6)
  })

  it('สามเหลี่ยมแบนคืน null', () => {
    expect(triangleStretch(triangle([0, 0, 1, 1, 2, 2], [0, 0, 1, 1, 2, 2]))).toBeNull()
  })
})
